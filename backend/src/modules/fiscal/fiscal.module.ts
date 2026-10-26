import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FiscalController } from './fiscal.controller.js';
import { FiscalService } from './fiscal.service.js';
import { FISCAL_GATEWAY } from './fiscal.types.js';
import { FiscalSandboxAdapter } from './adapters/fiscal-sandbox.adapter.js';
import { FocusNfeAdapter } from './adapters/focus-nfe.adapter.js';

@Module({
  imports: [ConfigModule],
  controllers: [FiscalController],
  providers: [
    FiscalSandboxAdapter,
    FocusNfeAdapter,
    {
      provide: FISCAL_GATEWAY,
      useFactory: (configService: ConfigService, sandbox: FiscalSandboxAdapter, focusNfe: FocusNfeAdapter) => {
        const provider = configService.get<string>('FISCAL_PROVIDER', 'sandbox');
        return provider.toLowerCase() === 'focusnfe' ? focusNfe : sandbox;
      },
      inject: [ConfigService, FiscalSandboxAdapter, FocusNfeAdapter],
    },
    FiscalService,
  ],
  exports: [FiscalService, FISCAL_GATEWAY],
})
export class FiscalModule {}
