import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FiscalDocumentType, FiscalDocumentStatus } from '@prisma/client';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

export class FiscalDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FiscalDocumentType })
  @IsOptional()
  @IsEnum(FiscalDocumentType)
  type?: FiscalDocumentType;

  @ApiPropertyOptional({ enum: FiscalDocumentStatus })
  @IsOptional()
  @IsEnum(FiscalDocumentStatus)
  status?: FiscalDocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;
}

export class EmitSaleNFeDto {
  @ApiProperty({ description: 'ID da venda a ser faturada em NF-e' })
  @IsUUID()
  @IsNotEmpty()
  saleId!: string;

  @ApiPropertyOptional({ default: 'Venda de mercadoria adquirida de terceiros' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  natureOfOperation?: string;

  @ApiPropertyOptional({ description: 'Observações de interesse do contribuinte' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  series?: number;
}

export class EmitSaleNFCeDto {
  @ApiProperty({ description: 'ID da venda a ser faturada em NFC-e (Balcão)' })
  @IsUUID()
  @IsNotEmpty()
  saleId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  series?: number;
}

export class EmitOrderNFSeDto {
  @ApiProperty({ description: 'ID da Ordem de Serviço concluída para faturamento de serviços pirotécnicos' })
  @IsUUID()
  @IsNotEmpty()
  serviceOrderId!: string;

  @ApiPropertyOptional({ description: 'Descrição detalhada dos serviços de queima pirotécnica' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  serviceDescription?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  series?: number;
}

export class CancelFiscalDocumentDto {
  @ApiProperty({
    description: 'Justificativa do cancelamento (mínimo de 15 caracteres exigido pela SEFAZ)',
    example: 'Venda cancelada por desistência mútua antes da circulação da mercadoria',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(15, { message: 'A justificativa de cancelamento deve ter no mínimo 15 caracteres conforme exigido pela SEFAZ.' })
  @MaxLength(255)
  reason!: string;
}
