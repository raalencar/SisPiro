import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsBooleanString,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

const normalizeTaxIdInput = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[./-]/g, '') : value;

export class CustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBooleanString()
  active?: string;
}

export class CreateCustomerDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  legalName!: string;

  @ApiProperty({
    description:
      'CPF ou CNPJ válido; pode ser enviado formatado ou somente números.',
    example: '12.345.678/0001-95',
  })
  @IsString()
  @Transform(normalizeTaxIdInput)
  @Matches(/^\d{11}$|^\d{14}$/)
  taxId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasCr = false;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  crNumber?: string;

  @ApiPropertyOptional({ example: '2027-12-31', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  crExpiresAt?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Classes PCE explicitamente autorizadas no CR do comprador.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value.map((item: string) => item.trim())
      : value,
  )
  authorizedPceClasses?: string[];
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  legalName?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  hasCr?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  crNumber?: string | null;

  @ApiPropertyOptional({
    example: '2027-12-31',
    format: 'date',
    nullable: true,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  crExpiresAt?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value.map((item: string) => item.trim())
      : value,
  )
  authorizedPceClasses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CheckPceEligibilityDto {
  @ApiProperty({
    type: [String],
    example: ['CLASSE_C', '1.3G'],
    description: 'Classes de risco/PCE exigidas para a operação.',
  })
  @IsArray()
  @MinLength(1, { each: true })
  @IsString({ each: true })
  @ArrayUnique()
  @Transform(({ value }) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value.map((item: string) => item.trim())
      : value,
  )
  classes!: string[];
}
