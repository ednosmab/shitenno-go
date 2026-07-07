# Nexus System — Guia Completo do Sistema de Governança

> **Nome público:** Nexus System
> **Ficheiro guia:** `nexus-system/docs/Nexus-System_GUIDE.md`
> **Versão:** 3.0
> **Data:** 2026-07-02

---

## 1. O que é o Nexus System

O **Nexus System** é um framework de governança para desenvolvimento de software assistido por inteligência artificial. Define **como** uma equipa (humana + agentes IA) deve ler, compreender, modificar e validar código num repositório complexo — de forma segura, rastreável e consistente.

### Princípio Fundamental

> **O sistema mede e sugere. O humano decide.**

Todo conhecimento tácito (regras, convenções, decisões arquitecturais, padrões de código) é convertido em:
- **Ficheiros estruturados** (YAML, MD) legíveis por máquinas
- **Protocolos obrigatórios** (workflows, checklists) que o agente segue sem decidir
- **Regras vinculantes** (FORBIDDEN_OPERATIONS) que impedem erros antes de acontecerem

### Arquitectura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    PROJECTO DO UTILIZADOR                    │
│                                                             │
│  opencode.json          ← Configuração (project root)       │
│  nexus-system/          ← Framework de governança           │
│    ├── docs/            ← Documentação e skills             │
│    ├── governance/      ← Contratos, contextos, políticas   │
│    ├── scripts/         ← Scripts de validação              │
│    └── cognition/       ← Memória e hierarquia              │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ nexus init / nexus upgrade
                          │
┌─────────────────────────────────────────────────────────────┐
│                      NEXUS CLI (FERRAMENTA)                  │
│                                                             │
│  nexus init          ← Instala framework no projecto        │
│  nexus status        ← Verifica saúde da governança         │
│  nexus upgrade       ← Eleva capacidades (knowledge, etc.)  │
│  nexus validate      ← Valida conformidade                 │
│  nexus sync          ← Sincroniza templates                 │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ templates/base/
                          │
┌─────────────────────────────────────────────────────────────┐
│                    TEMPLATES DO CLI                          │
│                                                             │
│  docs/skills/         ← 23 skills de engenharia             │
│  governance/agents/   ← 4 contratos de papel IA             │
│  core/complexity/     ← Contratos tipados de scoring        │
│  scripts/             ← Scripts de sessão                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Capacidades do Sistema

O Nexus System usa uma abordagem modular baseada em **capacidades**. O `nexus init` instala a base, e `nexus upgrade --capability <name>` adiciona capacidades conforme necessário.

### Capacidades Disponíveis

| Capacidade | Descrição | Componentes |
|---|---|---|
| **knowledge** | ADRs, skills, runbooks, workflow | Skills de engenharia, documentação |
| **architecture** | Contratos de agentes, SYSTEM_MAP | Agentes IA, mapeamento de pastas |
| **governance** | Políticas, FORBIDDEN_OPERATIONS, DESDO | Regras vinculantes, diretrizes |
| **ai** | Context buffer, cognição, handoffs | Memória de sessão, coordenação |
| **quality** | TDD, code review, premortem | Scripts de validação, checklists |
| **metrics** | Complexity scoring, performance | Scoring, métricas de engenharia |
| **operations** | CI/CD, deploy, monitoring | Pipelines, runbooks operacionais |
| **compliance** | Audit trails, ADRs, SDRs | Rastreabilidade, decisões |

### Como Funciona

1. **`nexus init`** — Instala base completa (knowledge + architecture + governance)
2. **`nexus upgrade --capability <name>`** — Adiciona capacidade específica
3. **`nexus upgrade --accept-recommended`** — Instala todas as recomendadas pelo perfil

---

## 3. Skills — 23 Competências de Engenharia

### Distribuição

| Categoria | # Skills | Descrição |
|---|---|---|
| **Core** | 11 | Engenharia fundamental (TDD, SOLID, clean code, etc.) |
| **Intermediárias** | 8 | Especializadas (CI/CD, DDD, animação, UI/UX, etc.) |
| **Avançadas** | 3 | Performance, segurança, infraestrutura |

