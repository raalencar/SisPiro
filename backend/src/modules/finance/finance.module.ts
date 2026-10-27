import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { PixService } from './pix.service.js';
import { OfxService } from './ofx.service.js';
import { FinanceEntriesService } from './services/finance-entries.service.js';
import { FinanceSettlementsService } from './services/finance-settlements.service.js';
import { FinanceReportsService } from './services/finance-reports.service.js';

@Module({
  controllers: [FinanceController],
  providers: [
    FinanceEntriesService,
    FinanceSettlementsService,
    FinanceReportsService,
    FinanceService,
    PixService,
    OfxService,
  ],
  exports: [FinanceService, PixService, OfxService],
})
export class FinanceModule {}
