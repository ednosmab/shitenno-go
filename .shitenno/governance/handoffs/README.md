# Handoffs

> **Directório:** `shitenno/governance/handoffs/`
> **Propósito:** Armazenar decisões de roteamento entre agentes IA

---

## Descrição

Este directório contém os registos de handoff gerados pelo agente **Orchestrator** durante a coordenação de tarefas.

## Papel dos Handoffs

Os handoffs são decisões de roteamento que determinam:
- **Qual papel** deve agir em seguida (Planner, Executor, Reviewer)
- **Se uma tarefa** pode avançar de fase
- **Se pré-requisitos** foram satisfeitos

## Formato

Cada handoff segue o schema `handoff_decision` definido no contrato do Orchestrator.

## Estrutura

```
handoffs/
├── README.md                    # Este ficheiro
├── TEMPLATE.md                  # Template de handoff
└── handoff-YYYY-MM-DD-N.json   # Registo de handoff (futuro)
```

## Notas

- Directório criado automaticamente durante a inicialização
- Handoffs são gerados pelo agente Orchestrator

---

*Última actualização: 2026-07-10*
