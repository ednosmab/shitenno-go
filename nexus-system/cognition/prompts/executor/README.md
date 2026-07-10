# Executor Prompts

> **Directório:** `cognition/prompts/executor/`
> **Propósito:** Armazenar prompts e templates para o agente Executor

---

## Descrição

Este directório contém os prompts utilizados pelo agente **Executor** durante a execução de tarefas.

## Papel do Executor

O Executor é responsável por:
- Implementar código baseado nos planos do Planner
- Seguir as directrizes de código (DESDO.md)
- Respeitar as regras vinculantes (FORBIDDEN_OPERATIONS.md)
- Gerar testes unitários para cada funcionalidade

## Estrutura

```
executor/
├── README.md           # Este ficheiro
├── [system-prompt.md]  # Prompt de sistema (futuro)
└── [examples/]         # Exemplos de execução (futuro)
```

## Notas

- Directório criado automaticamente durante a inicialização
- Conteúdo a ser populado conforme necessidade

---

*Última actualização: 2026-07-10*
