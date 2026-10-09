import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);
    const password = config.get<string>('REDIS_PASSWORD');
    const client = new Redis({
      host,
      port,
      ...(password ? { password } : {}),
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      // Nunca retorna null/não-número: o cliente deve continuar tentando
      // reconectar indefinidamente (mesmo comportamento da conexão do
      // BullMQ em app.module.ts). Um retryStrategy que desiste após N
      // tentativas torna o fallback em memória do LoginRateLimiterService
      // permanente após qualquer instabilidade transitória do Redis, já
      // que nada neste código chama `.connect()` novamente.
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });

    client.on('error', (err) => {
      // Evita logs não tratados de conexão em ambiente de teste/local
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[RedisProvider] Aviso de conexão Redis: ${(err as Error).message}`);
      }
    });

    return client;
  },
};

