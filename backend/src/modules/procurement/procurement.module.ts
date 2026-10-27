import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller.js';
import { ProcurementService } from './procurement.service.js';
import { PurchasesService } from './services/purchases.service.js';
import { SuppliersService } from './services/suppliers.service.js';

@Module({
  controllers: [ProcurementController],
  providers: [SuppliersService, PurchasesService, ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
