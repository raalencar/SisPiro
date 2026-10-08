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
      "A API já lista paióis, lotes e movimentações e valida capacidade NEQ no recebimento e na transferência. Esta interface ainda não consulta nem altera esses dados.",
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
      "O backend já oferece consulta e cadastro de produtos PCE e lotes rastreáveis. Esta tela ainda não está conectada à API e não está lendo dados do banco.",
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
      "A API já disponibiliza cadastro, consulta e verificação dos dados de CR e classes PCE. Esta interface ainda não está conectada; não envia nem consulta cadastros.",
  },
  {
    slug: "operations",
    title: "Operações e Ordens de Serviço",
    shortTitle: "Operações / OS",
    description: "Planejamento de eventos e ordens de serviço.",
    icon: "spark",
    group: "Operações",
    emptyTitle: "As ordens de serviço ainda não estão disponíveis",
    emptyDescription:
      "A API ainda não oferece operações para orçamentos, aprovações ou execução de OS. Nenhuma ordem, reserva, separação ou execução pode ser criada por esta interface.",
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
      "A API já disponibiliza cadastro e verificação da validade da habilitação para a data de evento. Esta interface ainda não está conectada; não envia nem consulta cadastros.",
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
      "Não há endpoints de propostas ou vendas disponíveis. Esta tela não registra pedidos nem confirma vendas.",
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
      "Não há endpoints financeiros ou relatórios disponíveis. Saldos, lançamentos, fluxo de caixa e DRE não são apresentados para evitar informações fictícias.",
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
      "Esta área está reservada para configurações futuras. A autenticação e o controle de acesso ainda não estão implementados no backend nem neste frontend.",
  },
];

export function getModule(slug: string): ErpModule | undefined {
  return modules.find((item) => item.slug === slug);
}
