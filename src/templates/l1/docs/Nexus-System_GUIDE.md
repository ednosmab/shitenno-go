# Nexus System — Engineering Systems for AI-Assisted Development

> **Nome público:** Nexus System
> **Ficheiro guia:** `docs/Nexus-System_GUIDE.md`
> **Versão:** 1.0

---

## 1. O que é o Nexus System

O **Nexus System** é uma metodologia de governança para desenvolvimento de software assistido por inteligência artificial. Ele define **como** uma equipa de agentes IA deve ler, compreender, modificar e validar código num repositório complexo, de forma segura, rastreável e consistente.

### Princípio Fundamental

> **O Nexus System existe para reduzir a dependência de memória humana e memória do agente, transformando conhecimento em processos executáveis.**

Todo conhecimento tácito (regras, convenções, decisões arquitecturais, padrões de código) é convertido em:
- **Ficheiros estruturados** (YAML, MD) legíveis por máquinas
- **Protocolos obrigatórios** (workflows, checklists) que o agente segue sem decidir
- **Regras vinculantes** (FORBIDDEN_OPERATIONS) que impedem erros antes de acontecerem

O agente IA não precisa de "lembrar" — precisa de **ler**. O Nexus System garante que ele lê, na ordem certa, apenas o que precisa.

---

### Os 5 Layers do Nexus System

| Layer | Nome Oficial | Tecnologia Subjacente | Propósito |
|---|---|---|---|
| **Layer 1** | **Access Layer** | MCP (`@modelcontextprotocol/server-filesystem`) | Dar acesso directo ao filesystem ao LLM |
| **Layer 2** | **Memory Layer** | Ficheiros YAML/MD no repositório | Resolver amnésia de contexto entre sessões |
| **Layer 3** | **Context Layer** | Níveis P0→P4 de leitura | Optimizar tokens e evitar estouro de janela |
| **Layer 4** | **Execution Layer** | Protocolo operacional obrigatório | Garantir disciplina de execução |
| **Layer 5** | **Governance Layer** | ADRs + Políticas + FORBIDDEN_OPERATIONS | Prevenir erros arquitecturais e de segurança |

### O que resolve

Sem o Nexus System, um agente IA num repositório complexo sofre de:

- **Amnésia de sessão** — esquece o que fez na sessão anterior
- **Leitura desperdiçada** — lê ficheiros desnecessários, gasta tokens
- **Escrita perigosa** — sobrescreve código de produção sem querer
- **Falta de rastreabilidade** — ninguém sabe o que a IA alterou e porquê
- **Inconsistência arquitectural** — cada sessão toma decisões diferentes

O Nexus System elimina estes problemas através de 5 layers interligados.

---

## 2. Os 5 Layers do Nexus System

### Layer 1: Access Layer (Servidor MCP)

**O que é:** O servidor `@modelcontextprotocol/server-filesystem` dá ao LLM a capacidade de ler e escrever ficheiros directamente no sistema de arquivos local.

**Como funciona:**
- Configurado em `opencode.json` (bloco `mcp`)
- Restrito ao workspace root do repositório
- Variável de ambiente `AI_OPERATIONAL_RULES` injecta regras operacionais

**Limites de segurança:**
- Escrita apenas dentro do workspace root
- Proibido aceder a `/tmp`, `/home`, `.git`
- `docs/history/` é append-only (imutável)

**Configuração actual:**
```json
"mcp": {
  "local-filesystem": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."],
    "enabled": true,
    "environment": {
      "AI_OPERATIONAL_RULES": "[PERSONALIZAR: regras operacionais do projecto]"
    }
  }
}
```

---

### Layer 2: Memory Layer (Arquitectura de Memória RAM/ROM)

**O que é:** Um sistema de dois níveis que persiste o estado da sessão activa e o histórico de decisões.

```
┌─────────────────────────────────────────────────────────┐
│              MEMÓRIA DE CURTO PRAZO (RAM)               │
│       governance/context/context_buffer.yaml            │
│   Estado activo, impedimentos, tarefa em curso          │
└────────────────────────────┬────────────────────────────┘
                             │
                  (Consolidação de Sessão)
                             ▼
┌─────────────────────────────────────────────────────────┐
│             MEMÓRIA DE LONGO PRAZO (ROM)                │
│         docs/history/ (IMUTÁVEL)                        │
│   Logs densos e definitivos de decisões e progresso     │
└─────────────────────────────────────────────────────────┘
```

