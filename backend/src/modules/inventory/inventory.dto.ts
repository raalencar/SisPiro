import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsInt,
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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, StockMovementType } from '@prisma/client';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBooleanString()
  isPce?: string;
}

export class LotsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  magazineId?: string;
}

export class MovementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productLotId?: string;

  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}

export class CreateProductDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(50)
  sku!: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPce = false;

  @ApiPropertyOptional({
    description: 'Obrigatório para PCE. Exemplos: 1.3G, 1.4G, CLASSE_C.',
    maxLength: 20,
  })
  @ValidateIf((product: CreateProductDto) => product.isPce)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(20)
  riskClass?: string;

  @ApiPropertyOptional({
    description: 'NEQ unitária em gramas; obrigatória e positiva para PCE.',
    minimum: 0,
    maximum: 9999999.999,
  })
  @ValidateIf((product: CreateProductDto) => product.isPce)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999)
  neqGrams?: number;

  @ApiProperty({ maxLength: 10 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(10)
  unit!: string;
}

export class CreateMagazineDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Capacidade máxima do paiol em kg de NEQ.',
    minimum: 0.01,
    maximum: 99999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  maxNeqCapacityKg!: number;

  @ApiProperty({ example: '2027-12-31', format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fireLicenseExpiresAt!: string;
}

export class CreateLotDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  magazineId!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(50)
  lotNumber!: string;

  @ApiProperty({
    description: 'Quantidade inicial do lote.',
    minimum: 0.01,
    maximum: 99999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  quantity!: number;

  @ApiProperty({ example: '2026-01-15', format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  manufacturedAt!: string;

  @ApiProperty({ example: '2028-01-15', format: 'date' })
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

export class CreateMovementDto {
  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productLotId!: string;

  @ApiProperty({
    description:
      'Quantidade positiva para entrada, saída e transferência. No ajuste, positiva adiciona estoque e negativa remove estoque.',
    minimum: -99999999.99,
    maximum: 99999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99999999.99)
  @Max(99999999.99)
  quantity!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Paiol de destino; obrigatório somente para transferência.',
  })
  @ValidateIf(
    (movement: CreateMovementDto) =>
      movement.type === StockMovementType.TRANSFERENCIA,
  )
  @IsUUID()
  destinationMagazineId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  reference?: string;
}
