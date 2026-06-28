# 📋 BACKLOG — Nexus System

> **Priorização e SLA:** P0 (imediato, ≤ 7d), P1 (curto prazo, ≤ 30d), P2 (médio prazo, ≤ 90d), P3 (baixa prioridade, sem SLA).
>
> **Status:** `Backlog` | `In Progress` | `Paused [REVISIT: YYYY-MM-DD]` | `Done`
>
> **Severidade:** 🔴 Crítico | 🟠 Alto | 🟡 Médio | 🟢 Baixo
>
> **Regras vinculantes:** `src/templates/l1/docs/FORBIDDEN_OPERATIONS.md`
>
> **Owner:** Agente que assume o item. Itens sem owner são `unassigned`.

---

## 🏆 P0 — Sprint Actual (≤ 7 dias)

### 🔧 Renomear "nexus-governance" para "nexus-system"

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | 🔴 Crítico |
| **Owner** | Agente |
| **Due** | 2026-06-27 |
| **Criado** | 2026-06-27 |
| **Concluído** | 2026-06-27 |
| **Descrição** | Renomear todas as referências de "nexus-governance" para "nexus-system" em package.json, package-lock.json, README.md, src/commands/init.ts e src/commands/audit.ts. |
| **Critérios de sucesso** | (1) package.json name é "nexus-system"; (2) package-lock.json name é "nexus-system"; (3) README.md usa "nexus-system" em install/run; (4) Comandos CLI referenciam "Nexus System"; (5) Typecheck passa; (6) Todos os testes passam |
| **Commits** | pendente |

### 🔗 Fix repository URL — substituir placeholder "your-org"

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | 🟠 Alto |
| **Owner** | Agente |
| **Due** | Antes do MVP |
| **Criado** | 2026-06-27 |
| **Concluído** | 2026-06-27 |
| **Descrição** | package.json linha 41 contém `"url": "https://github.com/your-org/nexus-system.git"` — placeholder que precisa ser substituído pelo GitHub org/username real do projeto. |
| **Critérios de sucesso** | (1) URL do repositório aponta para o GitHub real; (2) `npm pack` gera metadados corretos |
| **Resolução** | URL actualizado para `https://github.com/ednosmab/nexus-system.git` |

### 🗺️ Executar Plano Estratégico — Próximo Estágio do Nexus System

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | 🟠 Alto |
| **Owner** | Agente |
| **Due** | 2026-07-15 |
| **Criado** | 2026-06-27 |
| **Plano** | `plans/Plano-Estrategico-Proximo-Estagio-do-Nexus-System.md` |
| **Descrição** | Consolidar o Nexus System como plataforma de Gestão da Evolução de Produtos. 10 pilares: (1) Formalização do Modelo Conceitual, (2) Ciclo de Vida do Conhecimento, (3) Capacidades Evolutivas, (4) Assessment Contínuo, (5) Rule Engine, (6) Grafo do Conhecimento, (7) Separação dos Estados, (8) Dívida de Conhecimento, (9) Mentor de Engenharia, (10) Evolução Autônoma. |
| **Fases** | Fase 1 (fundamentos), Fase 2 (UX), Fase 3 (arquitetura), Fase 4 (autonomia) |
| **Critérios de sucesso** | Instalação baseada em maturidade/capacidades; conhecimento com ciclo de vida formal; Rule Engine; CLI como consultor permanente; dívida de conhecimento medida; evolução autônoma recomendada |
| **Concluído** | 2026-06-27 |
| **Resolução** | 10 pilares implementados: CONCEPTUAL_MODEL.md, KNOWLEDGE_LIFECYCLE.md, rule-engine.ts, knowledge-graph.ts, state-manager.ts, knowledge-debt.ts, doctor command, auto-evolution.ts |

---

## ✅ Done

| Item | Severidade | Resolução |
|---|---|---|
| Renomear "nexus-governance" → "nexus-system" | 🔴 Crítico | package.json, package-lock.json, README.md, init.ts, audit.ts actualizados |
| Fix repository URL | 🟠 Alto | package.json repository.url actualizado para ednosmab/nexus-system |
| Executar Plano Estratégico | 🟠 Alto | 10 pilares: conceptual model, knowledge lifecycle, capabilities, rule engine, knowledge graph, state separation, knowledge debt, doctor, auto-evolution |

