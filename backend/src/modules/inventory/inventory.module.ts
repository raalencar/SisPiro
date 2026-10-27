import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import {
  InventoryReportsService,
  MagazinesService,
  ProductLotsService,
  ProductsService,
  StockMovementsService,
} from './services/index.js';

@Module({
  controllers: [InventoryController],
  providers: [
    ProductsService,
    MagazinesService,
    ProductLotsService,
    InventoryReportsService,
    StockMovementsService,
    InventoryService,
  ],
  exports: [
    ProductsService,
    MagazinesService,
    ProductLotsService,
    InventoryReportsService,
    StockMovementsService,
    InventoryService,
  ],
})
export class InventoryModule {}