### Skills Core (11)

| Skill | Tipo | Descrição |
|---|---|---|
| `senior-engineer.md` | Genérica pura | Postura operacional de engenheiro senior (15+ anos) |
| `tdd-agent.md` | Genérica pura | Agente TDD — ciclo Red-Green-Refactor rigoroso |
| `tdd_workflow.md` | Mista | Workflow de testes com Vitest/Jest |
| `clean_code_standards.md` | Mista | Padrões de código limpo |
| `solid_principles.md` | Mista | Princípios SOLID aplicados |
| `architectural_integrity.md` | Genérica pura | Integridade arquitectural e padrões |
| `design_patterns.md` | Mista | Padrões de design (Factory, Strategy, etc.) |
| `error_handling_observability.md` | Mista | Tratamento de erros e observabilidade |
| `pnpm_management.md` | Genérica pura | Gestão de pacotes com pnpm |
| `optimistic_ui.md` | Mista | UI optimista para respostas imediatas |
| `codebase_hygiene_git.md` | Genérica pura | Higiene de código e workflow Git |
| `quick-board-enforcement.md` | Genérica pura | Enforcement do Quick Board (bloqueador de sessão) |

### Skills Intermediárias (+8)

| Skill | Tipo | Descrição |
|---|---|---|
| `animation_protocol.md` | Mista | Protocolo de animação e transição (UX premium) |
| `ci_cd_pipeline.md` | Mista | CI/CD com GitHub Actions |
| `ddd_patterns.md` | Mista | Domain-Driven Design patterns |
| `domain_driven_design_(ddd).md` | Mista | DDD tático e estratégico (complementar a ddd_patterns) |
| `responsividade.md` | Mista | Responsividade cross-platform |
| `state_management_protocol.md` | Mista | Gestão de estado (Server vs Client) |
| `ui_ux_principles.md` | Mista | Princípios de UI e UX visual |
| `operacao_no_nexus.md` | Meta-skill | Como agir dentro da estrutura de pastas do Nexus |

### Skills Avançadas (+3)

| Skill | Tipo | Descrição |
|---|---|---|
| `nextjs_performance_seo.md` | Mista | Next.js performance e SEO |
| `postgresql_performance.md` | Mista | PostgreSQL performance e optimização |
| `security_xss_prevention.md` | Mista | Segurança e prevenção de XSS |

### Classificação das Skills

- **Genéricas puras (5):** Corpo inteiro é metodologia, sem menção a path, produto ou stack específica
- **Mistas (16):** Princípio central é genérico, mas a skill original tinha seções específicas que foram generalizadas
- **Meta-skill (1):** `operacao_no_nexus.md` — descreve como operar dentro da estrutura de pastas

---

## 4. Os 4 Papéis de Agente IA

Cada agente IA num projecto Nexus tem um contrato definido:

### Planner (Planeador)
- **Ficheiro:** `AI-CONTRACT-planner-v1.yaml`
- **Função:** Lê contexto do projecto e produz planos atómicos
- **Permissões:** Leitura ampla, escrita apenas em `governance/plans/`

### Executor (Construtor)
- **Ficheiro:** `AI-CONTRACT-executor-v1.yaml`
- **Função:** Executa o plano step-by-step, exactamente como aprovado
- **Restrições:** Sem refactors oportunistas, sem melhorias não planeadas
- **Excepções:** Fixes mínimos (<5 linhas) para fazer o step actual passar

### Reviewer (Auditor)
- **Ficheiro:** `AI-CONTRACT-reviewer-v1.yaml`
- **Função:** Audita código produzido, valida contra o plano
- **Permissões:** Apenas leitura em código de produção, pode correr testes/lint

