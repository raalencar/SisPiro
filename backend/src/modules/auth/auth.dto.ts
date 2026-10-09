import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

export class CreateAdminDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ maxLength: 128, writeOnly: true })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    description: 'Código TOTP de 6 dígitos ou código de backup (se MFA estiver ativo)',
    maxLength: 16,
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  mfaCode?: string;
}

export class MfaEnableDto {
  @ApiProperty({
    description: 'Código TOTP de 6 dígitos gerado pelo app autenticador',
    minLength: 6,
    maxLength: 8,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code!: string;
}

export class MfaDisableDto {
  @ApiProperty({
    description: 'Senha atual do usuário para confirmar a desativação',
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @MaxLength(128)
  currentPassword!: string;
}

export class MfaVerifyLoginDto {
  @ApiProperty({
    description: 'Token de desafio MFA emitido na primeira etapa de login',
  })
  @IsString()
  mfaToken!: string;

  @ApiProperty({
    description: 'Código TOTP de 6 dígitos ou código de backup',
    minLength: 6,
    maxLength: 16,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(16)
  code!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({
    description: 'Token opaco de uso único recebido para redefinição',
    minLength: 32,
    maxLength: 128,
  })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(80)
  @MaxLength(120)
  refreshToken!: string;
}

export class CreateUserDto extends CreateAdminDto {
  @ApiProperty({ enum: UserRole, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];
}

export class UsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  active?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ enum: UserRole, isArray: true, minItems: 1 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty({ maxLength: 128, writeOnly: true })
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
