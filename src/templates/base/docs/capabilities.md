# CAPABILITIES — Mapeamento Capacidade→Regras→Arquivos

> **Versão:** 1.0
> **Propósito:** Mapa centralizado de todas as capacidades do Nexus System,
> mostrando quais regras do AGENTS.md e arquivos são activados por cada capacidade.

---

## Visão Geral

O Nexus System é construído sobre **capabilitides** — cada uma activa regras
específicas no AGENTS.md e instala directórios/arquivos correspondentes.

```
┌─────────────────────────────────────────────────────────┐
│  Capacidade                                              │
│  ├── Activa regras no AGENTS.md                          │
│  ├── Instala directórios e arquivos                      │
│  └── Determina comportamento do agente                   │
└─────────────────────────────────────────────────────────┘
```

---

## Capacidades Disponíveis

### ✅ core (Sempre instalado)

| Campo | Valor |
|---|---|
| **Descrição** | Fundação básica do sistema |
| **Regras AGENTS.md** | #18-25 (evidência, métricas, estados, detecção proativa) |
| **Directórios** | `nexus-system/`, `nexus-system/docs/`, `nexus-system/scripts/` |
| **Arquivos-chave** | AGENTS.md, FORBIDDEN_OPERATIONS.md, DESDO.md, SYSTEM_MAP.md |
| **Sem esta capacidade** | Sistema não funciona — nada é instalado |

### ✅ knowledge (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Skills, documentação e regras de engenharia |
| **Regras AGENTS.md** | #5-9 (TDD, validação, senior engineer), #14 (review mode) |
| **Directórios** | `nexus-system/docs/skills/` |
| **Arquivos-chave** | 20+ skills (.md), AGENTS.md seções condicionais |
| **Depende de** | core |

### ✅ governance (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Workflows, context buffer e gestão de sessões |
| **Regras AGENTS.md** | #1-4 (lazy loading, workflow, sessão), #10-13 (backlog, fim de sessão) |
| **Directórios** | `nexus-system/governance/context/` |
| **Arquivos-chave** | WORKFLOW.md, context_buffer.yaml |
| **Depende de** | core |

### ✅ architecture (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Decisões arquiteturais, planos e templates |
| **Regras AGENTS.md** | #12 (review mode), #15-16 (plan/build mode) |
| **Directórios** | `nexus-system/docs/adrs/`, `nexus-system/docs/plans/` |
| **Arquivos-chave** | ADR-TEMPLATE.md, SDR-TEMPLATE.md, TEMPLATE.md |
| **Depende de** | core |

### ✅ ai (Com governance)

| Campo | Valor |
|---|---|
| **Descrição** | Contratos de agentes IA e cognition |
| **Regras AGENTS.md** | #11 (multi-agent), #12 (review), #15-16 (plan/build) |
| **Directórios** | `nexus-system/governance/agents/`, `nexus-system/cognition/` |
| **Arquivos-chave** | AI-CONTRACT-*.yaml, CONTEXT_HIERARCHY.md |
| **Depende de** | governance |

### ✅ quality (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Scripts de validação e sincronização |
| **Regras AGENTS.md** | #5 (TDD), #9 (post-commit validation) |
| **Directórios** | `nexus-system/scripts/` |
| **Arquivos-chave** | validate-session.ts, sync-docs.ts |
| **Depende de** | core |

### ✅ metrics (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Relatórios e histórico de sessões |
| **Regras AGENTS.md** | #13 (quick board), #17 (feedback) |
| **Directórios** | `nexus-system/reports/`, `nexus-system/docs/history/` |
| **Arquivos-chave** | README.md |
| **Depende de** | core |

### ✅ operations (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Runbooks, sessão e análise de riscos |
| **Regras AGENTS.md** | #9 (post-commit), #10 (checklist) |
| **Directórios** | `nexus-system/docs/runbooks/` |
| **Arquivos-chave** | merge.md, close-session.ts, premortem-check.ts |
| **Depende de** | core |

### ✅ compliance (Com core)

| Campo | Valor |
|---|---|
| **Descrição** | Premortem e reviews de sessão |
| **Regras AGENTS.md** | #12 (review mode), #17 (feedback) |
| **Directórios** | `nexus-system/governance/premortem/`, `reviews/` |
| **Arquivos-chave** | PREMORTEM.md, SESSION_REVIEW.md |
| **Depende de** | core |

---

## Fluxo de Instalação

```
1. nexus init
   └── Instala: core + knowledge + governance + quality
   └── AGENTS.md: secções knowledge + governance activas

2. nexus upgrade --capability architecture
   └── Adiciona: architecture
   └── AGENTS.md: secção architecture activada
   └── Novos arquivos: adrs/, plans/, templates

3. nexus upgrade --capability ai
   └── Adiciona: ai (requer governance)
   └── AGENTS.md: secção ai activada
   └── Novos arquivos: contracts/, cognition/
```

---

## Diagnóstico

Execute `nexus upgrade --list` para ver:
- Capacidades instaladas (✅)
- Capacidades disponíveis (📋)
- Dependências não satisfeitas

Execute `nexus status` para ver gaps de infraestrutura.

---

## Referências

- `governance/SYSTEM_MAP.md` — Mapa do sistema
- `docs/AGENTS.md` — Regras condicionais por capacidade
- `src/capability-mapping.ts` — Implementação do mapeamento
- `src/scaffolder.ts` — Instalação de capacidades
- `src/commands/upgrade.ts` — Comando de upgrade
