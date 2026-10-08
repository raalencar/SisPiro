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
  BlastersQueryDto,
  CheckBlasterEligibilityDto,
  CreateBlasterDto,
  UpdateBlasterDto,
} from './blasters.dto.js';
import { BlastersService } from './blasters.service.js';

@ApiTags('Blasters e equipes')
@ApiBearerAuth()
@Roles(UserRole.OPERACOES)
@Controller('blasters')
export class BlastersController {
  constructor(private readonly blasters: BlastersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista profissionais, com status de habilitação.' })
  list(@Query() query: BlastersQueryDto) {
    return this.blasters.list(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastra blaster com CPF e validade da habilitação.',
  })
  @ApiCreatedResponse({ description: 'Blaster cadastrado.' })
  create(@Body() dto: CreateBlasterDto) {
    return this.blasters.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta cadastro e validade do blaster.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.blasters.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza cadastro, habilitação ou estado ativo.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBlasterDto,
  ) {
    return this.blasters.update(id, dto);
  }

  @Post(':id/eligibility')
  @ApiOperation({
    summary: 'Verifica se o blaster estará habilitado na data do evento.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  checkEligibility(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckBlasterEligibilityDto,
  ) {
    return this.blasters.checkEligibility(id, dto);
  }
}
