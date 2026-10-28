import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller.js';
import { ProcurementService } from './procurement.service.js';
import { PurchasesService } from './services/purchases.service.js';
import { SuppliersService } from './services/suppliers.service.js';
import { SupplierCatalogImagesService } from './supplier-catalog/supplier-catalog-images.service.js';
import { SupplierCatalogController } from './supplier-catalog/supplier-catalog.controller.js';
import { SupplierCatalogService } from './supplier-catalog/supplier-catalog.service.js';

@Module({
  controllers: [ProcurementController, SupplierCatalogController],
  providers: [
    SuppliersService,
    PurchasesService,
    ProcurementService,
    SupplierCatalogService,
    SupplierCatalogImagesService,
  ],
  exports: [ProcurementService],
})
export class ProcurementModule {}
