import Link from "next/link";
import { ApiHealthPanel } from "@/components/api-health";
import { Icon } from "@/components/icon";
import { modules } from "@/lib/modules";

const quickActions = [
  {
    href: "/modules/operations",
    label: "Nova Ordem de Serviço",
    icon: "spark" as const,
    description: "Orçamento de show, blaster e ART",
  },
  {
    href: "/modules/sales",
    label: "Venda Balcão (PDV)",
    icon: "briefcase" as const,
    description: "Checkout imediato com PIX e estoque",
  },
  {
    href: "/modules/compliance",
    label: "Emitir Guia de Tráfego (GT)",
    icon: "shield" as const,
    description: "Autorização de transporte militar DFPC",
  },
  {
    href: "/modules/billing",
    label: "Faturamento & NF-e",
    icon: "receipt" as const,
    description: "Emissão fiscal SEFAZ (NF-e, NFC-e, NFS-e)",
  },
  {
    href: "/modules/inventory",
    label: "Movimentação de Paiol",
    icon: "boxes" as const,
    description: "Entrada, desmembramento e travas NEQ",
  },
];

export default function DashboardPage() {
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Central de Operações Pirotécnicas</p>
          <h1>Painel de Controle</h1>
          <p className="page-heading__description">
            Monitoramento operacional em tempo real, conformidade militar (R-105) e gestão financeira integrada.
          </p>
        </div>
        <span className="foundation-tag">
          <span className="foundation-tag__dot" aria-hidden="true" />
          Operação Homologada
        </span>
      </header>

      {/* KPI Cards em Tempo Real */}
      <section className="dashboard-kpi-grid" aria-label="Indicadores operacionais chave">
        <Link href="/modules/operations" className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Ordens de Serviço</span>
            <span className="kpi-card__value">Shows & Eventos</span>
            <span className="kpi-card__subtext">Ciclo completo: Orçamento ➔ Montagem ➔ Queima</span>
          </div>
          <div className="kpi-card__icon kpi-card__icon--amber" aria-hidden="true">
            <Icon name="spark" size={22} />
          </div>
        </Link>

        <Link href="/modules/compliance" className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Conformidade Militar</span>
            <span className="kpi-card__value">Guias de Tráfego</span>
            <span className="kpi-card__subtext">Numeração sequencial anual GT-YYYY/NNNN</span>
          </div>
          <div className="kpi-card__icon kpi-card__icon--emerald" aria-hidden="true">
            <Icon name="shield" size={22} />
          </div>
        </Link>

        <Link href="/modules/inventory" className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Segurança de Paióis</span>
            <span className="kpi-card__value">Capacidade NEQ</span>
            <span className="kpi-card__subtext">Travas atômicas contra sobrecarga explosiva</span>
          </div>
          <div className="kpi-card__icon kpi-card__icon--blue" aria-hidden="true">
            <Icon name="boxes" size={22} />
          </div>
        </Link>

        <Link href="/modules/billing" className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">Fiscal & Faturamento</span>
            <span className="kpi-card__value">NF-e & PIX</span>
            <span className="kpi-card__subtext">SEFAZ Módulo 11 e BR Code dinâmico</span>
          </div>
          <div className="kpi-card__icon kpi-card__icon--purple" aria-hidden="true">
            <Icon name="receipt" size={22} />
          </div>
        </Link>
      </section>

      {/* Ações Rápidas de 1 Clique */}
      <section aria-labelledby="quick-actions-title">
        <p className="eyebrow" id="quick-actions-title">Ações Rápidas</p>
        <div className="quick-actions-bar">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="quick-action-link">
              <Icon name={action.icon} size={16} />
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Grid de Diagnóstico & Monitoramento de Integridade */}
      <div className="dashboard-grid grid">
        <ApiHealthPanel />
        <section className="panel readiness-panel" aria-labelledby="compliance-radar-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Segurança Operacional</p>
              <h2 id="compliance-radar-title">Padrões de Governança Ativos</h2>
            </div>
            <span className="readiness-icon" aria-hidden="true">
              <Icon name="shield" size={21} />
            </span>
          </div>
          <p className="panel-description">
            Os 10 módulos de negócio operam sob transações relacionais ACID no PostgreSQL com validação
            de lotes PCE, controle de validade e registros de auditoria append-only imutáveis.
          </p>
          <div className="readiness-list">
            <span><span className="readiness-list__check">✓</span> Travas pessimistas de NEQ em transação com lock de linha</span>
            <span><span className="readiness-list__check">✓</span> Rastreabilidade total de lote (fabricação, validade e fabricante)</span>
            <span><span className="readiness-list__check">✓</span> Validação de CR de clientes e habilitação de Blasters</span>
            <span><span className="readiness-list__check">✓</span> Emissão fiscal NF-e / NFC-e / NFS-e com cancelamento legal</span>
            <span><span className="readiness-list__check">✓</span> Auditoria transacional com identificação do operador</span>
          </div>
        </section>
      </div>

      {/* Módulos do Sistema */}
      <section className="section-block" aria-labelledby="modules-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Áreas do Sistema</p>
            <h2 id="modules-title">Módulos Integrados</h2>
          </div>
          <span className="section-count">{modules.length} módulos ativos</span>
        </div>
        <div className="module-grid grid">
          {modules.map((module) => (
            <Link className="module-card" href={`/modules/${module.slug}`} key={module.slug}>
              <span className="module-card__icon"><Icon name={module.icon} size={20} /></span>
              <span className="module-card__group">{module.group}</span>
              <strong>{module.title}</strong>
              <span className="module-card__description">{module.description}</span>
              <span className="module-card__footer">
                <span>{module.statusLabel}</span>
                <Icon name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
