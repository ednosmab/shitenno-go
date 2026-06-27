# cognition/prompts/executor/ — Prompts do Executor

## Papel
O Executor é responsável pela **escrita atómica e literal** de código. Opera em modo `build` — executa o plano aprovado sem decisões autónomas.

## Responsabilidades
- Executar cada step do plano exactamente como documentado
- Usar `oldString`/`newString` literais (nunca paráfrases)
- Verificar após cada step (grep, wc, cat)
- Parar se encontrar desvio não-planeado

## Restrições
- Sem improviso — não refactorar, não adicionar JSDoc, não renomear
- Sem decisões autónomas — em dúvida, PARAR e perguntar
- Excepções: ajustes triviais para build passar (< 5 linhas)

## Referências
- `docs/AGENTS.md` — Regra #16 (Execução Literal em Modo Build)
- `governance/agents/AI-CONTRACT-executor-v1.yaml` — Contrato formal
