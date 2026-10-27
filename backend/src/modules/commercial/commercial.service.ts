import { Injectable } from '@nestjs/common';
import {
  ConvertSalesQuoteDto,
  CreatePriceListDto,
  CreateProductPromotionDto,
  CreateSaleDto,
  CreateSaleReturnDto,
  CreateSalesQuoteDto,
  PriceListsQueryDto,
  ProductPromotionsQueryDto,
  QuotesConversionReportQueryDto,
  SalesReportQueryDto,
  SalesQuotesQueryDto,
  SalesQueryDto,
  SendSalesQuoteDto,
  UpdateProductPromotionDto,
  UpdateSalesQuoteDto,
} from './commercial.dto.js';
import {
  CommercialReportsService,
  PriceListsService,
  ProductPromotionsService,
  SaleReturnsService,
  SalesQuotesService,
  SalesService,
} from './services/index.js';

@Injectable()
export class CommercialService {
  constructor(
    private readonly priceListsService: PriceListsService,
    private readonly promotionsService: ProductPromotionsService,
    private readonly salesQuotesService: SalesQuotesService,
    private readonly salesService: SalesService,
    private readonly saleReturnsService: SaleReturnsService,
    private readonly reportsService: CommercialReportsService,
  ) {}

  // ================= Price Lists =================
  async listPriceLists(query: PriceListsQueryDto) {
    return this.priceListsService.listPriceLists(query);
  }

  async getPriceList(id: string) {
    return this.priceListsService.getPriceList(id);
  }

  async createPriceList(dto: CreatePriceListDto) {
    return this.priceListsService.createPriceList(dto);
  }

  // ================= Product Promotions =================
  async listProductPromotions(query: ProductPromotionsQueryDto) {
    return this.promotionsService.listProductPromotions(query);
  }

  async getProductPromotion(id: string) {
    return this.promotionsService.getProductPromotion(id);
  }

  async createProductPromotion(dto: CreateProductPromotionDto) {
    return this.promotionsService.createProductPromotion(dto);
  }

  async updateProductPromotion(id: string, dto: UpdateProductPromotionDto) {
    return this.promotionsService.updateProductPromotion(id, dto);
  }

  // ================= Sales Quotes =================
  async listSalesQuotes(query: SalesQuotesQueryDto) {
    return this.salesQuotesService.listSalesQuotes(query);
  }

  async getSalesQuote(id: string) {
    return this.salesQuotesService.getSalesQuote(id);
  }

  async createSalesQuote(dto: CreateSalesQuoteDto) {
    return this.salesQuotesService.createSalesQuote(dto);
  }

  async updateSalesQuote(id: string, dto: UpdateSalesQuoteDto) {
    return this.salesQuotesService.updateSalesQuote(id, dto);
  }

  async sendSalesQuote(id: string, dto?: SendSalesQuoteDto) {
    return this.salesQuotesService.sendSalesQuote(id, dto);
  }

  async cancelSalesQuote(id: string) {
    return this.salesQuotesService.cancelSalesQuote(id);
  }

  // ================= Sales =================
  async listSales(query: SalesQueryDto) {
    return this.salesService.listSales(query);
  }

  async getSale(id: string) {
    return this.salesService.getSale(id);
  }

  async createSale(dto: CreateSaleDto) {
    return this.salesService.createSale(dto);
  }

  async convertSalesQuote(id: string, settlement: ConvertSalesQuoteDto) {
    return this.salesService.convertSalesQuote(id, settlement);
  }

  // ================= Sale Returns =================
  async listSaleReturns(saleId: string) {
    return this.saleReturnsService.listSaleReturns(saleId);
  }

  async createSaleReturn(saleId: string, dto: CreateSaleReturnDto) {
    return this.saleReturnsService.createSaleReturn(saleId, dto);
  }

  // ================= Reports =================
  async salesReport(query: SalesReportQueryDto) {
    return this.reportsService.salesReport(query);
  }

  async quotesConversionReport(query: QuotesConversionReportQueryDto) {
    return this.reportsService.quotesConversionReport(query);
  }
}
