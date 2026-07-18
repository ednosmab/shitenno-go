# Plano de Refactor Estrutural — SA4 / SA10 / SA11

**Status:** done
**Updated_at:** 2026-07-15T06:27:34.339Z
**Date:** 2026-07-13

> **Data:** 2026-07-13
> **Status:** Planeado
> **Prioridade:** P1
> **Backlog refs:** SA4 (Arquitetura), SA10 (Clean Architecture), SA11 (SOLID/God Modules)
> **Dependências:** Nenhuma — pode iniciar imediatamente

---


## Checklist

- [ ] `pnpm run lint` — limpo
- [ ] `pnpm test` — todos passam
- [ ] `pnpm run build` — OK
- [ ] `wc -l src/*.ts` — nenhum > 400
- [ ] `find src/ -maxdepth 1 -name "*.ts" | wc -l` — < 30
- [ ] `ls -d src/domain/ src/infrastructure/ src/shared/` — existem
- [ ] Backlog SA4/SA10/SA11 actualizado

## 1. Problema

O código fonte tem **99 ficheiros flat** em `src/` (era 46 quando os items foram criados). Situação actual:

| Métrica | Actual | Target |
|---|---|---|
| Ficheiros flat em `src/` | 99 | < 30 |
| Ficheiros >500 linhas | 10 | < 3 |
| Maior ficheiro | `rule-engine.ts` (1307) | < 400 |
| Subpastas em `src/` | 5 (audit, commands, console, handbook, templates) | +3 (domain, infrastructure, shared) |
| Padrões DI | 1 (context-collector) | > 10 |

### God Modules identificados

| Ficheiro | Linhas | Responsabilidade |
|---|---|---|
| `rule-engine.ts` | 1307 | Regras, triggers, execução, validação |
| `scorer.ts` | 947 | Scoring, profile loading, area calculation |
| `engineering-state.ts` | 908 | Estado, consolidação, histórico, mutations |
| `feedback-engine.ts` | 756 | Feedback, personalização, formatação |
| `doc-lifecycle-auditor.ts` | 753 | Auditoria, detecção, sugestões |
| `knowledge-graph.ts` | 671 | Grafo, persistência, queries |
| `mcp-server.ts` | 591 | Servidor MCP, tools, resources |
| `maturity-profile.ts` | 586 | Maturidade, dimensões, snapshots |
| `health-auditor.ts` | 567 | Saúde, scoring, recomendações |
| `capability-engine.ts` | 542 | Capacidades, mapping, instalação |

---

## 2. Estrutura Alvo

```
src/
├── domain/                    # Entidades e regras de negócio puras
│   ├── entities/              # Tipos de dados core
│   │   ├── project.ts         # ProjectProfile, ShitenState
│   │   ├── maturity.ts        # MaturityProfile, Dimension
│   │   ├── feedback.ts        # SessionFeedbackRecord, SessionOutcome
│   │   ├── plan.ts            # Plan, PlanStatus
│   │   ├── knowledge.ts       # KnowledgeGraph, KnowledgeNode
│   │   └── rule.ts            # Rule, RuleTrigger
│   ├── rules/                 # Regras de negócio (extraído de rule-engine.ts)
│   │   ├── rule-evaluator.ts  # Avaliação de condições
│   │   ├── rule-loader.ts     # Carregamento de regras
│   │   └── rule-registry.ts   # Registo de regras activas
│   └── scoring/               # Scoring (extraído de scorer.ts)
│       ├── area-scorer.ts     # Cálculo de score por área
│       ├── project-scorer.ts  # Score global
│       └── profile-loader.ts  # Carregamento de perfil
│
├── infrastructure/            # Implementações concretas
│   ├── persistence/           # Leitura/escrita de ficheiros
│   │   ├── file-storage.ts    # Storage genérico append-only
│   │   ├── jsonl-reader.ts    # Leitura JSONL
│   │   ├── cache.ts           # Cache em disco
│   │   └── git-access.ts      # Operações git
│   ├── event-bus/             # Sistema de eventos
│   │   ├── bus.ts             # Publicação/subscrição
│   │   └── payloads.ts        # Tipos de evento
│   └── prompts/               # Interface com utilizador
│       ├── interactive.ts     # Perguntas interactivas
│       └── output.ts          # Helpers de output (já existe src/output.ts)
│
├── shared/                    # Utilitários partilhados
│   ├── errors.ts              # Tipos de erro (já existe)
│   ├── constants.ts           # Constantes (já existe)
│   ├── utils.ts               # Helpers genéricos (já existe)
│   └── formatting.ts          # Formatação (já existe)
│
├── commands/                  # Comandos CLI (já existe)
│   ├── status.ts
│   ├── audit.ts
│   ├── ...
│   └── index.ts               # Registo de comandos
│
├── audit/                     # Auditores (já existe)
│   ├── health-auditor.ts      # Simplificado, delega para domain/
│   ├── engineering-detectors/
│   └── ...
│
├── engine/                    # Engines de alto nível
│   ├── feedback-engine.ts     # Orquestração de feedback
│   ├── capability-engine.ts   # Orquestração de capacidades
│   ├── recommendation-engine.ts
│   ├── decision-engine.ts
│   └── plan-engine.ts         # Lifecycle de planos
│
└── __tests__/                 # Testes (já existe)
    ├── domain/
    ├── infrastructure/
    └── engine/
```

