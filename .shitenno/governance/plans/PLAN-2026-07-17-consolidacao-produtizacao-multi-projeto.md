# PLAN-2026-07-17 — Consolidação Arquitetural para Produtização Multi-Projeto

**Status:** Pending
**Date:** 2026-07-17
**Updated_at:** 2026-07-17T00:00:00.000Z
**Priority:** P0
**Owner:** AI Agent
**Estimated Time:** 3-4 semanas (bloqueante para qualquer adoção externa)

---


## Checklist

- [ ] Passo 1 — Congelar criação de novas engines
- [ ] Passo 1 — Matriz de responsabilidade
- [ ] Passo 2 — Validar decisões com uso real
- [ ] Passo 1 — Fundir `policy-engine` em `rule-engine`
- [ ] Passo 2 — Escolher `markdown-plan-engine` como canônico
- [ ] Passo 3 — Consolidar `goal/decision/recommendation/proactive` em um módulo
- [ ] Passo 4 — Consolidar `engineering-state`
- [ ] Passo 1 — Documento de API pública
- [ ] Passo 2 — Versionamento semântico da superfície pública
- [ ] Passo 1 — Rodar em 2 repositórios reais diferentes do original
- [ ] Passo 2 — Atualizar README

## Contexto

O objetivo declarado mudou: o Shiten deixa de ser uma ferramenta de uso solo e passa a ser oferecido para governar **outros projetos**. Isso muda o critério de avaliação. Não basta "funcionar para mim" — precisa ser compreensível, estável e auditável por gente de fora, incluindo agentes de IA que nunca viram este código antes.

Hoje isso não é verdade. Levantamento confirmado no código:

- **293 arquivos, ~56.600 linhas em `src/`**, para uma ferramenta cujo próprio README diz: *"built and validated for solo use. Team usage has not been tested with real users yet."*
- **26 arquivos com "engine/detector/analyser" no nome** só no nível raiz de `src/`.
- **Duplicação confirmada, não hipotética:**
  - `rule-engine.ts` e `policy-engine.ts` — mesma forma (condition → action, declarativo, JSON), vocabulário diferente. 2 implementações do mesmo mecanismo.
  - `plan-engine.ts` (planos JSON, rollback, idempotência) e `markdown-plan-engine.ts` (planos markdown, status andamento/parado/done) — 2 implementações completas do conceito "plano", com storages incompatíveis entre si.
  - `goal-engine.ts`, `decision-engine.ts`, `recommendation-engine.ts`, `proactive-engine.ts` — todos giram em torno de "qual a próxima ação certa", cada um com sua própria persistência e API pública, sem uma camada compartilhada de priorização.
  - `engineering-state.ts` fragmentado em **8 arquivos** (`-access`, `-discovery`, `-evolved`, `-history`, `-io`, `-mutations`, `-subscription`) — 1.571 linhas para um único conceito de domínio.
- **Cada engine tem cobertura de teste isolada** (1 arquivo de teste por engine, na média) — não há teste de que `rule-engine` e `policy-engine` produzem resultado consistente entre si, porque formalmente ninguém decidiu que deveriam.
- **Ritmo de churn alto**: 11 planos concluídos em um único dia (16/07), 48 checkpoints de contexto em ~5h no dia seguinte — mais compatível com ciclo de "construir → descobrir que não resolveu → construir de novo" do que com maturação de arquitetura.

O risco de produtizar sem consolidar: qualquer projeto externo que adote o Shiten herda essa fragmentação como API pública. Depois que outros projetos dependerem de `rule-engine` e `policy-engine` como coisas separadas, consolidar vira breaking change em produção, não refactor interno. **A janela para consolidar é agora, antes do primeiro adotante externo — depois fica extremamente mais caro.**

## Objetivo

Reduzir a superfície do sistema ao mínimo necessário, com uma API pública estável e documentada, validada em pelo menos 2 projetos reais além do original, antes de qualquer divulgação como "pronto para outros projetos".

**Critérios de aceitação:**
1. Nenhum par de engines com sobreposição funcional não-documentada (cada engine remanescente tem uma responsabilidade que nenhuma outra cobre).
2. `engineering-state` consolidado em no máximo 3 arquivos (core, io/persistência, subscription/eventos) — não 8.
3. Existe um documento único (`docs/PUBLIC_API.md` ou equivalente) listando o que é superfície pública estável (schemas, comandos CLI, tools MCP) vs. o que é interno e pode mudar sem aviso.
4. README deixa de dizer "não testado em equipe" — só depois de rodar em 2 repositórios reais diferentes do original.

---

## FASE 0 — Moratória (imediata, custo zero)

### Passo 1: Congelar criação de novas engines
**Ação:** nenhuma nova entidade `*-engine.ts` / `*-detector.ts` / `*-analyser.ts` é criada até o fim da Fase 2. Qualquer necessidade nova deve primeiro tentar encaixar em uma engine existente ou justificar por escrito por que não cabe.
**Verificação:** revisão de PR — regra social, não técnica, mas precisa ser dita explicitamente porque o padrão observado é "resolver problema novo criando engine nova".

