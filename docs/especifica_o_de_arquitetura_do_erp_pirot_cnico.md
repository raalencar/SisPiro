# Especificação de Arquitetura do Sistema ERP Pirotécnico & Serviços

## 1. Visão Geral do Projeto

O **ERP Pirotécnico** é uma plataforma de gestão empresarial sob medida para empresas atuantes no setor de artefatos pirotécnicos, prestação de serviços de shows com fogos de artifício, transporte especializado e atividades correlatas.

O sistema lida com alta complexidade operacional e regulatória devido à fiscalização rigorosa de **Produtos Controlados pelo Exército (PCE)**, órgãos policiais e Corpo de Bombeiros, exigindo mecanismos nativos de controle de massa explosiva (NEQ/NEC), validade de habilitações (Blasters) e emissão de documentação legal (Guias de Tráfego e Licenças).

---

## 2. Arquitetura Orientada a Domínio (DDD) & Bounded Contexts

A arquitetura do sistema é desenhada com base nos princípios de *Domain-Driven Design* (DDD) para assegurar desacoplamento e isolamento de regras operacionais e tributárias.

```
+-------------------------------------------------------------------+
|                        ERP PIROTECNIA                             |
+-----------------+-----------------+-----------------+-------------+
|   COMPLIANCE &  |  ESTOQUE & WMS  | OPERAÇÃO SHOWS  | COMERCIAL & |
|    EXÉRCITO     |   (PAIÓIS/NEQ)  |  (SERVIÇOS OS)  | FATURAMENTO |
+-----------------+-----------------+-----------------+-------------+
|       \                 |                /          |             |
|        +----------------+---------------+           |             |
|                         |                           |             |
|                         v                           v             |
|             +-----------------------------------------+           |
|             |        CORE FINANCEIRO & CONTÁBIL       |           |
|             +-----------------------------------------+           |
+-------------------------------------------------------------------+
```

### Contextos Delimitados (Bounded Contexts)

1. **Compliance & Regulatório (PCE):**
   * Validação de Certificados de Registro (CR), Alvarás de Funcionamento e Licenças de Compradores/Fornecedores.
   * Geração automatizada de mapas de estocagem e movimentação para órgãos fiscalizadores.
   * Gestão de Guias de Tráfego (GT).

2. **Estoque Especializado & WMS (Paióis & NEQ):**
   * Controle de estoque por lotes, datas de fabricação e validade.
   * Classificação por Classe de Risco (ex: 1.1, 1.3G, 1.4G).
   * Cálculo em tempo real da Carga Líquida Explosiva (NEQ/NEC) acumulada por paiol com travas de capacidade legal.

3. **Gestão de Operações de Shows & Serviços (OS):**
   * Planejamento operacional de espetáculos pirotécnicos e queimas técnicas.
   * Alocação de equipes qualificadas (Escala de Blasters com verificação de alvarás).
   * Reserva e controle de frota e equipamentos de disparo (mesas de disparo digitais/módulos).
   * Emissão e controle de Anotação de Responsabilidade Técnica (ART/CREA/CFT).

4. **Comercial, Balcão & Faturamento:**
   * Fluxo de vendas B2B, B2C e balcão/PDV.
   * Bloqueio automático de vendas para produtos restritos quando a documentação do cliente não estiver em conformidade.
   * Emissão de NF-e (Modelo 55 com tags de rastreabilidade de PCE), NFS-e e MDF-e.

5. **Core Financeiro & DRE:**
   * Contas a pagar/receber, conciliação bancária e fluxo de caixa.
   * DRE gerencial com apuração de margem de contribuição individualizada por show/evento executado.

---

## 3. Regras de Negócio Críticas

