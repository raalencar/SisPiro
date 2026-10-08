import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinancialDirection,
  FinancialEntryStatus,
  FinancialPaymentMethod,
} from '@prisma/client';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

export class FinanceEntriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FinancialDirection })
  @IsOptional()
  @IsEnum(FinancialDirection)
  direction?: FinancialDirection;

  @ApiPropertyOptional({ enum: FinancialEntryStatus })
  @IsOptional()
  @IsEnum(FinancialEntryStatus)
  status?: FinancialEntryStatus;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueFrom?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueUntil?: string;
}

export class CashFlowQueryDto {
  @ApiProperty({ format: 'date', example: '2026-10-01' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ format: 'date', example: '2026-10-31' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class FinanceDashboardQueryDto extends CashFlowQueryDto {}

export class FinancePaymentReportQueryDto extends CashFlowQueryDto {}

export class CreateFinancialEntryDto {
  @ApiProperty({ enum: FinancialDirection })
  @IsEnum(FinancialDirection)
  direction!: FinancialDirection;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  counterparty!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ minimum: 0.01, maximum: 9999999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  amount!: number;

  @ApiProperty({ format: 'date', example: '2026-10-31' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  reference?: string;
}

export class CreateFinancialPaymentDto {
  @ApiProperty({ minimum: 0.01, maximum: 9999999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  amount!: number;

  @ApiProperty({ enum: FinancialPaymentMethod })
  @IsEnum(FinancialPaymentMethod)
  method!: FinancialPaymentMethod;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500)
  notes?: string;
}