---

## 3. Fases de Execução

### Fase 1 — Extrair Domain Entities (2-3h)
**Risco:** Baixo — apenas mover tipos, sem mudança de lógica.

| Step | Ação | Ficheiros | Verificação |
|---|---|---|---|
| 1.1 | Criar `src/domain/entities/` e extrair tipos de `ShitenState`, `ProjectProfile` de `engineering-state.ts` e `scorer.ts` | Novo: `project.ts`, `maturity.ts`, `feedback.ts`, `plan.ts`, `knowledge.ts`, `rule.ts` | `grep -r "ShitenState" src/` — todos importam de `domain/entities/project.ts` |
| 1.2 | Criar barrel export `src/domain/index.ts` | Novo: `domain/index.ts` | `pnpm run lint` |
| 1.3 | Actualizar imports nos 99 ficheiros flat para usar `domain/` | Todos os ficheiros que importam tipos | `pnpm test` — todos passam |
| 1.4 | Testes unitários para entities (validação de tipos) | Novo: `__tests__/domain/entities/` | `pnpm test` |

### Fase 2 — Extrair Domain Rules (3-4h)
**Risco:** Médio — `rule-engine.ts` é complexo (1307 linhas).

| Step | Ação | Ficheiros | Verificação |
|---|---|---|---|
| 2.1 | Extrair `evaluateCondition()` e helpers de comparação para `domain/rules/rule-evaluator.ts` | Mod: `rule-engine.ts` → `domain/rules/rule-evaluator.ts` | Testes de regras existentes passam |
| 2.2 | Extrair carregamento de regras para `domain/rules/rule-loader.ts` | Mod: `rule-engine.ts` → `domain/rules/rule-loader.ts` | `grep -c "getActiveRules" src/` — mesmo count |
| 2.3 | Extrair registo de regras para `domain/rules/rule-registry.ts` | Mod: `rule-engine.ts` → `domain/rules/rule-registry.ts` | `pnpm test` |
| 2.4 | `rule-engine.ts` fica como orquestrador fino (~200 linhas) | Mod: `rule-engine.ts` | `wc -l src/rule-engine.ts` < 250 |
| 2.5 | Testes para cada módulo extraído | Novo: `__tests__/domain/rules/` | `pnpm test` |

### Fase 3 — Extrair Scoring (2-3h)
**Risco:** Baixo — `scorer.ts` é relativamente independente.

| Step | Ação | Ficheiros | Verificação |
|---|---|---|---|
| 3.1 | Extrair `calculateAreaScores()` para `domain/scoring/area-scorer.ts` | Mod: `scorer.ts` → `domain/scoring/area-scorer.ts` | Testes de scoring passam |
| 3.2 | Extrair `calculateProjectScore()` para `domain/scoring/project-scorer.ts` | Mod: `scorer.ts` → `domain/scoring/project-scorer.ts` | `pnpm test` |
| 3.3 | Extrair `loadProjectProfile()` para `domain/scoring/profile-loader.ts` | Mod: `scorer.ts` → `domain/scoring/profile-loader.ts` | `pnpm test` |
| 3.4 | `scorer.ts` fica como barrel/facade (~150 linhas) | Mod: `scorer.ts` | `wc -l src/scorer.ts` < 200 |

### Fase 4 — Extrair Infrastructure (2-3h)
**Risco:** Baixo — separar I/O de lógica.

| Step | Ação | Ficheiros | Verificação |
|---|---|---|---|
| 4.1 | Mover `file-storage.ts`, `jsonl-reader.ts` para `infrastructure/persistence/` | Mov: ficheiros existentes | Imports actualizados, testes passam |
| 4.2 | Extrair operações git de `validate.ts` e `shared.ts` para `infrastructure/persistence/git-access.ts` | Mod: `validate.ts`, `shared.ts` | `pnpm test` |
| 4.3 | Mover event-bus para `infrastructure/event-bus/` | Mov: `event-bus.ts` | Imports actualizados |

### Fase 5 — Split God Modules (4-6h)
**Risco:** Alto — refactoring de módulos grandes com muitos dependents.

