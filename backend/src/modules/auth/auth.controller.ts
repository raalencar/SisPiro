import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  CreateAdminDto,
  LoginDto,
  MfaDisableDto,
  MfaEnableDto,
  MfaVerifyLoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
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
  bootstrap(@Body() dto: CreateAdminDto, @Ip() ip: string) {
    return this.auth.bootstrap(dto, ip);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica o usuário e emite tokens (ou desafio MFA se ativo).' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Post('login/mfa')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conclui login autenticando o segundo fator (desafio MFA).' })
  verifyMfaLogin(@Body() dto: MfaVerifyLoginDto, @Ip() ip: string) {
    return this.auth.verifyMfaLogin(dto, ip);
  }

  @Post('password-reset/request')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Solicita recuperação de senha e despacha instruções de redefinição por e-mail.',
  })
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Ip() ip: string,
  ) {
    return this.auth.requestPasswordReset(dto, ip);
  }

  @Post('password-reset/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirma redefinição de senha com token de uso único e revoga todas as sessões.',
  })
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia configuração de MFA gerando chave TOTP e URL de pareamento.',
  })
  setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setupMfa(user);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Ativa MFA confirmando código TOTP e retorna códigos de backup de uso único.',
  })
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaEnableDto) {
    return this.auth.enableMfa(user, dto);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desativa MFA exigindo a senha atual do usuário.',
  })
  disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaDisableDto,
  ) {
    return this.auth.disableMfa(user, dto);
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
