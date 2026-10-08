import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Roles } from '../auth/auth.decorators.js';
import {
  CheckPceEligibilityDto,
  CreateCustomerDto,
  CustomersQueryDto,
  UpdateCustomerDto,
} from './customers.dto.js';
import { CustomersService } from './customers.service.js';

@ApiTags('Clientes e documentação')
@ApiBearerAuth()
@Roles(UserRole.COMERCIAL)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista clientes com paginação, busca e filtro ativo.',
  })
  list(@Query() query: CustomersQueryDto) {
    return this.customers.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra cliente com CPF/CNPJ e dados de CR.' })
  @ApiCreatedResponse({ description: 'Cliente cadastrado.' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta cadastro e documentos do cliente.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customers.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados do cliente, CR e estado ativo.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }

  @Post(':id/pce-eligibility')
  @ApiOperation({
    summary:
      'Verifica os dados de CR e as classes PCE autorizadas no cadastro do cliente.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  checkPceEligibility(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckPceEligibilityDto,
  ) {
    return this.customers.checkPceEligibility(id, dto);
  }
}
