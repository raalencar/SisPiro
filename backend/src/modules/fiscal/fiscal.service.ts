import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  FiscalGateway,
  NFeEmissionData,
  NFCeEmissionData,
  NFSeEmissionData,
} from './fiscal.types.js';
import { FISCAL_GATEWAY } from './fiscal.types.js';
import {
  EmitSaleNFeDto,
  EmitSaleNFCeDto,
  EmitOrderNFSeDto,
  CancelFiscalDocumentDto,
  FiscalDocumentsQueryDto,
} from './fiscal.dto.js';
import { FiscalDocumentStatus, FiscalDocumentType, Prisma } from '@prisma/client';

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FISCAL_GATEWAY) private readonly fiscalGateway: FiscalGateway,
  ) {}

  private async getNextNumber(type: FiscalDocumentType, series: number): Promise<number> {
    const lastDoc = await this.prisma.fiscalDocument.findFirst({
      where: { type, series },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return (lastDoc?.number ?? 0) + 1;
  }

  async emitSaleNFe(dto: EmitSaleNFeDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            productLot: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venda #${dto.saleId} não encontrada.`);
    }

    if (!sale.customer || !sale.customer.taxId) {
      throw new BadRequestException('A emissão de NF-e (Modelo 55) exige cliente cadastrado com CPF ou CNPJ.');
    }

    const existingActive = await this.prisma.fiscalDocument.findFirst({
      where: {
        saleId: sale.id,
        type: FiscalDocumentType.NFE,
        status: { in: [FiscalDocumentStatus.AUTORIZADO, FiscalDocumentStatus.PROCESSANDO] },
      },
    });

    if (existingActive) {
      throw new BadRequestException(`Esta venda já possui a NF-e nº ${existingActive.number} autorizada.`);
    }

    const series = dto.series ?? 1;
    const number = await this.getNextNumber(FiscalDocumentType.NFE, series);

    const emissionData: NFeEmissionData = {
      number,
      series,
      natureOfOperation: dto.natureOfOperation || 'Venda de mercadoria adquirida de terceiros',
      notes: dto.notes,
      totalAmount: Number(sale.total),
      recipient: {
        taxId: sale.customer.taxId,
        legalName: sale.customer.legalName,
        crNumber: sale.customer.crNumber || undefined,
        hasCr: Boolean(sale.customer.crNumber),
      },
      items: sale.items.map((item: any) => ({
        code: item.product.code,
        description: item.product.name,
        ncm: '3604.10.00', // NCM Padrão Pirotecnia
        cfop: '5102',
        quantity: Number(item.quantity),
        unit: 'UN',
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.subtotal),
      })),
    };

    const result = await this.fiscalGateway.emitNFe(emissionData);

    const fiscalDoc = await this.prisma.fiscalDocument.create({
      data: {
        type: FiscalDocumentType.NFE,
        status: result.status,
        number,
        series,
        accessKey: result.accessKey,
        protocol: result.protocol,
        totalAmount: sale.total,
        danfeUrl: result.danfeUrl,
        xmlUrl: result.xmlUrl,
        errorMessage: result.errorMessage,
        issuedAt: result.issuedAt,
        saleId: sale.id,
      },
    });

    this.logger.log(`NF-e #${number} emitida com sucesso para venda #${sale.code} (Status: ${result.status})`);
    return fiscalDoc;
  }

  async emitSaleNFCe(dto: EmitSaleNFCeDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venda #${dto.saleId} não encontrada.`);
    }

    const existingActive = await this.prisma.fiscalDocument.findFirst({
      where: {
        saleId: sale.id,
        type: FiscalDocumentType.NFCE,
        status: { in: [FiscalDocumentStatus.AUTORIZADO, FiscalDocumentStatus.PROCESSANDO] },
      },
    });

    if (existingActive) {
      throw new BadRequestException(`Esta venda já possui a NFC-e nº ${existingActive.number} autorizada.`);
    }

    const series = dto.series ?? 1;
    const number = await this.getNextNumber(FiscalDocumentType.NFCE, series);

    const emissionData: NFCeEmissionData = {
      number,
      series,
      paymentMethod: 'DINHEIRO',
      totalAmount: Number(sale.total),
      recipient: sale.customer
        ? {
            taxId: sale.customer.taxId,
            legalName: sale.customer.legalName,
          }
        : undefined,
      items: sale.items.map((item: any) => ({
        code: item.product.code,
        description: item.product.name,
        ncm: '3604.10.00',
        cfop: '5102',
        quantity: Number(item.quantity),
        unit: 'UN',
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.subtotal),
      })),
    };

    const result = await this.fiscalGateway.emitNFCe(emissionData);

    const fiscalDoc = await this.prisma.fiscalDocument.create({
      data: {
        type: FiscalDocumentType.NFCE,
        status: result.status,
        number,
        series,
        accessKey: result.accessKey,
        protocol: result.protocol,
        totalAmount: sale.total,
        danfeUrl: result.danfeUrl,
        xmlUrl: result.xmlUrl,
        errorMessage: result.errorMessage,
        issuedAt: result.issuedAt,
        saleId: sale.id,
      },
    });

    this.logger.log(`NFC-e #${number} emitida com sucesso para venda #${sale.code}`);
    return fiscalDoc;
  }

  async emitOrderNFSe(dto: EmitOrderNFSeDto) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: dto.serviceOrderId },
      include: {
        customer: true,
        responsibleBlaster: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Ordem de Serviço #${dto.serviceOrderId} não encontrada.`);
    }

    if (!order.contractedAmount || Number(order.contractedAmount) <= 0) {
      throw new BadRequestException('A Ordem de Serviço deve possuir valor contratado válido para emissão de NFS-e.');
    }

    const existingActive = await this.prisma.fiscalDocument.findFirst({
      where: {
        serviceOrderId: order.id,
        type: FiscalDocumentType.NFSE,
        status: { in: [FiscalDocumentStatus.AUTORIZADO, FiscalDocumentStatus.PROCESSANDO] },
      },
    });

    if (existingActive) {
      throw new BadRequestException(`Esta Ordem de Serviço já possui a NFS-e nº ${existingActive.number} autorizada.`);
    }

    const series = dto.series ?? 1;
    const number = await this.getNextNumber(FiscalDocumentType.NFSE, series);

    const emissionData: NFSeEmissionData = {
      number,
      series,
      recipient: {
        taxId: order.customer.taxId,
        legalName: order.customer.legalName,
      },
      serviceDescription:
        dto.serviceDescription ||
        `Prestação de serviços pirotécnicos e queima de fogos de artifício no local: ${order.eventLocation}. Blaster Responsável: ${order.responsibleBlaster?.name || 'SisPiro Equipe'}. ART Nº: ${order.artNumber || 'N/A'}.`,
      totalAmount: Number(order.contractedAmount),
      eventLocation: order.eventLocation,
      artNumber: order.artNumber || undefined,
      blasterName: order.responsibleBlaster?.name,
    };

    const result = await this.fiscalGateway.emitNFSe(emissionData);

    const fiscalDoc = await this.prisma.fiscalDocument.create({
      data: {
        type: FiscalDocumentType.NFSE,
        status: result.status,
        number,
        series,
        accessKey: result.accessKey,
        protocol: result.protocol,
        totalAmount: order.contractedAmount,
        danfeUrl: result.danfeUrl,
        xmlUrl: result.xmlUrl,
        errorMessage: result.errorMessage,
        issuedAt: result.issuedAt,
        serviceOrderId: order.id,
      },
    });

    this.logger.log(`NFS-e #${number} emitida com sucesso para OS #${order.code}`);
    return fiscalDoc;
  }

  async cancelDocument(id: string, dto: CancelFiscalDocumentDto) {
    const document = await this.prisma.fiscalDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Documento fiscal #${id} não encontrado.`);
    }

    if (document.status === FiscalDocumentStatus.CANCELADO) {
      throw new BadRequestException('Este documento fiscal já se encontra cancelado.');
    }

    if (document.status !== FiscalDocumentStatus.AUTORIZADO) {
      throw new BadRequestException(`Não é possível cancelar um documento com status "${document.status}".`);
    }

    if (!document.accessKey) {
      throw new BadRequestException('Documento fiscal não possui chave de acesso válida para cancelamento.');
    }

    const result = await this.fiscalGateway.cancelDocument({
      accessKey: document.accessKey,
      protocol: document.protocol || undefined,
      reason: dto.reason,
    });

    const updated = await this.prisma.fiscalDocument.update({
      where: { id },
      data: {
        status: result.status,
        cancelledAt: result.cancelledAt,
        cancelReason: dto.reason,
      },
    });

    this.logger.log(`Documento fiscal #${document.number} cancelado com sucesso. Justificativa: ${dto.reason}`);
    return updated;
  }

  async listDocuments(query: FiscalDocumentsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FiscalDocumentWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.saleId) {
      where.saleId = query.saleId;
    }

    if (query.serviceOrderId) {
      where.serviceOrderId = query.serviceOrderId;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      const numTerm = parseInt(term, 10);
      where.OR = [
        { accessKey: { contains: term, mode: 'insensitive' } },
        { protocol: { contains: term, mode: 'insensitive' } },
        ...(Number.isInteger(numTerm) ? [{ number: numTerm }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.fiscalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sale: {
            select: {
              code: true,
              total: true,
              customer: { select: { legalName: true, taxId: true } },
            },
          },
          serviceOrder: {
            select: {
              code: true,
              contractedAmount: true,
              eventLocation: true,
              customer: { select: { legalName: true, taxId: true } },
            },
          },
        },
      }),
      this.prisma.fiscalDocument.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDocument(id: string) {
    const doc = await this.prisma.fiscalDocument.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            customer: true,
            items: {
              include: {
                product: true,
                productLot: true,
              },
            },
          },
        },
        serviceOrder: {
          include: {
            customer: true,
            responsibleBlaster: true,
          },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Documento fiscal #${id} não encontrado.`);
    }

    return doc;
  }
}
