import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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

  @ApiPropertyOptional({ maxLength: 50, example: 'grp-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  installmentGroup?: string;
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

export class AgingReportQueryDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-10-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  referenceDate?: string;

  @ApiPropertyOptional({ enum: FinancialDirection })
  @IsOptional()
  @IsEnum(FinancialDirection)
  direction?: FinancialDirection;
}

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

  @ApiPropertyOptional({ minimum: 1, maximum: 60, example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(60)
  installmentsCount?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(365)
  intervalDays?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['2026-10-31', '2026-11-30', '2026-12-31'],
  })
  @IsOptional()
  @IsArray()
  @IsDateString({ strict: true }, { each: true })
  customDueDates?: string[];
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

export class GeneratePixDto {
  @ApiPropertyOptional({ example: '12345678000190' })
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional({ example: 'CASA DE FOGOS ESPERANCA' })
  @IsOptional()
  @IsString()
  merchantName?: string;

  @ApiPropertyOptional({ example: 'SAO PAULO' })
  @IsOptional()
  @IsString()
  merchantCity?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expiresInHours?: number;
}

export class PixWebhookDto {
  @ApiProperty({ example: 'SPP00000120261026XYZ' })
  @IsString()
  txid!: string;

  @ApiProperty({ example: 150.0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ example: 'E12345678202610261200abc' })
  @IsOptional()
  @IsString()
  e2eId?: string;
}

export class ReconcileOfxPreviewDto {
  @ApiProperty({ description: 'Conteúdo bruto do arquivo OFX (SGML/XML)' })
  @IsString()
  ofxContent!: string;
}

export class ApplyReconciliationItemDto {
  @ApiProperty({ example: '20261026001827' })
  @IsString()
  fitId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entryId!: string;

  @ApiProperty({ example: 250.0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ format: 'date', example: '2026-10-26' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memo?: string;
}

export class ApplyReconciliationDto {
  @ApiProperty({ type: [ApplyReconciliationItemDto] })
  @IsArray()
  items!: ApplyReconciliationItemDto[];
}
