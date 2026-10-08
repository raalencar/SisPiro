import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service.js';
import { Public } from '../modules/auth/auth.decorators.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
    @InjectQueue('health-check') private readonly queue: Queue,
  ) {}

  @Get('live')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () =>
        this.indicators
          .check('postgres')
          .attempt(async () => {
            await this.prisma.$queryRaw`SELECT 1`;
          })
          .withTimeout(3000),
      () =>
        this.indicators
          .check('redis')
          .attempt(async () => {
            await this.queue.getJobCounts();
          })
          .withTimeout(3000),
    ]);
  }
}
