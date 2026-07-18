# Pipeline: Shugo Living — Fase 2 (Git Hooks Reactivos)

**Status:** Pending
**Date:** 2026-07-11
**Plan:** 2026-07-11-shitenno-living-plano-v2-3fases
**Phase:** 2
**Owner:** ambos
**Execucoes_humano:** 0
**Execucoes_agente:** 0
**Updated_at:** 2026-07-11T00:00:00.000Z

---

## 1. Pré-requisitos

| # | Item | Estado |
|---|---|---|
| P1 | Fase 1 validada (dogfooding alguns dias sem regressões) | pendente |
| P2 | BUG-001 corrigido (--auto em detect.ts) | pendente |
| P3 | src/plan-lifecycle.ts criado com checkAndArchiveDonePlans() | pendente |
| P4 | src/commands/hooks.ts criado (instalador Husky) | pendente |
| P5 | .husky/post-merge criado | pendente |

## 2. Roteiro de Execução

### Para humano (passo a passo)

1. Criar um ficheiro de plano dummy em `governance/plans/` com `**Status:** Done`
2. Fazer commit — o hook `post-commit` deve correr `shugo detect --auto`
3. Verificar que o plano foi arquivado para `governance/plans/done/`
4. Correr `shugo hooks install` — deve fazer append ao `post-commit` existente
5. Verificar que o conteúdo original do `post-commit` sobrevive
6. Criar outro plano dummy, marcar `Status: Done`, commitar
7. Confirmar arquivamento automático via hook

### Para agente IA (comandos)

1. `npx vitest run src/__tests__/plan-lifecycle.test.ts` — testes de idempotência
2. `npx vitest run src/__tests__/hooks-install.test.ts` — testes do instalador
3. `npx tsc --noEmit src/plan-lifecycle.ts src/commands/hooks.ts` — zero erros
4. `cat .husky/post-commit` — confirmar que conteúdo original não foi sobrescrito
5. `grep -n "checkAndArchiveDonePlans" src/plan-lifecycle.ts` — confirmar função existe

## 3. Checklists de Validação

| # | Cenário | Acção | Esperado | Estado |
|---|---|---|---|---|
| C1 | detect --auto funciona | Correr `shugo detect --auto` | Zero erro de opção desconhecida | pendente |
| C2 | checkAndArchiveDonePlans é idempotente | Correr 2x seguidas sobre mesmo estado | Sem duplicação, sem falha | pendente |
| C3 | Instalador nunca sobrescreve hook | Correr `shugo hooks install` com post-commit preenchido | Conteúdo original preservado | pendente |
| C4 | Arquivamento via hook | Criar plano Status: Done, commitar | Plano movido para done/ | pendente |
| C5 | post-merge funciona | Fazer merge de branch | Hook executa sem erro | pendente |
| C6 | pnpm test limpo | Correr `npx vitest run` | Todos os testes passam | pendente |

## 4. Comandos de Execução

```bash
npx vitest run src/__tests__/plan-lifecycle.test.ts src/__tests__/hooks-install.test.ts \
  && npx tsc --noEmit src/plan-lifecycle.ts src/commands/hooks.ts \
  && shugo pipeline notify living-fase2-hooks --event "phase_complete"
```

## 5. Resultado

| Métrica | Valor |
|---|---|
| Total de cenários | 6 |
| Passaram | 0 |
| Falharam | 0 |
| Taxa de sucesso | 0% |
| Execuções (humano) | 0 |
| Execuções (agente) | 0 |

**Decisão:** PENDENTE

**Notas:**
