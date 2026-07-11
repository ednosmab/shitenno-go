# Pipeline: Nexus Living — Fase 1 (Cache Cross-Process)

**Status:** Pending
**Date:** 2026-07-11
**Plan:** 2026-07-11-nexus-living-plano-v2-3fases
**Phase:** 1
**Owner:** ambos
**Execucoes_humano:** 0
**Execucoes_agente:** 0
**Updated_at:** 2026-07-11T00:00:00.000Z

---

## 1. Pré-requisitos

| # | Item | Estado |
|---|---|---|
| P1 | BUG-001 corrigido (--auto em detect.ts) | pendente |
| P2 | engineering-state-access.ts modificado com cache cross-process | pendente |
| P3 | Testes unitários 7/7 passando | pendente |
| P4 | tsc --noEmit zero erros em engineering-state-access.ts | pendente |

## 2. Roteiro de Execução

### Para humano (passo a passo)

1. Correr `nexus status` — deve responder sem erro e mostrar health score
2. Correr `nexus doctor` — deve mostrar recomendações
3. Correr `nexus audit` — deve listar assets do projecto
4. Aguardar 70 segundos (cache expira após 60s)
5. Correr `nexus status` novamente — deve usar cache do disco (mais rápido)
6. Modificar um ficheiro em `governance/` (ex: adicionar linha a um .md)
7. Correr `nexus status` — deve recalcular (cache obsoleto detectado)
8. Correr `nexus status --force-refresh` — deve recalcular sempre, ignorando cache

### Para agente IA (comandos)

1. `npx vitest run src/__tests__/engineering-state-access.test.ts` — esperado 7/7
2. `npx tsc --noEmit src/engineering-state-access.ts` — esperado zero erros
3. `grep -n "loadEngineeringState" src/engineering-state-access.ts` — confirmar que chamada existe
4. `grep -n "isDiskCacheFresh" src/engineering-state-access.ts` — confirmar verificação de frescor
5. `grep -n "hasFileChangedSince" src/engineering-state-access.ts` — confirmar detecção de mtime
6. `grep -n "forceRefresh" src/engineering-state-access.ts` — confirmar kill-switch mantido

## 3. Checklists de Validação

| # | Cenário | Acção | Esperado | Estado |
|---|---|---|---|---|
| C1 | Cache in-memory funciona | Chamar `getEngineeringState()` 2x seguidas sem forceRefresh | Mesma referência (===) | pendente |
| C2 | Cache cross-process funciona | Gravar estado em disco, limpar cache, ler | Estado do disco usado, não recalcula | pendente |
| C3 | Cache obsoleto detectado | Modificar ficheiro governance/, esperar, ler estado | Recalcula (não usa disco) | pendente |
| C4 | forceRefresh bypassa tudo | Gravar estado em disco, chamar com forceRefresh=true | Recalcula do zero | pendente |
| C5 | nexus status funciona | Correr `nexus status` | Output sem erro, health score visível | pendente |
| C6 | nexus doctor funciona | Correr `nexus doctor` | Output sem erro, recomendações visíveis | pendente |

## 4. Comandos de Execução

```bash
npx vitest run src/__tests__/engineering-state-access.test.ts \
  && npx tsc --noEmit src/engineering-state-access.ts \
  && nexus pipeline notify living-fase1-cache --event "phase_complete"
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
