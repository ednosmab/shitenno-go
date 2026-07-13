# SYSTEM_MAP — Mapa Centralizado

> **Versão:** 2.1
> **Data:** 2026-07-02
> **Propósito:** Mapa de todos os directórios e arquivos do sistema

---

## Legenda de Capacidades

| Símbolo | Significado |
|---|---|
| ✅ | Capacidade instalada e activa |
| 📋 | Capacidade disponível (pode ser instalada via `nexus upgrade`) |
| 🔮 | Capacidade futura (não disponível ainda) |
| ➖ | Não aplicável |

**Verificar capacidades instaladas:** `nexus status` ou `nexus doctor`
**Instalar capacidade:** `nexus upgrade --capability <name>`

---

## Estrutura Geral

<!-- SYNC:START -->
```
│   BRIEFING.md
│   answers.json
│   capability-engine.json
│   cognition/
│   cognition/context/
│   cognition/context/CONTEXT_HIERARCHY.md
│   cognition/memory/
│   cognition/memory/MEM-operational-state-v1.json
│   cognition/prompts/
│   cognition/prompts/executor/
│   cognition/prompts/executor/README.md
│   cognition/prompts/planner/
│   cognition/prompts/planner/README.md
│   cognition/prompts/reviewer/
│   cognition/prompts/reviewer/README.md
│   core/
│   core/complexity/
│   core/complexity/types.ts
│   daemon/
│   daemon/circuit-breaker.json
│   daemon/daemon.approved
│   daemon/daemon.log
│   daemon/daemon.pid
│   daemon/daemon.sock
│   docs/
│   docs/AGENTS.md
│   docs/BACKLOG.md
│   docs/CONCEPTUAL_MODEL.md
│   docs/DESDO.md
│   docs/ENTERPRISE_AUDIT_PLAN.md
│   docs/ENTERPRISE_AUDIT_PLAN_V2.md
│   docs/FORBIDDEN_OPERATIONS.md
│   docs/INDEX.md
│   docs/KNOWLEDGE_LIFECYCLE.md
│   docs/Nexus-System_GUIDE.md
│   docs/REGISTRY.md
│   docs/adrs/
│   docs/adrs/ADR-001-single-agent-architecture.md
│   docs/adrs/ADR-002-event-driven-state.md
│   docs/adrs/ADR-003-knowledge-graph-persistence.md
│   docs/adrs/ADR-005-automated-task-completion-pipeline.md
│   docs/adrs/ADR-006-filesystem-access-restriction.md
│   docs/adrs/ADR-TEMPLATE.md
│   docs/audits/
│   docs/audits/README.md
│   docs/capabilities.md
│   docs/feedback/
│   docs/feedback/README.md
│   docs/generated/
│   docs/generated/ARCHITECTURE.md
│   docs/generated/ASSET_INDEX.md
│   docs/generated/CAPABILITY_REPORT.md
│   docs/generated/HEALTH_REPORT.md
│   docs/generated/README.md
│   docs/generated/SYSTEM_MAP.md
│   docs/generated/_metadata.json
│   docs/history/
│   docs/history/2026-07-12-rule-plan_archived.md
│   docs/history/2026-07-12-rule-session_close.md
│   docs/history/2026-07-12-rule-session_end_plans.md
│   docs/history/2026-07-13-rule-session_close.md
│   docs/history/2026-07-13-rule-session_end_plans.md
│   docs/opencode-context.md
│   docs/rules/
│   docs/rules/agent-modes.md
│   docs/rules/branch-policy.md
│   docs/rules/context-algorithm.md
│   docs/rules/dependency-graph.md
│   docs/rules/feedback-protocol.md
│   docs/rules/lazy-loading.md
│   docs/runbooks/
│   docs/runbooks/merge.md
│   docs/session-template.md
│   docs/skills/
│   docs/skills/architectural_integrity.md
│   docs/skills/ci_cd_pipeline.md
│   docs/skills/clean_code_standards.md
│   docs/skills/codebase_hygiene_git.md
│   docs/skills/design_patterns.md
│   docs/skills/domain_driven_design_(ddd).md
│   docs/skills/error_handling_observability.md
│   docs/skills/handbook-fill.md
│   docs/skills/operacao_no_nexus.md
│   docs/skills/optimistic_ui.md
│   docs/skills/pnpm_management.md
│   docs/skills/quick-board-enforcement.md
│   docs/skills/senior-engineer.md
│   docs/skills/solid_principles.md
│   docs/skills/system-first.md
│   docs/skills/tdd-agent.md
│   docs/skills/tdd_workflow.md
│   engineering-state.json
│   feedback/
│   feedback/records/
│   feedback/records/2026-07-12-FB-1783883991822-wy1a3o.json
│   feedback/records/2026-07-12-FB-1783884012232-4u8s6o.json
│   feedback/records/2026-07-12-FB-1783884164044-j06rij.json
│   feedback/records/2026-07-12-FB-1783884810911-gcjfsm.json
│   feedback/records/2026-07-12-FB-1783888037474-l1zi9m.json
│   feedback/records/2026-07-13-FB-1783907221581-a9mw9z.json
│   feedback/summary.json
│   fingerprint.json
│   governance/
│   governance/SYSTEM_MAP.md
│   governance/WORKFLOW.md
│   governance/agents/
│   governance/agents/AI-CONTRACT-executor-v1.yaml
│   governance/agents/AI-CONTRACT-orchestrator-v1.yaml
│   governance/agents/AI-CONTRACT-planner-v1.yaml
│   governance/agents/AI-CONTRACT-reviewer-v1.yaml
│   governance/context/
│   governance/context/context_buffer.yaml
│   governance/contracts/
│   governance/contracts/CONTRACTS_INDEX.md
│   governance/handoffs/
│   governance/handoffs/README.md
│   governance/handoffs/TEMPLATE.md
│   governance/knowledge-graph/
│   governance/knowledge-graph/artifacts.json
│   governance/knowledge-graph/relations.json
│   governance/plans/
│   governance/plans/2026-07-12-migrar-console-log-para-logger.md
│   governance/plans/2026-07-12-plano-correcao-watch-loop-e-fase2.md
│   governance/plans/2026-07-13-plano-bug002-entropia.md
│   governance/plans/README.md
│   governance/plans/TEMPLATE.md
│   governance/plans/done/
│   governance/plans/done/2026-07-02-init-audit-dashboard.md
│   governance/plans/done/2026-07-02-nexus-dashboard-restructure.md
│   governance/plans/done/2026-07-04-audit-followup-improvements.md
│   governance/plans/done/2026-07-04-audit-master-plan.md
│   governance/plans/done/2026-07-04-audit-phase3-5-lacunas.md
│   governance/plans/done/2026-07-04-docs-sync-critical.md
│   governance/plans/done/2026-07-04-expand-nexus-audit.md
│   governance/plans/done/2026-07-04-feedback-and-update.md
│   governance/plans/done/2026-07-04-rename-health-score.md
│   governance/plans/done/2026-07-05-corrections-13-14.md
│   governance/plans/done/2026-07-06-plano-correcao-nexus.md
│   governance/plans/done/2026-07-07-event-driven-reactive.md
│   governance/plans/done/2026-07-07-plano-desacoplamento-opencode.md
│   governance/plans/done/2026-07-08-adr005-automated-task-completion.md
│   governance/plans/done/2026-07-08-plano-correcao-nexus.md
│   governance/plans/done/2026-07-09-complete-architecture-plan.md
│   governance/plans/done/2026-07-09-gap-analysis-coverage-plan.md
│   governance/plans/done/2026-07-09-plano-correcao-nexus-audit.md
│   governance/plans/done/2026-07-11-nexus-living-plano-v2-3fases.md
│   governance/plans/done/2026-07-12-backlog-batch-resolver.md
│   governance/plans/done/2026-07-12-plano-fix-retroactive-scan-race.md
│   governance/plans/done/PLAN-DYNAMIC-RULE-ADAPTATION.md
│   governance/plans/done/PLAN-HANDBOOK-SYNC.md
│   governance/plans/done/PLANO-CORRECAO-NEXUS.md
│   governance/plans/done/Plano-de-Evolução-do-Nexus-CLI.md
│   governance/plans/done/adaptive-dual-path.md
│   governance/plans/done/auditoria-completa-plano.md
│   governance/plans/done/auditoria-correcao-completa.md
│   governance/plans/done/briefing-onboarding-nexus.md
│   governance/plans/done/fase-1-fundacao.md
│   governance/plans/done/fase-integracao.md
│   governance/plans/done/fase-system-live.md
│   governance/plans/done/nexus-single-source-of-truth-plan.md
│   governance/plans/done/plano-correcao-nexus-audit.md
│   governance/plans/done/production-readiness.md
│   governance/plans/done/unified-execution.md
│   governance/plans/pipeline/
│   governance/plans/pipeline/_template.md
│   governance/plans/pipeline/living-fase1-cache.md
│   governance/plans/pipeline/living-fase2-hooks.md
│   governance/plans/pipeline/living-fase3-daemon.md
│   governance/plans/reference/
│   governance/plans/reference/NEXUS_EVOLUTION_PLAN.md
│   governance/plans/reference/Plano-Estrategico-Proximo-Estagio-do-Nexus-System.md
│   governance/policies/
│   governance/policies/BRANCH-POLICY.md
│   governance/policies/COMMIT-POLICY.md
│   governance/policies/POLICY-TEMPLATE.md
│   governance/policies/REVIEW-POLICY.md
│   governance/premortem/
│   governance/premortem/PREMORTEM.md
│   governance/reviews/
│   governance/reviews/SESSION_REVIEW.md
│   governance/rules/
│   governance/rules/RULE-011-doc-lifecycle-check.json
│   governance/rules/RULE-011.json
│   governance/rules/RULE-012-session-briefing.json
│   governance/rules/RULE-012.json
│   governance/rules/RULE-013.json
│   governance/rules/RULE-014.json
│   governance/rules/RULE-015.json
│   governance/rules/RULE-016.json
│   governance/rules/RULE-017.json
│   governance/rules/RULE-018.json
│   governance/rules/RULE-019.json
│   governance/rules/RULE-HB-001.json
│   governance/rules/RULE-TEMPLATE.json
│   history/
│   history/snapshots/
│   history/snapshots/README.md
│   maturity-profile.json
│   plugins/
│   plugins/README.md
│   plugins/event-logger/
│   plugins/event-logger/plugin.js
│   plugins/health-check/
│   plugins/health-check/plugin.js
│   plugins/health-check/plugin.ts
│   plugins/health-monitor/
│   plugins/health-monitor/plugin.js
│   profile/
│   profile/nexus-cli.config.ts
│   reports/
│   reports/complexity-nexus-cli-2026-07-12-session1.json
│   reports/complexity-nexus-cli-2026-07-13-session1.json
│   reports/doc-lifecycle-2026-07-12.json
│   reports/doc-lifecycle-2026-07-13.json
│   reports/doc-sync-2026-07-12.json
│   reports/doc-sync-2026-07-13.json
│   reports/patterns-2026-07-12.json
│   reports/patterns-2026-07-13.json
│   scripts/
│   scripts/backlog.ts
│   scripts/close-session.ts
│   scripts/generate-changelog.ts
│   scripts/premortem-check.ts
│   scripts/sync-docs.ts
│   scripts/validate-session.ts
│   session-feedback/
│   session-feedback/records.jsonl
│   telemetry/
│   telemetry/dead-letter/
│   telemetry/dead-letter/README.md
│   telemetry/events-2026-07-01.jsonl
│   telemetry/events-2026-07-02.jsonl
│   telemetry/events-2026-07-03.jsonl
│   telemetry/events-2026-07-04.jsonl
│   telemetry/events-2026-07-05.jsonl
│   telemetry/events-2026-07-06.jsonl
│   telemetry/events-2026-07-07.jsonl
│   telemetry/events-2026-07-08.jsonl
│   telemetry/events-2026-07-09.jsonl
│   telemetry/events-2026-07-10.jsonl
│   telemetry/events-2026-07-11.jsonl
│   telemetry/events-2026-07-12.jsonl
│   telemetry/events-2026-07-13.jsonl
│   telemetry/maturity-2026-06-30.json
│   telemetry/maturity-2026-07-01.json
│   telemetry/maturity-2026-07-06.json
│   telemetry/rule-trace.jsonl
│   telemetry/sessions.jsonl
│   user-profile.json
```
<!-- SYNC:END -->

