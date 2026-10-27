import { Injectable } from '@nestjs/common';
import {
  CreatePurchaseDto,
  CreateSupplierDto,
  PurchasesQueryDto,
  ReceivePurchaseDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
} from './procurement.dto.js';
import { PurchasesService } from './services/purchases.service.js';
import { SuppliersService } from './services/suppliers.service.js';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly purchasesService: PurchasesService,
  ) {}

  async listSuppliers(query: SuppliersQueryDto) {
    return this.suppliersService.listSuppliers(query);
  }

  async getSupplier(id: string) {
    return this.suppliersService.getSupplier(id);
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    return this.suppliersService.updateSupplier(id, dto);
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.suppliersService.createSupplier(dto);
  }

  async listPurchases(query: PurchasesQueryDto) {
    return this.purchasesService.listPurchases(query);
  }

  async getPurchase(id: string) {
    return this.purchasesService.getPurchase(id);
  }

  async createPurchase(dto: CreatePurchaseDto) {
    return this.purchasesService.createPurchase(dto);
  }

  async receivePurchase(id: string, dto: ReceivePurchaseDto) {
    return this.purchasesService.receivePurchase(id, dto);
  }

  async cancelPurchase(id: string) {
    return this.purchasesService.cancelPurchase(id);
  }
}