### Orchestrator (Orquestrador)
- **Ficheiro:** `AI-CONTRACT-orchestrator-v1.yaml`
- **Função:** Coordena os 3 agentes, gere handoffs e transições
- **Restrições:** Sem commit sem autorização, sem alterar regras sem aprovação

### Princípio Comum a Todos

> **O humano decide. O agente executa. Nenhum commit sem autorização explícita.**

---

## 5. Arquitectura de Memória (RAM/ROM)

```
┌─────────────────────────────────────────────────────────┐
│              MEMÓRIA DE CURTO PRAZO (RAM)               │
│       governance/context/context_buffer.yaml            │
│   Estado activo, impedimentos, tarefa em curso          │
│   Actualizado a cada turno do agente                    │
└────────────────────────────┬────────────────────────────┘
                             │
                  (Consolidação de Sessão)
                             ▼
┌─────────────────────────────────────────────────────────┐
│             MEMÓRIA DE LONGO PRAZO (ROM)                │
│         docs/history/ (IMUTÁVEL)                        │
│   Logs densos e definitivos de decisões e progresso     │
│   Gerado no encerramento de cada sessão                 │
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

## 6. Hierarquia de Contexto (P0→P4)

```
[Nível 0: P0] docs/AGENTS.md              ← Regras Globais (SEMPRE)
       │
       ▼
[Nível 1: P1] governance/context/
             context_buffer.yaml           ← Estado Actual
       │
       ▼
[Nível 2: P2] Código e configuração       ← Escrita Cirúrgica
       │
       ▼
[Nível 3: P3] docs/skills/                ← Competências operacionais
       │
       ▼
[Nível 4: P4] docs/history/               ← Auditoria (Sob Demanda)
```

**Regra:** O agente nunca decide o que ler. A hierarquia P0→P4 determina a ordem.

---

## 7. Workflow Operacional (4 Passos)

```
PASSO 1: DIAGNÓSTICO E LEITURA PREGUIÇOSA
  │  → Ler WORKFLOW.md
  │  → Ler context_buffer.yaml
  │  → Ler AGENTS.md (P0)
  │  → Identificar tipo: FEATURE | BUG | REFACTOR
  ▼
PASSO 2: ACTUALIZAÇÃO DA MEMÓRIA RAM
  │  → Actualizar context_buffer.yaml
  │  → Registar tarefa em execução
  │  → Registar documentos carregados
  ▼
PASSO 3: EXECUÇÃO CIRÚRGICA
  │  → Escrever código apenas na pasta permitida
  │  → Se erro → parar, documentar no buffer, corrigir
  ▼
PASSO 4: CONSOLIDAÇÃO E PURGA
     → Marcar [x] no plano
     → Limpar impedimentos do buffer
     → Gerar histórico (ROM)
