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
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CashFlowQueryDto,
  CreateFinancialEntryDto,
  CreateFinancialPaymentDto,
  FinanceEntriesQueryDto,
} from './finance.dto.js';
import { FinanceService } from './finance.service.js';

@ApiTags('Financeiro')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('entries')
  @ApiOperation({
    summary: 'Lista contas a pagar/receber com filtros por status e vencimento.',
  })
  list(@Query() query: FinanceEntriesQueryDto) {
    return this.finance.list(query);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Cria lançamento de conta a pagar ou receber.' })
  @ApiCreatedResponse({ description: 'Lançamento financeiro criado.' })
  create(@Body() dto: CreateFinancialEntryDto) {
    return this.finance.create(dto);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: 'Consulta lançamento, pagamentos e saldo pendente.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.finance.get(id);
  }

  @Post('entries/:id/payments')
  @ApiOperation({
    summary: 'Registra pagamento ou recebimento parcial até quitar o lançamento.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Pagamento registrado.' })
  createPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateFinancialPaymentDto,
  ) {
    return this.finance.createPayment(id, dto);
  }

  @Post('entries/:id/cancel')
  @ApiOperation({
    summary: 'Cancela lançamento sem pagamentos vinculados.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.finance.cancel(id);
  }

  @Get('cash-flow')
  @ApiOperation({
    summary: 'Resume entradas e saídas efetivamente pagas por dia no período.',
  })
  cashFlow(@Query() query: CashFlowQueryDto) {
    return this.finance.cashFlow(query);
  }
}
