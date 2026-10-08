import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';
import { ServiceOrderStatus } from '@prisma/client';

export class ServiceOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ServiceOrderStatus,
  })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;
}

export class ServiceOrdersReportQueryDto {
  @ApiProperty({ format: 'date', example: '2026-10-01' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ format: 'date', example: '2026-10-31' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class CreateServiceOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productLotId!: string;

  @ApiProperty({ minimum: 0.01, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  plannedQuantity!: number;
}

export class CreateServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({
    description: 'Valor contratado da OS, imutável após sua criação.',
    minimum: 0.01,
    maximum: 9999999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  contractedAmount!: number;

  @ApiProperty({ example: '2027-12-31T20:00:00-03:00' })
  @IsDateString()
  eventAt!: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(500)
  eventLocation!: string;

  @ApiProperty({ type: [CreateServiceOrderItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateServiceOrderItemDto)
  items!: CreateServiceOrderItemDto[];
}

export class ApproveServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  responsibleBlasterId!: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  artNumber?: string;
}

export class FiredServiceOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ minimum: 0, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  firedQuantity!: number;
}

export class CloseServiceOrderDto {
  @ApiProperty({ format: 'date', example: '2026-10-31' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate!: string;

  @ApiProperty({ type: [FiredServiceOrderItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: FiredServiceOrderItemDto) => item.itemId)
  @ValidateNested({ each: true })
  @Type(() => FiredServiceOrderItemDto)
  items!: FiredServiceOrderItemDto[];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reportNotes?: string;
}

export class CancelServiceOrderDto {
  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Motivo do cancelamento da ordem de serviço.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500)
  reason?: string;
}

export class UpdateServiceOrderDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    description: 'Valor contratado da OS.',
    minimum: 0.01,
    maximum: 9999999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  contractedAmount!: number;

  @ApiProperty({ example: '2027-12-31T20:00:00-03:00' })
  @IsDateString()
  eventAt!: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(500)
  eventLocation!: string;

  @ApiProperty({ type: [CreateServiceOrderItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateServiceOrderItemDto)
  items!: CreateServiceOrderItemDto[];
}

