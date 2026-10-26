import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators.js';
import { FiscalService } from './fiscal.service.js';
import {
  EmitSaleNFeDto,
  EmitSaleNFCeDto,
  EmitOrderNFSeDto,
  CancelFiscalDocumentDto,
  FiscalDocumentsQueryDto,
} from './fiscal.dto.js';

@ApiTags('Módulo Fiscal (NF-e, NFC-e, NFS-e)')
@ApiBearerAuth()
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Get('documents')
  @Roles(UserRole.ADMIN, UserRole.COMERCIAL, UserRole.OPERACOES)
  @ApiOperation({ summary: 'Lista documentos fiscais emitidos (NF-e, NFC-e, NFS-e) com filtros e paginação.' })
  @ApiOkResponse({ description: 'Lista paginada de documentos fiscais.' })
  listDocuments(@Query() query: FiscalDocumentsQueryDto) {
    return this.fiscalService.listDocuments(query);
  }

  @Get('documents/:id')
  @Roles(UserRole.ADMIN, UserRole.COMERCIAL, UserRole.OPERACOES)
  @ApiOperation({ summary: 'Busca detalhes de um documento fiscal específico.' })
  @ApiParam({ name: 'id', description: 'ID do documento fiscal' })
  @ApiOkResponse({ description: 'Detalhes completos do documento fiscal.' })
  getDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.fiscalService.getDocument(id);
  }

  @Post('nfe')
  @Roles(UserRole.ADMIN, UserRole.COMERCIAL)
  @ApiOperation({ summary: 'Emite NF-e (Modelo 55) para uma venda faturada com destinatário identificado.' })
  @ApiCreatedResponse({ description: 'NF-e autorizada/processada pela SEFAZ.' })
  emitNFe(@Body() dto: EmitSaleNFeDto) {
    return this.fiscalService.emitSaleNFe(dto);
  }

  @Post('nfce')
  @Roles(UserRole.ADMIN, UserRole.COMERCIAL)
  @ApiOperation({ summary: 'Emite NFC-e (Modelo 65) para venda balcão/consumidor final.' })
  @ApiCreatedResponse({ description: 'NFC-e autorizada/processada pela SEFAZ.' })
  emitNFCe(@Body() dto: EmitSaleNFCeDto) {
    return this.fiscalService.emitSaleNFCe(dto);
  }

  @Post('nfse')
  @Roles(UserRole.ADMIN, UserRole.OPERACOES)
  @ApiOperation({ summary: 'Emite NFS-e para prestação de serviços pirotécnicos e queima de fogos vinculada a uma OS.' })
  @ApiCreatedResponse({ description: 'NFS-e autorizada/processada pela Prefeitura.' })
  emitNFSe(@Body() dto: EmitOrderNFSeDto) {
    return this.fiscalService.emitOrderNFSe(dto);
  }

  @Post('documents/:id/cancel')
  @Roles(UserRole.ADMIN, UserRole.COMERCIAL, UserRole.OPERACOES)
  @ApiOperation({ summary: 'Cancela documento fiscal autorizado mediante justificativa legal perante a SEFAZ/Prefeitura.' })
  @ApiParam({ name: 'id', description: 'ID do documento fiscal' })
  @ApiOkResponse({ description: 'Documento fiscal cancelado com sucesso.' })
  cancelDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelFiscalDocumentDto,
  ) {
    return this.fiscalService.cancelDocument(id, dto);
  }
}
