import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis.provider.js';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
  blockedUntil?: number;
}

// Checa o bloqueio e já incrementa a tentativa atomicamente em uma única
// operação no Redis (EVAL executa o script sem intercalar outros comandos).
// Isso elimina a janela de corrida que existiria se "checar" e "incrementar"
// fossem comandos Redis separados com uma operação assíncrona do chamador
// (consulta ao banco, verificação de senha) entre eles: chamadas concorrentes
// para a mesma chave são serializadas pelo Redis e recebem incrementos
// distintos, em vez de todas lerem a mesma contagem desatualizada.
//
// KEYS[1] = chave de bloqueio, KEYS[2] = chave de tentativas
// ARGV[1] = janela em ms, ARGV[2] = limite de tentativas, ARGV[3] = duração do bloqueio em ms
const CHECK_AND_INCREMENT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return -1
end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  redis.call('PEXPIRE', KEYS[2], ARGV[1])
end
if attempts >= tonumber(ARGV[2]) then
  redis.call('SET', KEYS[1], '1', 'PX', ARGV[3])
end
return attempts
`;

@Injectable()
export class LoginRateLimiterService {
  private readonly records = new Map<string, RateLimitRecord>();
  private readonly defaultAccountMaxAttempts = 5;
  private readonly defaultIpMaxAttempts = 25;
  private readonly defaultLoopbackMaxAttempts = 100;
  private readonly defaultWindowMs = 15 * 60 * 1000; // 15 minutos
  private readonly defaultBlockMs = 15 * 60 * 1000; // 15 minutos de bloqueio temporário

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {
    // Limpeza periódica preventiva contra vazamento de memória quando em fallback local
    setInterval(() => this.cleanupMemory(), 5 * 60 * 1000).unref();
  }

  private isRedisUsable(): boolean {
    return Boolean(
      this.redis &&
        (this.redis.status === 'ready' || this.redis.status === 'connect'),
    );
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

  private blockedException(): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message:
          'Muitas tentativas de autenticação. Acesso temporariamente bloqueado. Tente novamente mais tarde.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Verifica e já contabiliza esta tentativa atomicamente. Chamar isto no
  // início de cada fluxo sensível (login, desafio MFA, pedido de redefinição
  // de senha, etc.) é suficiente: não é mais necessário um recordFailure()
  // separado depois da verificação de credenciais, porque a tentativa já foi
  // registrada aqui, sem a janela de corrida que existia entre o check e o
  // registro quando eram duas operações separadas por I/O assíncrono.
  async assertNotRateLimited(
    keys: string[],
    maxAttempts?: number,
  ): Promise<void> {
    const now = Date.now();

    if (this.isRedisUsable() && this.redis) {
      try {
        for (const key of keys) {
          if (!key) continue;
          const threshold = this.getMaxAttemptsForKey(key, maxAttempts);
          const result = await this.redis.eval(
            CHECK_AND_INCREMENT_SCRIPT,
            2,
            `rl:blocked:${key}`,
            `rl:attempts:${key}`,
            this.defaultWindowMs,
            threshold,
            this.defaultBlockMs,
          );
          if (result === -1) {
            throw this.blockedException();
          }
        }
        return;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        // Falha transitória de Redis: fallback para checagem em memória
      }
    }

    // Fallback em memória. Cada iteração roda de forma síncrona (sem await
    // entre a leitura e a escrita), o que a torna atômica dentro deste
    // processo pelo próprio modelo de execução single-threaded do Node.
    for (const key of keys) {
      if (!key) continue;
      const record = this.records.get(key);

      if (record?.blockedUntil && record.blockedUntil > now) {
        throw this.blockedException();
      }

      const threshold = this.getMaxAttemptsForKey(key, maxAttempts);

      if (!record || record.resetAt <= now) {
        this.records.set(key, {
          attempts: 1,
          resetAt: now + this.defaultWindowMs,
        });
        continue;
      }

      record.attempts += 1;
      if (record.attempts >= threshold) {
        record.blockedUntil = now + this.defaultBlockMs;
      }
    }
  }

  async recordSuccess(keys: string[]): Promise<void> {
    if (this.isRedisUsable() && this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          if (!key) continue;
          pipeline.del(`rl:attempts:${key}`);
          pipeline.del(`rl:blocked:${key}`);
        }
        await pipeline.exec();
        return;
      } catch {
        // Falha transitória de Redis: fallback para limpeza em memória
      }
    }

    // Fallback em memória
    for (const key of keys) {
      if (!key) continue;
      this.records.delete(key);
    }
  }

  async clearAll(): Promise<void> {
    if (this.isRedisUsable() && this.redis) {
      try {
        const keys = await this.redis.keys('rl:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch {
        // Silencioso em caso de erro no Redis
      }
    }
    this.records.clear();
  }

  private cleanupMemory(): void {
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
