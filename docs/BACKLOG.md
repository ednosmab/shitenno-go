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
>
> **Ultima auditoria:** 2026-06-28 — Coverage 50.71%, 484 testes, 0 lint warnings

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
| ESLint migrado para flat config | Alto | eslint.config.js criado para ESLint v10, .eslintrc.json removido |
| 38 warnings ESLint corrigidos | Alto | Imports/variaveis nao usadas removidas, dead code limpo, any types corrigidos |
| require() substituido por ESM imports | Medio | bin/nexus.ts e event-bus.ts atualizados para ESM |
| Trend historico no performance-reporter | Medio | Comparacao real de scores entre periodos, mostActiveDay calculado |
| Coverage configurado com @vitest/coverage-v8 | Alto | vitest.config.ts com thresholds, reporters text/json-summary/html |
| Testes de integracao para CLI commands | Alto | commands.test.ts — 42 testes para sync, doctor, report (43% → 49% coverage) |
| Testes unitarios para scorer.ts | Alto | scorer-extra.test.ts — 27 testes (46% → 79% coverage) |
| Coverage gate no CI | Alto | .github/workflows/ci.yml com step de coverage, vitest.config.ts com thresholds |
| npm run bench — comparacao antes/depois | Medio | Nenhuma regressao de performance detectada |

---

## P0 — Bugs Corretivos (≤ 7 dias)

### npm audit: vulnerabilidade em esbuild

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Pacote** | esbuild 0.27.3 - 0.28.0 |
| **Descricao** | npm audit detecta 1 vulnerabilidade low-severity em esbuild (dependencia de tsup). Fix disponivel via `npm audit fix`. |
| **Correcao** | Rodar `npm audit fix` ou atualizar tsup para versao mais recente |

---

## P1 — Seguranca e Robustez (≤ 30 dias)

### Empty catch blocks (erros silenciados)

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Arquivos afetados** | `src/analyser.ts:210`, `src/auto-evolution.ts:272,396`, `src/cache.ts:45,71,150,162,236`, `src/capability-engine.ts:169,276,469`, `src/engineering-state.ts:242,539,561,645`, `src/event-bus.ts:124,207`, `src/feedback-loops.ts:137,160` |
| **Descricao** | ~20 blocos `catch {}` vazios silenciam erros sem log ou re-throw. Em producao, falhas ficam invisiveis. Exemplo: `cache.ts:45` — se JSON.parse falha, cache retorna null sem indicar corrupcao. |
| **Correcao** | Adicionar `console.error` ou `logger.debug` em cada catch vazio, ou re-throw com contexto. Priorizar em `cache.ts` e `engineering-state.ts` que tem mais blocos. |

### Tipos `any` residuais em src/

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivos afetados** | `src/commands/*.ts` (129 occurrences de console.log que usam `any` indiretamente), `src/knowledge-debt.ts:315`, `src/cache.ts:6,90`, `src/auto-evolution.ts:292` |
| **Descricao** | Embora `as any` explicito tenha sido removido, restam 129 `console.log` em commands que produzem output sem type-safety. Tambem existem 4 ocorrencias de `any` em comentarios. |
| **Correcao** | Nenhuma acao critica — sao apenas console.log para output CLI. Considerar migrar para logger centralizado. |

### Seguranca: `process.exit(1)` ausente (ja corrigido)

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Resolucao** | Todas as 9 chamadas process.exit(1) e 2 process.exit(0) substituidas por return |

---

## P1 — Qualidade e Manutencao (≤ 30 dias)

### Coverage gap: comandos CLI com 0%

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Arquivos** | `src/commands/assess.ts` (0%), `src/commands/audit.ts` (0%), `src/commands/clean.ts` (0%), `src/commands/detect.ts` (0%), `src/commands/doctor.ts` (0%), `src/commands/evolve.ts` (0%), `src/commands/init.ts` (11.44%), `src/commands/report.ts` (0%), `src/commands/run.ts` (0%), `src/commands/status.ts` (0%), `src/commands/upgrade.ts` (0%), `src/commands/validate.ts` (0%) |
| **Descricao** | 12 dos 13 comandos CLI estao com 0% de coverage. Apenas init.ts e commands.test.ts cobrem parcialmente. Comandos testados via CLI binario nao contam para coverage de source. |
| **Correcao** | Exportar funcoes auxiliares de cada comando e criar testes unitarios (como feito para sync/doctor/report). Priorizar: assess, doctor, evolve, report, upgrade. |

