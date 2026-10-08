import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

@Module({
  imports: [BullModule.registerQueue({ name: 'background' })],
  exports: [BullModule],
})
export class QueueModule {}
