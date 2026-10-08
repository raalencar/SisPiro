import Link from "next/link";
import { Icon } from "@/components/icon";
import type { ErpModule } from "@/lib/modules";

export function ModuleEmptyState({ module }: { module: ErpModule }) {
  return (
    <>
      <header className="page-heading">
        <div className="page-heading__identity">
          <span className="page-heading__icon"><Icon name={module.icon} size={24} /></span>
          <div>
            <p className="eyebrow">{module.group}</p>
            <h1>{module.title}</h1>
          </div>
        </div>
        <p className="page-heading__description">{module.description}</p>
      </header>
      <section className="empty-state panel" aria-labelledby="empty-title">
        <div className="empty-state__illustration" aria-hidden="true">
          <Icon name={module.icon} size={30} />
        </div>
        <span className="status-pill status-pill--pending">Aguardando integração</span>
        <h2 id="empty-title">{module.emptyTitle}</h2>
        <p>{module.emptyDescription}</p>
        <Link className="text-link" href="/">
          Voltar à visão geral <Icon name="arrow" size={16} />
        </Link>
      </section>
    </>
  );
}
