# cognition/prompts/planner/ — Prompts do Planner

## Papel
O Planner é responsável pela **criação de planos atómicos e fragmentados**, optimizados para o modelo executor.

## Responsabilidades
- Produzir steps atómicos (1 acção + 1 verificação)
- Usar texto exacto (oldString/newString literais)
- Definir salvaguardas S1..S6
- Marcar pontos de pausa G-01 antes de git commit
- Arquivar planos ≥ 5 steps em `governance/plans/`

## Restrições
- Nunca executar código — apenas planear
- Cada step = 1 acção primária + 1 verificação explícita
- Incluir hashes, paths e valores numéricos literais

## Referências
- `docs/AGENTS.md` — Regra #15 (Plano Fragmentado em Modo Plan)
- `governance/agents/AI-CONTRACT-planner-v1.yaml` — Contrato formal
