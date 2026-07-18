# Pre-Session Briefing
*Generated: 2026-07-12T01:42:24.144Z*

---

## QUICK BOARD — Estado do Projecto

> **Apresentar este quadro ao utilizador antes da primeira resposta operacional.**
> Veja regra #13 em `docs/AGENTS.md` (QUICK BOARD DE AVISO).

| Campo | Estado |
|---|---|
| **Tarefa em curso** | LIVING-001 Fase 1 — Cache cross-process (In Progress) |
| **Próximo P0** | LIVING-001 Fase 1 — Cache cross-process (In Progress) |
| **Dívidas P1** | Nenhuma |
| **Impedimentos** | Nenhum |
| **Estado última sessão** | Em curso |

---

## Actividade Recente (24h)

| Evento | Detalhe | Hora |
|--------|---------|------|
| plan.format_warning | Formato inválido: PLAN-NOTIFICATION-TEST | 01:30 |
| backlog.updated | retroactive_scan: 4 passos | 01:30 |
| plan.format_warning | Formato inválido: PLAN-NOTIFICATION-TEST | 01:30 |
| plan.format_warning | Formato inválido: PLAN-HANDBOOK-SYNC | 01:00 |
| plan.format_warning | Formato inválido: PLAN-HANDBOOK-SYNC | 00:59 |
| plan.format_warning | Formato inválido: PLAN-HANDBOOK-SYNC | 00:58 |
| plan.format_warning | Formato inválido: PLAN-HANDBOOK-SYNC | 00:58 |
| plan.format_warning | Formato inválido: PLAN-DYNAMIC-RULE-ADAPTATION | 00:58 |
| plan.format_warning | Formato inválido: 2026-07-11-shitenno-living-plano-v2-3fases | 00:58 |
| plan.format_warning | Formato inválido: 2026-07-02-shitenno-dashboard-restructure | 00:58 |

**Resumo:** 1 sincronizações, 9 erros

## Active Reminders

- 🔴 **HIGH** — Health status is CRITICAL — immediate action required [health]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]

## Project Identity
- **Domain:** monorepo
- **Scale:** medium
- **Stack:** react
- **Maturity:** 73/100

## Risk Status
- **Overall:** critical
- **Critical:** src, apps

## Test Coverage
- **Has Tests:** Yes
- **Areas Without Tests:** 5

## Context Rules (Top)
- Area "src" has 7 file(s) without tests. Prioritize test coverage here.
- Area "src" contains sensitive keywords (auth, payment, security). Apply extra security review.
- Area "apps" has 8 file(s) without tests. Prioritize test coverage here.
- Area "apps" contains sensitive keywords (auth, payment, security). Apply extra security review.
- This is a monorepo. When modifying shared packages, ensure backward compatibility.

## Dynamic Rules (From History)
- [high] This project has 75 force push(es) in the last 180 days. Avoid "git push --force" — use --force-with-lease instead.
- [medium] This project has 4 hotfix(es) in the last 180 days. Consider adding more pre-merge validation.

## Recommended Next Steps
1. Address critical risk areas: src, apps
1. Improve test coverage in 5 area(s)

## Token Economy
- **Estimated tokens saved:** ~11.600
- **Context rules:** 7
- **Dynamic rules:** 2
- **Cache hit:** No