---

## FASE 1 — Auditoria de Consolidação (1 semana)

### Passo 1: Matriz de responsabilidade
**Ficheiro:** `docs/architecture/engine-consolidation-audit.md` (novo)

**Ação:** para cada uma das 26 engines, preencher:

| Engine | Responsabilidade real (1 frase) | Sobreposição com | Decisão |
|---|---|---|---|
| rule-engine | Executa ações quando condições batem, via trigger declarativo | policy-engine (idêntico) | **Fundir** |
| policy-engine | Executa ações quando condições batem, modo enforce/advisory | rule-engine | **Fundir** — absorver "modo enforce/advisory" como campo do rule-engine |
| plan-engine | Planos JSON com rollback/idempotência | markdown-plan-engine (mesmo conceito, storage diferente) | **Escolher um storage canônico** |
| markdown-plan-engine | Planos markdown, usado pelos planos reais do `governance/plans/` (evidência: é o formato usado neste próprio repositório) | plan-engine | **Manter como canônico** (é o que está em uso real); plan-engine vira adapter ou é descontinuado |
| goal-engine / decision-engine / recommendation-engine / proactive-engine | Priorização de próxima ação, cada um com fatia própria | entre si | **Consolidar em um módulo `prioritization/` com submódulos internos**, não 4 arquivos top-level |
| engineering-state (8 arquivos) | Estado do projeto | entre si | **Consolidar em 3**: `engineering-state/core.ts`, `engineering-state/io.ts`, `engineering-state/events.ts` |

*(preencher as 26 linhas completas — a tabela acima é o padrão a seguir, com as 4 fusões já identificadas com evidência de código)*

**Verificação:** cada linha da tabela tem uma decisão (Fundir / Manter / Descontinuar), não fica em aberto.

### Passo 2: Validar decisões com uso real
**Ação:** para "plan-engine vs markdown-plan-engine", grep de qual é efetivamente referenciado pelos comandos CLI reais (`shiten plan`, `shiten status` etc.) — não assumir por leitura do código isolado, confirmar qual caminho o usuário de fato aciona.
**Verificação:** relatório curto anexado à Fase 1 dizendo, por par duplicado, qual é o caminho quente (usado) e qual é órfão.

---

## FASE 2 — Fusão dos pares confirmados (1-2 semanas)

### Passo 1: Fundir `policy-engine` em `rule-engine`
**Ficheiros:** `src/rule-engine/*`, `src/policy-engine.ts`

**Ação:**
```typescript
// src/rule-engine/domain/rules/rule.ts — adicionar campo existente do policy-engine
export interface Rule {
  id: string;
  description: string;
  trigger: TriggerType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  dependencies: string[];
  enabled: boolean;
  tags: string[];
  mode?: "enforce" | "advisory"; // <- absorvido do policy-engine, default "enforce"
}
```
Migrar todo consumidor de `policy-engine.ts` para `rule-engine` com `mode: "advisory"` onde aplicável. Deprecar `policy-engine.ts` com re-export temporário (`export * from "./rule-engine.js"`) por 1 versão, depois remover.

**Verificação:** `grep -rl "policy-engine" src/` retorna zero após a migração, exceto o próprio arquivo de deprecação temporária. Testes de `rule-engine` cobrem os casos que hoje só `policy-engine` cobre (modo advisory não bloqueando ação).

### Passo 2: Escolher `markdown-plan-engine` como canônico
**Ação:** confirmar via Passo 2 da Fase 1 que é o caminho quente (evidência preliminar: todos os planos reais neste repositório, incluindo os dois que geramos nesta conversa, são markdown, não JSON). Migrar qualquer consumidor de `plan-engine.ts` para a API do `markdown-plan-engine`. Descontinuar `plan-engine.ts` — ou, se houver funcionalidade real de rollback/idempotência que o markdown não cobre e for necessária, portar essa funcionalidade específica para dentro do `markdown-plan-engine`, não manter dois sistemas de plano.

**Verificação:** um único ponto de entrada para "criar/consultar/fechar plano" no código.

### Passo 3: Consolidar `goal/decision/recommendation/proactive` em um módulo
**Ficheiro:** `src/prioritization/` (novo diretório, substitui os 4 arquivos top-level)

**Ação:** estrutura proposta:
```
src/prioritization/
  goals.ts          # ex-goal-engine: persistência de metas
  evaluators.ts      # ex-decision-engine: scoring por dimensão
  recommend.ts        # ex-recommendation-engine: "próxima melhor ação"
  triggers.ts          # ex-proactive-engine: reage a eventos do event-bus
  index.ts              # API pública única do módulo
```
Cada arquivo interno pode importar dos outros livremente (estão no mesmo módulo); só `index.ts` é exposto para o resto do sistema.

