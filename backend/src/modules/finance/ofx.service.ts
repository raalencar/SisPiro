import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialDirection,
  FinancialEntryStatus,
  FinancialPaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export interface OfxTransaction {
  fitId: string;
  type: 'CREDIT' | 'DEBIT' | 'OTHER';
  amount: number;
  date: string; // YYYY-MM-DD
  memo: string;
  checkNumber?: string;
}

export interface OfxParsedData {
  bankId?: string;
  accountId?: string;
  transactions: OfxTransaction[];
}

export interface ReconciliationSuggestion {
  transaction: OfxTransaction;
  alreadyReconciled: boolean;
  matchConfidence: 'EXACT' | 'APPROXIMATE' | 'NONE';
  suggestedEntry?: {
    id: string;
    code: number;
    direction: FinancialDirection;
    description: string;
    counterparty: string;
    dueDate: string;
    amount: number;
    remaining: number;
    status: FinancialEntryStatus;
  };
}

export interface ReconcilePreviewResult {
  bankId?: string;
  accountId?: string;
  summary: {
    totalTransactions: number;
    totalCredits: number;
    totalDebits: number;
    creditsAmount: number;
    debitsAmount: number;
    matchedCount: number;
    unmatchedCount: number;
    alreadyReconciledCount: number;
  };
  items: ReconciliationSuggestion[];
}

export interface ApplyReconciliationItemDto {
  fitId: string;
  entryId: string;
  amount: number;
  occurredAt: string;
  memo?: string;
}

