import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TerminusModule, BullModule.registerQueue({ name: 'health-check' })],
  controllers: [HealthController],
})
export class HealthModule {}
