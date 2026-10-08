import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Joi from 'joi';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { QueueModule } from './infrastructure/queue.module.js';
import { CommercialModule } from './modules/commercial/commercial.module.js';
import { ComplianceModule } from './modules/compliance/compliance.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { ProcurementModule } from './modules/procurement/procurement.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const { error, value } = Joi.object({
          NODE_ENV: Joi.string()
            .valid('development', 'test', 'production')
            .default('development'),
          PORT: Joi.number().port().default(3000),
          API_PREFIX: Joi.string()
            .pattern(/^[a-zA-Z0-9/_-]+$/)
            .default('api/v1'),
          CORS_ORIGINS: Joi.string().default('http://localhost:3001'),
          DATABASE_URL: Joi.string()
            .uri({ scheme: ['postgresql'] })
            .required(),
          REDIS_HOST: Joi.string().default('localhost'),
          REDIS_PORT: Joi.number().port().default(6379),
          REDIS_PASSWORD: Joi.string().allow('').default(''),
        })
          .unknown(true)
          .validate(config, { abortEarly: false });

        if (error) {
          throw error;
        }

        return value;
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('REDIS_PASSWORD');
        return {
          connection: {
            host: config.getOrThrow<string>('REDIS_HOST'),
            port: config.getOrThrow<number>('REDIS_PORT'),
            ...(password ? { password } : {}),
          },
        };
      },
    }),
    PrismaModule,
    QueueModule,
    HealthModule,
    ComplianceModule,
    InventoryModule,
    OperationsModule,
    CommercialModule,
    FinanceModule,
    ProcurementModule,
  ],
})
export class AppModule {}
