import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  CreateAdminDto,
  LoginDto,
  RefreshTokenDto,
} from './auth.dto.js';
import { CurrentUser, Public } from './auth.decorators.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('bootstrap')
  @Public()
  @ApiOperation({
    summary:
      'Cria o primeiro administrador; fica bloqueado após o primeiro usuário.',
  })
  bootstrap(@Body() dto: CreateAdminDto) {
    return this.auth.bootstrap(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica o usuário e emite tokens.' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotaciona o refresh token e emite novo JWT.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga a sessão apresentada pelo refresh token.' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o usuário da sessão atual.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Patch('me/password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Altera a senha atual e revoga todas as sessões do usuário.',
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user, dto);
  }
}