---

## 📌 P1 — Curto Prazo (≤ 30 dias)

### 🏗️ NEXUS EVOLUTION — Evolução Arquitetural Incremental

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | 🔴 Crítico |
| **Owner** | unassigned |
| **Due** | 2026-07-15 |
| **Criado** | 2026-06-28 |
| **Plano** | `.opencode/plans/nexus-evolution-implementation.md` |
| **Referência** | `plans/NEXUS_EVOLUTION_PLAN.md` |
| **Descrição** | Transformar conceitos implícitos em componentes explícitos da arquitetura. 5 objetivos sequenciais: (1) Engineering Assets como entidades de domínio, (2) Capabilities como entidades de primeira classe, (3) Engineering State como fonte única de verdade, (4) Capability Engine para gerenciamento de ciclo de vida, (5) Pipeline Explícita conectando todos os componentes. |
| **Ordem** | Assets → Capabilities → State → Engine → Pipeline (cada objetivo cria fundação para o próximo) |
| **Commits** | 5 commits (um por objetivo) |
| **Princípios** | Domínio/Infra separados; Dependência unidirecional; Engines como extensão; Builders para agregados; Compatibilidade retroativa |
| **Critérios de sucesso** | (1) Engineering State é fonte de verdade; (2) Capabilities controlam evolução; (3) Nexus cresce por capacidades; (4) IA orientada pelo estado; (5) Pipeline explícita; (6) 321+ testes passando; (7) Typecheck sem erros; (8) Sem dependências bidirecionais |
| **Escopo** | Apenas fundamentos. Recommendation Engine, Dashboard, Plugins, Integrações externas ficam para futuras etapas |

| Item | Severidade | Status | Due | Owner |
|---|---|---|---|---|
| Criar GitHub Actions CI (`.github/workflows/ci.yml`) — typecheck + build + test em Node 18/20/22 | 🟠 Alto | Backlog | 2026-07-15 | unassigned |
| Criar GitHub Actions Release (`.github/workflows/release.yml`) — npm publish em git tags | 🟠 Alto | Backlog | 2026-07-15 | unassigned |
| Publicar npm package — definir scope, registry, e permissões de publicação | 🟠 Alto | Backlog | 2026-07-15 | unassigned |
| Documentar CONTRIBUTING.md com guia de desenvolvimento | 🟡 Médio | Backlog | 2026-07-15 | unassigned |
| Adicionar testes de cobertura (vitest --coverage) ao CI | 🟡 Médio | Backlog | 2026-07-30 | unassigned |

**CI — Detalhe:** CHANGELOG.md documenta CI/CD como features mas os ficheiros `.github/workflows/` nunca foram criados. Workflow CI deve executar: typecheck, build, e testes em Node 18/20/22. Workflow Release deve publicar npm em git tags (ex: `v0.1.0`).

---

## 🗓️ P2 — Médio Prazo (≤ 90 dias)

| Item | Severidade | Status | Due | Owner |
|---|---|---|---|---|
| Testes de integração end-to-end para scaffolding completo | 🟡 Médio | Backlog | 2026-08-01 | unassigned |
| Adicionar `nexus assess` command (avaliação de maturidade reativa) | 🟡 Médio | Backlog | 2026-08-15 | unassigned |
| Melhorar output de `nexus status` com tabela formatada | 🟢 Baixo | Backlog | 2026-08-01 | unassigned |
| Suportar projectos sem Git (fallback para métricas estáticas apenas) | 🟡 Médio | Backlog | 2026-08-15 | unassigned |
| Benchmark suite automatizada (CI) para detectar regressões de performance | 🟢 Baixo | Backlog | 2026-08-30 | unassigned |

---

## 🌱 P3 — Baixa Prioridade (sem SLA)

| Item | Severidade | Status |
|---|---|---|
| Plugin system para skills customizadas | 🟢 Baixo | Backlog |
| Dashboard web para visualização de scores históricos | 🟢 Baixo | Backlog |
| Suportar monorepos com workspaces (pnpm/yarn) | 🟡 Médio | Backlog |
| Integrar com GitHub API para métricas de PRs/issues | 🟢 Baixo | Backlog |
