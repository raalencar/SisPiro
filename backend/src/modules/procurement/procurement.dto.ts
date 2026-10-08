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
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseStatus } from '@prisma/client';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

const normalizeTaxIdInput = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[./-]/g, '') : value;

export class SuppliersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  active?: boolean;
}

export class CreateSupplierDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  legalName!: string;

  @ApiProperty({ example: '12.345.678/0001-95' })
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
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCr?: boolean;

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
}

export class CreatePurchaseItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 0.01, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  orderedQuantity!: number;

  @ApiProperty({ minimum: 0, maximum: 9999999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  unitCost!: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreatePurchaseItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}

export class ReceivePurchaseItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  purchaseItemId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  magazineId!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(50)
  lotNumber!: string;

  @ApiProperty({ minimum: 0.01, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  quantity!: number;

  @ApiProperty({ format: 'date', example: '2026-01-15' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  manufacturedAt!: string;

  @ApiProperty({ format: 'date', example: '2028-01-15' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiresAt!: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  manufacturerOrImporter!: string;
}

export class ReceivePurchaseDto {
  @ApiProperty({ format: 'date', example: '2026-10-31' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate!: string;

  @ApiProperty({
    maxLength: 100,
    description: 'Referência da nota fiscal/fatura deste recebimento.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  invoiceReference!: string;

  @ApiProperty({ type: [ReceivePurchaseItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: ReceivePurchaseItemDto) => item.purchaseItemId)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseItemDto)
  items!: ReceivePurchaseItemDto[];
}

export class PurchasesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PurchaseStatus })
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;
}