**Verificação:** nenhum arquivo fora de `src/prioritization/` importa diretamente `goals.ts`/`evaluators.ts`/etc. — só `index.ts`.

### Passo 4: Consolidar `engineering-state`
**Ficheiro:** `src/engineering-state/` (novo diretório)

**Ação:** mesma lógica do Passo 3 — `core.ts` (o que hoje é `engineering-state.ts` + `-evolved`), `io.ts` (`-io` + `-discovery`), `events.ts` (`-subscription` + `-history`), `access.ts` só se `-access` (98 linhas) tiver responsabilidade genuinamente distinta após revisão — senão dobra em `core.ts`.
**Verificação:** de 8 arquivos para no máximo 3-4, com `index.ts` como única porta de entrada externa.

---

## FASE 3 — Definir a superfície pública (1 semana)

### Passo 1: Documento de API pública
**Ficheiro:** `docs/PUBLIC_API.md` (novo)

**Ação:** listar explicitamente:
- Comandos CLI estáveis (com garantia de compatibilidade semântica)
- Tools MCP estáveis (`getBriefing`, `getRules`, etc. — já existentes)
- Schema do `rule-manifest.yaml` (da Fase 1 do plano anterior) como contrato versionado
- Tudo que **não** está nessa lista é considerado interno e pode mudar sem aviso — isso inclui a maioria das 26 engines atuais, que não deveriam ser importadas diretamente por integrações externas.

**Verificação:** revisão humana confirmando que a lista é mínima — cada item incluído tem justificativa de por que precisa ser público.

### Passo 2: Versionamento semântico da superfície pública
**Ação:** adotar `semver` real para o pacote npm, com changelog focado em mudanças da superfície listada no Passo 1 — não em mudanças internas de engines consolidadas (essas não quebram nada para o consumidor externo, por definição, se a Fase 2 foi feita corretamente).
**Verificação:** `CHANGELOG.md` distingue "Breaking (API pública)" de "Internal refactor".

---

## FASE 4 — Validação multi-projeto (1-2 semanas, não pode ser pulada)

### Passo 1: Rodar em 2 repositórios reais diferentes do original
**Ação:** instalar e usar o Shiten em pelo menos 2 projetos com stack/domínio diferentes do original (idealmente um menor e mais simples, um maior). Registrar fricções reais — não hipotéticas.
**Verificação:** relatório com problemas encontrados, indexado por severidade.

### Passo 2: Atualizar README
**Ação:** só depois do Passo 1 concluído, remover a ressalva "team usage has not been tested" e substituir por dados reais (quantos projetos, que tipo de fricção, o que ainda é limitação conhecida).
**Verificação:** a alegação no README é rastreável a evidência real, não aspiracional.

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Consolidação vem antes de qualquer trabalho de "eficiência de contexto" (manifesto, injeção posicional) | Seguir direto para o Rule Manifest do plano anterior | Produtizar uma API pública fragmentada é dívida que se paga em breaking changes depois de haver adotantes externos — muito mais caro que consolidar agora |
| 2 | `markdown-plan-engine` como canônico, não `plan-engine` | Manter os dois / escolher o JSON por ter rollback | Evidência de uso real (os próprios planos deste repositório, incluindo os gerados nesta conversa) já usa markdown — descartar o caminho que não está em uso reduz superfície sem perder funcionalidade em produção |
| 3 | Engines internas viram submódulos de diretórios temáticos (`prioritization/`, `engineering-state/`) em vez de arquivos top-level | Manter estrutura plana atual | Reduz o número de conceitos que um agente (interno ou de outro projeto integrando) precisa segurar na cabeça de uma vez — ataca o mesmo problema de "seleção de contexto" do ADR original, só que na arquitetura em vez do prompt |
| 4 | Validação em 2 projetos reais é bloqueante antes de anunciar "pronto para outros projetos" | Divulgar já com base na auditoria de código | Auditoria estática não substitui fricção real de outro time/projeto usando a ferramenta — é exatamente o gap que o próprio README já admite |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Fundir `rule-engine`/`policy-engine` quebra consumidores internos não mapeados | Alto | `grep -rl` exaustivo antes de remover; manter re-export de deprecação por 1 ciclo |
| 2 | Descontinuar `plan-engine.ts` remove funcionalidade real (rollback/idempotência) que alguém depende | Médio | Passo 2 da Fase 2 exige portar a funcionalidade antes de remover, não só apagar |
| 3 | Fase 4 (validação externa) revela que a arquitetura consolidada ainda não serve para stacks diferentes | Médio | É o resultado esperado de uma validação real — tratar como insumo para nova iteração da Fase 1-2, não como falha do plano |
| 4 | Pressão para "lançar logo" pular a Fase 4 | Alto — reincide no mesmo problema que motivou este plano | Deixar explícito que README só muda com evidência da Fase 4, não antes |