**RAM (Mutável):** `governance/context/context_buffer.yaml`
- Actualizado a cada turno do agente
- Contém: tarefa activa, impedimentos, documentos carregados
- Formato YAML estruturado para leitura por máquinas

**ROM (Imutável):** `docs/history/`
- Gerado no encerramento de cada sessão
- Protegido contra regravação
- Formato: `YYYY-MM-DD-sessao-NN.md`

---

### Layer 3: Context Layer (Hierarquia P0→P4)

**O que é:** Uma ordem de leitura obrigatória que garante que o agente carrega apenas o necessário, optimizando tokens.

```
[Nível 0: P0] docs/AGENTS.md              ← Regras Globais (SEMPRE)
       │
       ▼
[Nível 1: P1] governance/context/
             context_buffer.yaml           ← Estado Actual
       │
       ▼
[Nível 2: P2] docs/layers/[camada]/
             execution_plan.md             ← Plano Técnico
       │
       ▼
[Nível 3: P3] Código e Arquivos           ← Escrita Cirúrgica
       │
       ▼
[Nível 4: P4] docs/history/               ← Auditoria (Sob Demanda)
       │
       ▼
[⚡ Cross-cutting] docs/skills/
             senior-engineer.md            ← Postura Operacional
```

**Como se aplica:** O agente nunca decide o que ler primeiro. O WORKFLOW (`governance/WORKFLOW.md`) e a hierarquia P0→P4 determinam a ordem.

---

### Layer 4: Execution Layer (Workflow de 4 Passos)

**O que é:** O protocolo operacional obrigatório que todo agente deve seguir antes de escrever qualquer código.

```
PASSO 1: DIAGNÓSTICO E LEITURA PREGUIÇOSA
  │  → Ler WORKFLOW.md
  │  → Ler SYSTEM_MAP.md
  │  → Ler context_buffer.yaml
  │  → Ler planos/skills da camada
  ▼
PASSO 2: ACTUALIZAÇÃO DA MEMÓRIA RAM (Before-Code)
  │  → Actualizar context_buffer.yaml
  │  → Registar tarefa em execução
  │  → Registar documentos carregados
  ▼
PASSO 3: EXECUÇÃO CIRÚRGICA
  │  → Escrever código apenas na pasta permitida
  │  → Se erro → parar, documentar no buffer, corrigir
  ▼
PASSO 4: CONSOLIDAÇÃO E PURGA (After-Code)
     → Marcar [x] no plano
     → Limpar impedimentos do buffer
     → Exibir estado resumido
```

**Referência:** `docs/AGENTS.md`, `docs/skills/document-loader/SKILL.md`

---

### Quick Start — O que faço agora?

> Novos agentes e developers normalmente procuram: **"O que faço agora?"** Estes fluxos respondem exactamente isso.

#### Nova Feature

```
1. Ler WORKFLOW.md                          ← Determinar tipo de operação
2. Ler context_buffer.yaml                  ← Obter estado actual
3. Executar PREMORTEM
   → O que pode quebrar?
   → Existe ADR relacionada?
   → Existe impacto arquitectural?
4. Criar plano em docs/plans/
5. Ler planos/skills da camada (P2)
6. Actualizar buffer com tarefa em execução
7. Implementar código cirurgicamente
8. Executar testes e lint
9. Executar validate:session
10. Executar close:session
11. Preencher SESSION_REVIEW
```

#### Bug Report

```
1. Ler WORKFLOW.md                          ← Identificar como BUG
2. Ler context_buffer.yaml                  ← Estado actual
3. Reproduzir erro / identificar causa raiz
4. Documentar erro no buffer (seção Impedimentos)
5. Corrigir código cirurgicamente
6. Executar testes (validar correção)
7. Actualizar context_buffer.yaml
8. Executar close:session
```

#### Refactor

```
1. Ler WORKFLOW.md                          ← Identificar como REFACTOR
2. Ler ADRs relacionadas + SYSTEM_MAP.md
3. Executar premortem:check                 ← Verificar impacto
4. Ler plano da camada (P2)
5. Executar refactoração conforme plano
6. Executar testes e lint
7. Executar validate:session
8. Actualizar context_buffer.yaml
9. Executar close:session
```

