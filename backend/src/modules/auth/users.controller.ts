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
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from './auth.constants.js';
import { CurrentUser, Roles } from './auth.decorators.js';
import { CreateUserDto, UpdateUserDto, UsersQueryDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('Usuários')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários com paginação e filtros.' })
  list(@Query() query: UsersQueryDto) {
    return this.auth.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta os dados de acesso de um usuário.' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.auth.getUser(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria usuário com perfis de acesso.' })
  @ApiCreatedResponse({ description: 'Usuário cadastrado.' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.auth.createUser(actor, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza nome, perfis ou estado ativo do usuário.',
  })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.auth.updateUser(actor, id, dto);
  }
}
