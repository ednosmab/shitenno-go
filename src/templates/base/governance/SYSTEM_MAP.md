# SYSTEM_MAP — Mapa Centralizado

> **Versão:** 1.0
> **Data:** YYYY-MM-DD
> **Propósito:** Mapa de todos os directórios e arquivos do sistema

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
- `docs/Nexus-System_GUIDE.md` — Guia completo