#### Nova Feature (resumo rápido)

| Passo | Acção | Comando/Verificação |
|---|---|---|
| 1 | Ler WORKFLOW.md | `governance/WORKFLOW.md` |
| 2 | Ler buffer | `governance/context/context_buffer.yaml` |
| 3 | Premortem | `[PERSONALIZAR: comando de premortem]` |
| 4 | Planear | Criar `docs/plans/YYYY-MM-DD-<task>.md` |
| 5 | Carregar P2 | Ler plano da camada via MCP |
| 6 | Actualizar buffer | Escrever tarefa em execução |
| 7 | Implementar | Código na pasta permitida |
| 8 | Testar | `[PERSONALIZAR: comando de testes]` |
| 9 | Validar sessão | `[PERSONALIZAR: comando de validação]` |
| 10 | Encerrar | `[PERSONALIZAR: comando de encerramento]` |

---

### Layer 5: Governance Layer (Regras Vinculantes)

**O que é:** O conjunto de regras absolutas que nenhum agente pode violar.

**Fontes de regras:**

| Documento | Caminho | Propósito |
|---|---|---|
| FORBIDDEN_OPERATIONS | `docs/FORBIDDEN_OPERATIONS.md` | Regras vinculantes |
| ADRs | `docs/adrs/` | Architecture Decision Records |
| GOV-POLICY | `governance/policies/` | Políticas operacionais |
| DESDO | `docs/DESDO.md` | Diretrizes de engenharia (SOLID, TDD, segurança) |

**Regras críticas (resumo):**
- Nenhum commit sem autorização explícita do usuário
- Nenhuma escrita fora do workspace root
- Nenhum input sem validação
- `docs/history/` é imutável

---

## 3. Directórios Envolvidos

### 3.1 Configuração do Nexus System

```
docs/
├── skills/
│   └── document-loader/
│       └── SKILL.md                ← Protocolo de leitura
└── plans/
    └── [PLANOS_DO_PROJECTO]
```

### 3.2 Governança (Núcleo do Sistema)

```
governance/
├── WORKFLOW.md                     ← Entrada única obrigatória
├── SYSTEM_MAP.md                   ← Mapa centralizado
├── context/
│   └── context_buffer.yaml         ← RAM mutável (estado activo)
├── agents/                         ← Contratos de agentes AI
├── contracts/                      ← Índice de contratos
├── handoffs/                       ← Protocolos de transição
└── policies/                       ← Políticas operacionais
```

### 3.3 Cognição (Arquitectura Mental)

```
cognition/
├── context/
│   └── CONTEXT_HIERARCHY.md        ← Hierarquia P0-P4
├── memory/
│   └── MEM-operational-state-v1.json  ← Estado operacional
└── prompts/
    ├── executor/                   ← Prompts do executor
    ├── planner/                    ← Prompts do planner
    ├── reviewer/                   ← Prompts do reviewer
    └── shared/                     ← Regras partilhadas
```

### 3.4 Documentação & ADRs

```
docs/
├── AGENTS.md                       ← Regras do time (P0)
├── FORBIDDEN_OPERATIONS.md         ← Regras vinculantes (P0)
├── DESDO.md                        ← Diretrizes de engenharia (P0)
├── BACKLOG.md                      ← Fila de tarefas
├── Nexus-System_GUIDE.md           ← Este ficheiro
├── adrs/                           ← Architecture Decision Records
├── feedback/                       ← Feedback de sessões
├── history/                        ← Registos históricos (ROM)
├── layers/                         ← Planos por camada técnica
├── plans/                          ← Planos de execução
├── skills/                         ← Skills operacionais
└── roadmaps/                       ← Roadmaps de desenvolvimento
```

### 3.5 Scripts de Validação

```
scripts/
├── validate-session.ts             ← Validação de sessão
└── close-session.ts                ← Encerramento de sessão
```

### 3.6 Código (Monorepo)

```
packages/
├── ui/                             ← Design System
├── types/                          ← Contratos de dados
├── core/                           ← Lógica de domínio
└── renderer/                       ← Motor de renderização

apps/
├── admin/                          ← App Admin
└── student/                        ← App Aluno

[PERSONALIZAR: estrutura de directórios específica do projecto]
```

---

## 4. Como Funciona — Fluxo Completo

