import { Module } from '@nestjs/common';
import { QueueModule } from '../../infrastructure/queue.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { CommercialController } from './commercial.controller.js';
import { CommercialService } from './commercial.service.js';
import {
  CommercialReportsService,
  PriceListsService,
  ProductPromotionsService,
  SaleReturnsService,
  SalesQuotesService,
  SalesService,
} from './services/index.js';

@Module({
  imports: [QueueModule],
  controllers: [CustomersController, CommercialController],
  providers: [
    CustomersService,
    PriceListsService,
    ProductPromotionsService,
    SalesQuotesService,
    SalesService,
    SaleReturnsService,
    CommercialReportsService,
    CommercialService,
  ],
  exports: [
    CustomersService,
    PriceListsService,
    ProductPromotionsService,
    SalesQuotesService,
    SalesService,
    SaleReturnsService,
    CommercialReportsService,
    CommercialService,
  ],
})
export class CommercialModule {}
