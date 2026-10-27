"use client";

import { Icon } from "@/components/icon";
import type { SfpcMonthlyReport } from "@/lib/api";
import { COMPANY_CONFIG } from "@/lib/company-config";
import { formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";

interface SfpcOfficialModalProps {
  isOpen: boolean;
  sfpcReport: SfpcMonthlyReport | null;
  sfpcMonth: number;
  sfpcYear: number;
  onClose: () => void;
}

export function SfpcOfficialModal({
  isOpen,
  sfpcReport,
  sfpcMonth,
  sfpcYear,
  onClose,
}: SfpcOfficialModalProps) {
  if (!isOpen || !sfpcReport) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content print-document"
        id="sfpc-official-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sfpc-official-title"
        style={{
          maxWidth: "860px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="modal-header no-print">
          <div>
            <p className="eyebrow">Documento Regulatório Militar</p>
            <h2 id="sfpc-official-title">
              Espelho do Mapa Mensal SFPC (R-105)
            </h2>
          </div>
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="print-sheet">
          {/* Cabeçalho Militar */}
          <div className="print-header-military">
            <div className="military-title">
              Ministério da Defesa — Exército Brasileiro
            </div>
            <div className="military-subtitle">
              Comando Logístico (COLOG) · Diretoria de Fiscalização de Produtos
              Controlados (DFPC)
            </div>
            <div className="military-subtitle">
              Serviço de Fiscalização de Produtos Controlados (SFPC)
            </div>
            <h3
              style={{
                marginTop: "0.5rem",
                fontSize: "1.05rem",
                textTransform: "uppercase",
              }}
            >
              Mapa Mensal de Movimentação e Estocagem de PCE — Regulamento R-105
            </h3>
            <div className="military-meta">
              Período de Apuração:{" "}
              <strong>
                {sfpcMonth.toString().padStart(2, "0")}/{sfpcYear}
              </strong>{" "}
              (de {formatDateOnly(sfpcReport.periodStart)} a{" "}
              {formatDateOnly(sfpcReport.periodEnd)})
            </div>
          </div>

          {/* Box de Identificação da Empresa */}
          <div className="print-box">
            <div className="print-box-title">
              Identificação do Estabelecimento Registrado
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: "0.5rem",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span>Razão Social: </span>
                <strong>{COMPANY_CONFIG.legalName}</strong>
              </div>
              <div>
                <span>CNPJ: </span>
                <strong>{COMPANY_CONFIG.taxId}</strong>
              </div>
              <div>
                <span>Certificado de Registro (CR): </span>
                <strong>{COMPANY_CONFIG.crNumber}</strong>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: "0.5rem",
                fontSize: "0.8rem",
                marginTop: "0.3rem",
              }}
            >
              <div>
                <span>Endereço: </span>
                <span>{COMPANY_CONFIG.fullAddress}</span>
              </div>
              <div>
                <span>Validade do CR: </span>
                <strong style={{ color: "#065f46" }}>
                  Vigente · {COMPANY_CONFIG.crRegion}
                </strong>
              </div>
              <div>
                <span>Emissão do Relatório: </span>
                <span>{formatDateTime(new Date().toISOString())}</span>
              </div>
            </div>
          </div>

          {/* Totais Gerais de NEQ */}
          <div className="print-box">
            <div className="print-box-title">
              Balanço de Carga Líquida Explosiva (NEQ)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.5rem",
                textAlign: "center",
                fontSize: "0.8rem",
              }}
            >
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Saldo Anterior
                </div>
                <strong style={{ fontSize: "0.95rem" }}>
                  {formatNumber(
                    Number(sfpcReport.totals.initialBalanceNeqKg),
                    2,
                  )}{" "}
                  kg
                </strong>
              </div>
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Entradas no Mês
                </div>
                <strong style={{ fontSize: "0.95rem", color: "#047857" }}>
                  +
                  {formatNumber(Number(sfpcReport.totals.inflowNeqKg), 2)}{" "}
                  kg
                </strong>
              </div>
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Saídas no Mês
                </div>
                <strong style={{ fontSize: "0.95rem", color: "#b91c1c" }}>
                  -
                  {formatNumber(Number(sfpcReport.totals.outflowNeqKg), 2)}{" "}
                  kg
                </strong>
              </div>
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Saldo Final em Estoque
                </div>
                <strong style={{ fontSize: "0.95rem" }}>
                  {formatNumber(
                    Number(sfpcReport.totals.finalBalanceNeqKg),
                    2,
                  )}{" "}
                  kg
                </strong>
              </div>
            </div>
          </div>

          {/* Tabela de Classes de Risco */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                marginBottom: "0.25rem",
                textTransform: "uppercase",
              }}
            >
              1. Consolidação por Classe de Risco ONU / Exército Brasileiro
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Classe de Risco</th>
                  <th>Qtd Produtos</th>
                  <th>Saldo Anterior</th>
                  <th>Entradas</th>
                  <th>Saídas</th>
                  <th>Saldo Final</th>
                  <th>NEQ Total (kg)</th>
                </tr>
              </thead>
              <tbody>
                {sfpcReport.byRiskClass.map((rc) => (
                  <tr key={rc.riskClass}>
                    <td>
                      <strong>{rc.riskClass}</strong>
                    </td>
                    <td>{rc.productCount}</td>
                    <td>{formatNumber(Number(rc.initialQuantity))}</td>
                    <td>{formatNumber(Number(rc.inflowQuantity))}</td>
                    <td>{formatNumber(Number(rc.outflowQuantity))}</td>
                    <td>
                      <strong>{formatNumber(Number(rc.finalQuantity))}</strong>
                    </td>
                    <td>
                      <strong>{formatNumber(Number(rc.finalNeqKg))} kg</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabela de Produtos PCE */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                marginBottom: "0.25rem",
                textTransform: "uppercase",
              }}
            >
              2. Detalhamento Físico de Produtos Controlados
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Produto / Código</th>
                  <th>Classe</th>
                  <th>UN</th>
                  <th>Saldo Anterior</th>
                  <th>Entradas (Compras/Dev)</th>
                  <th>Saídas (Vendas/OS)</th>
                  <th>Saldo Final</th>
                  <th>NEQ Final</th>
                </tr>
              </thead>
              <tbody>
                {sfpcReport.items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <strong>{item.productName}</strong> ({item.sku})
                    </td>
                    <td>{item.riskClass}</td>
                    <td>{item.unit}</td>
                    <td>{formatNumber(Number(item.initialQuantity))}</td>
                    <td>{formatNumber(Number(item.inflowBreakdown.total))}</td>
                    <td>{formatNumber(Number(item.outflowBreakdown.total))}</td>
                    <td>
                      <strong>{formatNumber(Number(item.finalQuantity))}</strong>
                    </td>
                    <td>{formatNumber(Number(item.finalNeqKg))} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Termo de Responsabilidade Técnica */}
          <div className="print-box" style={{ marginTop: "1rem" }}>
            <div className="print-box-title">
              Termo de Encerramento e Responsabilidade Técnica
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                lineHeight: 1.5,
                margin: 0,
                textAlign: "justify",
              }}
            >
              Declaro sob as penas da lei e em cumprimento às disposições do
              Regulamento para a Fiscalização de Produtos Controlados (R-105) e
              normas complementares do Exército Brasileiro, que as informações
              constantes deste Mapa Mensal espelham com fidedignidade todas as
              entradas, saídas, queimas operacionais e estocagem de produtos
              controlados no período assinalado, mantendo a integridade das
              capacidades máximas autorizadas em NEQ dos paióis e o
              rastreamento obrigatório por lote de fabricação.
            </p>
          </div>

          {/* Assinaturas */}
          <div className="print-signatures-grid">
            <div>
              <div className="print-signature-line">
                <strong>Responsável Técnico / Blaster Pirotécnico</strong>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                  Carteira de Blaster / CREA · CR 98765-SFPC
                </div>
              </div>
            </div>
            <div>
              <div className="print-signature-line">
                <strong>Representante Legal da Empresa</strong>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                  {COMPANY_CONFIG.legalName}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="modal-footer no-print"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            marginTop: "1rem",
          }}
        >
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => window.print()}
          >
            <Icon name="boxes" size={14} />
            Imprimir Mapa Oficial
          </button>
        </div>
      </div>
    </div>
  );
}