| Step | Ação | Ficheiros | Verificação |
|---|---|---|---|
| 5.1 | Dividir `engineering-state.ts` (908) em: `domain/entities/engineering-state.ts` + `engine/engineering-state-consolidator.ts` + `infrastructure/persistence/engineering-state-io.ts` | Mod: `engineering-state.ts` | 3 ficheiros < 350 cada |
| 5.2 | Dividir `feedback-engine.ts` (756) em: `engine/feedback-engine.ts` + `engine/feedback-personalizer.ts` | Mod: `feedback-engine.ts` | 2 ficheiros < 400 cada |
| 5.3 | Dividir `knowledge-graph.ts` (671) em: `domain/entities/knowledge.ts` + `engine/knowledge-engine.ts` | Mod: `knowledge-graph.ts` | 2 ficheiros < 400 cada |
| 5.4 | Dividir `maturity-profile.ts` (586) em: `domain/entities/maturity.ts` + `engine/maturity-engine.ts` | Mod: `maturity-profile.ts` | 2 ficheiros < 350 cada |
| 5.5 | Dividir `health-auditor.ts` (567) em: `engine/health-auditor.ts` + `engine/health-recommender.ts` | Mod: `health-auditor.ts` | 2 ficheiros < 350 cada |
| 5.6 | Dividir `capability-engine.ts` (542) em: `engine/capability-engine.ts` + `engine/capability-installer.ts` | Mod: `capability-engine.ts` | 2 ficheiros < 350 cada |
| 5.7 | Testes para cada split | Novo: `__tests__/engine/` | `pnpm test` |

### Fase 6 — DI Básico + Cleanup (2-3h)
**Risco:** Baixo — adopts padrão existente em `context-collector.ts`.

| Step | Ação | Ficheiros | Verificação |
|---|---|---|---|
| 6.1 | Criar `src/shared/container.ts` com service locator simples | Novo: `shared/container.ts` | `pnpm run lint` |
| 6.2 | Adoptar DI em 3-5 módulos de alto uso (commands) | Mod: 3-5 commands | `pnpm test` |
| 6.3 | Actualizar `wc -l` — verificar que nenhum ficheiro > 500 | Verificação | `wc -l src/*.ts src/**/*.ts \| sort -rn \| head -5` |
| 6.4 | Actualizar backlog SA4/SA10/SA11 com estado final | Mod: `BACKLOG.md` | — |

---

## 4. Orçamento Total

| Fase | Esforço | Complexidade |
|---|---|---|
| Fase 1 — Domain Entities | 2-3h | Baixa |
| Fase 2 — Domain Rules | 3-4h | Média |
| Fase 3 — Scoring | 2-3h | Baixa |
| Fase 4 — Infrastructure | 2-3h | Baixa |
| Fase 5 — Split God Modules | 4-6h | Alta |
| Fase 6 — DI + Cleanup | 2-3h | Baixa |
| **Total** | **15-22h** | — |

---

## 5. Critérios de Sucesso

| Critério | Métrica |
|---|---|
| Ficheiros flat em `src/` | < 30 |
| Maior ficheiro | < 400 linhas |
| Ficheiros >500 linhas | 0 |
| Subpastas `domain/`, `infrastructure/`, `shared/` | Existem |
| DI adoptado | > 5 módulos |
| Testes | Todos passam |
| Lint | Limpo |
| Build | OK |

---

## 6. Ordem de Execução Recomendada

1. **Fase 1** (Entities) — fundação para tudo o resto
2. **Fase 3** (Scoring) — independente, baixo risco
3. **Fase 4** (Infrastructure) — independente, baixo risco
4. **Fase 2** (Rules) — depende de entities
5. **Fase 5** (God Modules) — maior esforço, fazer penúltimo
6. **Fase 6** (DI) — último, consolida tudo

> **Nota:** Fases 1-4 podem ser feitas em paralelo por agentes diferentes.
> Fase 5 depende de 1-4 estar completas.
> Fase 6 depende de 5.

---

## 7. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Imports quebrados após mover ficheiros | Alto | Fase por fase, `pnpm test` após cada step |
| Circular dependencies | Médio | Domain não importa infrastructure |
| Testes que dependem de implementação | Médio | Extrair interfaces antes de mover |
| Regressão silenciosa | Alto | Manter barrel exports temporários |

---

## 8. Checklist de Validação

- [ ] `pnpm run lint` — limpo
- [ ] `pnpm test` — todos passam
- [ ] `pnpm run build` — OK
- [ ] `wc -l src/*.ts` — nenhum > 400
- [ ] `find src/ -maxdepth 1 -name "*.ts" | wc -l` — < 30
- [ ] `ls -d src/domain/ src/infrastructure/ src/shared/` — existem
- [ ] Backlog SA4/SA10/SA11 actualizado
