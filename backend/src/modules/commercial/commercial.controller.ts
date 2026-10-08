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
  CreatePriceListDto,
  CreateSaleDto,
  CreateSaleReturnDto,
  PriceListsQueryDto,
  SalesQueryDto,
} from './commercial.dto.js';
import { CommercialService } from './commercial.service.js';

@ApiTags('Vendas e preços')
@ApiBearerAuth()
@Roles(UserRole.COMERCIAL)
@Controller()
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Get('pricing/lists')
  @ApiOperation({ summary: 'Lista tabelas de preço.' })
  listPriceLists(@Query() query: PriceListsQueryDto) {
    return this.commercial.listPriceLists(query);
  }

  @Post('pricing/lists')
  @ApiOperation({
    summary: 'Cria tabela de preço com preços unitários por produto.',
  })
  @ApiCreatedResponse({ description: 'Tabela de preço cadastrada.' })
  createPriceList(@Body() dto: CreatePriceListDto) {
    return this.commercial.createPriceList(dto);
  }

  @Get('pricing/lists/:id')
  @ApiOperation({ summary: 'Consulta tabela de preço e itens.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getPriceList(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commercial.getPriceList(id);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Lista vendas finalizadas.' })
  listSales(@Query() query: SalesQueryDto) {
    return this.commercial.listSales(query);
  }

  @Get('sales/:id')
  @ApiOperation({ summary: 'Consulta venda, cliente, preços e itens.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getSale(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commercial.getSale(id);
  }

  @Get('sales/:id/returns')
  @ApiOperation({ summary: 'Lista devoluções de uma venda.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listSaleReturns(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commercial.listSaleReturns(id);
  }

  @Post('sales/:id/returns')
  @ApiOperation({
    summary:
      'Registra devolução parcial ou total e reentrada rastreável no estoque atomicamente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Devolução registrada.' })
  createSaleReturn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateSaleReturnDto,
  ) {
    return this.commercial.createSaleReturn(id, dto);
  }

  @Post('sales')
  @ApiOperation({
    summary:
      'Finaliza venda/PDV, valida cliente PCE, preço e saldo não reservado e baixa estoque atomicamente.',
  })
  @ApiCreatedResponse({ description: 'Venda finalizada e estoque baixado.' })
  createSale(@Body() dto: CreateSaleDto) {
    return this.commercial.createSale(dto);
  }
}
