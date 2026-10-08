import { Module } from '@nestjs/common';
import { BlastersController } from './blasters.controller.js';
import { BlastersService } from './blasters.service.js';
import { CommercialModule } from '../commercial/commercial.module.js';
import { ServiceOrdersController } from './service-orders.controller.js';
import { ServiceOrdersService } from './service-orders.service.js';

@Module({
  imports: [CommercialModule],
  controllers: [BlastersController, ServiceOrdersController],
  providers: [BlastersService, ServiceOrdersService],
})
export class OperationsModule {}
