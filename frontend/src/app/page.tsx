import Link from "next/link";
import { ApiHealthPanel } from "@/components/api-health";
import { Icon } from "@/components/icon";
import { modules } from "@/lib/modules";

const focusCards = [
  {
    number: "01",
    title: "Rastreabilidade",
    text: "Produtos, lotes e documentos conectados a cada etapa.",
  },
  {
    number: "02",
    title: "Segurança operacional",
    text: "Fluxos críticos preparados para controles no backend.",
  },
  {
    number: "03",
    title: "Conformidade",
    text: "Informações regulatórias claras, sem validações presumidas.",
  },
];

export default function DashboardPage() {
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Central de operações</p>
          <h1>Visão geral</h1>
          <p className="page-heading__description">
            Uma base confiável para conectar pessoas, produtos e operações.
          </p>
        </div>
        <span className="foundation-tag">
          <span className="foundation-tag__dot" aria-hidden="true" />
          Fundação do sistema
        </span>
      </header>

      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-panel__content">
          <p className="eyebrow eyebrow--light">ERP para operações pirotécnicas</p>
          <h2 id="welcome-title">Clareza para operar.<br />Segurança para evoluir.</h2>
          <p>
            Os módulos estão organizados para acompanhar a operação ponta a ponta.
            Recursos de negócio serão habilitados conforme a API estiver disponível.
          </p>
          <Link className="welcome-link" href="/modules/compliance">
            Explorar módulos <Icon name="arrow" size={17} />
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-art__ring welcome-art__ring--outer" />
          <div className="welcome-art__ring welcome-art__ring--inner" />
          <div className="welcome-art__center"><Icon name="spark" size={33} /></div>
          <span className="welcome-art__label">OPERAÇÃO<br />RESPONSÁVEL</span>
          <span className="welcome-art__dot welcome-art__dot--one" />
          <span className="welcome-art__dot welcome-art__dot--two" />
          <span className="welcome-art__dot welcome-art__dot--three" />
        </div>
      </section>

      <div className="dashboard-grid grid">
        <ApiHealthPanel />
        <section className="panel readiness-panel" aria-labelledby="readiness-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Próxima etapa</p>
              <h2 id="readiness-title">Base preparada para integração</h2>
            </div>
            <span className="readiness-icon" aria-hidden="true">
              <Icon name="shield" size={21} />
            </span>
          </div>
          <p className="panel-description">
            As APIs iniciais de estoque já estão disponíveis, assim como
            cadastros de clientes e blasters. As telas ainda precisam ser
            conectadas a esses endpoints; os fluxos de OS e demais módulos
            seguem em implementação no backend.
          </p>
          <div className="readiness-list">
            <span><span className="readiness-list__check">✓</span> Navegação modular</span>
            <span><span className="readiness-list__check">✓</span> Cliente HTTP tipado</span>
            <span><span className="readiness-list__check">✓</span> APIs iniciais de estoque e cadastros</span>
            <span><span className="readiness-list__pending">○</span> Integração das telas de negócio</span>
          </div>
        </section>
      </div>

      <section className="section-block" aria-labelledby="modules-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Áreas do sistema</p>
            <h2 id="modules-title">Módulos de trabalho</h2>
          </div>
          <span className="section-count">{modules.length} módulos previstos</span>
        </div>
        <div className="module-grid grid">
          {modules.map((module) => (
            <Link className="module-card" href={`/modules/${module.slug}`} key={module.slug}>
              <span className="module-card__icon"><Icon name={module.icon} size={20} /></span>
              <span className="module-card__group">{module.group}</span>
              <strong>{module.title}</strong>
              <span className="module-card__description">{module.description}</span>
              <span className="module-card__footer">
                <span>Aguardando integração</span>
                <Icon name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="focus-strip grid" aria-label="Princípios de produto">
        {focusCards.map((item) => (
          <article className="focus-card" key={item.number}>
            <span>{item.number}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
