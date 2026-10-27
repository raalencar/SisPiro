import { Injectable } from '@nestjs/common';
import {
  AgingReportQueryDto,
  CashFlowQueryDto,
  CreateFinancialEntryDto,
  CreateFinancialPaymentDto,
  FinanceDashboardQueryDto,
  FinanceEntriesQueryDto,
  FinancePaymentReportQueryDto,
} from './finance.dto.js';
import { FinanceEntriesService } from './services/finance-entries.service.js';
import { FinanceReportsService } from './services/finance-reports.service.js';
import { FinanceSettlementsService } from './services/finance-settlements.service.js';

@Injectable()
export class FinanceService {
  constructor(
    private readonly entriesService: FinanceEntriesService,
    private readonly settlementsService: FinanceSettlementsService,
    private readonly reportsService: FinanceReportsService,
  ) {}

  async list(query: FinanceEntriesQueryDto) {
    return this.entriesService.list(query);
  }

  async create(dto: CreateFinancialEntryDto) {
    return this.entriesService.create(dto);
  }

  async get(id: string) {
    return this.entriesService.get(id);
  }

  async createPayment(id: string, dto: CreateFinancialPaymentDto) {
    return this.settlementsService.createPayment(id, dto);
  }

  async cancel(id: string) {
    return this.entriesService.cancel(id);
  }

  async cashFlow(query: CashFlowQueryDto) {
    return this.reportsService.cashFlow(query);
  }

  async dashboard(query: FinanceDashboardQueryDto) {
    return this.reportsService.dashboard(query);
  }

  async paymentBreakdown(query: FinancePaymentReportQueryDto) {
    return this.reportsService.paymentBreakdown(query);
  }

  async agingReport(query: AgingReportQueryDto) {
    return this.reportsService.agingReport(query);
  }
}
