import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../src/database/prisma.service.js';
import { HealthController } from '../src/health/health.controller.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: vi.fn() } },
        { provide: HealthIndicatorService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: getQueueToken('health-check'), useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('reports liveness without depending on external services', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  afterAll(async () => {
    await app.close();
  });
});
