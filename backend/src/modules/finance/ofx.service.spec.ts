import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { FinancialDirection, FinancialEntryStatus } from '@prisma/client';
import { OfxService } from './ofx.service.js';

const SAMPLE_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILESPEC:NONE
NEWFILESPEC:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20261026120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>98765-4
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001120000
<DTEND>20261026120000
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261025120000
<TRNAMT>1500.50
<FITID>FIT_20261025_001
<MEMO>PIX RECEBIDO CLIENTE ESPETACULO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261026120000
<TRNAMT>-320.00
<FITID>FIT_20261026_002
<MEMO>PGTO BOLETO FORNECEDOR POLVORA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>12500.00
<DTASOF>20261026120000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe('OfxService', () => {
  let service: OfxService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      financialPayment: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      financialEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      bankReconciliation: {
        create: vi.fn().mockResolvedValue({ id: 'reconcile-batch-1' }),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    service = new OfxService(mockPrisma);
  });

  describe('parseOfx', () => {
    it('deve extrair dados da conta bancária e transações do arquivo OFX', () => {
      const parsed = service.parseOfx(SAMPLE_OFX);

      expect(parsed.bankId).toBe('341');
      expect(parsed.accountId).toBe('98765-4');
      expect(parsed.transactions).toHaveLength(2);

      const [credit, debit] = parsed.transactions;
      expect(credit.type).toBe('CREDIT');
      expect(credit.amount).toBe(1500.5);
      expect(credit.fitId).toBe('FIT_20261025_001');
      expect(credit.date).toBe('2026-10-25');
      expect(credit.memo).toBe('PIX RECEBIDO CLIENTE ESPETACULO');

      expect(debit.type).toBe('DEBIT');
      expect(debit.amount).toBe(320.0);
      expect(debit.fitId).toBe('FIT_20261026_002');
      expect(debit.date).toBe('2026-10-26');
    });

    it('deve rejeitar arquivo vazio ou inválido', () => {
      expect(() => service.parseOfx('')).toThrow(BadRequestException);
    });
  });

  describe('previewReconciliation', () => {
    it('deve sugerir match exato quando encontra lançamento com mesmo valor e data próxima', async () => {
      mockPrisma.financialPayment.findMany.mockResolvedValue([]);
      mockPrisma.financialEntry.findMany.mockResolvedValue([
        {
          id: 'entry-credit-match',
          code: 2001,
          direction: FinancialDirection.RECEBER,
          description: 'Show de Fogos Reveillon',
          counterparty: 'Prefeitura Municipal',
          dueDate: new Date('2026-10-25'),
          amount: 1500.5,
          creditedAmount: 0,
          status: FinancialEntryStatus.ABERTO,
          payments: [],
        },
      ]);

      const preview = await service.previewReconciliation(SAMPLE_OFX);

      expect(preview.summary.totalTransactions).toBe(2);
      expect(preview.summary.matchedCount).toBe(1);

      const matchedItem = preview.items.find((i) => i.transaction.fitId === 'FIT_20261025_001');
      expect(matchedItem).toBeDefined();
      expect(matchedItem?.matchConfidence).toBe('EXACT');
      expect(matchedItem?.suggestedEntry?.id).toBe('entry-credit-match');
      expect(matchedItem?.suggestedEntry?.remaining).toBe(1500.5);
    });

    it('deve marcar transações já conciliadas previamente com o banco', async () => {
      mockPrisma.financialPayment.findMany.mockResolvedValue([
        { bankFitId: 'FIT_20261025_001' },
      ]);
      mockPrisma.financialEntry.findMany.mockResolvedValue([]);

      const preview = await service.previewReconciliation(SAMPLE_OFX);

      expect(preview.summary.alreadyReconciledCount).toBe(1);
      const item = preview.items.find((i) => i.transaction.fitId === 'FIT_20261025_001');
      expect(item?.alreadyReconciled).toBe(true);
    });
  });

  describe('applyReconciliation', () => {
    it('deve registrar pagamentos conciliados e criar lote de conciliação bancária', async () => {
      mockPrisma.financialEntry.findUnique.mockResolvedValue({
        id: 'entry-credit-match',
        amount: { minus: () => ({ minus: () => ({ lte: () => true }) }) },
        creditedAmount: 0,
        payments: [],
      });

      mockPrisma.financialPayment.create.mockResolvedValue({
        id: 'pay-reconciled-1',
        amount: 1500.5,
      });

      mockPrisma.financialEntry.update.mockResolvedValue({
        id: 'entry-credit-match',
        status: FinancialEntryStatus.PAGO,
      });

      const result = await service.applyReconciliation([
        {
          fitId: 'FIT_20261025_001',
          entryId: 'entry-credit-match',
          amount: 1500.5,
          occurredAt: '2026-10-25',
          memo: 'PIX RECEBIDO CLIENTE',
        },
      ]);

      expect(result.reconciledCount).toBe(1);
      expect(result.batchId).toBe('reconcile-batch-1');
      expect(mockPrisma.financialPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bankFitId: 'FIT_20261025_001',
            reconciled: true,
          }),
        }),
      );
      expect(mockPrisma.bankReconciliation.create).toHaveBeenCalled();
    });
  });
});
