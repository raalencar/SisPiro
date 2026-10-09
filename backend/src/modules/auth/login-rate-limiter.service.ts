import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
  blockedUntil?: number;
}

@Injectable()
export class LoginRateLimiterService {
  private readonly records = new Map<string, RateLimitRecord>();
  private readonly defaultAccountMaxAttempts = 5;
  private readonly defaultIpMaxAttempts = 25;
  private readonly defaultLoopbackMaxAttempts = 100;
  private readonly defaultWindowMs = 15 * 60 * 1000; // 15 minutos
  private readonly defaultBlockMs = 15 * 60 * 1000; // 15 minutos de bloqueio temporário

  constructor() {
    // Limpeza periódica preventiva contra vazamento de memória
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  private getMaxAttemptsForKey(key: string, overrideMax?: number): number {
    if (overrideMax) return overrideMax;
    if (key.startsWith('ip:')) {
      if (
        key.includes('127.0.0.1') ||
        key.includes('::1') ||
        key.includes('::ffff:127.0.0.1')
      ) {
        return this.defaultLoopbackMaxAttempts;
      }
      return this.defaultIpMaxAttempts;
    }
    return this.defaultAccountMaxAttempts;
  }

  assertNotRateLimited(
    keys: string[],
    maxAttempts?: number,
  ): void {
    const now = Date.now();
    for (const key of keys) {
      if (!key) continue;
      const record = this.records.get(key);
      if (!record) continue;

      const threshold = this.getMaxAttemptsForKey(key, maxAttempts);

      if (record.blockedUntil && record.blockedUntil > now) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Muitas tentativas de autenticação. Acesso temporariamente bloqueado. Tente novamente mais tarde.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (record.resetAt > now && record.attempts >= threshold) {
        record.blockedUntil = now + this.defaultBlockMs;
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Muitas tentativas de autenticação. Acesso temporariamente bloqueado. Tente novamente mais tarde.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailure(
    keys: string[],
    windowMs = this.defaultWindowMs,
    maxAttempts?: number,
  ): void {
    const now = Date.now();
    for (const key of keys) {
      if (!key) continue;
      const threshold = this.getMaxAttemptsForKey(key, maxAttempts);
      const record = this.records.get(key);
      if (!record || record.resetAt <= now) {
        this.records.set(key, {
          attempts: 1,
          resetAt: now + windowMs,
        });
      } else {
        record.attempts += 1;
        if (record.attempts >= threshold) {
          record.blockedUntil = now + this.defaultBlockMs;
        }
      }
    }
  }

  recordSuccess(keys: string[]): void {
    for (const key of keys) {
      if (!key) continue;
      this.records.delete(key);
    }
  }

  clearAll(): void {
    this.records.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (
        record.resetAt <= now &&
        (!record.blockedUntil || record.blockedUntil <= now)
      ) {
        this.records.delete(key);
      }
    }
  }
}
