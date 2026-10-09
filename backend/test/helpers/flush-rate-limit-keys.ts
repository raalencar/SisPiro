import { config as loadEnv } from 'dotenv';
import { Redis } from 'ioredis';

// vitest `globalSetup` roda fora do bootstrap do Nest, então o .env não é
// carregado automaticamente pelo ConfigModule como acontece dentro de cada
// suíte via supertest/app.
loadEnv();

// Executado uma única vez antes da suíte e2e. O rate limiter de login agora
// usa Redis real (não mais um Map em memória por processo), então chaves
// "rl:blocked:*" de uma execução anterior que tenha travado ou sido
// interrompida (ex.: CI cancelado, falha antes do clearAll()) continuam
// válidas por até 15 minutos e podem bloquear o bootstrap/login de execuções
// seguintes com 429 mesmo sem nenhuma tentativa real nesta rodada.
export default async function setup() {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    lazyConnect: true,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    const keys = await client.keys('rl:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Redis indisponível nesta máquina/CI: a suíte segue com o fallback em
    // memória do rate limiter, que já começa limpo por processo.
  } finally {
    client.disconnect();
  }
}
