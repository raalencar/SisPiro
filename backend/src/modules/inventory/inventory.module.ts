import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import {
  InventoryReportsService,
  InventorySfpcReportService,
  MagazinesService,
  ProductLotsOperationsService,
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
    ProductLotsOperationsService,
    InventoryReportsService,
    InventorySfpcReportService,
    StockMovementsService,
    InventoryService,
  ],
  exports: [
    ProductsService,
    MagazinesService,
    ProductLotsService,
    ProductLotsOperationsService,
    InventoryReportsService,
    InventorySfpcReportService,
    StockMovementsService,
    InventoryService,
  ],
})
export class InventoryModule {}
