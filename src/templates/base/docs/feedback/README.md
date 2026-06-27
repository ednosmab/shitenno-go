# docs/feedback/ — Feedback de Sessões

## Por que existe?
Resolve o problema de **falta de feedback estruturado** sobre o desempenho dos agentes e developers. Sem feedback, não há evolução.

## O que contém?
- `YYYY-MM-DD.md` — Feedback diário (1 ficheiro por dia)
- `MVP-aggregated.md` — Feedback agregado do MVP

## Como o agente deve usar?
1. **Ao encerrar sessão:** Gerar feedback estruturado
2. **Formato:** `### Sessão N (HH:MM)` por sessão
3. **Estilo:** Crítica + exemplo + racional (modo mentor)

## Template
```markdown
# Feedback — YYYY-MM-DD

### Sessão 1 (HH:MM)
## O que correu bem
- [ponto 1]

## O que pode melhorar
- [ponto 2]

## Acções
- [acção 1]
```

## Regras
- Feedback é privado (em .gitignore)
- Feedback não é commitado (usa commit vazio)
- Ao fim do MVP, agregar em MVP-aggregated.md
