import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { CommercialController } from './commercial.controller.js';
import { CommercialService } from './commercial.service.js';

@Module({
  controllers: [CustomersController, CommercialController],
  providers: [CustomersService, CommercialService],
  exports: [CustomersService, CommercialService],
})
export class CommercialModule {}