### 3.1. Rastreabilidade e Gestão de PCE
* **Lote Mandatório:** Nenhum item pirotécnico pode entrar ou sair do estoque sem o preenchimento de lote, data de fabricação, validade e fabricante/importador.
* **Trava de Capacidade do Paiol:** O sistema calcula a soma do peso da massa explosiva ($NEQ_{total} = \sum qte \times neq_{unitario}$). Se $NEQ_{total} > Capacidade_{Paiol}$, o recebimento ou transferência para o paiol é bloqueado.
* **Validação de Comprador:** Produtos das categorias restritas (ex: Classe C e D) exigem que a ficha do cliente possua CR ativo, dentro da validade e com autorização para a respectiva classe.

### 3.2. Ciclo de Vida da Ordem de Serviço (Shows Pirotécnicos)
1. **Orçamento e Proposta:** Reserva temporária do estoque pirotécnico para garantia de execução.
2. **Aprovação e Planejamento:** Atribuição do Blaster Responsável Técnico (com validação automática do alvará) e geração da lista de separação do material (*pick-list*).
3. **Transporte e Disparo:** Emissão da Guia de Tráfego/MDF-e e saída dos insumos para o local do evento.
4. **Relatório de Queima pós-evento:** Registro dos produtos disparados/consumidos e devolução dos artefatos não utilizados (sobras/falhas) ao paiol com respectiva atualização de estoque e nota fiscal de devolução/insumo consumido.

---

## 4. Matriz de Módulos e Funcionalidades

| Módulo | Funcionalidades Principais | Trava de Segurança / Integração |
| :--- | :--- | :--- |
| **PCE & Regulatório** | Emissão de Mapas de Estocagem, Controle de CRs e GTs. | Impede alteração de registros consolidados em períodos já encerrados perante os órgãos. |
| **WMS / Paióis** | Mapeamento de Paióis, Entrada/Saída por Lote, Cálculo NEQ. | Bloqueia movimentação se ultrapassar a capacidade máxima permitida no Habite-se/Alvará do paiol. |
| **Gestão de OS** | Orçamento de Espetáculos, Escala de Blasters, Pick-list, Vistoria e ART. | Impede alocação de Blaster com credencial/alvará vencido. |
| **Faturamento / Fiscal** | NF-e (Tags de explosivos), NFS-e, MDF-e de transporte. | Preenchimento obrigatório de campos regulatórios fiscais. |
| **Vendas & PDV** | Tabela de preços, consulta de estoque por lote, validação de cliente. | Impede finalização da venda se a licença do cliente estiver expirada. |
| **Financeiro** | Contas a Pagar/Receber, Fluxo de Caixa, DRE por Evento. | Vincula custos de insumos e mão de obra diretamente à OS para apuração real de lucro. |

---

## 5. Modelagem de Dados Relacional (Esquema SQL PostgreSQL)

