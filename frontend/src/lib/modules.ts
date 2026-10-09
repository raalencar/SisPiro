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
  /**
   * Perfis que o backend exige para este módulo (ver backend/README.md).
   * `ADMIN` sempre tem acesso. Omitido = nenhuma restrição conhecida (módulo
   * ainda não integrado ou sem regra de perfil dedicada).
   */
  requiredRoles?: string[];
};

export function hasModuleAccess(
  module: ErpModule,
  userRoles: readonly string[],
): boolean {
  if (!module.requiredRoles || module.requiredRoles.length === 0) return true;
  if (userRoles.includes("ADMIN")) return true;
  return module.requiredRoles.some((role) => userRoles.includes(role));
}

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
    requiredRoles: ["ESTOQUE"],
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
    requiredRoles: ["ESTOQUE"],
  },
  {
    slug: "customers",
    title: "Clientes e Controle de CR",
    shortTitle: "Clientes",
    description: "Cadastro de clientes, controle de CR e classes PCE autorizadas.",
    icon: "users",
    group: "Cadastros",
    emptyTitle: "Cadastro de clientes conectado",
    emptyDescription:
      "Acompanhe clientes, validade de Certificados de Registro e habilitação de classes de produtos controlados.",
    statusLabel: "Tela integrada",
    requiredRoles: ["COMERCIAL"],
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
    requiredRoles: ["OPERACOES"],
  },
  {
    slug: "teams",
    title: "Blasters e Equipes",
    shortTitle: "Blasters e equipes",
    description: "Profissionais habilitados e equipes de operação.",
    icon: "hardhat",
    group: "Cadastros",
    emptyTitle: "Gestão de blasters conectada",
    emptyDescription:
      "Acompanhe carteiras funcionais, prazos de validade e elegibilidade para espetáculos pirotécnicos.",
    statusLabel: "Tela integrada",
    requiredRoles: ["OPERACOES"],
  },
  {
    slug: "purchases",
    title: "Compras e Fornecedores",
    shortTitle: "Compras / suprimentos",
    description: "Pedidos de compra, fornecedores e recebimento de lotes em paióis.",
    icon: "briefcase",
    group: "Gestão",
    emptyTitle: "Compras conectadas",
    emptyDescription:
      "Emissão de pedidos de compra, controle de fornecedores com CR e recebimento físico rastreável.",
    statusLabel: "Tela integrada",
    requiredRoles: ["COMPRAS"],
  },
  {
    slug: "sales",
    title: "Comercial e Vendas",
    shortTitle: "Comercial e vendas",
    description: "Propostas, tabelas de preço, promoções, orçamentos e PDV.",
    icon: "receipt",
    group: "Gestão",
    emptyTitle: "O fluxo comercial conectado",
    emptyDescription:
      "A API oferece tabelas de preço, orçamentos, vendas e devoluções com controle de reservas de estoque.",
    statusLabel: "Tela integrada",
    requiredRoles: ["COMERCIAL"],
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
    description: "Contas a pagar/receber, fluxo de caixa e Aging schedule.",
    icon: "chart",
    group: "Gestão",
    emptyTitle: "Gestão financeira conectada",
    emptyDescription:
      "Controle de contas a pagar e receber, baixas de pagamentos, conciliação e relatórios de vencimento.",
    statusLabel: "Tela integrada",
    requiredRoles: ["FINANCEIRO"],
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
