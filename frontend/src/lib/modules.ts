export type ModuleIcon =
  | "shield"
  | "warehouse"
  | "boxes"
  | "users"
  | "spark"
  | "hardhat"
  | "briefcase"
  | "receipt"
  | "chart"
  | "settings";

export type ErpModule = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: ModuleIcon;
  group: string;
  emptyTitle: string;
  emptyDescription: string;
  statusLabel: string;
};

export const modules: ErpModule[] = [
  {
    slug: "compliance",
    title: "Compliance e Regulatório",
    shortTitle: "Compliance",
    description: "Documentos, licenças e obrigações regulatórias.",
    icon: "shield",
    group: "Governança",
    emptyTitle: "A gestão regulatória ainda não está conectada",
    emptyDescription:
      "O backend ainda não oferece consultas ou operações para CRs, licenças, Guias de Tráfego ou mapas regulatórios. Nenhuma validação regulatória está sendo realizada por esta tela.",
    statusLabel: "Planejado",
  },
  {
    slug: "inventory",
    title: "Estoque e WMS",
    shortTitle: "Estoque e paióis",
    description: "Visão de estoque, lotes e paióis.",
    icon: "warehouse",
    group: "Governança",
    emptyTitle: "A API de estoque está disponível; falta conectar esta tela",
    emptyDescription:
      "A tela já consulta produtos, paióis, lotes e movimentações e envia cadastros e operações à API protegida por autenticação.",
    statusLabel: "Tela integrada",
  },
  {
    slug: "products",
    title: "Produtos e Lotes",
    shortTitle: "Produtos e lotes",
    description: "Catálogo, classificação e rastreabilidade.",
    icon: "boxes",
    group: "Cadastros",
    emptyTitle: "A API de produtos e lotes está disponível",
    emptyDescription:
      "O catálogo de produtos está integrado à API de estoque, incluindo classificação PCE e massa NEQ.",
    statusLabel: "Tela integrada",
  },
  {
    slug: "customers",
    title: "Clientes",
    shortTitle: "Clientes",
    description: "Cadastro e documentação de clientes.",
    icon: "users",
    group: "Cadastros",
    emptyTitle: "O cadastro de clientes aguarda integração",
    emptyDescription:
      "O backend disponibiliza cadastro e consulta de clientes, mas a interface deste módulo ainda não está conectada.",
    statusLabel: "API disponível",
  },
  {
    slug: "operations",
    title: "Operações e Ordens de Serviço",
    shortTitle: "Operações / OS",
    description: "Planejamento de eventos e ordens de serviço.",
    icon: "spark",
    group: "Operações",
    emptyTitle: "Ordens de serviço conectadas",
    emptyDescription:
      "Acompanhe orçamentos, reservas e execução de eventos. As regras e transições são validadas pelo backend.",
    statusLabel: "Tela integrada",
  },
  {
    slug: "teams",
    title: "Blasters e Equipes",
    shortTitle: "Blasters e equipes",
    description: "Profissionais habilitados e equipes de operação.",
    icon: "hardhat",
    group: "Cadastros",
    emptyTitle: "A gestão de equipes aguarda integração",
    emptyDescription:
      "O backend disponibiliza cadastro e consulta de blasters, mas a interface deste módulo ainda não está conectada.",
    statusLabel: "API disponível",
  },
  {
    slug: "sales",
    title: "Comercial e Vendas",
    shortTitle: "Comercial e vendas",
    description: "Propostas e relacionamento comercial.",
    icon: "briefcase",
    group: "Gestão",
    emptyTitle: "O fluxo comercial ainda não está conectado",
    emptyDescription:
      "A API já oferece tabelas de preço, orçamentos, vendas e devoluções. A interface ainda não está conectada nem realiza transações comerciais.",
    statusLabel: "API disponível",
  },
  {
    slug: "billing",
    title: "Faturamento e Fiscal",
    shortTitle: "Faturamento / fiscal",
    description: "Documentos fiscais e faturamento.",
    icon: "receipt",
    group: "Gestão",
    emptyTitle: "A integração fiscal ainda não está disponível",
    emptyDescription:
      "O backend não expõe endpoints fiscais. Nenhuma NF-e, NFS-e, MDF-e ou Guia de Tráfego pode ser emitida ou consultada por esta interface.",
    statusLabel: "Planejado",
  },
  {
    slug: "finance",
    title: "Financeiro e Relatórios",
    shortTitle: "Financeiro",
    description: "Indicadores financeiros e relatórios gerenciais.",
    icon: "chart",
    group: "Gestão",
    emptyTitle: "Os dados financeiros aguardam integração",
    emptyDescription:
      "A API já oferece contas a pagar e receber, pagamentos e relatórios financeiros. A interface ainda não consulta esses dados.",
    statusLabel: "API disponível",
  },
  {
    slug: "settings",
    title: "Configurações",
    shortTitle: "Configurações",
    description: "Preferências e futuras integrações do sistema.",
    icon: "settings",
    group: "Sistema",
    emptyTitle: "Configurações ainda não implementadas",
    emptyDescription:
      "A autenticação já está integrada. Preferências da empresa e demais configurações ainda não estão disponíveis nesta interface.",
    statusLabel: "Em preparação",
  },
];

export function getModule(slug: string): ErpModule | undefined {
  return modules.find((item) => item.slug === slug);
}
