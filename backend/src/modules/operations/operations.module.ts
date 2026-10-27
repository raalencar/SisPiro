import { Module } from '@nestjs/common';
import { BlastersController } from './blasters.controller.js';
import { BlastersService } from './blasters.service.js';
import { CommercialModule } from '../commercial/commercial.module.js';
import { ServiceOrdersController } from './service-orders.controller.js';
import { ServiceOrdersService } from './service-orders.service.js';
import { ServiceOrdersBudgetService } from './services/service-orders-budget.service.js';
import { ServiceOrdersLifecycleService } from './services/service-orders-lifecycle.service.js';
import { ServiceOrdersQueryService } from './services/service-orders-query.service.js';

@Module({
  imports: [CommercialModule],
  controllers: [BlastersController, ServiceOrdersController],
  providers: [
    BlastersService,
    ServiceOrdersQueryService,
    ServiceOrdersBudgetService,
    ServiceOrdersLifecycleService,
    ServiceOrdersService,
  ],
  exports: [ServiceOrdersService],
})
export class OperationsModule {}
