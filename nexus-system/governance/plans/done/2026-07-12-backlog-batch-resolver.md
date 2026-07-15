# Plano — Resolver Backlog em Lote (Itens sem Dependência Humana)

**Status:** Done
**Updated_at:** 2026-07-12T21:57:12.417Z
**Date:** 2026-07-12

> **Data:** 2026-07-12
> **Objetivo:** Resolver todos os itens do BACKLOG que podem ser implementados mecanicamente, sem necessidade de decisão humana (naming, branding, design, etc.)
> **Critério de saída:** `pnpm lint` + `pnpm test` a passar, BACKLOG.md actualizado

---


## Checklist

- [x] `pnpm lint` passa sem erros
- [x] `pnpm test` passa (1912+ testes)
- [x] BACKLOG.md actualizado com novos Done items
- [x] Commit + push para origin (2b4a20d)

## Itens seleccionados (ordenados por complexidade crescente)

### Fase 1 — Quick Wins (≤ 30 min cada)

| # | Item | Descrição | Trabalho estimado |
|---|---|---|---|
| 1 | **A4** | Marcar Git hooks como Done (já implementado em `hooks.ts`) | 2 min |
| 2 | **3.22** | HealthBar compartilhado — remover duplicação `dashboard.ts` vs `formatting.ts` | 10 min |
| 3 | **2.12** | JSDoc em 8 funções exportadas sem documentação | 20 min |
| 4 | **3.1** | Substituir console.log por logger nos commands (90+ chamadas) | 30 min |
| 5 | **2.13** | Consolidar planos de `plans/` (mover done/ para done/) | 15 min |

### Fase 2 — CLI Enhancements (≤ 1h cada)

| # | Item | Descrição | Trabalho estimado |
|---|---|---|---|
| 6 | **3.10** | `--quiet` / `--no-color` flags globais | 45 min |
| 7 | **2.4** | `nexus feedback --list` (últimos 10 registros) | 30 min |
| 8 | **2.7** | `briefing --diff --compact` usando `differentialBriefing()` | 20 min |
| 9 | **2.3b** | `nexus bench --compare` (comparar com execução anterior) | 45 min |
| 10 | **3.27** | Briefing cache TTL configurável (env var) | 15 min |

### Fase 3 — Quality & Security (≤ 1h cada)

| # | Item | Descrição | Trabalho estimado |
|---|---|---|---|
| 11 | **S2** | Adicionar `pnpm audit` ao CI pipeline | 15 min |
| 12 | **3.30** | Schema validation com tipo guard (simplificado, sem zod) | 30 min |
| 13 | **3.33** | Feedback campo `briefingProfile` | 20 min |

### Fase 4 — Performance (≤ 1h cada)

| # | Item | Descrição | Trabalho estimado |
|---|---|---|---|
| 14 | **2.16** | Lazy loading de módulos pesados em `context-collector.ts` | 30 min |
| 15 | **2.17** | Benchmark suite no CI | 15 min |

---

## Itens NÃO seleccionados (requerem decisão humana)

| Item | Razão |
|---|---|
| 3.36 Decidir nome do produto | Decisão estratégica |
| 3.37 Refinamento do logo | Design/branding |
| 3.38 Optimizar tokens sessão | Requer análise de trade-offs |
| A2/A3/A5/A6/A7 | Integrações externas (OpenCode, Cursor, webhooks, serve) |
| D1-D6 | Developer experience (tutorial, examples, migration, SDK, video) |
| DA1-DA4 | Data & analytics (requer decisões de produto) |
| S1/S3/S4 | Security (pentest, secret scanning, SLSA — requer tooling choice) |
| I1-I3 | Internationalization (requer decisão de idiomas) |
| SA4/SA10/SA11 | Arquitetura Clean/SOLID (refactor grande, requer planeamento) |
| 3.3 Monorepos | Requer decisão de suporte |
| 3.4 GitHub API | Requer decisão de OAuth/token |
| 3.7 Projetos sem Git | Requer decisão de fallback |

---

## Ordem de execução

1. Criar plano (este ficheiro) ✅
2. Executar Fase 1 (quick wins)
3. Executar Fase 2 (CLI enhancements)
4. Executar Fase 3 (quality & security)
5. Executar Fase 4 (performance)
6. Actualizar BACKLOG.md
7. Run lint + tests
8. Commit + push

---

## Critério de saída

- [x] `pnpm lint` passa sem erros
- [x] `pnpm test` passa (1912+ testes)
- [x] BACKLOG.md actualizado com novos Done items
- [x] Commit + push para origin (2b4a20d)
