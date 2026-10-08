import { Transform } from 'class-transformer';
import {
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

export class BlastersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBooleanString()
  active?: string;
}

export class CreateBlasterDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    description: 'CPF válido do profissional.',
    example: '52998224725',
  })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[.-]/g, '') : value,
  )
  @Matches(/^\d{11}$/)
  taxId!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(50)
  licenseNumber!: string;

  @ApiProperty({ example: '2027-12-31', format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  licenseExpiresAt!: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(30)
  category?: string;
}

export class UpdateBlasterDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(50)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2027-12-31', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  licenseExpiresAt?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(30)
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CheckBlasterEligibilityDto {
  @ApiProperty({
    example: '2027-12-31T20:00:00-03:00',
    description:
      'Data/hora prevista do evento para a qual será verificada a habilitação.',
  })
  @IsDateString()
  eventAt!: string;
}
