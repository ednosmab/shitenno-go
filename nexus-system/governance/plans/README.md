# Planos — Nexus System

**Status:** In Progress

> Índice consolidado de todos os planos do projecto.
> Actualizado automaticamente pelo agente ao criar/concluir planos.

---

## Plano Actual (Activo)

| Plano | Data | Estado | Descrição |
|---|---|---|---|
| [complete-architecture-plan](2026-07-09-complete-architecture-plan.md) | 2026-07-09 | **In Progress** | Reactive + Proactive + Histórico + Agentes IA (15 fases) |
| [nexus-dashboard-restructure](2026-07-02-nexus-dashboard-restructure.md) | 2026-07-02 | **Em espera** | Reestruturar dashboard em 6 camadas de conhecimento progressivo |

---

## Histórico (Done)

Planos concluídos, organizados por data:

### 2026-07-09
| Plano | Resumo |
|---|---|
| [nexus-single-source-of-truth](done/nexus-single-source-of-truth-plan.md) | Engineering State como SSOT — 5 bugs corrigidos, accessor + ESLint guard |

### 2026-07-08
| Plano | Resumo |
|---|---|
| [adr005-automated-task-completion](done/2026-07-08-adr005-automated-task-completion.md) | Pipeline automático de tarefas (ADR-005) |

### 2026-07-07
| Plano | Resumo |
|---|---|
| [event-driven-reactive](done/2026-07-07-event-driven-reactive.md) | Arquitectura event-driven com rule engine |
| [plano-desacoplamento-opencode](done/2026-07-07-plano-desacoplamento-opencode.md) | Desacoplamento do opencode.json |

### 2026-07-06
| Plano | Resumo |
|---|---|
| [plano-correcao-nexus](done/2026-07-06-plano-correcao-nexus.md) | Correções gerais do sistema |

### 2026-07-05
| Plano | Resumo |
|---|---|
| [corrections-13-14](done/2026-07-05-corrections-13-14.md) | Correções items 13-14 do audit |

### 2026-07-04
| Plano | Resumo |
|---|---|
| [audit-master-plan](done/2026-07-04-audit-master-plan.md) | Plano mestre de auditoria |
| [expand-nexus-audit](done/2026-07-04-expand-nexus-audit.md) | Expansão do audit coverage |
| [audit-phase3-5-lacunas](done/2026-07-04-audit-phase3-5-lacunas.md) | Fase 3-5: lacunas encontradas |
| [audit-followup-improvements](done/2026-07-04-audit-followup-improvements.md) | Melhorias de follow-up |
| [docs-sync-critical](done/2026-07-04-docs-sync-critical.md) | Sincronização crítica de docs |
| [feedback-and-update](done/2026-07-04-feedback-and-update.md) | Comandos feedback + update |
| [rename-health-score](done/2026-07-04-rename-health-score.md) | Renomear health score |

### 2026-07-02
| Plano | Resumo |
|---|---|
| [init-audit-dashboard](done/2026-07-02-init-audit-dashboard.md) | Init, audit e dashboard iniciais |

### Planos sem data (faseamento inicial)
| Plano | Resumo |
|---|---|
| [fase-1-fundacao](done/fase-1-fundacao.md) | Fase 1: Fundação |
| [fase-integracao](done/fase-integracao.md) | Fase: Integração |
| [fase-system-live](done/fase-system-live.md) | Fase: System Live |
| [adaptive-dual-path](done/adaptive-dual-path.md) | Dual-path adaptativo |
| [auditoria-completa-plano](done/auditoria-completa-plano.md) | Auditoria completa |
| [auditoria-correcao-completa](done/auditoria-correcao-completa.md) | Correção de auditoria |
| [briefing-onboarding-nexus](done/briefing-onboarding-nexus.md) | Briefing de onboarding |
| [plano-correcao-nexus-audit](done/plano-correcao-nexus-audit.md) | Correção do nexus audit |
| [Plano-de-Evolução-do-Nexus-CLI](done/Plano-de-Evolução-do-Nexus-CLI.md) | Plano de evolução geral |
| [production-readiness](done/production-readiness.md) | Production readiness |
| [unified-execution](done/unified-execution.md) | Execução unificada |

---

## Roadmap Futuro (Backlog)

Itens planeados mas ainda não iniciados, extraídos do BACKLOG:

### P1 — Curto prazo (≤ 30d)
- **SA4/SA10/SA11** — Clean Architecture / SOLID (refactoring grande)
- **A2** — OpenCode plugin (hook antes de tarefas)
- **A3** — Cursor integration (extensão VS Code)
- **A4** — Git hooks (`nexus hooks --install`)
- **A7** — Skill template (`nexus skill:create`)

### P2 — Médio prazo (≤ 90d)
- **2.1** — `nexus detect --approve/--reject`
- **2.3b** — `nexus bench --compare`
- **2.4** — `nexus feedback --list`
- **D1** — Interactive tutorial
- **D2** — Example projects

### P3 — Baixa prioridade (sem SLA)
- Shell completion, i18n, structured logging, metrics export, etc.
- Ver [BACKLOG.md](../../../../docs/BACKLOG.md) para lista completa.

---

*Actualizado: 2026-07-09*
