import { Injectable } from '@nestjs/common';
import {
  CreateLotDto,
  CreateMagazineDto,
  CreateMovementDto,
  CreateProductDto,
  LotsQueryDto,
  MovementsQueryDto,
  ProductsQueryDto,
  SfpcMonthlyMapQueryDto,
  SplitLotDto,
  UpdateLotStatusDto,
  UpdateMagazineStatusDto,
} from './inventory.dto.js';
import type { Pagination } from './inventory.common.js';
import {
  InventoryReportsService,
  MagazinesService,
  ProductLotsService,
  ProductsService,
  StockMovementsService,
} from './services/index.js';

@Injectable()
export class InventoryService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly magazinesService: MagazinesService,
    private readonly productLotsService: ProductLotsService,
    private readonly inventoryReportsService: InventoryReportsService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  // --- Produtos ---
  listProducts(query: ProductsQueryDto) {
    return this.productsService.listProducts(query);
  }

  getProduct(id: string) {
    return this.productsService.getProduct(id);
  }

  createProduct(dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  // --- Paióis ---
  listMagazines(query: Pagination) {
    return this.magazinesService.listMagazines(query);
  }

  getMagazine(id: string) {
    return this.magazinesService.getMagazine(id);
  }

  createMagazine(dto: CreateMagazineDto) {
    return this.magazinesService.createMagazine(dto);
  }

  updateMagazineStatus(id: string, dto: UpdateMagazineStatusDto) {
    return this.magazinesService.updateMagazineStatus(id, dto);
  }

  // --- Lotes ---
  listLots(query: LotsQueryDto) {
    return this.productLotsService.listLots(query);
  }

  listOperationalLots(query: LotsQueryDto) {
    return this.productLotsService.listOperationalLots(query);
  }

  getLot(id: string) {
    return this.productLotsService.getLot(id);
  }

  createLot(dto: CreateLotDto) {
    return this.productLotsService.createLot(dto);
  }

  splitLot(parentLotId: string, dto: SplitLotDto) {
    return this.productLotsService.splitLot(parentLotId, dto);
  }

  updateLotStatus(id: string, dto: UpdateLotStatusDto) {
    return this.productLotsService.updateLotStatus(id, dto);
  }

  // --- Relatórios e SFPC ---
  stockReport() {
    return this.inventoryReportsService.stockReport();
  }

  getSfpcMonthlyMap(query: SfpcMonthlyMapQueryDto) {
    return this.inventoryReportsService.getSfpcMonthlyMap(query);
  }

  // --- Movimentações e Transferências ---
  listMovements(query: MovementsQueryDto) {
    return this.stockMovementsService.listMovements(query);
  }

  createMovement(dto: CreateMovementDto) {
    return this.stockMovementsService.createMovement(dto);
  }
}
