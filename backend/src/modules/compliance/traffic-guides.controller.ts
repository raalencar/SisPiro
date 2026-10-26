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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators.js';
import { TrafficGuidesService } from './traffic-guides.service.js';
import {
  CreateTrafficGuideDto,
  UpdateTrafficGuideStatusDto,
  TrafficGuidesQueryDto,
} from './traffic-guides.dto.js';

@ApiTags('Compliance & Regulatório Militar (Exército Brasileiro - DFPC / SFPC)')
@ApiBearerAuth()
@Controller('compliance/traffic-guides')
export class TrafficGuidesController {
  constructor(private readonly service: TrafficGuidesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERACOES, UserRole.COMERCIAL)
  @ApiOperation({ summary: 'Emite nova Guia de Tráfego (GT) para transporte de Produtos Controlados pelo Exército (PCE).' })
  @ApiCreatedResponse({ description: 'Guia de Tráfego emitida com sucesso.' })
  create(@Body() dto: CreateTrafficGuideDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERACOES, UserRole.COMERCIAL)
  @ApiOperation({ summary: 'Lista Guias de Tráfego emitidas com paginação e filtros regulatórios.' })
  @ApiOkResponse({ description: 'Lista paginada de Guias de Tráfego.' })
  list(@Query() query: TrafficGuidesQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERACOES, UserRole.COMERCIAL)
  @ApiOperation({ summary: 'Obtém detalhes completos de uma Guia de Tráfego militar para visualização ou espelho oficial.' })
  @ApiParam({ name: 'id', description: 'ID da Guia de Tráfego' })
  @ApiOkResponse({ description: 'Dados completos da Guia de Tráfego e itens controlados.' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OPERACOES)
  @ApiOperation({ summary: 'Atualiza o status de trânsito da Guia de Tráfego (EM_TRANSITO, CONCLUIDA, CANCELADA).' })
  @ApiParam({ name: 'id', description: 'ID da Guia de Tráfego' })
  @ApiOkResponse({ description: 'Status da Guia de Tráfego atualizado com sucesso.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrafficGuideStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