### Início de Sessão

```
Utilizador envia tarefa
        │
        ▼
┌──────────────────────────┐
│  PASSO 1: DIAGNÓSTICO    │
│  Ler WORKFLOW.md          │
│  Ler context_buffer.yaml  │
│  Identificar tipo:        │
│  FEATURE | BUG | REFACTOR │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  PASSO 2: CARREGAR       │
│  Ler P0 (AGENTS.md, etc) │
│  Ler P1 (buffer)         │
│  Ler P2 (plano da camada)│
│  via MCP filesystem      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  PASSO 3: EXECUTAR       │
│  Escrever código         │
│  Cirurgicamente          │
│  (apenas pasta permitida)│
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  PASSO 4: VALIDAR        │
│  [PERSONALIZAR: testes]  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  PASSO 5: CONSOLIDAR     │
│  Actualizar buffer       │
│  Marcar [x] no plano     │
│  Gerar histórico (ROM)   │
└──────────────────────────┘
```

### Fluxo por Tipo de Operação

| Tipo | Fluxo | Entrada |
|---|---|---|
| **FEATURE** | Carregar → Premortem → Planear → Implementar → Validar → Encerrar | `WORKFLOW.md` § Fluxo FEATURE |
| **BUG** | Carregar → Reproduzir → Corrigir → Validar → Encerrar | `WORKFLOW.md` § Fluxo BUG |
| **REFACTOR** | Carregar → Verificar impacto → Executar → Validar → Encerrar | `WORKFLOW.md` § Fluxo REFACTOR |
| **DOCUMENTATION** | Carregar → Escrever → Validar consistência → Encerrar | `WORKFLOW.md` § Fluxo DOCUMENTATION |
| **PLANNING** | Carregar → Premortem → Planear → Actualizar backlog → Encerrar | `WORKFLOW.md` § Fluxo PLANNING |
| **INVESTIGATION** | Hipótese → Investigação → Evidência → Decisão → Encerramento | `WORKFLOW.md` § Fluxo INVESTIGATION |

---

## 5. Como Usar — Guia Prático

### 5.1 Para um Novo Developer

1. Ler este ficheiro (`Nexus-System_GUIDE.md`)
2. Ler `governance/WORKFLOW.md` — entender os fluxos
3. Ler `docs/AGENTS.md` — regras do time
4. Ler `governance/context/context_buffer.yaml` — estado actual
5. Seguir o fluxo do tipo de tarefa atribuída

### 5.2 Para um Agente IA

O agente **nunca** decide o que ler. O protocolo é:

```
1. Ler WORKFLOW.md (sempre primeiro)
2. Ler context_buffer.yaml (obrigatório)
3. Seguir hierarquia P0→P4
4. Actualizar buffer antes de escrever código
5. Validar após implementar
6. Gerar histórico ao encerrar
```

### 5.3 Mapa de Camadas vs Documentos

| Camada | Pasta | Documento P2 |
|--------|-------|-------------|
| Types (contratos) | `packages/types/` | `docs/layers/types/execution_plan.md` |
| UI (Design System) | `packages/ui/` | `docs/layers/ui/execution_plan.md` |
| Database | `[PERSONALIZAR: directório de migrations]` | `docs/layers/supabase/database_schema_plan.md` |
| Admin App | `apps/admin/` | `docs/layers/apps/admin_canvas_plan.md` |
| Student App | `apps/student/` | `docs/layers/apps/mobile_player_plan.md` |
| Core (domínio) | `packages/core/` | `docs/layers/core/domain-logic.md` |
| Renderer | `packages/renderer/` | `docs/layers/renderer/engine-spec.md` |
| Infra/DevOps | — | `docs/layers/infra/execution_plan.md` |

### 5.4 Scripts de Validação

| Script | Comando | Função |
|---|---|---|
| Validate Session | `[PERSONALIZAR: comando de validação]` | Verifica integridade da sessão |
| Close Session | `[PERSONALIZAR: comando de encerramento]` | Checklist de encerramento |

---

## 6. Regras Vinculantes (Resumo)

### Proibições Absolutas

