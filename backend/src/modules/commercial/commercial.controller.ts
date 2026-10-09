import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Put,
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
  CreateProductPromotionDto,
  ProductPromotionsQueryDto,
  UpdateProductPromotionDto,
  CreateSaleDto,
  CreateSaleReturnDto,
  ConvertSalesQuoteDto,
  CreateSalesQuoteDto,
  UpdateSalesQuoteDto,
  SendSalesQuoteDto,
  PriceListsQueryDto,
  SalesReportQueryDto,
  SalesQuotesQueryDto,
  QuotesConversionReportQueryDto,
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

  @Get('pricing/promotions')
  @ApiOperation({ summary: 'Lista promoções de preço por período e produto.' })
  listProductPromotions(@Query() query: ProductPromotionsQueryDto) {
    return this.commercial.listProductPromotions(query);
  }

  @Post('pricing/promotions')
  @ApiOperation({
    summary:
      'Cria promoção de preço fixo por produto, bloqueando vigências sobrepostas.',
  })
  @ApiCreatedResponse({ description: 'Promoção cadastrada.' })
  createProductPromotion(@Body() dto: CreateProductPromotionDto) {
    return this.commercial.createProductPromotion(dto);
  }

  @Get('pricing/promotions/:id')
  @ApiOperation({ summary: 'Consulta promoção e preços dos produtos.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getProductPromotion(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commercial.getProductPromotion(id);
  }

  @Patch('pricing/promotions/:id')
  @ApiOperation({
    summary: 'Ativa ou desativa promoção sem alterar seu período ou preços.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateProductPromotion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductPromotionDto,
  ) {
    return this.commercial.updateProductPromotion(id, dto);
  }

  @Get('sales/quotes')
  @ApiOperation({ summary: 'Lista orçamentos comerciais e suas reservas.' })
  listSalesQuotes(@Query() query: SalesQuotesQueryDto) {
    return this.commercial.listSalesQuotes(query);
  }

  @Post('sales/quotes')
  @ApiOperation({
    summary:
      'Emite orçamento por sete dias e reserva o estoque dos lotes atomicamente.',
  })
  @ApiCreatedResponse({ description: 'Orçamento emitido com validade.' })
  createSalesQuote(@Body() dto: CreateSalesQuoteDto) {
    return this.commercial.createSalesQuote(dto);
  }

  @Get('sales/quotes/:id')
  @ApiOperation({ summary: 'Consulta orçamento, itens e situação da reserva.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getSalesQuote(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commercial.getSalesQuote(id);
  }

  @Post('sales/quotes/:id/cancel')
  @ApiOperation({ summary: 'Cancela orçamento e libera a reserva de estoque.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancelSalesQuote(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.commercial.cancelSalesQuote(id);
  }

  @Put(['sales/quotes/:id', 'commercial/sales/quotes/:id'])
  @ApiOperation({
    summary:
      'Edita orçamento de venda, recalculando reservas de estoque e renovando validade.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateSalesQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSalesQuoteDto,
  ) {
    return this.commercial.updateSalesQuote(id, dto);
  }

  @Post(['sales/quotes/:id/send', 'commercial/sales/quotes/:id/send'])
  @ApiOperation({
    summary: 'Envia orçamento de venda para o cliente via fila de mensageria.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  sendSalesQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto?: SendSalesQuoteDto,
  ) {
    return this.commercial.sendSalesQuote(id, dto);
  }

  @Get(['commercial/reports/quotes-conversion', 'sales/quotes/reports/conversion'])
  @ApiOperation({
    summary: 'Relatório de taxa de conversão de orçamentos por período.',
  })
  quotesConversionReport(@Query() query: QuotesConversionReportQueryDto) {
    return this.commercial.quotesConversionReport(query);
  }

  @Post('sales/quotes/:id/convert')
  @ApiOperation({
    summary:
      'Converte orçamento em venda com condição de pagamento, preservando preços e baixando estoque atomicamente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Orçamento convertido em venda.' })
  convertSalesQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConvertSalesQuoteDto,
  ) {
    return this.commercial.convertSalesQuote(id, dto);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Lista vendas finalizadas.' })
  listSales(@Query() query: SalesQueryDto) {
    return this.commercial.listSales(query);
  }

  @Get('sales/reports/summary')
  @ApiOperation({
    summary:
      'Resume vendas brutas, devoluções e vendas líquidas por produto e cliente.',
  })
  salesReport(@Query() query: SalesReportQueryDto) {
    return this.commercial.salesReport(query);
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
      'Finaliza venda, registra recebimento imediato ou conta a receber e baixa estoque atomicamente.',
  })
  @ApiCreatedResponse({ description: 'Venda finalizada e estoque baixado.' })
  createSale(@Body() dto: CreateSaleDto) {
    return this.commercial.createSale(dto);
  }
}