---

## Regras de Leitura

### Ordem Obrigatória

```
1. governance/WORKFLOW.md                    ← SEMPRE PRIMEIRO
2. governance/context/context_buffer.yaml   ← SEMPRE
3. docs/AGENTS.md                           ← SEMPRE (P0)
4. docs/FORBIDDEN_OPERATIONS.md             ← SEMPRE (P0)
5. docs/DESDO.md                            ← SEMPRE (P0)
6. Skill específica da camada               ← POR TAREFA
7. Plano da camada                          ← POR TAREFA
```

### Hierarquia P0-P4

| Nível | Conteúdo | Quando |
|---|---|---|
| **P0** | AGENTS.md, FORBIDDEN_OPERATIONS, DESDO | Sempre |
| **P1** | context_buffer.yaml | Sempre |
| **P2** | Planos da camada | Por tarefa |
| **P3** | Código e arquivos | Na execução |
| **P4** | docs/history/ | Sob demanda |

---

## Mapa de Scripts

| Script | Caminho | Função |
|---|---|---|
| validate-session | `scripts/validate-session.ts` | Validar integridade da sessão |
| close-session | `scripts/close-session.ts` | Encerrar sessão |
| premortem-check | `scripts/premortem-check.ts` | Análise de riscos |
| sync-docs | `scripts/sync-docs.ts` | Sincronizar documentação com estado real |