| # | Regra | Fonte |
|---|---|---|
| G-01 | Nenhum `git commit` sem autorização explícita | FORBIDDEN_OPERATIONS |
| F-01 | Nenhuma lógica de domínio em componentes UI | FORBIDDEN_OPERATIONS |
| F-03 | Nenhum import cruzado entre apps | FORBIDDEN_OPERATIONS |
| F-04 | Nenhum schema de validação fora da camada de contratos | FORBIDDEN_OPERATIONS |
| S-01 | Nenhum HTML dinâmico sem sanitização | FORBIDDEN_OPERATIONS |
| S-02 | Nenhuma tabela sem RLS configurado | FORBIDDEN_OPERATIONS |
| DB-01 | Nenhuma mutação JSONB sem validação | FORBIDDEN_OPERATIONS |
| ENV-01 | Nenhuma flag de teste em configs de deploy | FORBIDDEN_OPERATIONS |
| CONFID-01 | Nenhuma informação comercial sensível em código | FORBIDDEN_OPERATIONS |

### Regras de Código

| # | Regra | Fonte |
|---|---|---|
| 1 | Commits em inglês (Conventional Commits) | GOV-POLICY |
| 2 | JSDoc em todas as funções exportadas | DESDO |
| 3 | Usar tokens de design (não cores hardcoded) | AGENTS.md |
| 4 | Usar componentes do design system (não HTML nativo) | AGENTS.md |
| 5 | Testes actualizados ou criados | DESDO |
| 6 | `[PERSONALIZAR: comando de testes]` verde antes de commitar | AGENTS.md |

---

## 7. Referências

### Documentos Primários (ler para entender o Nexus System)

| Documento | Caminho | Propósito |
|---|---|---|
| WORKFLOW | `governance/WORKFLOW.md` | Fluxo de sessão (entrada única) |
| SYSTEM_MAP | `governance/SYSTEM_MAP.md` | Mapa centralizado do sistema |
| CONTEXT_HIERARCHY | `cognition/context/CONTEXT_HIERARCHY.md` | Hierarquia de leitura P0-P4 |
| document-loader SKILL | `docs/skills/document-loader/SKILL.md` | Protocolo de leitura obrigatório |

### Documentos Secundários (referência detalhada)

| Documento | Caminho | Propósito |
|---|---|---|
| AGENTS.md | `docs/AGENTS.md` | Regras do time de engenharia |
| FORBIDDEN_OPERATIONS | `docs/FORBIDDEN_OPERATIONS.md` | Regras vinculantes |
| DESDO | `docs/DESDO.md` | Diretrizes de engenharia |
| GOV-POLICY | `governance/policies/` | Políticas operacionais |
| context_buffer | `governance/context/context_buffer.yaml` | Estado activo da sessão |
| BACKLOG | `docs/BACKLOG.md` | Fila de tarefas |

### Documentos Operacionais (uso diário)

| Documento | Caminho | Propósito |
|---|---|---|
| SESSION_REVIEW | `governance/reviews/SESSION_REVIEW.md` | Template de feedback de sessão |
| feedback | `docs/feedback/` | Feedback diário de sessões |
| history | `docs/history/` | Registos históricos (ROM) |

---

## 8. Glossário

| Termo | Definição |
|---|---|
| **Nexus System** | Metodologia de governança para dev assistido por IA |
| **Access Layer** | Layer 1 — servidor MCP para acesso ao filesystem |
| **Memory Layer** | Layer 2 — arquitectura de memória RAM/ROM |
| **Context Layer** | Layer 3 — hierarquia de contexto P0-P4 |
| **Execution Layer** | Layer 4 — workflow de 4 passos |
| **Governance Layer** | Layer 5 — regras vinculantes e políticas |
| **MCP** | Model Context Protocol — protocolo para acesso ao filesystem |
| **RAM** | Memória de curto prazo (context_buffer.yaml) — mutável |
| **ROM** | Memória de longo prazo (docs/history/) — imutável |
| **P0-P4** | Níveis de hierarquia de contexto (P0 = sempre, P4 = sob demanda) |
| **Premortem** | Análise de riscos prévia à implementação |
| **Lazy Loading** | Leitura preguiçosa — carregar apenas o necessário |
| **Sandboxing** | Restrição de escrita ao workspace root |
| **ADR** | Architecture Decision Record — registo de decisão arquitectural |
| **FORBIDDEN_OPERATIONS** | Regras vinculantes que nenhum agente pode violar |

---

## 9. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | [DATA] | Criação do guia unificado do Nexus System |
