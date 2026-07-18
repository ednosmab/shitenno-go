# Feedback

> **Directório:** `shitenno/docs/feedback/`
> **Propósito:** Armazenar feedback estruturado de sessões de trabalho

---

## Descrição

Este directório contém os registos de feedback gerados pelo comando `shugo feedback`.

## Formato

Cada ficheiro de feedback segue o formato:
- **Nome:** `YYYY-MM-DD.md` (um ficheiro por dia)
- **Conteúdo:** Secções `### Sessão N (HH:MM)` para cada sessão

## Comandos Relacionados

| Comando | Descrição |
|---------|-----------|
| `shugo feedback --outcome success` | Registar sessão bem-sucedida |
| `shugo feedback --outcome failure` | Registar sessão com falha |
| `shugo feedback --summary` | Ver resumo do feedback |

## Estrutura

```
feedback/
├── README.md              # Este ficheiro
├── 2026-07-10.md          # Feedback do dia (futuro)
└── ...
```

## Notas

- Directório criado automaticamente durante a inicialização
- Feedback é privado e não versionado (excluído do git)

---

*Última actualização: 2026-07-10*
