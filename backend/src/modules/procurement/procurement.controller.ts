import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePurchaseDto,
  CreateSupplierDto,
  PurchasesQueryDto,
  ReceivePurchaseDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
} from './procurement.dto.js';
import { ProcurementService } from './procurement.service.js';

@ApiTags('Compras e fornecedores')
@Controller()
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get('suppliers')
  @ApiOperation({ summary: 'Lista fornecedores com filtros e paginação.' })
  listSuppliers(@Query() query: SuppliersQueryDto) {
    return this.procurement.listSuppliers(query);
  }

  @Post('suppliers')
  @ApiOperation({
    summary: 'Cadastra fornecedor, CPF/CNPJ e dados de CR para fornecimento PCE.',
  })
  @ApiCreatedResponse({ description: 'Fornecedor cadastrado.' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.procurement.createSupplier(dto);
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Consulta fornecedor e quantidade de compras.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getSupplier(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.procurement.getSupplier(id);
  }

  @Patch('suppliers/:id')
  @ApiOperation({
    summary: 'Atualiza dados, documentação PCE ou estado ativo do fornecedor.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateSupplier(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.procurement.updateSupplier(id, dto);
  }

  @Get('purchases')
  @ApiOperation({ summary: 'Lista compras por status, busca e paginação.' })
  listPurchases(@Query() query: PurchasesQueryDto) {
    return this.procurement.listPurchases(query);
  }

  @Post('purchases')
  @ApiOperation({
    summary: 'Cria pedido de compra pendente para fornecedor e produtos.',
  })
  @ApiCreatedResponse({ description: 'Pedido de compra criado.' })
  createPurchase(@Body() dto: CreatePurchaseDto) {
    return this.procurement.createPurchase(dto);
  }

  @Get('purchases/:id')
  @ApiOperation({ summary: 'Consulta compra, fornecedor, itens e recebimentos.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getPurchase(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.procurement.getPurchase(id);
  }

  @Post('purchases/:id/receive')
  @ApiOperation({
    summary:
      'Registra recebimento parcial ou integral, criando lotes rastreáveis e movimentações de entrada atomicamente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Compra recebida e estoque atualizado.' })
  receivePurchase(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReceivePurchaseDto,
  ) {
    return this.procurement.receivePurchase(id, dto);
  }

  @Post('purchases/:id/cancel')
  @ApiOperation({ summary: 'Cancela pedido de compra ainda pendente.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancelPurchase(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.procurement.cancelPurchase(id);
  }
}
