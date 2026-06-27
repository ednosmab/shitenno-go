# WORKFLOW — Fluxos de Sessão

> **Versão:** 1.0
> **Data:** YYYY-MM-DD
> **Entrada única obrigatória** — Todo agente deve ler este ficheiro primeiro

---

## Princípio Fundamental

> **O agente NUNCA decide o que ler primeiro. Este WORKFLOW determina o fluxo com base no tipo de operação.**

---

## Fluxo Padrão

```
Utilizador envia tarefa
        │
        ▼
┌─────────────────────────────────────────┐
│  PASSO 1: DIAGNÓSTICO                   │
│  → Ler governance/WORKFLOW.md (este)    │
│  → Ler governance/context/context_buffer.yaml │
│  → Identificar tipo de operação         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  PASSO 2: CARREGAR CONTEXTO             │
│  → Ler P0: AGENTS.md, FORBIDDEN, DESDO  │
│  → Ler P1: context_buffer.yaml          │
│  → Ler P2: Plano da camada afectada     │
│  → Actualizar context_buffer.yaml       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  PASSO 3: EXECUTAR                      │
│  → Escrever código cirurgicamente       │
│  → Seguir plano atómico                 │
│  → Verificar após cada step             │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  PASSO 4: VALIDAR                       │
│  → Executar testes                      │
│  → Executar lint/typecheck              │
│  → Verificar integridade                │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  PASSO 5: CONSOLIDAR                    │
│  → Actualizar context_buffer.yaml       │
│  → Marcar [x] no plano                  │
│  → Gerar histórico (docs/history/)      │
│  → Executar close:session               │
└─────────────────────────────────────────┘
```

---

## Por Tipo de Operação

### FEATURE
1. Ler WORKFLOW.md → context_buffer → premortem
2. Criar plano em `docs/plans/YYYY-MM-DD-<task>.md`
3. Ler skill da camada (P2)
4. Implementar cirurgicamente
5. Testar, validar, consolidar

### BUG
1. Ler WORKFLOW.md → context_buffer
2. Reproduzir erro / causa raiz
3. Documentar no buffer → corrigir → testar

### REFACTOR
1. Ler WORKFLOW.md → ADRs → SYSTEM_MAP
2. Premortem check → plano → executar
3. Testar, validar, consolidar

### DOCUMENTATION
1. Identificar documentos a actualizar
2. Escrever → validar consistência

### PLANNING
1. Ler WORKFLOW.md → context_buffer → premortem
2. Criar plano → actualizar BACKLOG

### INVESTIGATION
1. Formular hipótese → recolher evidências
2. Documentar findings → criar ADR se necessário

---

## Quick Start

| Passo | Acção | Comando |
|---|---|---|
| 1 | Ler WORKFLOW.md | `governance/WORKFLOW.md` |
| 2 | Ler buffer | `governance/context/context_buffer.yaml` |
| 3 | Premortem | `npx tsx scripts/premortem-check.ts` |
| 4 | Planear | Criar `docs/plans/YYYY-MM-DD-<task>.md` |
| 5 | Implementar | Código na pasta permitida |
| 6 | Testar | `pnpm run test` |
| 7 | Validar | `npx tsx scripts/validate-session.ts` |
| 8 | Encerrar | `npx tsx scripts/close-session.ts` |

---

## Referências

- `docs/AGENTS.md` — Regras do time
- `docs/FORBIDDEN_OPERATIONS.md` — Regras vinculantes
- `docs/DESDO.md` — Diretrizes de engenharia
- `governance/SYSTEM_MAP.md` — Mapa centralizado