@Injectable()
export class OfxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Faz o parser do arquivo OFX (suporta SGML padrão e XML)
   */
  parseOfx(content: string): OfxParsedData {
    if (!content || typeof content !== 'string') {
      throw new BadRequestException('Conteúdo do arquivo OFX inválido ou vazio.');
    }

    // Extrai informações da conta
    const bankIdMatch = content.match(/<BANKID>([^<\r\n]+)/i);
    const acctIdMatch = content.match(/<ACCTID>([^<\r\n]+)/i);

    const bankId = bankIdMatch ? bankIdMatch[1].trim() : undefined;
    const accountId = acctIdMatch ? acctIdMatch[1].trim() : undefined;

    // Extrai blocos de transações <STMTTRN>
    const stmttrnBlocks = content.split(/<STMTTRN>/i).slice(1);
    const transactions: OfxTransaction[] = [];

    for (const block of stmttrnBlocks) {
      const trnTypeMatch = block.match(/<TRNTYPE>([^<\r\n]+)/i);
      const dtPostedMatch = block.match(/<DTPOSTED>([^<\r\n]+)/i);
      const trnAmtMatch = block.match(/<TRNAMT>([^<\r\n]+)/i);
      const fitIdMatch = block.match(/<FITID>([^<\r\n]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);
      const checkNumMatch = block.match(/<CHECKNUM>([^<\r\n]+)/i);

      if (!trnAmtMatch || !dtPostedMatch) {
        continue;
      }

      const rawAmt = parseFloat(trnAmtMatch[1].trim().replace(',', '.'));
      if (isNaN(rawAmt)) continue;

      // Data formato OFX: YYYYMMDD ou YYYYMMDDHHMMSS
      const rawDate = dtPostedMatch[1].trim();
      let formattedDate = new Date().toISOString().split('T')[0];
      if (rawDate.length >= 8) {
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        formattedDate = `${year}-${month}-${day}`;
      }

      const fitId = fitIdMatch
        ? fitIdMatch[1].trim()
        : `OFX_${formattedDate}_${Math.abs(rawAmt)}_${transactions.length}`;

      const memo = memoMatch ? memoMatch[1].trim() : 'Lançamento bancário';
      const trnTypeStr = trnTypeMatch ? trnTypeMatch[1].trim().toUpperCase() : '';

      let type: 'CREDIT' | 'DEBIT' | 'OTHER' = 'OTHER';
      if (trnTypeStr === 'CREDIT' || rawAmt > 0) {
        type = 'CREDIT';
      } else if (trnTypeStr === 'DEBIT' || rawAmt < 0) {
        type = 'DEBIT';
      }

      transactions.push({
        fitId,
        type,
        amount: Math.abs(rawAmt),
        date: formattedDate,
        memo,
        checkNumber: checkNumMatch ? checkNumMatch[1].trim() : undefined,
      });
    }

    return {
      bankId,
      accountId,
      transactions,
    };
  }

  /**
   * Cruza as transações do extrato OFX com os lançamentos financeiros do ERP
   */
  async previewReconciliation(ofxContent: string): Promise<ReconcilePreviewResult> {
    const parsed = this.parseOfx(ofxContent);

    if (parsed.transactions.length === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo OFX fornecido.');
    }

    // Coleta FITIDs para conferir se já foram conciliados anteriormente
    const fitIds = parsed.transactions.map((t) => t.fitId);
    const existingPayments = await this.prisma.financialPayment.findMany({
      where: {
        bankFitId: { in: fitIds },
      },
      select: { bankFitId: true },
    });
    const reconciledFitIdSet = new Set(existingPayments.map((p) => p.bankFitId));

    // Busca títulos em aberto ou parciais no financeiro
    const openEntries = await this.prisma.financialEntry.findMany({
      where: {
        status: { in: [FinancialEntryStatus.ABERTO, FinancialEntryStatus.PARCIAL] },
      },
      include: {
        payments: true,
      },
    });

    // Mapeia títulos com seus saldos restantes
    const mappedEntries = openEntries.map((e) => {
      const paid = e.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(e.amount) - Number(e.creditedAmount) - paid;
      return {
        id: e.id,
        code: e.code,
        direction: e.direction,
        description: e.description,
        counterparty: e.counterparty,
        dueDate: e.dueDate.toISOString().split('T')[0],
        amount: Number(e.amount),
        remaining: Number(remaining.toFixed(2)),
        status: e.status,
      };
    });

    const usedEntryIds = new Set<string>();
    const items: ReconciliationSuggestion[] = [];

    let totalCredits = 0;
    let totalDebits = 0;
    let creditsAmount = 0;
    let debitsAmount = 0;
    let matchedCount = 0;
    let alreadyReconciledCount = 0;

    for (const tx of parsed.transactions) {
      if (tx.type === 'CREDIT') {
        totalCredits++;
        creditsAmount += tx.amount;
      } else {
        totalDebits++;
        debitsAmount += tx.amount;
      }

      const isAlready = reconciledFitIdSet.has(tx.fitId);
      if (isAlready) {
        alreadyReconciledCount++;
        items.push({
          transaction: tx,
          alreadyReconciled: true,
          matchConfidence: 'NONE',
        });
        continue;
      }

      // Direção esperada: crédito no banco liquida RECEBER, débito liquida PAGAR
      const targetDirection =
        tx.type === 'CREDIT' ? FinancialDirection.RECEBER : FinancialDirection.PAGAR;

      // Procura primeiro match exato de valor e data próxima (dentro de 5 dias)
      let bestMatch: (typeof mappedEntries)[0] | undefined;
      let matchConfidence: 'EXACT' | 'APPROXIMATE' | 'NONE' = 'NONE';

      const candidates = mappedEntries.filter(
        (e) => e.direction === targetDirection && !usedEntryIds.has(e.id),
      );

      // 1. Procura valor idêntico (diferença < 1 centavo)
      const exactValueCandidates = candidates.filter(
        (e) => Math.abs(e.remaining - tx.amount) < 0.01,
      );

      if (exactValueCandidates.length > 0) {
        // Encontra o mais próximo pela data
        const txTime = new Date(tx.date).getTime();
        exactValueCandidates.sort((a, b) => {
          const diffA = Math.abs(new Date(a.dueDate).getTime() - txTime);
          const diffB = Math.abs(new Date(b.dueDate).getTime() - txTime);
          return diffA - diffB;
        });

        const closest = exactValueCandidates[0];
        const daysDiff = Math.abs(new Date(closest.dueDate).getTime() - txTime) / (86400 * 1000);

        bestMatch = closest;
        matchConfidence = daysDiff <= 7 ? 'EXACT' : 'APPROXIMATE';
      }

      if (bestMatch) {
        usedEntryIds.add(bestMatch.id);
        matchedCount++;
        items.push({
          transaction: tx,
          alreadyReconciled: false,
          matchConfidence,
          suggestedEntry: bestMatch,
        });
      } else {
        items.push({
          transaction: tx,
          alreadyReconciled: false,
          matchConfidence: 'NONE',
        });
      }
    }

    return {
      bankId: parsed.bankId,
      accountId: parsed.accountId,
      summary: {
        totalTransactions: parsed.transactions.length,
        totalCredits,
        totalDebits,
        creditsAmount: Number(creditsAmount.toFixed(2)),
        debitsAmount: Number(debitsAmount.toFixed(2)),
        matchedCount,
        unmatchedCount: parsed.transactions.length - matchedCount - alreadyReconciledCount,
        alreadyReconciledCount,
      },
      items,
    };
  }

  /**
   * Aplica a conciliação bancária das transações confirmadas
   */
  async applyReconciliation(items: ApplyReconciliationItemDto[]) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Nenhum item informado para conciliação.');
    }

    return this.prisma.$transaction(async (tx) => {
      const reconciledResults = [];

      for (const item of items) {
        // Verifica se lançamento existe
        const entry = await tx.financialEntry.findUnique({
          where: { id: item.entryId },
          include: { payments: true },
        });

        if (!entry) {
          throw new NotFoundException(`Lançamento ${item.entryId} não encontrado.`);
        }

        // Verifica se FITID já foi conciliado
        const existingFit = await tx.financialPayment.findFirst({
          where: { bankFitId: item.fitId },
        });
        if (existingFit) {
          continue; // Já conciliado, pula de forma idempotente
        }

        // Define método de pagamento conforme descrição do extrato
        let method: FinancialPaymentMethod = FinancialPaymentMethod.TRANSFERENCIA;
        const memoUpper = (item.memo || '').toUpperCase();
        if (memoUpper.includes('PIX')) {
          method = FinancialPaymentMethod.PIX;
        } else if (memoUpper.includes('BOL') || memoUpper.includes('COB')) {
          method = FinancialPaymentMethod.BOLETO;
        }

        const occurredAt = item.occurredAt ? new Date(item.occurredAt) : new Date();
        const payAmount = new Prisma.Decimal(item.amount);

        // Cria o pagamento
        const payment = await tx.financialPayment.create({
          data: {
            entryId: entry.id,
            amount: payAmount,
            method,
            occurredAt,
            bankFitId: item.fitId,
            reconciled: true,
            reconciledAt: new Date(),
            reference: `OFX_${item.fitId}`,
            notes: `Conciliação bancária OFX: ${item.memo || 'Sem descrição'}`,
          },
        });

        // Recalcula status do lançamento
        const currentPaid = entry.payments.reduce(
          (sum, p) => sum.plus(p.amount),
          new Prisma.Decimal(0),
        );
        const nextPaid = currentPaid.plus(payAmount);
        const outstanding = entry.amount
          .minus(nextPaid)
          .minus(entry.creditedAmount);

        const nextStatus = outstanding.lte(0)
          ? FinancialEntryStatus.PAGO
          : FinancialEntryStatus.PARCIAL;

        await tx.financialEntry.update({
          where: { id: entry.id },
          data: { status: nextStatus },
        });

        reconciledResults.push({
          paymentId: payment.id,
          fitId: item.fitId,
          entryId: entry.id,
          amount: Number(payment.amount),
          newStatus: nextStatus,
        });
      }

      // Registra no histórico de conciliações bancárias
      const totalAmount = reconciledResults.reduce((acc, r) => acc + r.amount, 0);
      const reconciliationRecord = await tx.bankReconciliation.create({
        data: {
          statementDate: new Date(),
          totalCredits: new Prisma.Decimal(totalAmount),
          totalDebits: new Prisma.Decimal(0),
          transactionsCount: items.length,
          reconciledCount: reconciledResults.length,
        },
      });

      return {
        batchId: reconciliationRecord.id,
        reconciledCount: reconciledResults.length,
        results: reconciledResults,
      };
    });
  }
}
