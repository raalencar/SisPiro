import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';

describe('LoginRateLimiterService', () => {
  describe('Memory fallback mode', () => {
    it('allows attempts within limit', async () => {
      const service = new LoginRateLimiterService();
      const key = 'test-ip-1';

      await expect(service.assertNotRateLimited([key], 5)).resolves.toBeUndefined();
      await expect(service.assertNotRateLimited([key], 5)).resolves.toBeUndefined();
    });

    it('allows the attempt that reaches the threshold, then blocks subsequent ones with 429', async () => {
      const service = new LoginRateLimiterService();
      const key = 'test-ip-blocked';

      // As 5 primeiras chamadas (o próprio limite) devem passar: o
      // bloqueio só entra em vigor a partir da tentativa seguinte.
      for (let i = 0; i < 5; i++) {
        await expect(service.assertNotRateLimited([key], 5)).resolves.toBeUndefined();
      }

      await expect(service.assertNotRateLimited([key], 5)).rejects.toThrow(HttpException);

      try {
        await service.assertNotRateLimited([key], 5);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('resets attempts on successful login', async () => {
      const service = new LoginRateLimiterService();
      const key = 'test-ip-reset';

      await service.assertNotRateLimited([key], 5);
      await service.assertNotRateLimited([key], 5);

      await service.recordSuccess([key]);

      // O contador deve estar limpo
      await expect(service.assertNotRateLimited([key], 5)).resolves.toBeUndefined();
    });
  });

  describe('Redis distributed mode', () => {
    function createMockRedis(store: Map<string, string>) {
      // Simula, em JS, exatamente a lógica do script Lua usado em produção
      // (ver CHECK_AND_INCREMENT_SCRIPT): checa o bloqueio e já incrementa
      // em uma única chamada, sem round-trips separados.
      const mockEval = vi.fn(
        async (
          _script: string,
          _numKeys: number,
          blockedKey: string,
          attemptsKey: string,
          _windowMs: number,
          threshold: number,
          _blockMs: number,
        ) => {
          if (store.has(blockedKey)) return -1;
          const current = Number(store.get(attemptsKey) || '0') + 1;
          store.set(attemptsKey, String(current));
          if (current >= threshold) {
            store.set(blockedKey, '1');
          }
          return current;
        },
      );

      const redis = {
        status: 'ready',
        eval: mockEval,
        pipeline: vi.fn(() => ({
          del: vi.fn((key: string) => store.delete(key)),
          exec: vi.fn(async () => []),
        })),
        keys: vi.fn(async () => Array.from(store.keys())),
        del: vi.fn(async (...keys: string[]) => {
          keys.forEach((k) => store.delete(k));
          return keys.length;
        }),
      } as unknown as Redis;

      return { redis, mockEval };
    }

    it('checks and increments atomically in a single Redis round-trip per key', async () => {
      const store = new Map<string, string>();
      const { redis: mockRedis, mockEval } = createMockRedis(store);
      const service = new LoginRateLimiterService(mockRedis);
      const key = 'test-user-redis';

      await service.assertNotRateLimited([key], 3);
      expect(mockEval).toHaveBeenCalledTimes(1);
      expect(store.get(`rl:attempts:${key}`)).toBe('1');

      await service.assertNotRateLimited([key], 3);
      await service.assertNotRateLimited([key], 3);
      expect(store.get(`rl:blocked:${key}`)).toBe('1');

      // A tentativa que atingiu o limite (a 3ª) ainda passa; só a próxima é bloqueada.
      await expect(service.assertNotRateLimited([key], 3)).rejects.toThrow(HttpException);

      await service.recordSuccess([key]);
      expect(store.has(`rl:attempts:${key}`)).toBe(false);
      expect(store.has(`rl:blocked:${key}`)).toBe(false);
    });

    it('does not let concurrent calls for the same key exceed the configured threshold', async () => {
      const store = new Map<string, string>();
      const { redis: mockRedis } = createMockRedis(store);
      const service = new LoginRateLimiterService(mockRedis);
      const key = 'test-user-concurrent';
      const threshold = 3;
      const concurrentCalls = 10;

      const results = await Promise.allSettled(
        Array.from({ length: concurrentCalls }, () =>
          service.assertNotRateLimited([key], threshold),
        ),
      );

      const allowed = results.filter((r) => r.status === 'fulfilled').length;
      const blocked = results.filter((r) => r.status === 'rejected').length;

      // Mesmo com chamadas concorrentes, no máximo `threshold` tentativas
      // podem passar antes do bloqueio entrar em vigor — o antigo design
      // (checagem e gravação em operações separadas) permitiria um burburinho
      // de tentativas além do limite configurado.
      expect(allowed).toBe(threshold);
      expect(blocked).toBe(concurrentCalls - threshold);
    });
  });
});