```

---

## 8. Fluxo por Tipo de Operação

### Nova Feature
1. Ler WORKFLOW.md → Determinar tipo
2. Ler context_buffer.yaml → Estado actual
3. Executar PREMORTEM → O que pode quebrar?
4. Criar plano em governance/plans/
5. Actualizar buffer com tarefa em execução
6. Implementar código cirurgicamente
7. Executar testes e lint
8. Executar validate-session
9. Executar close-session

### Bug Report
1. Ler WORKFLOW.md → Identificar como BUG
2. Ler context_buffer.yaml → Estado actual
3. Reproduzir erro / identificar causa raiz
4. Documentar erro no buffer
5. Corrigir código cirurgicamente
6. Executar testes
7. Actualizar buffer e encerrar

### Refactor
1. Ler WORKFLOW.md → Identificar como REFACTOR
2. Ler ADRs relacionadas
3. Executar premortem:check → Verificar impacto
4. Executar refactoração conforme plano
5. Executar testes e lint
6. Validar e encerrar

---

## 9. Complexidade e Scoring

O Nexus System calcula complexidade do projecto usando dois eixos:

### Static Metrics (Métricas Estáticas)
- **Estrutura de pastas** — quantos directórios, apps, packages
- **Dependências** — quantos packages no package.json
- **Tamanho** — linhas de código por área

### Behavioral Metrics (Métricas Comportamentais)
- **Churn** — frequência de alterações por área (git log)
- **Taxa de violação** — quantas regras foram violadas
- **Superfície sensível** — quantas áreas sensíveis existem (auth, payment, session)

### Scoring
- **Score 0-3:** Baixa complexidade — projecto simples, poucas dependências
- **Score 4-6:** Média complexidade — projecto em crescimento
- **Score 7-10:** Alta complexidade — projecto complexo, multi-app, muitas dependências

---

## 10. Directórios do Projecto

### Estrutura Actual (nexus-system/)

```
nexus-system/
├── BRIEFING.md                      ← Briefing pré-sessão
├── fingerprint.json                 ← Impressão digital do projecto
├── maturity-profile.json            ← Perfil de maturidade
├── cognition/                       ← Arquitectura mental
│   ├── context/
│   │   └── CONTEXT_HIERARCHY.md     ← Hierarquia de contexto P0-P4
│   ├── memory/
│   │   └── MEM-operational-state-v1.json
│   └── prompts/                     ← Prompts por agente (placeholders)
│       ├── executor/README.md
│       ├── planner/README.md
│       └── reviewer/README.md
├── core/                            ← Contratos tipados
│   └── complexity/
│       └── types.ts                 ← Scoring de complexidade
├── docs/                            ← Documentação
│   ├── AGENTS.md                    ← Regras do time (P0)
│   ├── BACKLOG.md                   ← Fila de tarefas
│   ├── CONCEPTUAL_MODEL.md          ← Modelo conceitual canónico
│   ├── DESDO.md                     ← Diretrizes de engenharia (P0)
│   ├── FORBIDDEN_OPERATIONS.md      ← Regras vinculantes (P0)
│   ├── KNOWLEDGE_LIFECYCLE.md       ← Ciclo de vida do conhecimento
│   ├── Nexus-System_GUIDE.md        ← Este ficheiro
│   ├── opencode-context.md          ← Contexto operacional
│   ├── session-template.md          ← Template de encerramento
│   ├── adrs/                        ← Architecture Decision Records
│   │   ├── ADR-001-*.md
│   │   ├── ADR-002-*.md
│   │   ├── ADR-003-*.md
│   │   └── ADR-TEMPLATE.md
│   ├── feedback/                    ← Feedback de sessões
│   │   └── README.md
│   ├── history/                     ← Memória ROM (imutável)
│   │   ├── 2026-07-01.md
│   │   └── ... (logs por sessão)
│   ├── runbooks/                    ← Runbooks operacionais
│   │   └── merge.md
│   └── skills/                      ← 23 skills de engenharia
│       ├── senior-engineer.md
│       ├── tdd-agent.md
│       ├── domain_driven_design_(ddd).md
│       └── ... (23 skills)
│   ├── audits/                      ← Audit logs
│   │   └── ...
│   └── capabilities.md              ← Capacidades do sistema
├── feedback/                        ← Feedback do Nexus CLI
│   ├── summary.json
│   └── records/                     ← 14 registos de feedback
├── governance/                      ← Governança
│   ├── SYSTEM_MAP.md                ← Mapa centralizado
│   ├── WORKFLOW.md                  ← Fluxos de sessão
│   ├── agents/                      ← 4 contratos de agente
│   │   ├── AI-CONTRACT-planner-v1.yaml
│   │   ├── AI-CONTRACT-executor-v1.yaml
│   │   ├── AI-CONTRACT-reviewer-v1.yaml
│   │   └── AI-CONTRACT-orchestrator-v1.yaml
│   ├── context/                     ← Memória RAM
│   │   └── context_buffer.yaml
│   ├── contracts/                   ← Índice de contratos
│   │   └── CONTRACTS_INDEX.md
│   ├── handoffs/                    ← Protocolos de transição
│   │   └── TEMPLATE.md
│   ├── knowledge-graph/             ← Grafo de conhecimento (planeado)
│   │   ├── artifacts.json
│   │   └── relations.json
│   ├── policies/                    ← Políticas operacionais
│   │   └── POLICY-TEMPLATE.md
│   ├── premortem/                   ← Análise de riscos
│   │   └── PREMORTEM.md
│   ├── reviews/                     ← Reviews de sessão
│   │   └── SESSION_REVIEW.md
│   └── rules/                       ← Regras templates
│       └── RULE-TEMPLATE.json
├── reports/                         ← Relatórios de scoring
│   ├── README.md
│   ├── complexity-*.json            ← 9 relatórios
│   └── health-*.json
├── scripts/                         ← Scripts de validação
│   ├── validate-session.ts
│   ├── close-session.ts
│   ├── premortem-check.ts
│   └── sync-docs.ts                 ← Sincronização de documentação
├── session-feedback/                ← Feedback de sessões (runtime)
└── telemetry/                       ← Dados de telemetria
    ├── events-*.jsonl
    ├── maturity-*.json
    └── sessions.jsonl
