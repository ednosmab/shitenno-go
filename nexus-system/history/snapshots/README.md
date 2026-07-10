# History Snapshots

> **Directório:** `nexus-system/history/snapshots/`
> **Propósito:** Armazenar snapshots do estado do projecto ao longo do tempo

---

## Descrição

Este directório contém snapshots do estado do projecto, permitindo comparar evolução e detectar regressões.

## Tipos de Snapshots

| Tipo | Descrição |
|------|-----------|
| **engineering-state** | Estado consolidado do projecto |
| **health-report** | Relatório de saúde em ponto no tempo |
| **maturity-profile** | Perfil de maturidade |
| **knowledge-graph** | Grafo de conhecimento |

## Estrutura

```
snapshots/
├── README.md                      # Este ficheiro
├── snapshot-YYYY-MM-DD.json      # Snapshot completo (futuro)
└── diff-YYYY-MM-DD.json          # Diferenças desde último snapshot (futuro)
```

## Notas

- Directório criado automaticamente durante a inicialização
- Snapshots são gerados conforme necessidade

---

*Última actualização: 2026-07-10*
