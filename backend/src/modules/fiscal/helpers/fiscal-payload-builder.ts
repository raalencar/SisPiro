import type {
  NFeEmissionData,
  NFCeEmissionData,
  NFSeEmissionData,
} from '../fiscal.types.js';
import type { EmitSaleNFeDto, EmitSaleNFCeDto, EmitOrderNFSeDto } from '../fiscal.dto.js';

export function buildNFeEmissionData(
  sale: any,
  dto: EmitSaleNFeDto,
  number: number,
  series: number,
): NFeEmissionData {
  return {
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
}

export function buildNFCeEmissionData(
  sale: any,
  dto: EmitSaleNFCeDto,
  number: number,
  series: number,
): NFCeEmissionData {
  return {
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
}

export function buildNFSeEmissionData(
  order: any,
  dto: EmitOrderNFSeDto,
  number: number,
  series: number,
): NFSeEmissionData {
  return {
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
}
