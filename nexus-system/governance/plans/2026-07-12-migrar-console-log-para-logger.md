# Plano — Migrar console.log para Logger Centralizado (3.1)

**Status:** In Progress
**Updated_at:** 2026-07-13T01:40:56.614Z
**Date:** 2026-07-12

> **Objetivo:** Substituir console.log por output() (stdout) e logger.* (stderr) em todos os comandos CLI
> **Critério de saída:** pnpm lint + pnpm test passam, console.log count = 0 em src/commands/

---

## Contexto

- **1,532 console.log** em src/ (1,380 em commands/, 119 em outros módulos)
- **25 console.error** em commands/
- **6 console.warn** em commands/
- Logger atual usa console.error internamente (stderr)
- Decisão: Criar `output()` helper para stdout + usar `logger.*` para stderr

## Arquitetura

```
output()  → stdout → saída do usuário (tabelas, banners, status)
logger.*  → stderr → diagnóstico/debug/erros
```

## Checklist

- [x] Criar `src/output.ts` com helpers (output, outputLine, outputSection, outputTable, etc.)
- [x] Criar plano (este ficheiro)
- [ ] Migrar comandos (ordenados por complexidade crescente)
- [ ] Run lint + tests
- [ ] Atualizar BACKLOG.md (3.1 → Done)
- [ ] Commit + push

---

## Fases de Migração

### Fase 1 — Comandos Simples (≤ 50 console.log cada) — ~300 chamadas

| # | Arquivo | console.log | Prioridade |
|---|---|---|---|
| 1 | `act.ts` | 42 | Baixa |
| 2 | `bench.ts` | 42 | Baixa |
| 3 | `decide.ts` | 46 | Baixa |
| 4 | `evolve.ts` | 34 | Baixa |
| 5 | `report.ts` | 34 | Baixa |
| 6 | `update.ts` | 36 | Baixa |
| 7 | `profile.ts` | 37 | Baixa |
| 8 | `upgrade.ts` | 40 | Baixa |

### Fase 2 — Comandos Médios (50-80 console.log cada) — ~500 chamadas

| # | Arquivo | console.log | Prioridade |
|---|---|---|---|
| 9 | `feedback.ts` | 52 | Média |
| 10 | `goal.ts` | 51 | Média |
| 11 | `detect.ts` | 50 | Média |
| 12 | `console.ts` | 47 | Média |
| 13 | `policy.ts` | 53 | Média |
| 14 | `briefing.ts` | 62 | Média |

### Fase 3 — Comandos Grandes (80+ console.log cada) — ~580 chamadas

| # | Arquivo | console.log | Prioridade |
|---|---|---|---|
| 15 | `assess.ts` | 72 | Alta |
| 16 | `init.ts` | 80 | Alta |
| 17 | `status.ts` | 82 | Alta |
| 18 | `plan.ts` | 90 | Alta |
| 19 | `audit.ts` | 121 | Alta |
| 20 | `docs-audit.ts` | 40 | Alta |

### Fase 4 — Módulos Fora de commands/ — ~119 chamadas

| # | Arquivo | console.log | Prioridade |
|---|---|---|---|
| 21 | `src/*.ts` (outros) | 119 | Baixa |

---

## Regras de Migração

1. **console.log → output()** para saída do usuário
2. **console.error → logger.error** para erros
3. **console.warn → logger.warn** para avisos
4. **console.log(chalk.red(...))** → outputError() ou logger.error()
5. **console.log(chalk.green(...))** → outputSuccess()
6. **console.log(chalk.yellow(...))** → outputWarning() ou logger.warn()
7. **console.log(chalk.gray(...))** → output() com opts.quiet = true
8. **console.log("")** → outputBlank()
9. **Tabelas formatadas** → outputTable()
10. **Key-value pairs** → outputKV()

---

## Ordem de Execução

1. Criar output.ts ✅
2. Criar plano ✅
3. Migrar Fase 1 (comandos simples)
4. Migrar Fase 2 (comandos médios)
5. Migrar Fase 3 (comandos grandes)
6. Migrar Fase 4 (módulos fora de commands/)
7. Run lint + tests
8. Atualizar BACKLOG.md
9. Commit + push