```

### O que muda por capacidade

| Directório | Base (init) | + knowledge | + architecture | + governance | + ai | + quality | + metrics | + operations | + compliance |
|---|---|---|---|---|---|---|---|---|---|
| `docs/skills/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/agents/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/context/` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `governance/contracts/` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/handoffs/` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `governance/policies/` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/premortem/` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `governance/reviews/` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `cognition/` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `docs/adrs/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/feedback/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/history/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/plans/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/sdr/` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 11. ProjectProfile

O perfil do projecto é definido em `maturity-profile.json` na raiz do `nexus-system/`:

```json
{
  "projectName": "my-project",
  "areas": ["src/components", "src/services", "packages/core"],
  "sensitiveKeywords": ["auth", "payment", "session", "security"],
  "churnWindowDays": 90,
  "weights": {
    "churn": 1.0,
    "violationRate": 1.0,
    "sensitiveSurface": 1.0
  },
  "historyPath": "nexus-system/docs/history",
  "feedbackPath": "nexus-system/docs/feedback",
  "violationKeywords": ["erro", "bug", "corrigi", "falhou", "rollback"],
  "highComplexityThreshold": 7
}
```

- **Áreas** detectadas automaticamente por `nexus init` (via `detectAreas()`)
- **Keywords sensíveis** definidas por defeito (auth, payment, session, security)
- **Weights** ajustáveis para calibrar o scoring

---

## 12. Regras Vinculantes (Resumo)

### Proibições Absolutas

| # | Regra |
|---|---|
| G-01 | Nenhum `git commit` sem autorização explícita do utilizador |
| F-01 | Nenhuma lógica de domínio em componentes UI |
| F-03 | Nenhum import cruzado entre apps |
| F-04 | Nenhum schema de validação fora da camada de contratos |
| S-01 | Nenhum HTML dinâmico sem sanitização |
| S-02 | Nenhuma tabela sem RLS configurado |
| DB-01 | Nenhuma mutação JSONB sem validação |

### Princípios de Código

| # | Regra |
|---|---|
| 1 | Commits em inglês (Conventional Commits) |
| 2 | Testes antes do código (TDD) |
| 3 | Alterações mínimas — não refacta fora do escopo |
| 4 | Verifica após cada step — nunca avança com erro |
| 5 | Feedback é privado — não versionado |

---

## 13. Glossário

| Termo | Definição |
|---|---|
| **Nexus System** | Framework de governança para dev assistido por IA |
| **RAM** | Memória de curto prazo (context_buffer.yaml) — mutável |
| **ROM** | Memória de longo prazo (docs/history/) — imutável |
| **P0-P4** | Níveis de hierarquia de contexto |
| **Premortem** | Análise de riscos prévia à implementação |
| **ADR** | Architecture Decision Record — registo de decisão arquitectural |
| **FORBIDDEN_OPERATIONS** | Regras vinculantes que nenhum agente pode violar |
| **ProjectProfile** | Perfil do projecto (áreas, keywords, weights) |
| **Scoring** | Cálculo de complexidade (static + behavioral metrics) |
| **Handoff** | Transição controlada entre agentes |
| **Context Buffer** | Estado activo da sessão (RAM) |

---

## 14. Comandos CLI

| Comando | Função |
|---|---|
| `nexus init` | Instala framework no projecto (detecta stack, gera profile) |
| `nexus init --answers-file <path>` | Instala com respostas pré-definidas (JSON, sem prompts interactivos) |
| `nexus status` | Verifica saúde da governança (auto-detecta projecto) |
| `nexus upgrade --capability <name>` | Adiciona uma capacidade (knowledge, architecture, governance, ai, quality, metrics, operations, compliance) |
| `nexus upgrade --list` | Mostra capacidades disponíveis e seu estado |
| `nexus upgrade --accept-recommended` | Instala todas as capacidades recomendadas pelo perfil |
| `nexus validate` | Valida conformidade do projecto |
| `nexus detect` | Detecta padrões no histórico de commits |
| `nexus audit` | Auto-avaliação: regras mortas, hotspots de violação |
| `nexus evolve` | Recomendações adaptativas baseadas na maturidade |
| `nexus run` | Pipeline completo de 5 estágios |
| `nexus assess` | Re-avaliação do perfil de maturidade |
| `nexus doctor` | Diagnósticos de saúde do sistema |
| `nexus report` | Gera relatórios |
| `nexus clean` | Limpa cache e ficheiros temporários |
| `nexus bench` | Benchmark de performance do sistema |
| `nexus briefing` | Gera briefing pré-sessão (output markdown ou JSON) |
| `nexus console` | Consola interactiva para debug |
| `nexus dashboard` | Dashboard de métricas e estado |
| `nexus decide` | Motor de decisões assistido por IA |
| `nexus digest` | Digest diário de actividade |
| `nexus feedback` | Gestão de feedback de sessões |
| `nexus goal` | Gestão de objectivos e roadmap |
| `nexus plan` | Geração de planos atómicos |
| `nexus policy` | Gestão de políticas operacionais |
| `nexus profile` | Gestão do perfil do projecto |
| `nexus shell-init` | Configuração de shell (completions, aliases) |
| `nexus act` | Execução de acções atómicas |
| `nexus docs-audit` | Valida sincronização de documentação |

---

## 15. Referências

| Documento | Caminho | Propósito |
|---|---|---|
| WORKFLOW | `governance/WORKFLOW.md` | Fluxo de sessão (entrada única) |
| SYSTEM_MAP | `governance/SYSTEM_MAP.md` | Mapa centralizado do sistema |
| CONTEXT_HIERARCHY | `cognition/context/CONTEXT_HIERARCHY.md` | Hierarquia de leitura P0-P4 |
| AGENTS.md | `docs/AGENTS.md` | Regras do time de engenharia |
| FORBIDDEN_OPERATIONS | `docs/FORBIDDEN_OPERATIONS.md` | Regras vinculantes |
| DESDO | `docs/DESDO.md` | Diretrizes de engenharia |
| CONCEPTUAL_MODEL | `docs/CONCEPTUAL_MODEL.md` | Modelo conceitual canónico |
| KNOWLEDGE_LIFECYCLE | `docs/KNOWLEDGE_LIFECYCLE.md` | Ciclo de vida do conhecimento |
| BACKLOG | `docs/BACKLOG.md` | Fila de tarefas |
| context_buffer | `governance/context/context_buffer.yaml` | Estado activo (RAM) |

---

## 16. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 3.0 | 2026-07-02 | Sincronização completa com estado real: 23 skills, 26 comandos, árvore de pastas actualizada |
| 2.0 | 2026-06-24 | Reescrita completa: 3 níveis, 21 skills, 4 agentes, scoring, profiles |
| 1.0 | — | Criação inicial do guia |
