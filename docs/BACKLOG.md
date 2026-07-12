# BACKLOG — Nexus System

> **Priorizacao:** P0 (imediato, ≤ 7d), P1 (curto prazo, ≤ 30d), P2 (medio prazo, ≤ 90d), P3 (baixa prioridade, sem SLA).
>
> **Status:** `Backlog` | `In Progress` | `Paused [REVISIT: YYYY-MM-DD]` | `Done`
>
> **Severidade:** Critico | Alto | Medio | Baixo
>
> **Owner:** Agente que assume o item. Itens sem owner sao `unassigned`.
>
> **Ultima atualizacao:** 2026-07-12 — race condition fix no retroactive scan (lock + cooldown), 1898 testes passing

---

## Done

| Item | Severidade | Resolucao |
|---|---|---|
| Renomear "nexus-governance" → "nexus-system" | Critico | package.json, init.ts, audit.ts |
| Executar Plano Estrategico (10 pilares) | Alto | conceptual model, knowledge lifecycle, capabilities, etc. |
| Comando `evolve` com dual-path | Alto | src/commands/evolve.ts (251 linhas) |
| Comando `run` (pipeline) | Alto | src/commands/run.ts (206 linhas) |
| Auto-evolution com feedback | Alto | src/auto-evolution.ts (399 linhas) |
| Dual-path presenter | Alto | src/dual-path-presenter.ts (231 linhas) |
| Challenge generator | Alto | src/challenge-generator.ts (276 linhas) |
| Growth profile | Alto | src/growth-profile.ts (256 linhas) |
| Event bus com 10 tipos novos | Alto | src/event-bus.ts |
| Seguranca no rule-engine | Critico | Allowlist em execSync, sanitizacao |
| Atomic writes no cache | Medio | writeCache() usa tmp + renameSync |
| Coverage configurado com thresholds | Alto | vitest.config.ts com @vitest/coverage-v8 |
| Context Pipeline completo | Alto | collectContext(), briefing-cache, session-feedback |
| Comando `feedback` | Alto | nexus feedback --outcome success/failure/partial |
| Comando `bench` | Medio | nexus bench — token benchmark automatizado |
| Comando `dashboard` | Medio | nexus dashboard — token economy metrics |
| Token optimizer | Medio | suggestDepth, compressedSummary, differentialBriefing |
| Gap 1: status.ts usa collectContext() | Alto | Substituido ad-hoc por pipeline unificado |
| Gap 2: feedback.ts briefingHash conectado | Alto | Le do briefing-cache em vez de hardcoded "" |
| Gap 3: session-tracker ↔ session-feedback | Alto | sessionId field, getFeedbackForSession() |
| Gap 4: recurringErrors populado | Alto | Via feedback failure hotspots em enrichBriefingWithPatterns |
| Gap 5: pattern-detector no briefing | Alto | Campo detected[] populado por detectPatterns() |
| Token-optimizer integrado no briefing | Alto | compressedSummary em --summary, suggestDepth adaptativo, --profile option |
| P0 0.1: Remover auto-feedback briefing | Alto | Removido recordOutcome() automatico do briefing command |
| P0 0.2: Padrao redundante eliminado | Alto | enrichBriefingWithPatterns() aceita patternReport opcional |
| P0 0.3: Dead code briefing.ts | Medio | Removido displayBriefing() e import getCachedBriefing |
| P0 0.4: Dead code dashboard.ts | Baixo | Removido trendArrow() |
| P0 0.5: Simplificar getLatestFeedback | Baixo | Refatorado para records.at(-1) ?? null |
| 1.12 Coverage gap: comandos CLI | Alto | 36 novos testes em digest.test.ts + commands-action.test.ts (580 total) |
| Auto-backlog feature | Alto | nexus audit --auto-backlog — detecta gaps e escreve no BACKLOG.md (606 testes) |
| AUDIT-EXPANSION | Alto | Expandir audit coverage 79% → ~93% (taint, rule-engine) — 2026-07-04 |
| QUICK-BOARD-FIX | Alto | Corrigir loadQuickBoard() — require() em contexto ESM — 2026-07-04 |
| SA1 | Critico | governance/WORKFLOW.md criado — 2026-07-01 |
| SA6 | Alto | Artefactos orfaos conectados via SYSTEM_MAP.md — 2026-07-01 |
| SA14 | Baixo | docs/session-template.md criado — 2026-07-01 |
| BACKLOG-0.7 | Critico | Actualizar documentação desactualizada (6 ficheiros) — 2026-07-05 |
| SA2 | Critico | Resolvido import de node:fs em src/commands/digest.ts — 2026-07-05 |
| 2.3 | Medio | Criado src/commands/update.ts e src/manifest.ts — 2026-07-05 |
| AUDIT-CLEANUP-01 | Baixo | Testes knowledge-debt.test.ts e state-manager.test.ts criados — 2026-07-05 |
| AUDIT-CLEANUP-02 | Baixo | Health score deductions extraidos para formatting.ts (HEALTH_SCORE_DEDUCTIONS) — 2026-07-05 |
| AUDIT-CLEANUP-03 | Baixo | Removidos 4 casts as NexusEventType em pipeline.ts — 2026-07-05 |
| AUDIT-CLEANUP-04 | Baixo | run_script → run_local_script (deprecated fallback) — 2026-07-05 |
| AUDIT-CLEANUP-05 | Baixo | Planos de auditoria movidos para plans/done/ — 2026-07-05 |
| DESOPLAMENTO A.1-A.4 | Critico | Desacoplamento de opencode.json — shared.ts, nexus-state-machine.ts, analyser.ts, capability-engine.ts — 2026-07-07 |
| DESOPLAMENTO A.5 | Alto | MCP multi-formato (.mcp.json + .cursor/mcp.json) — init.ts — 2026-07-07 |
| DESOPLAMENTO B.1 | Alto | Path do BACKLOG.md corrigido no scaffolder — capability-mapping.ts — 2026-07-07 |
| DESOPLAMENTO B.2 | Medio | Falso positivo de XSS eliminado — engineering-detectors.ts — 2026-07-07 |
| DESOPLAMENTO B.3 | Medio | Sync restaurado em bin/nexus.ts, gate valido — 2026-07-07 |
| DESOPLAMENTO B.5 | Alto | OOM em vitest resolvido — programCache no TaintAnalyzer — 2026-07-07 |
| DESOPLAMENTO B.6 | Medio | healthScore recalibrado com sqrt e normalizacao — 2026-07-07 |
| DESOPLAMENTO B.7 | Alto | Rule engine auto-cria directories (history/, context/) — ensureContextBuffer() — 2026-07-07 |
| MCP-SERVER | Alto | Servidor MCP com 3 tools (getBriefing, getRiskMap, getRules) — mcp-server.ts — 2026-07-07 |
| SA3 | Critico | Governance 0% resolvido — maturity-profile.ts + policies + answers.json — 2026-07-06 |
| 2.5 | Medio | context-collector desacoplado de pattern-detector via ContextDeps — 2026-07-08 |
| 2.6 | Baixo | BriefingDepth tipo proprio em displayBriefingByDepth() — 2026-07-08 |
| 2.8 | Medio | Schema validation em JSONL readers (session-feedback, session-tracker) — 2026-07-08 |
| 2.9 | Baixo | banner()/section()/kv() extraidos para formatting.ts, 7 commands actualizados — 2026-07-08 |
| 2.10 | Medio | AGENTS.md template actualizado com lista completa de 20+ comandos — 2026-07-08 |
| 2.15b | Medio | Cache intermediario no collectContext via getCached/setCache injectaveis — 2026-07-08 |
| SA8 | Alto | context_buffer.yaml movido para core + ensureContextBuffer() — 2026-07-08 |
| SA5 | Alto | 4 ADRs criados (ADR-001 a ADR-005) — 2026-07-08 |
| SA9 | Alto | 4 agent contracts (planner, executor, reviewer, orchestrator) — 2026-07-08 |
| SA13 | Baixo | ADRs documentados (resolvido pelo SA5) — 2026-07-08 |
| 2.2a | Medio | Feedback CLI flags (--user-rating, --user-comment) + testes — 2026-07-08 |
| 2.18 | Medio | Dashboard cliques do mouse funcionais — 2026-07-08 |
| 3.5 | Baixo | Plugin system com registerPlugin(), hooks, validacao — 2026-07-08 |
| 3.29 | Medio | Session-tracker ja usa appendFileSync (append-only) — 2026-07-08 |
| 2.11 | Baixo | ROI.md linkado em README.md:133 — 2026-07-08 |
| 3.6 | Baixo | nexus dashboard --live (--live <seconds>) — 2026-07-08 |
| 3.21 | Baixo | Briefing --profile com minimal/standard/full — 2026-07-08 |
| 3.24 | Baixo | Event history query API (getHistory()) — 2026-07-08 |
| 2.14 | Baixo | KNOWN_LIMITATIONS.md ja existe com 12 limitacoes documentadas — 2026-07-09 |
| RACE-FIX | Alto | Lock inter-processo + cooldown persistido no retroactive scan — 2026-07-12 |

