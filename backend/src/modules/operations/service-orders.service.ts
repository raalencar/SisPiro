import { Injectable } from '@nestjs/common';
import {
  ApproveServiceOrderDto,
  CancelServiceOrderDto,
  CloseServiceOrderDto,
  CreateServiceOrderDto,
  ServiceOrdersQueryDto,
  ServiceOrdersReportQueryDto,
  UpdateServiceOrderDto,
} from './service-orders.dto.js';
import { ServiceOrdersBudgetService } from './services/service-orders-budget.service.js';
import { ServiceOrdersLifecycleService } from './services/service-orders-lifecycle.service.js';
import { ServiceOrdersQueryService } from './services/service-orders-query.service.js';

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly queryService: ServiceOrdersQueryService,
    private readonly budgetService: ServiceOrdersBudgetService,
    private readonly lifecycleService: ServiceOrdersLifecycleService,
  ) {}

  async list(query: ServiceOrdersQueryDto) {
    return this.queryService.list(query);
  }

  async report(query: ServiceOrdersReportQueryDto) {
    return this.queryService.report(query);
  }

  async get(id: string) {
    return this.queryService.get(id);
  }

  async create(dto: CreateServiceOrderDto) {
    return this.budgetService.create(dto);
  }

  async update(id: string, dto: UpdateServiceOrderDto) {
    return this.budgetService.update(id, dto);
  }

  async approve(id: string, dto: ApproveServiceOrderDto) {
    return this.lifecycleService.approve(id, dto);
  }

  async start(id: string) {
    return this.lifecycleService.start(id);
  }

  async cancel(id: string, dto?: CancelServiceOrderDto) {
    return this.lifecycleService.cancel(id, dto);
  }

  async close(id: string, dto: CloseServiceOrderDto) {
    return this.lifecycleService.close(id, dto);
  }
}
