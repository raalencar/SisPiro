import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrafficGuideStatus } from '@prisma/client';
import { PaginationQueryDto } from '../inventory/inventory.dto.js';

export class TrafficGuideItemDto {
  @ApiProperty({ description: 'ID do produto controlado (PCE)' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'ID do lote de onde sairá o material' })
  @IsUUID()
  @IsNotEmpty()
  productLotId!: string;

  @ApiProperty({ description: 'Quantidade a ser transportada', example: 50 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Número ONU para transporte perigoso', default: 'UN 0336' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unNumber?: string;

  @ApiPropertyOptional({ description: 'Classe de risco ONU', default: '1.4G' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  riskClass?: string;
}

export class CreateTrafficGuideDto {
  @ApiPropertyOptional({ description: 'ID da NF-e autorizada associada à expedição' })
  @IsOptional()
  @IsUUID()
  fiscalDocumentId?: string;

  @ApiPropertyOptional({ description: 'ID da Ordem de Serviço de espetáculo pirotécnico' })
  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;

  @ApiProperty({ description: 'Paiol de origem da carga' })
  @IsUUID()
  @IsNotEmpty()
  sourceMagazineId!: string;

  @ApiProperty({ description: 'Início da validade do trânsito', example: '2026-10-26T08:00:00.000Z' })
  @IsDateString()
  validFrom!: string;

  @ApiProperty({ description: 'Fim da validade do trânsito', example: '2026-10-28T18:00:00.000Z' })
  @IsDateString()
  validUntil!: string;

  @ApiProperty({ description: 'Município de origem', example: 'Ribeirão Preto' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  originCity!: string;

  @ApiProperty({ description: 'UF de origem', example: 'SP' })
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'UF de origem deve conter 2 letras maiúsculas.' })
  originState!: string;

  @ApiProperty({ description: 'Município de destino', example: 'Campinas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  destinationCity!: string;

  @ApiProperty({ description: 'UF de destino', example: 'SP' })
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'UF de destino deve conter 2 letras maiúsculas.' })
  destinationState!: string;

  @ApiProperty({ description: 'Itinerário planejado (rodovias principais)', example: 'SP-330 (Anhanguera) direto ao local de queima' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  routeDescription!: string;

  @ApiProperty({ description: 'Placa do veículo transportador', example: 'ABC1D23' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  vehiclePlate!: string;

  @ApiProperty({ description: 'UF da placa', example: 'SP' })
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'UF da placa deve conter 2 letras maiúsculas.' })
  vehiclePlateState!: string;

  @ApiPropertyOptional({ description: 'Marca/Modelo do veículo', example: 'Mercedes-Benz Sprinter Furgão' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleModel?: string;

  @ApiProperty({ description: 'Nome completo do motorista habilitado MOPP', example: 'Carlos Alberto da Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  driverName!: string;

  @ApiProperty({ description: 'CPF do motorista', example: '123.456.789-00' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  driverCpf!: string;

  @ApiProperty({ description: 'Número de registro da CNH do motorista', example: '12345678900' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  driverLicense!: string;

  @ApiPropertyOptional({ description: 'Possui certificação MOPP ativa', default: true })
  @IsOptional()
  @IsBoolean()
  hasMopp?: boolean;

  @ApiPropertyOptional({ description: 'ID do Blaster responsável técnico que acompanhará o deslocamento' })
  @IsOptional()
  @IsUUID()
  blasterId?: string;

  @ApiPropertyOptional({ description: 'Observações de segurança militar' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ description: 'Itens de carga controlada transportados', type: [TrafficGuideItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A Guia de Tráfego deve conter pelo menos 1 item controlado.' })
  @ValidateNested({ each: true })
  @Type(() => TrafficGuideItemDto)
  items!: TrafficGuideItemDto[];
}

export class UpdateTrafficGuideStatusDto {
  @ApiProperty({ enum: TrafficGuideStatus, description: 'Novo status da Guia de Tráfego' })
  @IsEnum(TrafficGuideStatus)
  status!: TrafficGuideStatus;

  @ApiPropertyOptional({ description: 'Justificativa para cancelamento ou encerramento antecipado' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class TrafficGuidesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TrafficGuideStatus })
  @IsOptional()
  @IsEnum(TrafficGuideStatus)
  status?: TrafficGuideStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ID do documento fiscal' })
  @IsOptional()
  @IsUUID()
  fiscalDocumentId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID da ordem de serviço' })
  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;
}