---

## P0 — Bugs e Integracao Imediata (≤ 7 dias)

### 0.1 Remover auto-feedback "success" no briefing command

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Resolucao** | Removido recordOutcome() automatico do briefing command (2026-06-30) |
| **Arquivo** | `src/commands/briefing.ts` |

### 0.2 Evitar deteccao de padroes redundante

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Resolucao** | enrichBriefingWithPatterns() aceita patternReport opcional (2026-06-30) |
| **Arquivo** | `src/context-collector.ts` |

### 0.3 Remover dead code em briefing.ts

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Removido displayBriefing() e import getCachedBriefing (2026-06-30) |
| **Arquivo** | `src/commands/briefing.ts` |

### 0.4 Remover dead code em dashboard.ts

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Resolucao** | Removido trendArrow() (2026-06-30) |
| **Arquivo** | `src/commands/dashboard.ts` |

### 0.5 Simplificar getLatestFeedback

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Resolucao** | Refatorado para records.at(-1) ?? null (2026-06-30) |
| **Arquivo** | `src/session-feedback.ts:161` |

### 0.6 Documentacao dinamica + deteccao proativa de gaps

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Critico |
| **Owner** | Edson |
| **Descricao** | Dois problemas combinados: (A) A documentacao (AGENTS.md, SYSTEM_MAP.md) descreve a arquitetura completa como se tudo estivesse presente, mas o sistema ja suporta entrega incremental por capacidades. A documentacao nao indica claramente o que esta instalado vs disponivel vs futuro. (B) O AGENTS.md nao inclui regras que obriguem o agente a detectar gaps proativamente e informar ao usuario. A capacidade tecnica ja existe (auto-evolution.ts, doctor.ts, status.ts, knowledge-debt.ts) mas nao esta acionada pelas regras do time. |
| **Resolucao parcial** | (2026-07-01) `nexus init` agora re-analisa complexidade quando projeto ja inicializado. `nexus assess` mostra proximo passo claro com `nexus upgrade --accept-recommended`. |
| **Fase 1** | ✅ Done (2026-07-05) — SYSTEM_MAP.md com legenda ✅/📋/🔮 + CAPABILITY_STATUS dinamico, `docs/capabilities.md` com mapeamento capacidade→regras→arquivos, `scaffolder.ts` com `updateSystemMapCapabilityStatus()`, 9 novos testes (24/24 passing). AGENTS.md condicional ja existia. Regras 23-25 (proactivas) ja existiam. |
| **Fase 2** | ✅ Done (2026-07-05) — upgrade.ts agora actualiza SYSTEM_MAP.md status ao adicionar capacidades (\`--capability\` e \`--accept-recommended\`). Exportado \`updateSystemMapCapabilityStatus()\` de scaffolder.ts. |
| **Commits** | `3070cc1` (P0.6 Phase 1), `56af5be` (P0.6 Phase 2 — upgrade.ts sync) |

### 0.7 Actualizar documentação desactualizada (6 ficheiros)

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Critico |
| **Owner** | Agente IA |
| **Resolucao** | Todos os 6 ficheiros actualizados (2026-07-05) — README.md (27 comandos, 1045+ testes), AGENTS.md (refs partidas removidas), GUIDE.md (contagens correctas), CONCEPTUAL_MODEL.md (paths corrigidos), SYSTEM_MAP.md (árvore actualizada), CHANGELOG.md (v0.2.0) |
| **Plano** | `plans/2026-07-04-docs-sync-critical.md` |
| **Arquivos** | README.md, docs/AGENTS.md, Nexus-System_GUIDE.md, CONCEPTUAL_MODEL.md, SYSTEM_MAP.md, CHANGELOG.md |

---

## P1 — Integracao e Conexao (≤ 30 dias)

### 1.1 Ligacao feedback ↔ session ativo

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Resolucao** | Adicionado --session-id ao nexus feedback (2026-06-30) |
| **Arquivo** | `src/commands/feedback.ts` |

### 1.2 Logging de erros no enrichment

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Substituido try/catch vazios por logger.debug() (2026-06-30) |
| **Arquivo** | `src/context-collector.ts` |

### 1.3 Unificar computeInputHash

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Removido de context-collector.ts, importado de briefing-cache.ts (2026-06-30) |
| **Arquivo** | `src/context-collector.ts` |

### 1.4 Dashboard correlacionar session-tracker + feedback

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Importado getSessionMetrics() e exibido no dashboard (2026-06-30) |
| **Arquivo** | `src/commands/dashboard.ts` |

### 1.5 Dynamico: estimativas de tokens no bench

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Resolucao** | Calculado baseado em contagem de arquivos, regras e risk-map (2026-06-30) |
| **Arquivo** | `src/commands/bench.ts` |

### 1.6 Corrigir writeBriefingMarkdown path

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Corrigido de .nexus para nexus-system/ (2026-06-30) |
| **Arquivo** | `src/commands/briefing.ts` |

### 1.7 Evitar race condition no cache

| Campo | Valor |
|---|---|
| **Status** | Done (limitacao documentada) |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Resolucao** | Aceito que ultimo writer vence — documentar limitacao (2026-06-30) |
| **Arquivo** | `src/briefing-cache.ts` |

### 1.8 Validar nexusDir antes de operacoes

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Adicionado existsSync(nexusDir) no guardNotInitialized() (2026-06-30) |
| **Arquivo** | `src/shared.ts` |

---

## P1 — Qualidade e Testes (≤ 30 dias)

### 1.9 Testes para comandos novos

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Resolucao** | Criados testes para bench, dashboard e session-feedback extended (2026-06-30) |
| **Arquivos** | `src/__tests__/bench.test.ts`, `src/__tests__/dashboard.test.ts`, `src/__tests__/session-feedback-extended.test.ts` |

### 1.10 Testes para enrichBriefingWithPatterns

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Resolucao** | Criados testes para collectContext com DI mock (2026-06-30) |
| **Arquivo** | `src/__tests__/context-collector.test.ts` |

### 1.11 Testes para getFeedbackForSession e getLatestFeedback

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Criados testes em session-feedback-extended.test.ts (2026-06-30) |
| **Arquivo** | `src/__tests__/session-feedback-extended.test.ts` |

### 1.12 Coverage gap: comandos CLI com 0%

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Modulos** | assess.ts, clean.ts, digest.ts, doctor.ts, evolve.ts, report.ts, sync.ts |
| **Descricao** | 7 comandos com 0% de coverage cobertos com 36 novos testes. |
| **Correcao** | digest.test.ts (17 testes — generateDigest, health determination, recommendations) + commands-action.test.ts (19 testes — action handlers de clean, doctor, report, assess, evolve, sync). Total: 580 tests passing. |

### 1.13 Empty catch blocks (erros silenciados)

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Adicionado logger.debug() em 25 catch blocks "// skip" em 12 arquivos (2026-06-30) |
| **Arquivos** | cache.ts, capability-engine.ts, clean.ts, doctor.ts, engineering-state.ts, feedback-loops.ts, health-auditor.ts, knowledge-debt.ts, scaffolder.ts, scorer.ts, state-manager.ts, utils.ts |
| **Nota** | 116 catch blocks analisados: 19 return null (legitimo), 25 // skip (corrigidos), 16 return default (legitimo), 8 com logging (OK), 48 outros (legitimo) |

### 1.14 Remover displayBriefing dead code

| Campo | Valor |
|---|---|
| **Status** | Done (resolvido pelo 0.3) |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Arquivo** | `src/commands/briefing.ts:160-230` |
| **Descricao** | `displayBriefing()` e uma funcao de ~70 linhas que nao e mais chamada — substituida por `displayBriefingByDepth()`. |
| **Correcao** | Removida junto com 0.3 (2026-06-30). |

---

## P2 — Funcionalidades e Otimizacao (≤ 90 dias)

### 2.1 Aprovacao de regras candidatas

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Arquivos** | `src/pattern-detector.ts` (CandidateRule), `src/commands/detect.ts` |
| **Descricao** | `detectPatterns()` gera `candidateRules` com status "proposed" mas nao existe mecanismo para aprovar/rejeitar. |
| **Correcao** | Criar `nexus detect --approve RULE-001` e `nexus detect --reject RULE-001`. Persistir decisoes em `nexus-system/governance/rules-decisions.json`. |

### 2.2a Feedback do utilizador (user rating + comment)

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Resolucao** | Schema + campos + CLI flags (--user-rating, --user-comment, --user-tags) + testes — 2026-07-08 |
| **Arquivos** | `src/session-feedback.ts`, `src/commands/feedback.ts` |
| **Descricao** | Feedback completo com user ratings e comment. |

### 2.3 Nexus update — comando de actualizacao com change detection

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Prioridade** | P2 |
| **Data** | 2026-07-04 |
| **Fonte** | Sessao 2026-07-04 — nao existe `nexus update`, templates congelados no install time |
| **Arquivos** | `src/commands/update.ts` (novo), `src/manifest.ts` (novo), `src/commands/init.ts`, `src/commands/upgrade.ts`, `bin/nexus.ts` |
| **Descricao** | Nao existe `nexus update`. O `nexus upgrade` so adiciona capabilities novas, nunca actualiza existentes. Templates estao congelados no install time. Nexus-system precisa saber que houve mudanças no nexus-cli. |
| **Resolucao** | (1) Criado `src/manifest.ts` para rastrear hashes de templates e cliVersion. (2) Integrado manifest em init e upgrade. (3) Criado comando `nexus update` com suporte a `--apply`, `--dry-run`, `--backup` e `--force` (2026-07-05). |
| **Plano** | `plans/2026-07-04-feedback-and-update.md` (Parte 2) |

### 2.2b Feedback ↔ capability-engine

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivos** | `src/capability-engine.ts`, `src/session-feedback.ts` |
| **Descricao** | O capability-engine recomenda instalacoes mas nao aprende com falhas. |
| **Correcao** | No `evaluateCapabilities()`, consultar `failureHotspots` do feedback. Se uma area com capability instalada tem muitos failures, sugerir downgrade. |

### 2.3b nexus bench --compare historico

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivo** | `src/commands/bench.ts` |
| **Descricao** | Benchmark mostra resultados atuais mas nao compara com execucoes anteriores. |
| **Correcao** | Salvar resultado em `nexus-system/reports/bench-YYYY-MM-DD.json`. Adicionar `--compare` que mostra tendencia. |

### 2.4 nexus feedback --list

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivo** | `src/commands/feedback.ts` |
| **Descricao** | Nao existe forma de ver os registros de feedback sem usar `--summary`. |
| **Correcao** | Adicionar `--list` que mostra ultimos 10 registros formatados. |

### 2.5 Desacoplar context-collector de pattern-detector

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Arquivo** | `src/context-collector.ts` |
| **Resolucao** | detectPatterns injetado via ContextDeps.detectPatterns — 2026-07-08 |

### 2.6 Type BriefingDepth como tipo proprio no briefing

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Arquivo** | `src/commands/briefing.ts`, `src/token-optimizer.ts` |
| **Resolucao** | BriefingDepth usado como tipo em displayBriefingByDepth() — 2026-07-08 |

### 2.7 Usar differentialBriefing no --diff

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivos** | `src/commands/briefing.ts`, `src/token-optimizer.ts` |
| **Descricao** | `differentialBriefing()` do token-optimizer e mais compacto que `generateDiff()` do briefing.ts. O `--diff` usa `generateDiff()` que gera markdown verboso. |
| **Correcao** | Oferecer `--diff --compact` que usa `differentialBriefing()` (~50 tokens vs ~200). |

### 2.8 Validação de schema nos records lidos

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Arquivos** | `src/session-feedback.ts`, `src/session-tracker.ts` |
| **Resolucao** | Schema validation com filter + type guard em ambos os readers — 2026-07-08 |

### 2.9 Extrair modulo shared de display

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Arquivos** | `src/formatting.ts`, 7 commands |
| **Resolucao** | banner()/section()/kv() extraidos para formatting.ts, 7 commands actualizados — 2026-07-08 |

### 2.18 Dashboard: cliques do mouse nas abas

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | Edson |
| **Resolucao** | useOnClick implementado em tab-bar.tsx — 2026-07-08 |
| **Modulos** | `src/console/components/tab-bar.tsx` |
| **Descricao** | Cliques do mouse nas abas do dashboard funcionais. |

### 2.19 Dashboard: responsividade do layout

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P3 |
| **Owner** | unassigned |
| **Data** | 2026-07-02 |
| **Fonte** | Teste manual do usuario |
| **Modulos** | `src/console/tabs/*.tsx`, `src/console/components/*.tsx` |
| **Descricao** | O dashboard so e visualizado corretamente com a tela maximizada. Em terminais menores (fora do VSCode ou sem maximizar), o layout fica quebrado com overflow. |
| **Correcao** | Implementar breakpoints dinamicos baseados no tamanho do terminal (`process.stdout.columns`). Adaptar numero de colunas e layout conforme largura disponivel. Usar `flexWrap` do Ink. |

---

## P2 — Documentacao (≤ 90 dias)

### 2.10 Atualizar AGENTS.md template

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Arquivo** | `src/templates/base/docs/AGENTS.md` |
| **Resolucao** | Lista completa de 20+ comandos actualizada — 2026-07-08 |

### 2.11 Linkar ROI.md no README

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Resolucao** | ROI.md ja linkado em README.md:133 ("See [docs/ROI.md](docs/ROI.md)") — 2026-07-08 |

### 2.12 JSDoc nas funcoes novas

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivos** | `enrichBriefingWithPatterns`, `getFeedbackForSession`, `getLatestFeedback`, `compressedSummary`, `differentialBriefing`, `suggestDepth`, `generateOptimizationHints`, `displayBriefingByDepth` |
| **Descricao** | 8 funcoes exportadas/novas sem JSDoc. |
| **Correcao** | Adicionar JSDoc com `@param`, `@returns`, e `@example`. |

### 2.13 Consolidar planos de plans/

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Diretorio** | `plans/` (11 arquivos) |
| **Descricao** | 11 arquivos de plano com massiva sobreposicao. |
| **Correcao** | Consolidar em 3 documentos: (a) Plano atual, (b) Historico, (c) Roadmap futuro. |

### 2.14 Documentar limitacoes conhecidas

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Owner** | Edson |
| **Arquivo** | `docs/KNOWN_LIMITATIONS.md` |
| **Resolucao** | KNOWN_LIMITATIONS.md ja existe com 12 limitacoes documentadas: cache race condition, monorepo support, symlinks, commander state, terminal size, event bus, testing, console output — 2026-07-09 |

### 2.15 Teste manual de onboarding (5 minutos)

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-07-03 |
| **Fonte** | Briefing de onboarding (briefing-onboarding-nexus.md, criterio de aceite #5) |
| **Arquivos** | `docs/tests/onboarding-5min-test.md`, README.md, `apps/nexus-dashboard/src/pages/discover/`, `apps/nexus-dashboard/src/pages/use/` |
| **Descricao** | Validar que o reescrita de onboarding (README + dashboard discover/use) atinge o criterio dos 5 minutos: pessoa sem contexto consegue correr `nexus init` e entender o output sem perguntar nada. Teste manual com participante real. |
| **Correcao** | (1) Seguir o protocolo em `docs/tests/onboarding-5min-test.md`. (2) Participante deve ser alguem que nunca usou Nexus. (3) Cronometrar tempo ate primeiro comando e tempo ate compreensao. (4) Se falhar, identificar a pagina/secao que causou confusao e corrigir. (5) Repetir apos correcao. |
| **Criterio de aceite** | Todos os 4 criterios do teste passam: encontrou install em ≤60s, rodou init em ≤3min, explicou o que Nexus faz em ≤5min, nao pediu ajuda. |

---

## P2 — Performance (≤ 90 dias)

### 2.15b Cache intermediario no collectContext

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Owner** | Edson |
| **Arquivo** | `src/context-collector.ts` |
| **Resolucao** | Cache via getCached/setCache injectaveis via ContextDeps — 2026-07-08 |

### 2.16 Lazy loading de modulos pesados

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivo** | `src/context-collector.ts` |
| **Descricao** | Todas as importacoes sao estaticas no topo do arquivo. `pattern-detector.ts`, `session-feedback.ts`, `analyser.ts` sao carregados mesmo quando nao necessarios. |
| **Correcao** | Usar dynamic imports (`await import()`) para modulos que so sao necessarios em branches especificos. |

### 2.17 Benchmark suite automatizada CI

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Arquivos** | `.github/workflows/ci.yml`, `src/__tests__/benchmarks.bench.ts` |
| **Descricao** | O benchmark existe mas nao roda no CI. Regressoes de performance passam despercebidas. |
| **Correcao** | Adicionar step `pnpm bench` ao CI com threshold de regressao (ex: +20% tempo = fail). |

---

## P3 — Baixa Prioridade (sem SLA)

| # | Item | Severidade | Descricao |
|---|---|---|---|
| 3.1 | Migrar console.log para logger centralizado | Baixo | 90+ chamadas console.log diretas nos commands em vez de logger |
| 3.2 | Dashboard web para scores historicos | Baixo | Visualizacao web dos dados de benchmark/feedback |
| 3.3 | Suportar monorepos com workspaces | Medio | pnpm/yarn workspaces, deteccao automatica |
| 3.4 | Integrar com GitHub API | Baixo | Churn real baseado em PR reviews, issues abertas |
| ~~3.5~~ | ~~Plugin system para skills customizadas~~ | ~~Baixo~~ | ~~Done: plugin-system.ts com registerPlugin(), hooks, validacao~~ |
| ~~3.6~~ | ~~nexus dashboard --live~~ | ~~Baixo~~ | ~~Done: --live <seconds> opção existe em dashboard.tsx~~ |
| 3.7 | Suportar projectos sem Git | Medio | Fallback para metricas estaticas apenas |
| 3.8 | Shell completion (bash/zsh/fish) | Baixo | Auto-complete para comandos e opcoes |
| 3.10 | nexus --quiet / --no-color | Baixo | Modo scriptavel para CI/CD |
| 3.11 | nexus init --dry-run | Baixo | Preview do que seria criado sem criar |
| 3.12 | nexus upgrade --dry-run | Baixo | Preview do que seria instalado sem instalar |
| 3.13 | nexus audit --fix | Medio | Auto-fix para problemas de governance detectados |
| ~~3.14~~ | ~~Changelog automatico~~ | ~~Baixo~~ | ~~Done: nexus-system/scripts/generate-changelog.ts — conventional commits~~ |
| 3.15 | Version bumping automatizado | Baixo | Semver automatico baseado em conventional commits |
| 3.16 | Metrics export (Prometheus/OpenTelemetry) | Baixo | Exportar metricas de uso para observabilidade |
| 3.17 | Structured logging | Baixo | JSON logs em vez de console.log para parsing |
| 3.18 | Plugin versioning e dependency resolution | Baixo | Versao minima de plugins, dependencias entre plugins |
| 3.19 | nexus detect --approve/--reject | Medio | Aprovar ou rejeitar regras candidatas do pattern-detector |
| ~~3.20~~ | ~~nexus feedback --outcome failure auto-link~~ | ~~Baixo~~ | ~~Done: sugere failure hotspots quando --areas nao fornecido~~ |
| ~~3.21~~ | ~~Briefing --profile no briefingToMarkdown~~ | ~~Baixo~~ | ~~Done: --profile com minimal/standard/full em briefing.ts~~ |
| 3.22 | HealthBar compartilhado | Baixo | dashboard.ts duplica healthBar de formatting.ts — importar |
| 3.23 | Colorblind-friendly mode | Baixo | Usar icons/texto em vez de apenas cores |
| ~~3.24~~ | ~~Event history query API~~ | ~~Baixo~~ | ~~Done: getHistory() publico em event-bus.ts~~ |
| 3.25 | nexus bench --save / --load | Baixo | Salvar/carregar benchmarks para comparacao offline |
| 3.26 | nexus status --fix | Baixo | Auto-fix para problemas de governance (como doctor) |
| 3.27 | Briefing cache com TTL configuravel | Baixo | Permitir configurar tempo de vida do cache |
| 3.28 | Briefing --watch | Baixo | Regenerar briefing automaticamente a cada N segundos |
| ~~3.29~~ | ~~Session-tracker com append-only (remover overwrite)~~ | ~~Medio~~ | ~~Done: ja usa appendFileSync (nao writeFileSync)~~ |
| 3.30 | Validacao de schema com zod/io-ts | Baixo | Validar todos os tipos de record lidos de disco |
| ~~3.31~~ | ~~nexus detect --format markdown~~ | ~~Baixo~~ | ~~Done: --format text/json/markdown em detect.ts~~ |
| 3.32 | Briefing cache com compressao | Baixo | Comprimir cache JSON para reduzir tamanho em disco |
| 3.33 | Feedback com campo `briefingProfile` | Baixo | Registrar qual profile (minimal/standard/full) foi usado |
| 3.34 | nexus dashboard --export csv | Baixo | Exportar dados do dashboard em CSV |
| 3.35 | Plugin sandboxing | Baixo | Isolar plugins em workers para seguranca |
| 3.36 | Decidir nome do produto | Baixo | Nexus Gaude, Prism, Codex, ou outro — decisao estrategica pendente |
| 3.37 | Refinamento do logo | Baixo | Vetorizacao, variações, assets finais — logo atual e AI-generated com watermark |
| 3.38 | Optimizar economia de tokens na abertura de sessão | Baixo | Reduzir consumo actual de 12% por sessão. Ficheiros alvo: opencode-context.md (3.8KB→1.5KB), quick-board-enforcement.md (3.4KB→1.5KB), AGENTS.md (8.8KB→5KB), BRIEFING.md (1.7KB→0.8KB). Potencial: ~50% redução |

---

## P1 — AI Agent Integration (≤ 30 dias)

### A1 MCP server

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Resolucao** | mcp-server.ts com 3 tools (getBriefing, getRiskMap, getRules). mcp-install.ts para filesystem server. Comando nexus mcp registado em bin/nexus.ts. |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Descricao** | Servidor MCP (Model Context Protocol) para agentes IA consumirem contexto do Nexus. Ferramentas: getBriefing, getRiskMap, getRules. |
| **Correcao** | Criar `src/mcp-server.ts` com ferramentas MCP. Publicar como `@nexus/mcp`. |

### A2 OpenCode plugin

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Descricao** | Hook automatico antes de cada tarefa no OpenCode. Injeta briefing no contexto do agente. |
| **Correcao** | Criar plugin OpenCode que chama `nexus briefing --summary` antes de cada tarefa e injeta no system prompt. |

### A3 Cursor integration

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Extensao para Cursor IDE que mostra briefing no sidebar. |
| **Correcao** | Criar extensao VS Code (Cursor e compativel) que le `.nexus/BRIEFING.md` e exibe em panel. |

### A4 Git hooks

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Pre-commit: auto-briefing. Pre-push: validation. Post-commit: feedback automatico. |
| **Correcao** | Criar `nexus hooks --install` que configura git hooks via `core.hooksPath`. |

### A5 Webhook de sessao

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | POST briefing result para API externa (Slack, Discord, webhook custom). |
| **Correcao** | Adicionar `--webhook <url>` ao `nexus briefing`. Enviar JSON via POST apos gerar. |

### A6 Context injection API

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | Endpoint REST para briefing sob demanda. Agentes podem chamar HTTP em vez de CLI. |
| **Correcao** | Adicionar `nexus serve` que inicia servidor HTTP com endpoints: GET /briefing, GET /risk-map, GET /rules. |

### A7 Skill template para nexus-cli

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | nexus-cli precisa prover um template para criar novas skills. Atualmente as 14 skills em `nexus-system/docs/skills/` foram criadas manualmente sem padrao formal. O template deve definir: frontmatter obrigatorio (name, description), estrutura de secoes (objetivo, regras, onde aplicar), e validacao. Comando: `nexus skill:create <nome>` que scaffolds um novo arquivo `.md` com o template preenchido. |
| **Correcao** | Criar `src/templates/base/skills/SKILL_TEMPLATE.md` com frontmatter + secoes padrao. Adicionar comando `skill:create` em `src/commands/skill-create.ts`. Validar frontmatter contra schema existente. |

### A8 Feedback personalizado agente + usuario com calibragem de perfil

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Owner** | Edson |
| **Resolucao** | Implementado feedback-engine.ts com calibragem de tom por perfil (2026-07-01). Comando `nexus feedback --personalized` gera feedback duplo (agente + usuario) com 3 tons (mentor/peer/relatorio) baseado no perfil do usuario. Comando `nexus profile` para configurar perfil. Perguntas de perfil no `nexus init`. Funcao `inferProfile()` infere perfil do comportamento. Atualizacao automatica do perfil apos cada sessao. 19 testes novos. |
| **Arquivo** | `src/feedback-engine.ts`, `src/commands/feedback.ts`, `src/commands/profile.ts`, `src/prompts.ts`, `src/commands/init.ts` |

---

## P2 — Developer Experience (≤ 90 dias)

### D1 Interactive tutorial

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | `nexus tutorial` — guided tour interativo que mostra cada comando com exemplos reais. |
| **Correcao** | Criar `src/commands/tutorial.ts` com 7 passos: init, status, detect, briefing, feedback, run, evolve. |

### D2 Example projects

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | 3 templates: web-app (Next.js), API (Express), library (TypeScript). Cada um com governance pre-configurada. |
| **Correcao** | Criar `examples/` com 3 diretorios. `nexus init --template web-app` para usar. |

### D3 Migration guide

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | Como migrar de outros tools (ESLint, Prettier, SonarQube) para Nexus. |
| **Correcao** | Criar `docs/migration.md` com tabelas de equivalencia. |

### D4 API documentation

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | Referencia completa das funcoes internas para quem quer usar como biblioteca. |
| **Correcao** | Gerar docs via TypeDoc. Publicar em `docs/api/`. |

### D5 SDK/library mode

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | Uso como biblioteca Node.js, nao CLI. `import { generateBriefing } from 'nexus-system'`. |
| **Correcao** | Separar core de CLI. Criar `nexus-system/core` export. |

### D6 Video walkthrough

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | 5min demo no YouTube mostrando o fluxo completo: init → briefing → feedback. |
| **Correcao** | Gravar screencast. Ferramenta: OBS + terminal grande. |

---

## P2 — Data & Analytics (≤ 90 dias)

### DA1 Usage analytics

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Quais comandos sao mais usados, horarios de pico, taxa de sucesso por comando. |
| **Correcao** | Dashboard `nexus analytics` que le `usage.jsonl` e gera graficos. |

### DA2 Error tracking

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Relatorio automatico de erros: tipo, frequencia, contexto. |
| **Correcao** | Criar `src/error-tracker.ts` que captura erros nao tratados e grava em `errors.jsonl`. |

### DA3 User behavior analysis

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | Fluxo tipico de uso: quais comandos sao executados em sequencia. |
| **Correcao** | Analisar `session-tracker` para detectar padroes de uso. |

### DA4 A/B testing framework

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | Testar variacoes de briefing: formato, profundidade, ordem de secoes. |
| **Correcao** | Criar `src/experiments.ts` com variante A/B e metricas de aceitacao. |

---

## P2 — Security Hardening (≤ 90 dias)

### S1 Penetration testing

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Teste de seguranca no CLI: injection via inputs, path traversal, command injection. |
| **Correcao** | Contratar pentest ou usar ferramentas (Snyk, npm audit). |

### S2 Dependency auditing

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Owner** | unassigned |
| **Descricao** | `npm audit` automatico no CI. Bloquear builds com vulnerabilidades criticas. |
| **Correcao** | Adicionar step `pnpm audit --audit-level=high` ao CI. |

### S3 Secret scanning

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Owner** | unassigned |
| **Descricao** | Detectar keys/tokens no output do CLI. Evitar vazar informacoes sensiveis. |
| **Correcao** | Usar `gitleaks` ou `trufflehog` no CI. Adicionar regex para detectar API keys no output. |

### S4 Supply chain security

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Owner** | unassigned |
| **Descricao** | SLSA compliance, provenance, SBOM. |
| **Correcao** | Gerar SBOM via `syft`. Assinar commits com Sigstore. |

---

## P3 — Internationalization (sem SLA)

| # | Item | Severidade | Descricao |
|---|---|---|---|
| I1 | Multi-language support | Baixo | pt-BR, en, es — mensagens de erro e output |
| I2 | Locale detection | Baixo | Detectar idioma do sistema automaticamente |
| I3 | Translation management | Baixo | i18n framework (i18next ou similar) |

---

## Auto-análise 2026-06-30 (nexus-cli)

> **Gerado por:** nexus assess + nexus doctor + nexus audit + nexus status + análise manual
> **Score de maturidade:** 55/100 | **Saúde:** 85/100 | **Auditoria:** 77/100
> **Data da auto-análise:** 2026-06-30

### SA1 governance/WORKFLOW.md faltando

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Critico |
| **Prioridade** | P0 |
| **Owner** | Agente IA |
| **Data** | 2026-06-30 |
| **Resolucao** | Criado governance/WORKFLOW.md (2026-07-01) |
| **Modulos** | nexus-system/governance/ |
| **Descricao** | Documento governance/WORKFLOW.md nao encontrado. Critico para lifecycle state — impede comandos que requerem estado governed. |
| **Correcao** | Criar WORKFLOW.md com fluxo de governanca do projeto. |

### SA2 Bug: digest require("fs") incompativel com ESM

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Critico |
| **Prioridade** | P0 |
| **Owner** | Edson |
| **Data** | 2026-06-30 |
| **Fonte** | nexus digest --json (erro) |
| **Modulos** | src/commands/digest.ts |
| **Descricao** | Comando digest falha com "Dynamic require of fs is not supported". Usa require() em vez de import, incompativel com ESM. |
| **Resolucao** | Substituído require("node:fs") por import estático no início do arquivo (2026-07-05). |

### SA3 Governanca 0%

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Resolucao** | maturity-profile.ts actualizado com auto-deteccao de artefactos, policies de governance criadas, answers.json — 2026-07-06 |
| **Severidade** | Critico |
| **Prioridade** | P0 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | nexus assess --json (dimension: governance = 0) |
| **Modulos** | src/ (global) |
| **Descricao** | Dimensao Governance do score de maturidade esta em 0%. Nenhuma pratica de governanca formalizada no codigo. |
| **Correcao** | Criar governance/WORKFLOW.md, adicionar ADRs, definir processos de review. |

### SA4 Arquitetura 15%

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | nexus assess --json (dimension: architecture = 15) |
| **Modulos** | src/ (global) |
| **Descricao** | Dimensao Architecture do score de maturidade esta em 15%. 46 arquivos flat em src/, sem camadas, sem bounded contexts. |
| **Correcao** | Reestruturar em domain/infrastructure/commands/interfaces. Adicionar abstracoes. |

### SA5 Documentacao 10%

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | Edson |
| **Resolucao** | 4 ADRs criados (ADR-001 a ADR-005) + template — 2026-07-08 |
| **Modulos** | `nexus-system/docs/adrs/` |
| **Descricao** | ADRs de arquitetura documentados: Single Agent, Event-Driven, Knowledge Graph, Orphan Events. |

### SA6 15 artifacts orfaos no knowledge graph

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | Agente IA |
| **Data** | 2026-06-30 |
| **Resolucao** | SYSTEM_MAP.md actualizado com referências a todos os ficheiros (2026-07-01) |
| **Modulos** | nexus-system/ |
| **Descricao** | 15 artifacts no knowledge graph sem relacoes conectando-os. Impossivel rastrear fluxo de conhecimento. |
| **Correcao** | Adicionar relacoes entre artifacts órfãos e existentes. |

### SA7 Baixa densidade de relacoes no knowledge graph

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | nexus audit --json (knowledgeGraph.suggestions) |
| **Modulos** | nexus-system/ |
| **Descricao** | Relacao baixa entre artifacts (24 relacoes para 26 artifacts). Sugestao: adicionar mais conexoes. |
| **Correcao** | Mapear dependencias entre modulos e criar relacoes no knowledge graph. |

### SA8 context_buffer.yaml nao encontrado

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | Edson |
| **Resolucao** | context_buffer.yaml movido para core capability, sempre criado no nexus init — 2026-07-08 |
| **Modulos** | `src/capability-mapping.ts` |
| **Descricao** | Arquivo context_buffer.yaml movido de governance para core. |

### SA9 Agent contracts configurados

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | Edson |
| **Resolucao** | 4 contracts criados: planner, executor, reviewer, orchestrator — 2026-07-08 |
| **Modulos** | `nexus-system/governance/agents/` |
| **Descricao** | Agent contracts com papeis e responsabilidades definidos. |

### SA10 Clean Architecture violado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual |
| **Modulos** | src/ (46 arquivos) |
| **Descricao** | 46 arquivos flat em src/, sem separacao de camadas. Domain logic misturado com infrastructure. Commands importam implementacoes concretas. |
| **Correcao** | Reestruturar: src/domain/, src/infrastructure/, src/commands/, src/interfaces/. Extrair abstracoes. |

### SA11 SOLID violado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual |
| **Modulos** | src/ (global) |
| **Descricao** | God modules (feedback-loops.ts 396 linhas, state-manager.ts 438 linhas). Sem dependency injection. Interface Segregation violada (NexusState com 60+ campos). |
| **Correcao** | Dividir modules grandes. Adicionar DI. Criar interfaces menores. |

### SA12 Knowledge graph nao inicializado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | nexus doctor --json |
| **Modulos** | nexus-system/ |
| **Descricao** | Knowledge graph nao inicializado. Impossivel rastrear como conhecimento flui pelo projeto. |
| **Correcao** | Executar `nexus audit` para popular knowledge graph automaticamente. |

### SA13 ADRs criados

| Campo | Valor |
|---|---|
| **Status** | Done (resolvido pelo SA5) |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | Edson |
| **Resolucao** | 4 ADRs documentados (ADR-001 a ADR-005) — 2026-07-08 |
| **Modulos** | `nexus-system/docs/adrs/` |
| **Descricao** | ADRs de arquitetura: Single Agent, Event-Driven, Knowledge Graph, Orphan Events. |

### SA14 docs/session-template.md faltando

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | Agente IA |
| **Data** | 2026-06-30 |
| **Resolucao** | Criado docs/session-template.md (2026-07-01) |
| **Modulos** | nexus-system/docs/ |
| **Descricao** | Documento session-template.md nao encontrado. Recomendado para estruturar sessoes de trabalho. |
| **Correcao** | Criar session-template.md a partir do template base. |

### SA15 DDD nao aplicado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual |
| **Modulos** | src/ (global) |
| **Descricao** | Domain-Driven Design nao aplicado. Sem bounded contexts, sem ubiquitous language, models anemicos. |
| **Correcao** | Definir bounded contexts (feedback, maturity, knowledge). Enriquecer models com comportamento. |

### SA16 TDD nao aplicado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual |
| **Modulos** | src/ (global) |
| **Descricao** | Testes escritos depois do codigo, nao antes. 580 testes mas nao e TDD — e test-after. |
| **Correcao** | Adotar workflow TDD: red → green → refactor. Escrever testes antes para features novas. |

### SA17 Commander state persistence

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual (commands-action.test.ts) |
| **Modulos** | src/commands/sync.ts |
| **Descricao** | Commander singleton retém _optionValues entre chamadas .parse(). Testes de sync precisam de fresh instances. |
| **Correcao** | Converter syncCommand para factory function (como reportCommand()). |

---

## Metricas de Qualidade (snapshot 2026-07-12)

```
Projeto:       nexus-cli v0.1.0
TypeScript:    strict: true, 0 erros
Testes:        1898/1898 passando (119 arquivos)
Coverage:      ~51% (linhas) | ~82% (funcoes) | ~76% (branches)
ESLint:        0 erros, 0 warnings
Dependencias:  6 deps + 10 devDeps (lean)
CI/CD:         ci.yml (Node 18/20/22 + coverage gate)
Commands:      36 (init, status, audit, assess, detect, run, evolve,
               report, doctor, upgrade, validate, sync, clean, digest,
               briefing, feedback, bench, dashboard, hooks, handbook, etc.)
Context Pipeline: collectContext → cache → briefing → feedback → dashboard
Auto-backlog:  nexus audit --auto-backlog (detect gaps → BACKLOG.md)
Auto-analise:  17 gaps identificados (3 P0, 8 P1, 6 P2)
Race Fix:      Lock inter-processo (wx flag) + cooldown persistido (15s)
```

---

## Resumo por Prioridade

| Prioridade | Itens | Tema Principal |
|---|---|---|
| **Done** | 85 | Desacoplamento, quick wins, event-driven, MCP, pipeline, ADRs, contracts, feedback, dashboard, KNOWN_LIMITATIONS, race condition fix |
| **P0** (≤ 7d) | 0 | Nenhum P0 activo |
| **P1** (≤ 30d) | 7 | Arquitetura (Clean/SOLID), AI agents (OpenCode, Cursor, Git hooks, skills) |
| **P2** (≤ 90d) | 15 | Features (detect approve, bench compare), docs, performance, developer experience, security |
| **P3** (sem SLA) | 20 | Nice-to-have, ecosystem, observability, i18n, dashboard responsividade |
| **Total** | **126** | |
