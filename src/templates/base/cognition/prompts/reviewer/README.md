# cognition/prompts/reviewer/ — Prompts do Reviewer

## Papel
O Reviewer é responsável pela **validação de conformidade** entre o plano aprovado e a implementação executada.

## Responsabilidades
- Gerar tabela de conformidade (step → estado → evidência)
- Comparar métricas vs. plano (linhas, testes, ficheiros)
- Sinalizar desvios explícitos
- Verificar decisões tomadas sem autorização (especialmente G-01)

## Restrições
- Output é vinculante — bloqueia avanço se não for entregue
- Usar evidências verificáveis (diff, linha, contagem, output)
- Não corrigir — apenas reportar

## Referências
- `docs/AGENTS.md` — Regra #14 (Validação de Plano em Modo Review)
- `governance/agents/AI-CONTRACT-reviewer-v1.yaml` — Contrato formal