### Coverage gap: modulos core com baixa cobertura

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Modulos** | `src/knowledge-graph.ts` (4.69%), `src/prompts.ts` (0.86%), `src/constants.ts` (0%), `src/shared.ts` (0%), `src/logger.ts` (46.51%), `src/state-manager.ts` (45.41%), `src/plugin-system.ts` (54.03%), `src/engineering-state.ts` (48.01%), `src/knowledge-debt.ts` (56.32%), `src/recommendation-engine.ts` (47.72%), `src/auto-evolution.ts` (57.58%), `src/capability-engine.ts` (59.94%), `src/event-bus.ts` (66.66%), `src/pipeline.ts` (43.47%) |
| **Descricao** | 14 modulos core com coverage abaixo de 70%. Os mais criticos: knowledge-graph (4.69%), prompts (0.86%), constants (0%). |
| **Correcao** | Criar testes unitarios para cada modulo. Comecar por knowledge-graph e shared.ts que sao fundamentais. |

### Coverage gap: modulos ja bem cobertos (manter)

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Modulos** | `src/errors.ts` (100%), `src/formatting.ts` (100%), `src/validation.ts` (100%), `src/analyser.ts` (98.78%), `src/maturity-profile.ts` (98.75%), `src/session-tracker.ts` (96.52%), `src/cache.ts` (96.29%), `src/scaffolder.ts` (94.97%), `src/challenge-generator.ts` (94.87%), `src/dual-path-presenter.ts` (95.86%), `src/performance-reporter.ts` (94.29%), `src/pattern-detector.ts` (93.45%), `src/utils.ts` (93.33%) |
| **Descricao** | 13 modulos com coverage > 93%. Manter como baseline e adicionar testes regressivos se houver refatoracoes. |

### Coverage threshold: funcao `readPackageJson` em analyser.ts

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivo** | `src/analyser.ts:210-212` |
| **Descricao** | `readPackageJson()` tem um `catch {}` vazio que esconde falhas de parse. Embora o modulo tenha 98.78% de coverage, esta funcao especifica nao e testada com JSON invalido. |
| **Correcao** | Adicionar teste para JSON invalido em package.json |

---

## P2 — Medio Prazo (≤ 90 dias)

| Item | Severidade | Status | Due | Owner |
|---|---|---|---|---|
| Testes de integracao end-to-end para scaffolding completo | Medio | Backlog | 2026-08-01 | unassigned |
| Melhorar output de `nexus status` com tabela formatada | Baixo | Backlog | 2026-08-01 | unassigned |
| Suportar projectos sem Git (fallback para metricas estaticas apenas) | Medio | Backlog | 2026-08-15 | unassigned |
| Benchmark suite automatizada (CI) para detectar regressoes de performance | Baixo | Backlog | 2026-08-30 | unassigned |
| Documentar CONTRIBUTING.md com guia de desenvolvimento | Medio | Backlog | 2026-08-15 | unassigned |
| Publicar npm package — definir scope, registry, e permissoes | Alto | Backlog | 2026-08-01 | unshared |
| Migrar testes CLI de exec() para import direto | Medio | Backlog | 2026-08-15 | unassigned |
| Adicionar testes para modulos com 0% (constants.ts, shared.ts, prompts.ts) | Medio | Backlog | 2026-08-01 | unassigned |
| Consolidar planos de `plans/` em unico documento | Medio | Backlog | 2026-08-15 | unassigned |
| Extrair funcoes testaveis de commands/ para aumentar coverage | Medio | Backlog | 2026-08-01 | unassigned |

---

## P3 — Baixa Prioridade (sem SLA)

| Item | Severidade | Status |
|---|---|---|
| Plugin system para skills customizadas | Baixo | Backlog |
| Dashboard web para visualizacao de scores historicos | Baixo | Backlog |
| Suportar monorepos com workspaces (pnpm/yarn) | Medio | Backlog |
| Integrar com GitHub API para metricas de PRs/issues | Baixo | Backlog |
| Migrar console.log dos commands para logger centralizado | Baixo | Backlog |
| Adicionar HTML coverage report ao .gitignore | Baixo | Backlog |

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

---

## Metricas de Qualidade (snapshot 2026-06-28)

```
Projeto:       nexus-system v0.1.0
TypeScript:    strict: true, 0 erros
Testes:        484/484 passando (31 arquivos)
Coverage:      50.71% (linhas) | 82.12% (funcoes) | 76.09% (branches)
ESLint:        0 erros, 0 warnings
Dependencias:  6 deps + 10 devDeps (lean)
CI/CD:         ci.yml (Node 18/20/22 + coverage gate)
               release.yml (npm publish + GitHub Release)
```
