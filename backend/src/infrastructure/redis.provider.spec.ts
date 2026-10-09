import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { afterEach, describe, expect, it } from 'vitest';
import { redisClientProvider } from './redis.provider.js';

describe('redisClientProvider', () => {
  let client: Redis | undefined;

  afterEach(() => {
    client?.disconnect();
    client = undefined;
  });

  it('never tells ioredis to give up reconnecting', () => {
    const config = {
      get: (key: string, fallback?: unknown) => fallback,
    } as unknown as ConfigService;

    const factory = redisClientProvider.useFactory as (
      config: ConfigService,
    ) => Redis;
    client = factory(config);

    const retryStrategy = client.options.retryStrategy;
    expect(retryStrategy).toBeTypeOf('function');

    // Um retryStrategy só é seguro para reconexão indefinida se NUNCA
    // retornar um valor que não seja número, não importa quantas
    // tentativas já tenham ocorrido. Retornar null/undefined faz o
    // ioredis desistir de reconectar para sempre (ver node_modules/
    // ioredis/README.md, seção "Reconnect on error").
    for (const times of [1, 2, 3, 4, 10, 100, 10_000]) {
      const delay = retryStrategy!(times);
      expect(typeof delay).toBe('number');
      expect(Number.isFinite(delay)).toBe(true);
      expect(delay).toBeGreaterThan(0);
    }
  });
});
