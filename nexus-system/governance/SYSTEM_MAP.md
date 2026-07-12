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
│   docs/history/2026-07-01-rule-session_close.md
│   docs/history/2026-07-01.md
│   docs/history/2026-07-02-rule-session_close.md
│   docs/history/2026-07-03-rule-doc_lifecycle_session_check.md
│   docs/history/2026-07-03-rule-session_close.md
│   docs/history/2026-07-04-rule-session_close.md
│   docs/history/2026-07-05-rule-session_close.md
│   docs/history/2026-07-06-rule-session_close.md
│   docs/history/2026-07-07-rule-session_close.md
│   docs/history/2026-07-08-rule-session_close.md
│   docs/history/2026-07-08-rule-session_end_plans.md
│   docs/history/2026-07-09-rule-plan_archived.md
│   docs/history/2026-07-09-rule-session_close.md
│   docs/history/2026-07-09-rule-session_end_plans.md
│   docs/history/2026-07-10-rule-plan_archived.md
│   docs/history/2026-07-10-rule-session_close.md
│   docs/history/2026-07-10-rule-session_end_plans.md
│   docs/history/2026-07-11-rule-session_close.md
│   docs/history/2026-07-11-rule-session_end_plans.md
│   docs/history/2026-07-12-rule-plan_archived.md
│   docs/history/2026-07-12-rule-session_close.md
│   docs/history/2026-07-12-rule-session_end_plans.md
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
│   feedback/records/2026-06-30-FB-1782832047532-g7u2w0.json
│   feedback/records/2026-06-30-FB-1782832047533-alkg4k.json
│   feedback/records/2026-06-30-FB-1782832047533-hybwj5.json
│   feedback/records/2026-06-30-FB-1782832047533-lzlgxm.json
│   feedback/records/2026-06-30-FB-1782832047533-u8ntet.json
│   feedback/records/2026-06-30-FB-1782832047533-zcyfh8.json
│   feedback/records/2026-06-30-FB-1782832047534-jt37br.json
│   feedback/records/2026-07-01-FB-1782910511558-6wbxqo.json
│   feedback/records/2026-07-01-FB-1782910511559-i1k5je.json
│   feedback/records/2026-07-01-FB-1782910511572-1ev5hw.json
│   feedback/records/2026-07-01-FB-1782910511572-gzonwn.json
│   feedback/records/2026-07-01-FB-1782910511573-abwb9c.json
│   feedback/records/2026-07-01-FB-1782910511573-unlec4.json
│   feedback/records/2026-07-01-FB-1782910511574-hn2ohp.json
│   feedback/records/2026-07-06-FB-1783342147584-cqk6m2.json
│   feedback/records/2026-07-06-FB-1783342147585-y9webt.json
│   feedback/records/2026-07-06-FB-1783342147613-lvvlzj.json
│   feedback/records/2026-07-06-FB-1783342147613-ykjlgi.json
│   feedback/records/2026-07-06-FB-1783342147614-cop17e.json
│   feedback/records/2026-07-06-FB-1783342147615-hmoywa.json
│   feedback/records/2026-07-06-FB-1783342147635-uczqg2.json
│   feedback/records/2026-07-06-FB-1783342942306-srqq9m.json
│   feedback/records/2026-07-06-FB-1783342942307-b1q6g6.json
│   feedback/records/2026-07-06-FB-1783342942308-trmuav.json
│   feedback/records/2026-07-06-FB-1783342942308-v2c6k3.json
│   feedback/records/2026-07-06-FB-1783342942309-sje8bs.json
│   feedback/records/2026-07-06-FB-1783342942310-gjz6u2.json
│   feedback/records/2026-07-06-FB-1783342942311-9sk5cb.json
│   feedback/records/2026-07-06-FB-1783342970937-knxoya.json
│   feedback/records/2026-07-06-FB-1783342970938-aji5to.json
│   feedback/records/2026-07-06-FB-1783342970939-6diuhq.json
│   feedback/records/2026-07-06-FB-1783342970950-bssgjv.json
│   feedback/records/2026-07-06-FB-1783342970950-dzd8e2.json
│   feedback/records/2026-07-06-FB-1783342970951-l7wpgv.json
│   feedback/records/2026-07-06-FB-1783342970951-xtv9jj.json
│   feedback/records/2026-07-11-FB-1783788365197-5iveda.json
│   feedback/records/2026-07-11-FB-1783790906179-85p420.json
│   feedback/records/2026-07-11-FB-1783811040070-9j6fsc.json
│   feedback/records/2026-07-11-FB-1783813017771-bcdsyv.json
│   feedback/records/2026-07-12-FB-1783815175014-lspcyd.json
│   feedback/records/2026-07-12-FB-1783816512487-zuddqf.json
│   feedback/records/2026-07-12-FB-1783816816773-z56vv5.json
│   feedback/records/2026-07-12-FB-1783818478561-xancl0.json
│   feedback/records/2026-07-12-FB-1783826469590-k3rwab.json
│   feedback/records/2026-07-12-FB-1783865456346-xebjaq.json
│   feedback/records/2026-07-12-FB-1783865570825-8f0zfh.json
│   feedback/records/2026-07-12-FB-1783866621341-llse69.json
│   feedback/records/2026-07-12-FB-1783867179799-69rgyz.json
│   feedback/records/2026-07-12-FB-1783868205015-p78gcf.json
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
│   governance/plans/2026-07-02-nexus-dashboard-restructure.md
│   governance/plans/2026-07-11-nexus-living-plano-v2-3fases.md
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
│   governance/plans/governance/
│   governance/plans/governance/plans/
│   governance/plans/governance/plans/done/
│   governance/plans/governance/plans/reference/
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
│   reports/README.md
│   reports/complexity-2026-06-30.json
│   reports/complexity-nexus-cli-2026-07-01-session1.json
│   reports/complexity-nexus-cli-2026-07-01-session2.json
│   reports/complexity-nexus-cli-2026-07-01-session3.json
│   reports/complexity-nexus-cli-2026-07-01-session4.json
│   reports/complexity-nexus-cli-2026-07-01-session5.json
│   reports/complexity-nexus-cli-2026-07-03-session1.json
│   reports/complexity-nexus-cli-2026-07-03-session2.json
│   reports/complexity-nexus-cli-2026-07-03-session3.json
│   reports/complexity-nexus-cli-2026-07-08-session1.json
│   reports/complexity-nexus-cli-2026-07-11-session1.json
│   reports/doc-lifecycle-2026-07-03.json
│   reports/doc-lifecycle-2026-07-04.json
│   reports/doc-lifecycle-2026-07-05.json
│   reports/doc-lifecycle-2026-07-06.json
│   reports/doc-lifecycle-2026-07-07.json
│   reports/doc-lifecycle-2026-07-08.json
│   reports/doc-lifecycle-2026-07-09.json
│   reports/doc-lifecycle-2026-07-10.json
│   reports/doc-lifecycle-2026-07-11.json
│   reports/doc-lifecycle-2026-07-12.json
│   reports/doc-sync-2026-07-11.json
│   reports/doc-sync-2026-07-12.json
│   reports/health-2026-06-30.json
│   reports/health-2026-07-03.json
│   reports/health-2026-07-04.json
│   reports/health-2026-07-06.json
│   reports/health-2026-07-09.json
│   reports/patterns-2026-07-11.json
│   reports/patterns-2026-07-12.json
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
