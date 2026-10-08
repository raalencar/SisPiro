import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialPaymentMethod, SalesQuoteStatus } from '@prisma/client';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

export class SalesQueryDto extends PaginationQueryDto {}

export class SalesQuotesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SalesQuoteStatus })
  @IsOptional()
  @IsEnum(SalesQuoteStatus)
  status?: SalesQuoteStatus;
}

export class PriceListsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;
}

export class CreatePriceListItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 0.01, maximum: 9999999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  unitPrice!: number;
}

export class CreatePriceListDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;

  @ApiPropertyOptional({ example: '2026-10-07', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: '2027-10-07', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveUntil?: string;

  @ApiProperty({ type: [CreatePriceListItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreatePriceListItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreatePriceListItemDto)
  items!: CreatePriceListItemDto[];
}

export class CreateSaleItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productLotId!: string;

  @ApiProperty({ minimum: 0.01, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  quantity!: number;
}

export class CreateSalePayloadDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omitir para venda de balcão sem cadastro.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  priceListId!: string;

  @ApiProperty({ type: [CreateSaleItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateSaleItemDto) => item.productLotId)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

export enum SaleSettlementCondition {
  IMEDIATO = 'IMEDIATO',
  PRAZO = 'PRAZO',
}

export class SaleSettlementDto {
  @ApiProperty({ enum: SaleSettlementCondition })
  @IsEnum(SaleSettlementCondition)
  condition!: SaleSettlementCondition;

  @ApiPropertyOptional({
    enum: FinancialPaymentMethod,
    description: 'Obrigatório quando condition=IMEDIATO.',
  })
  @ValidateIf(
    (settlement: SaleSettlementDto) =>
      settlement.condition === SaleSettlementCondition.IMEDIATO,
  )
  @IsEnum(FinancialPaymentMethod)
  paymentMethod?: FinancialPaymentMethod;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-10-31',
    description: 'Obrigatório quando condition=PRAZO.',
  })
  @ValidateIf(
    (settlement: SaleSettlementDto) =>
      settlement.condition === SaleSettlementCondition.PRAZO,
  )
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}

export class CreateSaleDto extends CreateSalePayloadDto {
  @ApiProperty({ enum: SaleSettlementCondition })
  @IsEnum(SaleSettlementCondition)
  condition!: SaleSettlementCondition;

  @ApiPropertyOptional({ enum: FinancialPaymentMethod })
  @ValidateIf(
    (settlement: SaleSettlementDto) =>
      settlement.condition === SaleSettlementCondition.IMEDIATO,
  )
  @IsEnum(FinancialPaymentMethod)
  paymentMethod?: FinancialPaymentMethod;

  @ApiPropertyOptional({ format: 'date' })
  @ValidateIf(
    (settlement: SaleSettlementDto) =>
      settlement.condition === SaleSettlementCondition.PRAZO,
  )
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}

export class CreateSalesQuoteDto extends CreateSalePayloadDto {}

export class ConvertSalesQuoteDto extends SaleSettlementDto {}

export class CreateSaleReturnItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  saleItemId!: string;

  @ApiProperty({ minimum: 0.01, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  quantity!: number;
}

export class CreateSaleReturnDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ type: [CreateSaleReturnItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateSaleReturnItemDto) => item.saleItemId)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnItemDto)
  items!: CreateSaleReturnItemDto[];
}
