import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators.js';
import {
  CreateLotDto,
  CreateMagazineDto,
  CreateMovementDto,
  CreateProductDto,
  LotsQueryDto,
  MovementsQueryDto,
  PaginationQueryDto,
  ProductsQueryDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Estoque e WMS')
@ApiBearerAuth()
@Roles(UserRole.ESTOQUE)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('products')
  @ApiOperation({ summary: 'Lista produtos com paginação e filtros.' })
  listProducts(@Query() query: ProductsQueryDto) {
    return this.inventory.listProducts(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Consulta um produto.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.inventory.getProduct(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Cadastra um produto ou item PCE.' })
  @ApiCreatedResponse({ description: 'Produto cadastrado.' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.inventory.createProduct(dto);
  }

  @Get('magazines')
  @ApiOperation({
    summary: 'Lista paióis com NEQ atual, capacidade e saldo disponível.',
  })
  listMagazines(@Query() query: PaginationQueryDto) {
    return this.inventory.listMagazines(query);
  }

  @Get('reports/stock-summary')
  @ApiOperation({
    summary:
      'Resume estoque físico, reservas, saldo disponível e lotes vencidos ou próximos do vencimento.',
  })
  stockReport() {
    return this.inventory.stockReport();
  }

  @Get('magazines/:id')
  @ApiOperation({ summary: 'Consulta um paiol e sua ocupação NEQ atual.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getMagazine(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.inventory.getMagazine(id);
  }

  @Post('magazines')
  @ApiOperation({ summary: 'Cadastra um paiol e sua capacidade regulatória.' })
  @ApiCreatedResponse({ description: 'Paiol cadastrado.' })
  createMagazine(@Body() dto: CreateMagazineDto) {
    return this.inventory.createMagazine(dto);
  }

  @Get('lots')
  @ApiOperation({ summary: 'Lista lotes rastreáveis e massa NEQ calculada.' })
  listLots(@Query() query: LotsQueryDto) {
    return this.inventory.listLots(query);
  }

  @Get('lots/:id')
  @ApiOperation({ summary: 'Consulta lote, produto, paiol e NEQ.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getLot(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.inventory.getLot(id);
  }

  @Post('lots')
  @ApiOperation({
    summary:
      'Registra lote com recebimento inicial, validação de licença e capacidade NEQ.',
  })
  @ApiCreatedResponse({
    description: 'Lote recebido e movimentação registrada.',
  })
  createLot(@Body() dto: CreateLotDto) {
    return this.inventory.createLot(dto);
  }

  @Get('movements')
  @ApiOperation({
    summary: 'Consulta o histórico de movimentações de estoque.',
  })
  listMovements(@Query() query: MovementsQueryDto) {
    return this.inventory.listMovements(query);
  }

  @Post('movements')
  @ApiOperation({
    summary:
      'Registra entrada, saída, transferência integral de lote ou ajuste de saldo.',
  })
  @ApiCreatedResponse({ description: 'Movimentação registrada.' })
  createMovement(@Body() dto: CreateMovementDto) {
    return this.inventory.createMovement(dto);
  }
}
