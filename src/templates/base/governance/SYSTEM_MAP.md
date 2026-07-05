# SYSTEM_MAP — Mapa Centralizado

> **Versão:** 1.1
> **Data:** YYYY-MM-DD
> **Propósito:** Mapa de todos os directórios e arquivos do sistema

---

## Legenda de Estados

| Ícone | Estado | Significado |
|---|---|---|
| ✅ | **Instalado** | Capacidade activa e operacional no projecto |
| 📋 | **Disponível** | Capacidade pode ser instalada via `nexus upgrade` |
| 🔮 | **Futuro** | Capacidade planeada mas ainda não disponível |

---

## Estrutura Geral

```
nexus-system/
├── cognition/                          ← Arquitectura mental
│   ├── context/                        ← Hierarquia de contexto
│   ├── memory/                         ← Estado operacional
│   └── prompts/                        ← Prompts por agente
├── docs/                               ← Documentação
│   ├── adrs/                           ← Architecture Decision Records
│   ├── feedback/                       ← Feedback de sessões (privado)
│   ├── history/                        ← Memória ROM (imutável)
│   ├── layers/                         ← Planos por camada técnica
│   ├── plans/                          ← Planos de execução
│   ├── roadmaps/                       ← Roadmaps
│   ├── sdr/                            ← Solution Decision Records
│   └── skills/                         ← Skills operacionais
├── governance/                         ← Governança
│   ├── agents/                         ← Contratos de agentes
│   ├── context/                        ← Memória RAM
│   ├── contracts/                      ← Índice de contratos
│   ├── handoffs/                       ← Protocolos de transição
│   ├── policies/                       ← Políticas operacionais
│   ├── premortem/                      ← Análise de riscos
│   └── reviews/                        ← Reviews de sessão
└── scripts/                            ← Scripts de validação
```

---

## Capacidades Instaladas

<!-- CAPABILITY_STATUS -->
As capacidades instaladas neste projecto determinam quais secções do AGENTS.md
estão activas. Execute `nexus upgrade --list` para ver todas as capacidades.

| Capacidade | Estado | Descrição |
|---|---|---|
| `core` | ✅ | Fundação básica (docs, scripts, opencode.json) |
| `knowledge` | ✅ | Skills, AGENTS.md regras, documentação |
| `governance` | ✅ | Workflows, context buffer, handoffs |
| `architecture` | ✅ | ADRs, SDRs, planos, session templates |
| `ai` | ✅ | Contratos de agentes, cognition, prompts |
| `quality` | ✅ | Scripts de validação, sync-docs |
| `metrics` | ✅ | Relatórios, histórico |
| `operations` | ✅ | Runbooks, close-session, premortem |
| `compliance` | ✅ | Premortem reviews, session reviews |
<!-- /CAPABILITY_STATUS -->

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
| sync-docs | `scripts/sync-docs.ts` | Sincronizar documentação |

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

## Referências

- `governance/WORKFLOW.md` — Fluxos de sessão
- `docs/AGENTS.md` — Regras do time
- `docs/capabilities.md` — Mapeamento capacidade→regras→arquivos
- `docs/Nexus-System_GUIDE.md` — Guia completo

---

## Diagnóstico de Capacidades

Quando uma regra do AGENTS.md referencia infraestrutura ausente (ex: WORKFLOW.md,
context buffer, agent contracts), o agente DEVE informar ao utilizador:

```
nexus upgrade --capability <name>
```

para desbloquear essa funcionalidade. O `nexus upgrade --list` mostra todas as
capacidades e o seu estado actual.

**Fluxo de detecção:**
1. Detectar regra que referencia arquivo/capacidade ausente
2. Identificar capacidade necessária
3. Recomendar `nexus upgrade --capability <capacidade>`
4. Nunca assumir que o utilizador sabe o que falta
