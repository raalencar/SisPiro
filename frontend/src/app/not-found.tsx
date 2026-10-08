import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-state panel">
      <span className="status-pill status-pill--pending">Página não encontrada</span>
      <h1>Não encontramos esta área</h1>
      <p>Confira o endereço ou volte para a visão geral do sistema.</p>
      <Link className="text-link" href="/">Voltar à visão geral</Link>
    </section>
  );
}
