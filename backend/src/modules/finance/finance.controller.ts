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
import { Public, Roles } from '../auth/auth.decorators.js';
import {
  CashFlowQueryDto,
  CreateFinancialEntryDto,
  CreateFinancialPaymentDto,
  AgingReportQueryDto,
  FinanceDashboardQueryDto,
  FinanceEntriesQueryDto,
  FinancePaymentReportQueryDto,
  GeneratePixDto,
  PixWebhookDto,
  ReconcileOfxPreviewDto,
  ApplyReconciliationDto,
} from './finance.dto.js';
import { FinanceService } from './finance.service.js';
import { PixService } from './pix.service.js';
import { OfxService } from './ofx.service.js';

@ApiTags('Financeiro')
@ApiBearerAuth()
@Roles(UserRole.FINANCEIRO)
@Controller(['finance', 'financial'])
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly pix: PixService,
    private readonly ofx: OfxService,
  ) {}

  @Get('entries')
  @ApiOperation({
    summary:
      'Lista contas a pagar/receber com filtros por status e vencimento.',
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
  @ApiOperation({
    summary: 'Consulta lançamento, pagamentos e saldo pendente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.finance.get(id);
  }

  @Post('entries/:id/payments')
  @ApiOperation({
    summary:
      'Registra pagamento ou recebimento parcial até quitar o lançamento.',
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

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Resume fluxo realizado e saldos atuais a pagar/receber por vencimento.',
  })
  dashboard(@Query() query: FinanceDashboardQueryDto) {
    return this.finance.dashboard(query);
  }

  @Get('reports/payment-breakdown')
  @ApiOperation({
    summary: 'Detalha pagamentos realizados no período por categoria e método.',
  })
  paymentBreakdown(@Query() query: FinancePaymentReportQueryDto) {
    return this.finance.paymentBreakdown(query);
  }

  @Get('reports/aging')
  @ApiOperation({
    summary:
      'Aging schedule de títulos a pagar e a receber por faixas de vencimento.',
  })
  agingReport(@Query() query: AgingReportQueryDto) {
    return this.finance.agingReport(query);
  }

  // --- FRENTE 3: PIX DINÂMICO & WEBHOOK ---

  @Post('pix/qrcode/:id')
  @Roles(UserRole.FINANCEIRO, UserRole.COMERCIAL)
  @ApiOperation({
    summary: 'Gera cobrança PIX dinâmico com payload BR Code EMVCo e QR Code em imagem Data URL.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  generatePix(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: GeneratePixDto,
  ) {
    return this.pix.generatePixForEntry(id, dto);
  }

  @Public()
  @Post('pix/webhook')
  @ApiOperation({
    summary: 'Webhook para confirmação e liquidação bancária automática de cobranças PIX.',
  })
  processPixWebhook(@Body() dto: PixWebhookDto) {
    return this.pix.processWebhook(dto);
  }

  // --- FRENTE 3: CONCILIAÇÃO BANCÁRIA OFX ---

  @Post('reconcile/ofx-preview')
  @Roles(UserRole.FINANCEIRO)
  @ApiOperation({
    summary: 'Lê arquivo OFX e cruza transações com contas abertas para conferência.',
  })
  previewOfx(@Body() dto: ReconcileOfxPreviewDto) {
    return this.ofx.previewReconciliation(dto.ofxContent);
  }

  @Post('reconcile/ofx-apply')
  @Roles(UserRole.FINANCEIRO)
  @ApiOperation({
    summary: 'Aplica a liquidação atômica das transações bancárias conciliadas.',
  })
  applyOfx(@Body() dto: ApplyReconciliationDto) {
    return this.ofx.applyReconciliation(dto.items);
  }
}

