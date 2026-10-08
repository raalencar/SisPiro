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
import { Roles } from '../auth/auth.decorators.js';
import {
  ApproveServiceOrderDto,
  CloseServiceOrderDto,
  CreateServiceOrderDto,
  ServiceOrdersQueryDto,
} from './service-orders.dto.js';
import { ServiceOrdersService } from './service-orders.service.js';

@ApiTags('Ordens de serviço')
@ApiBearerAuth()
@Roles(UserRole.OPERACOES)
@Controller('operations/orders')
export class ServiceOrdersController {
  constructor(private readonly orders: ServiceOrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista ordens de serviço com paginação, busca e filtro de status.',
  })
  list(@Query() query: ServiceOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria orçamento de OS com itens vinculados a lotes rastreáveis.',
  })
  @ApiCreatedResponse({
    description: 'Orçamento criado; nenhum estoque reservado ainda.',
  })
  create(@Body() dto: CreateServiceOrderDto) {
    return this.orders.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta uma OS, itens, cliente e reserva de NEQ.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.get(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary:
      'Aprova orçamento após validar cliente, CR, blaster e reservar atomicamente os lotes.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveServiceOrderDto,
  ) {
    return this.orders.approve(id, dto);
  }

  @Post(':id/start')
  @ApiOperation({
    summary: 'Inicia montagem e mantém a reserva de estoque da OS.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  start(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.start(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancela orçamento ou aprovação e libera reserva de estoque.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.cancel(id);
  }

  @Post(':id/close')
  @ApiOperation({
    summary:
      'Registra relatório de queima, baixa consumo real e libera sobras reservadas.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CloseServiceOrderDto,
  ) {
    return this.orders.close(id, dto);
  }
}
