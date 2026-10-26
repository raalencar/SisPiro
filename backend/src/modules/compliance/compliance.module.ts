import { Module } from '@nestjs/common';
import { TrafficGuidesController } from './traffic-guides.controller.js';
import { TrafficGuidesService } from './traffic-guides.service.js';

@Module({
  controllers: [TrafficGuidesController],
  providers: [TrafficGuidesService],
  exports: [TrafficGuidesService],
})
export class ComplianceModule {}
