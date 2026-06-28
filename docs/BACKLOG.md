# BACKLOG — Nexus System

> **Priorizacao:** P0 (imediato, ≤ 7d), P1 (curto prazo, ≤ 30d), P2 (medio prazo, ≤ 90d), P3 (baixa prioridade, sem SLA).
>
> **Status:** `Backlog` | `In Progress` | `Paused [REVISIT: YYYY-MM-DD]` | `Done`
>
> **Severidade:** Critico | Alto | Medio | Baixo
>
> **Regras vinculantes:** `src/templates/base/docs/FORBIDDEN_OPERATIONS.md`
>
> **Owner:** Agente que assume o item. Itens sem owner sao `unassigned`.

---

## Done

| Item | Severidade | Resolucao |
|---|---|---|
| Renomear "nexus-governance" → "nexus-system" | Critico | package.json, package-lock.json, README.md, init.ts, audit.ts atualizados |
| Fix repository URL | Alto | package.json repository.url atualizado para ednosmab/nexus-system |
| Executar Plano Estrategico | Alto | 10 pilares: conceptual model, knowledge lifecycle, capabilities, rule engine, knowledge graph, state separation, knowledge debt, doctor, auto-evolution |
| Executar NEXUS_EVOLUTION_PLAN | Alto | Engineering State, Capability Engine, Recommendation Engine, pipeline explícito, 10 novos eventos, entropy metrics |
| Comando `evolve` com dual-path | Alto | Implementado em `src/commands/evolve.ts` (251 linhas) — dual-path, feedback, growth profile |
| Comando `run` (pipeline) | Alto | Implementado em `src/commands/run.ts` (206 linhas) — pipeline com 5 estagios |
| Comando `assess` | Medio | Implementado em `src/commands/assess.ts` (11k linhas) |
| Comando `report` | Medio | Implementado em `src/commands/report.ts` |
| Auto-evolution com feedback | Alto | Implementado em `src/auto-evolution.ts` (399 linhas) — 4 tipos de recomendacao, integracao com feedback loops |
| Dual-path presenter | Alto | Implementado em `src/dual-path-presenter.ts` (231 linhas) |
| Challenge generator | Alto | Implementado em `src/challenge-generator.ts` (276 linhas) |
| Growth profile | Alto | Implementado em `src/growth-profile.ts` (256 linhas) — persiste em disco |
| pathChoice no feedback-loops | Alto | Implementado em `src/feedback-loops.ts` — tracked por escolha |
| `src/constants.ts` centralizado | Medio | VIOLATION_KEYWORDS, COMMAND_GATES, timeouts centralizados |
| `src/logger.ts` centralizado | Medio | debug/info/warn/error com setLogLevel e muteLogs |
| `src/errors.ts` tipados | Medio | NexusError, NotInitializedError, InvalidRuleError, ScriptNotAllowedError |
| Event bus com `knowledge.analyzed` | Alto | Definido e publicado em audit.ts |
| Plugin validation | Medio | isNexusPlugin() com SAFE_NAME_REGEX, VALID_HOOK_NAMES |
| Atomic writes no cache | Medio | writeCache() usa temp file + renameSync |
| Seguranca no rule-engine | Critico | Allowlist em execSync, sanitizacao de rule ID, limites de regex, prototype pollution protection |
| Docs de arquitetura (30 arquivos) | Medio | 00-VISION.md ate 29-ROADMAP.md + INDEX.md |
| 21 arquivos de teste | Medio | Cobertura para analyser, cache, challenge-generator, dual-path, edge-cases, event-bus, feedback-loops, formatting, growth-profile, health-auditor, maturity-profile, nexus-state-machine, pattern-detector, performance-reporter, pipeline, plugin-system, scaffolder, scorer, session-tracker, utils, cli-integration |

---

## P0 — Bugs Corretivos (≤ 7 dias)

### Bug: `miniBar()` cores invertidas

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Arquivo** | `src/formatting.ts:44-45` |
| **Descricao** | `miniBar()` usa vermelho para scores altos e verde para scores baixos — inverso de `healthBar()`. High scores (>=80%) aparecem em vermelho, low scores (<50%) em verde. |
| **Correcao** | Inverter logica: `pct >= 0.8 ? chalk.green : pct >= 0.5 ? chalk.yellow : chalk.red` |
| **Resolucao** | Cores corrigidas para coincidir com healthBar() |

### Bug: `createNexusCommand` e dead code

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Arquivo** | `src/shared.ts:45-93` |
| **Descricao** | Funcao definida mas nunca importada por nenhum comando. Contem `process.exit(1)` contradizendo o proposito de `errors.ts`. |
| **Correcao** | Remover funcao ou integrar nos comandos que ainda usam `process.exit(1)` |

---

## P1 — Seguranca e Robustez (≤ 30 dias)

### Seguranca: `process.exit(1)` ainda usado em comandos

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Arquivos** | `src/shared.ts:88`, `src/commands/upgrade.ts` (3x), `src/commands/sync.ts` (4x), `src/commands/init.ts` (1x) |
| **Descricao** | Apesar de `errors.ts` existir, ~10 chamadas `process.exit(1)` continuam diretas. Commander nao pode catchar `process.exit()`. |
| **Correcao** | Substituir por throw NexusError/NotInitializedError e deixar Commander tratar |

### Seguranca: `chmod 0o600` ausente no cache

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Arquivo** | `src/cache.ts` |
| **Descricao** | Arquivo `.nexus-cache.json` e escrito com permissoes default (world-readable). Deveria ter `chmod 0o600` apos escrita. |
| **Correcao** | Adicionar `chmodSync(filepath, 0o600)` apos `writeFileSync` |

