# DESDO — Diretrizes de Engenharia

> **Versão:** 1.0
> **Data:** YYYY-MM-DD
> **Aplicável a:** Todos os agentes IA e developers

---

## Princípio Fundamental

> **Código deve ser declarativo, simples e fácil de ler. Evitar optimizações prematuras ou sintaxes excessivamente complexas. Prefirir legibilidade à concisão.**

---

## 1. Princípios SOLID

- **S** — Single Responsibility: cada função/classe com um motivo para mudar
- **O** — Open/Closed: aberto para extensão, fechado para modificação
- **L** — Liskov Substitution: subclasses substituíveis sem quebrar
- **I** — Interface Segregation: interfaces pequenas e específicas
- **D** — Dependency Inversion: depender de abstrações, não implementações

## 2. TDD — Test-Driven Development

### Ciclo Red-Green-Refactor
1. **RED** — Escrever teste que falha
2. **GREEN** — Implementar mínimo para passar
3. **REFACTOR** — Limpar sem mudar comportamento

### Pirâmide de Testes
- **Unitários** — Muitos, rápidos, lógica de negócio
- **Integração** — Médios, fluxos entre serviços
- **E2E** — Poucos, lentos, críticos

## 3. Segurança

1. Sanitizar todo input dinâmico
2. Usar componentes seguros (nunca `dangerouslySetInnerHTML` sem sanitização)
3. Validar todos os dados na entrada (Zod, Yup, etc.)
4. RLS em todas as tabelas
5. Sanitizar output (prevenir XSS)

## 4. Documentação

- **JSDoc** obrigatório em todas as funções exportadas
- **ADRs** para decisões arquitecturais (`docs/adrs/`)
- **SDRs** para decisões de solução (`docs/sdr/`)

## 5. Performance

- Não optimizar prematuramente
- Medir primeiro com ferramentas de profiling
- Definir métricas antes de optimizar

## 6. Git e Branches

### Conventional Commits
```
feat: add new feature
fix: correct bug
docs: update documentation
refactor: code restructuring
test: adding missing tests
chore: maintenance tasks
```

---

## Referências

- `docs/AGENTS.md` — Regras do time
- `docs/FORBIDDEN_OPERATIONS.md` — Regras vinculantes
- `docs/skills/senior-engineer.md` — Postura operacional