---

## Mapa de Contratos

| Contrato | Caminho | Função |
|---|---|---|
| planner | `governance/agents/AI-CONTRACT-planner-v1.yaml` | Planejamento |
| executor | `governance/agents/AI-CONTRACT-executor-v1.yaml` | Execução |
| reviewer | `governance/agents/AI-CONTRACT-reviewer-v1.yaml` | Review/auditoria |
| orchestrator | `governance/agents/AI-CONTRACT-orchestrator-v1.yaml` | Orquestração |
| CONTRACTS_INDEX | `governance/contracts/CONTRACTS_INDEX.md` | Índice |

---

## Ficheiros Raiz

| Ficheiro | Propósito |
|---|---|
| `fingerprint.json` | Impressão digital do projecto (hash, stack, maturidade) |
| `maturity-profile.json` | Perfil de maturidade por dimensão |

---

## Referências por Categoria

### Documentação Conceptual

| Ficheiro | Descrição |
|---|---|
| `docs/CONCEPTUAL_MODEL.md` | Modelo conceitual canónico do Nexus |
| `docs/KNOWLEDGE_LIFECYCLE.md` | Ciclo de vida do conhecimento (9 estágios) |
| `docs/opencode-context.md` | Contexto operacional para o agente |

### Telemetria e Feedback

| Ficheiro | Descrição |
|---|---|
| `feedback/summary.json` | Resumo de interações de recomendações |
| `feedback/records/*.json` | Registos individuais de feedback |
| `telemetry/maturity-2026-06-30.json` | Snapshot de maturidade |

### Relatórios

| Ficheiro | Descrição |
|---|---|
| `reports/complexity-*.json` | Relatórios de scoring de complexidade |
| `reports/health-*.json` | Relatórios de saúde do projecto |

---

## Referências Principais

- `governance/WORKFLOW.md` — Fluxos de sessão
- `docs/AGENTS.md` — Regras do time
- `docs/Nexus-System_GUIDE.md` — Guia completo do sistema
- `docs/CONCEPTUAL_MODEL.md` — Modelo conceitual
- `docs/KNOWLEDGE_LIFECYCLE.md` — Ciclo de vida do conhecimento