```sql
-- Habilitação do suporte a UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cadastro de Produtos com Atributos de PCE
CREATE TABLE produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_sku VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) CHECK (tipo IN ('MERCADORIA', 'SERVICO', 'INSUMO')),
    eh_pce BOOLEAN DEFAULT FALSE,
    classe_risco VARCHAR(20), -- ex: '1.3G', '1.4G', 'CLASSE_C'
    massa_neq_gramas NUMERIC(10, 3) DEFAULT 0.000, -- Conteúdo explosivo em gramas
    unidade_medida VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Controle de Paióis e Limites de Segurança
CREATE TABLE paioes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    capacidade_max_neq_kg NUMERIC(10, 2) NOT NULL, -- Limite regulatório do paiol
    licenca_bombeiros_validade DATE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
);

-- Controle de Lotes de Estoque
CREATE TABLE produto_lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES produtos(id),
    paiol_id UUID REFERENCES paioes(id),
    numero_lote VARCHAR(50) NOT NULL,
    quantidade NUMERIC(10, 2) NOT NULL,
    data_fabricacao DATE,
    data_validade DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cadastro de Clientes e Licenças Regulatórias
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(150) NOT NULL,
    cnpj_cpf VARCHAR(20) UNIQUE NOT NULL,
    possui_cr BOOLEAN DEFAULT FALSE,
    numero_cr VARCHAR(50),
    validade_cr DATE,
    ativo BOOLEAN DEFAULT TRUE
);

-- Cadastro de Profissionais Técnicos (Blasters)
CREATE TABLE blasters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    numero_carteira_blaster VARCHAR(50) NOT NULL,
    validade_carteira DATE NOT NULL,
    categoria VARCHAR(30), -- ex: 'BLASTER_SHOW', 'BLASTER_ESPECIAL'
    ativo BOOLEAN DEFAULT TRUE
);

-- Ordens de Serviço para Shows Pirotécnicos
CREATE TABLE ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_os SERIAL UNIQUE,
    cliente_id UUID REFERENCES clientes(id),
    blaster_responsavel_id UUID REFERENCES blasters(id),
    data_evento TIMESTAMP NOT NULL,
    local_evento TEXT NOT NULL,
    status VARCHAR(30) CHECK (status IN ('ORCAMENTO', 'APROVADO', 'EM_MONTAGEM', 'EXECUTADO', 'CANCELADO')),
    art_numero VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Itens da Ordem de Serviço (Reserva / Consumo de Estoque)
CREATE TABLE ordem_servico_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID REFERENCES ordens_servico(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES produtos(id),
    produto_lote_id UUID REFERENCES produto_lotes(id),
    quantidade_planejada NUMERIC(10, 2) NOT NULL,
    quantidade_efetivamente_disparada NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Arquitetura Tecnológica Recomendada

Para assegurar consistência transacional, facilidade de auditoria e escalabilidade:

* **Estilo Arquitetural:** **Monólito Modular** (fácil de implantar e manter no estágio inicial, com clara separação entre módulos em subpastas ou pacotes bem delimitados).
* **Backend:** **TypeScript com NestJS** ou **C# (.NET 8)**.
* **Banco de Dados:** **PostgreSQL 16+** (uso de transações puras ACID para evitar saídas indevidas de estoque pirotécnico).
* **Frontend Web:** **React.js** / **Next.js** com biblioteca TailwindCSS e componentes de UI baseados em Radix / Shadcn UI.
* **Fila / Processamento Assíncrono:** **Redis com BullMQ** ou **RabbitMQ** para tarefas demoradas (emissão de NF-e/NFS-e, geração de PDF de relatórios para o Exército, envio de alertas de vencimento de licenças).
* **Auditoria:** Gravação de Logs Append-Only (*Audit Logs*) rastreando qualquer alteração manual em movimentação de lotes, dispensas ou cadastros de licenças.

---

## 7. Roadmap de Implementação

### Fase 1: Núcleo Operacional & WMS (Mês 1 e 2)
* Cadastros base (Produtos, Lotes, Paióis, Clientes).
* Motor de cálculo de NEQ e validações de capacidade do paiol.
* Módulo básico de Estoque e Compras.

### Fase 2: Gestão Comercial e Faturamento (Mês 3)
* Módulo de Vendas B2B/B2C e PDV.
* Trava automática de vendas por licença vencida do cliente.
* Integração para emissão de NF-e com tags de rastreamento de explosivos.

### Fase 3: Módulo Operacional de Shows (Mês 4 e 5)
* Gestão de Ordens de Serviço (OS) para espetáculos pirotécnicos.
* Cadastro e vinculação de Blasters e validações de validade de carteira.
* Módulo pós-evento (Relatório de Queima e baixa de material utilizado).
* Emissão de NFS-e e emissão de MDF-e para transporte.

### Fase 4: Compliance Avançado e Financeiro (Mês 6)
* Emissão de Guias de Tráfego (GT) e Mapas de Estocagem.
* Gestão financeira completa (Contas a pagar/receber, DRE gerencial por evento).
* Dashboard gerencial e alertas automatizados por e-mail/WhatsApp.