import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { PixService } from './pix.service.js';
import { OfxService } from './ofx.service.js';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, PixService, OfxService],
  exports: [FinanceService, PixService, OfxService],
})
export class FinanceModule {}