### Seguranca: Injecao YAML no `create_reminder`

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Arquivo** | `src/rule-engine.ts:355` |
| **Descricao** | `String(action.params.message)` e interpolada em conteudo YAML via substituicao de string. Se atacante controla regra, pode injetar YAML. |
| **Correcao** | Usar biblioteca YAML para geracao ou sanitizar input |

### Type safety: `PipelineContext` com `unknown`

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Arquivo** | `src/pipeline.ts:15-31` |
| **Descricao** | Todos os stage outputs (analysis, complexityReport, patternReport, healthReport, evolutionReport) sao `unknown`. Codigo consumidor usa type casts inseguros (`as ReturnType<typeof analyseProject>`). |
| **Correcao** | Parametrizar PipelineContext com generics ou criar tipos de stage |
| **Resolucao** | PipelineContext agora usa tipos proprios (ProjectAnalysis, ComplexityReport, PatternDetectionReport, etc.) — commit a9fb3fc |

### Refactoring: `validation.ts` centralizado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Logica de validacao fragmentada entre `rule-engine.ts`, `commands/validate.ts`, e `templates/base/scripts/validate-session.ts`. Falta modulo compartilhado com `safeJsonParse()` e `validateSchema()`. |
| **Correcao** | Criar `src/validation.ts` |

---

## P1 — Qualidade e Manutencao (≤ 30 dias)

### Testes ausentes para modulos criticos

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Modulos sem teste** | `src/rule-engine.ts` (777 linhas, modulo mais seguro), `src/auto-evolution.ts` (399 linhas), `src/errors.ts` |
| **Descricao** | rule-engine e o modulo com mais medidas de seguranca mas nao possui testes unitarios. auto-evolution e o cor do sistema de evolucao mas nao tem testes proprios. |
| **Correcao** | Criar `rule-engine.test.ts` (15+ testes), `auto-evolution.test.ts` (3+ testes), `errors.test.ts` |

### Tooling: ESLint ausente

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Nenhum `.eslintrc.json` ou equivalente existe. npm script `lint` referencia mas nao ha config. |
| **Correcao** | Instalar e configurar ESLint com regras TypeScript |

### Tooling: `tsup.config.ts` ausente

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Build usa tsup mas nao ha arquivo de configuracao. Configuracao esta implicita em package.json. |
| **Correcao** | Criar `tsup.config.ts` com configuracao explicita |

### CI/CD: GitHub Actions ausentes

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Descricao** | CHANGELOG.md documenta CI/CD mas os arquivos `.github/workflows/` nao existem. CI deve rodar typecheck + build + test em Node 18/20/22. Release deve publicar npm em git tags. |
| **Correcao** | Criar `.github/workflows/ci.yml` e `.github/workflows/release.yml` |

---

## P2 — Medio Prazo (≤ 90 dias)

| Item | Severidade | Status | Due | Owner |
|---|---|---|---|---|
| Testes de integracao end-to-end para scaffolding completo | Medio | Backlog | 2026-08-01 | unassigned |
| Melhorar output de `nexus status` com tabela formatada | Baixo | Backlog | 2026-08-01 | unassigned |
| Suportar projectos sem Git (fallback para metricas estaticas apenas) | Medio | Backlog | 2026-08-15 | unassigned |
| Benchmark suite automatizada (CI) para detectar regressoes de performance | Baixo | Backlog | 2026-08-30 | unassigned |
| Adicionar `test:coverage` script ao package.json | Baixo | Backlog | 2026-08-15 | unassigned |
| Documentar CONTRIBUTING.md com guia de desenvolvimento | Medio | Backlog | 2026-08-15 | unassigned |
| Publicar npm package — definir scope, registry, e permissoes | Alto | Backlog | 2026-08-01 | unassigned |

---

## P3 — Baixa Prioridade (sem SLA)

| Item | Severidade | Status |
|---|---|---|
| Plugin system para skills customizadas | Baixo | Backlog |
| Dashboard web para visualizacao de scores historicos | Baixo | Backlog |
| Suportar monorepos com workspaces (pnpm/yarn) | Medio | Backlog |
| Integrar com GitHub API para metricas de PRs/issues | Baixo | Backlog |

---

## Backlog Estrategico (referencia — nao e sprint)

Estes itens sao de longo prazo e estao documentados em `plans/`. Nao devem ser adicionados ao sprint sem consolidacao previa.

| Item | Documento | Status |
|---|---|---|
| Engineering State como fonte unica de verdade | `NEXUS_EVOLUTION_PLAN.md` | **Done** — `src/engineering-state.ts` (712 linhas) |
| Capability Engine | `NEXUS_EVOLUTION_PLAN.md` | **Done** — `src/capability-engine.ts` (542 linhas) |
| Recommendation Engine | `NEXUS_EVOLUTION_PLAN.md` | **Done** — `src/recommendation-engine.ts` (474 linhas) |
| Maturity-based installation (substituir L1/L2/L3) | `Plano-de-Evolução-do-Nexus-CLI.md` | Conceitual |
| Reducao de entropia organizacional | `NEXUS_EVOLUTION_PLAN.md` | **Done** — integrado em `engineering-state.ts` (entropy metrics) |
| Pipeline explícito com 8 stages | `NEXUS_EVOLUTION_PLAN.md` | **Done** — `src/pipeline.ts` (createDefaultPipeline) |
| Eventos de engenharia (10 novos tipos) | `NEXUS_EVOLUTION_PLAN.md` | **Done** — `src/event-bus.ts` |

> **Nota:** Os 11 arquivos em `plans/` possuem massiva sobreposicao. `auditoria-completa-plano.md` e `auditoria-correcao-completa.md` cobrem o mesmo escopo. `unified-execution.md` e o documento de coordenacao. Recomenda-se consolidar em um unico plano antes de iniciar novo ciclo.
