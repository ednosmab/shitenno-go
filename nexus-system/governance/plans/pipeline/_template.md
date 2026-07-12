# Pipeline: <Título do Plano> — Fase <N>

**Status:** Pending
**Date:** <YYYY-MM-DD>
**Plan:** <plan-id>
**Phase:** <N>
**Owner:** ambos
**Execucoes_humano:** 0
**Execucoes_agente:** 0
**Updated_at:** <ISO timestamp>

---

## 1. Pré-requisitos

> Itens que devem estar concluídos ANTES de executar este pipeline.

| # | Item | Estado |
|---|---|---|
| P1 | <descrição do pré-requisito> | pendente |

## 2. Roteiro de Execução

### Para humano (passo a passo)

1. <passo detalhado com contexto>
2. <passo detalhado com contexto>
3. <passo detalhado com contexto>

### Para agente IA (comandos)

1. `comando a executar`
2. `comando a executar`
3. `comando a executar`

## 3. Checklists de Validação

| # | Cenário | Acção | Esperado | Estado |
|---|---|---|---|---|
| C1 | <descrição do cenário> | <o que fazer> | <resultado esperado> | pendente |
| C2 | <descrição do cenário> | <o que fazer> | <resultado esperado> | pendente |
| C3 | <descrição do cenário> | <o que fazer> | <resultado esperado> | pendente |

## 4. Comandos de Execução

> Encadeamento para execução manual via shell.

```bash
nexus pipeline exec <pipeline-id> \
  && nexus pipeline notify <pipeline-id> --event "phase_complete"
```

## 5. Resultado

| Métrica | Valor |
|---|---|
| Total de cenários | 0 |
| Passaram | 0 |
| Falharam | 0 |
| Taxa de sucesso | 0% |
| Execuções (humano) | 0 |
| Execuções (agente) | 0 |

**Decisão:** PENDENTE

**Notas:**
