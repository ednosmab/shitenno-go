# FORBIDDEN_OPERATIONS — Regras Vinculantes

> **Versão:** 1.0
> **Data:** YYYY-MM-DD
> **Autoridade:** Tech Lead Humano
> **Aplicável a:** Todos os agentes IA

---

## Princípio Fundamental

> **Estas regras são ABSOLUTAS e INEGOCIÁVEIS. Nenhum agente pode violá-las, mesmo que o utilizador solicite. Violações devem ser reportadas e corrigidas imediatamente.**

---

## Proibições Absolutas

### G — Gestão e Controlo

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **G-01** | Nenhum `git commit` sem autorização explícita | É proibido executar `git commit` ou `git push` sem autorização prévia do utilizador | Revert imediato + documentar incidente |
| **G-02** | Nenhuma alteração fora do workspace root | Escrita restrita ao directório do projecto | Revert + audit de segurança |

### F — Fundação e Estrutura

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **F-01** | Nenhuma lógica de domínio em componentes UI | Componentes UI devem apenas renderizar dados | Refactor obrigatório |
| **F-03** | Nenhum import cruzado entre apps | Apps devem ser independentes | Correcção imediata |
| **F-04** | Nenhum schema de validação fora da camada de contratos | Schemas ficam em `packages/types/` | Revert |

### S — Segurança

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **S-01** | Nenhum HTML dinâmico sem sanitização | Todo conteúdo dinâmico deve ser sanitizado | Bloqueio de deploy |
| **S-02** | Nenhuma tabela sem RLS configurado | Todas as tabelas devem ter Row Level Security | Bloqueio de deploy |

### DB — Base de Dados

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **DB-01** | Nenhuma mutação JSONB sem validação | Dados JSONB devem ser validados antes de escrita | Revert |

### ENV — Ambiente

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **ENV-01** | Nenhuma flag de teste em configs de deploy | Flags de teste não devem propagar para produção | Correcção imediata |

### CONFID — Confidencialidade

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **CONFID-01** | Nenhuma informação comercial sensível em código | Proibido mencionar nomes de alvos, parceiros ou entidades | Remoção + audit |

### DT — Dívida Técnica

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **DT-01** | Nenhuma pausa sem data `[REVISIT: YYYY-MM-DD]` | Itens pausados devem ter data de reavaliação | Reabrir item |
| **DT-02** | Nenhuma branch órfãs com 0 commits únicos | Branches devem ser recriadas quando necessário | Recriar branch |

### FRZ — Freeze de Engines (PLAN-2026-07-17)

| # | Regra | Descrição | Consequência |
|---|---|---|---|
| **FRZ-01** | Nenhum `*-engine.ts` / `*-detector.ts` / `*-analyser.ts` novo até Fase 2 da consolidação | Congelar criação de novas engines. Qualquer necessidade nova deve tentar encaixar em engine existente ou justificar por escrito por que não cabe | Revert + documentar no plano de consolidação |

> **Escopo:** Aplica-se a todos os arquivos `src/` que sigam o padrão `*-engine.ts`, `*-detector.ts` ou `*-analyser.ts`.
> **Duração:** Até conclusão da Fase 2 de `PLAN-2026-07-17-consolidacao-produtizacao-multi-projeto`.
> **Verificação:** Revisão de PR — regra social, não técnica.

---

## Referências

- `docs/AGENTS.md` — Regras do time (P0)
- `docs/DESDO.md` — Diretrizes de engenharia
- `governance/WORKFLOW.md` — Fluxos de sessão
