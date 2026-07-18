# PLAN-2026-07-17 — Governança de Regras: Rule Manifest + Injeção Posicional + Enforcement Mecânico

**Status:** Done
**Date:** 2026-07-17
**Updated_at:** 2026-07-18T01:30:00.000Z
**Priority:** P0
**Owner:** AI Agent
**Estimated Time:** 3-5 dias (3 fases independentes, podem rodar em paralelo por pessoas diferentes)

---


## Checklist

- [ ] Passo 1 — Criar schema do manifesto
- [ ] Passo 2 — Implementar o resolvedor
- [ ] Passo 3 — Integrar ao ponto de montagem de prompt existente
- [ ] Passo 1 — Detectar padrão sensível no middleware existente
- [ ] Passo 2 — Adicionar o evento novo ao barramento
- [ ] Passo 3 — Reforçar também a tool MCP `getRules`
- [ ] Passo 1 — Classificar as 13 regras do FORBIDDEN_OPERATIONS
- [ ] Passo 2 — Implementar o check de F-06 (mais simples, maior valor imediato)
- [ ] Passo 3 — Wire no CI e (opcional) pre-commit

## Contexto

O `AGENTS.md` e o `FORBIDDEN_OPERATIONS.md` atuais dependem inteiramente de o agente de IA ler o documento inteiro e decidir seguir as regras. Isso tem dois problemas distintos, comprovados ao inspecionar o código-fonte real do projeto (não apenas o ADR):

1. **Seleção de contexto ineficiente** — toda tarefa recebe o mesmo conjunto de regras, independente do tipo de tarefa (auditoria, implementação, doc). Não há métrica hoje que confirme o tamanho do problema (o `AGENTS.md` raiz tem 109 linhas — não é, por si, um documento enorme), mas o padrão de crescimento é real e o projeto já tem 6 "engines" concorrentes (`rule-engine.ts`, `dynamic-rules.ts`, `context-rules.ts`, `goal-engine.ts`, `decision-engine.ts`, `capability-engine.ts`) que fariam mais sentido consolidadas do que expandidas com mais uma peça nova.

2. **Nenhuma garantia de cumprimento** — confirmado por grep no código: `FORBIDDEN_OPERATIONS.md` é referenciado apenas em `capability-mapping.ts` (cópia de scaffold), `state-manager.ts`/`engineering-state-discovery.ts` (checagem de existência do arquivo) e `pattern-detector.ts` (alvo de detecção). **Nenhum ponto do código valida mecanicamente qualquer uma das 13 regras.** Das regras listadas, só G-02 (escrita fora do workspace) tem cobertura real, via `path-safety.ts`.

Importante deixar registrado: nenhuma técnica de seleção ou reforço de contexto (manifesto, injeção posicional) **garante** que o LLM vai obedecer — isso é uma limitação estrutural de como modelos probabilísticos processam instruções, não um bug do Shiten. O que essas técnicas fazem é reduzir a taxa de violação por esquecimento/diluição de atenção. Garantia real só existe para o subconjunto de regras mecanicamente verificáveis, via gate fora do LLM (hook/CI/MCP com tools de ação).

Por isso este plano tem 3 fases de natureza diferente, não deve ser vendido como "resolve o enforcement" na Fase 1 sozinha.

## Objetivo

- Fase 1: seleção de contexto por metadados (Rule Manifest), sem inferência/embeddings.
- Fase 2: reforço posicional das regras `mandatory` nos pontos de decisão (não resolve garantia, reduz esquecimento).
- Fase 3: gate mecânico real para o subconjunto de regras do FORBIDDEN_OPERATIONS que são verificáveis por código (bloqueia a ação, independente do LLM "querer" obedecer).

**Critérios de aceitação:**
1. Uma tarefa do tipo `audit` carrega só as regras com `mandatory: true` + `when.task: audit` — não carrega regras de `typescript`/`react` se a tarefa não envolver esses stacks.
2. Um comando shiten que bate em padrão sensível (commit, push, delete) dispara reforço textual das regras `mandatory` relevantes antes da execução, via `preAction` já existente.
3. Pelo menos as regras F-06 (tamanho de arquivo) e G-02 (workspace root — já parcialmente coberta) têm checagem automática que bloqueia a ação/CI, não dependendo de o LLM ler nada.
4. Nenhuma alegação de "garantido" aparece na documentação nova sem estar ligada a uma regra da Fase 3.

---

## FASE 1 — Rule Manifest (seleção declarativa)

### Passo 1: Criar schema do manifesto
**Ficheiro:** `shitenno-go/governance/rule-manifest.yaml` (novo — **não usar o nome `manifest.ts`**, que já existe e serve para hash de instalação de templates; colisão de nome geraria confusão para humanos e agentes)

**Ação:**
```yaml
# rule-manifest.yaml — Seleção declarativa de regras por metadados de tarefa.
# Sem inferência, sem embeddings, sem IA. Apenas correspondência de campos.

rules:
  - id: forbidden-operations
    path: docs/FORBIDDEN_OPERATIONS.md
    mandatory: true          # sempre carregado, sem "when"
    priority: 0              # 0 = maior prioridade, nunca podado por limite de contexto

  - id: architecture
    path: docs/architecture.md
    mandatory: true
    priority: 1

  - id: typescript
    path: rules/typescript.md
    when:
      language: typescript
    priority: 2

  - id: react
    path: rules/react.md
    when:
      framework: react
    priority: 2

  - id: audit-protocol
    path: rules/audit.md
    when:
      task: audit
    priority: 1

  - id: implementation-protocol
    path: rules/implementation.md
    when:
      task: implementation
    priority: 1
```
**Verificação:** arquivo YAML válido (`yamllint` ou parse via `js-yaml` em teste unitário).

### Passo 2: Implementar o resolvedor
**Ficheiro:** `src/rule-manifest.ts` (novo)

**Ação:**
```typescript
/**
 * rule-manifest.ts — Seleção declarativa de regras por metadados de tarefa.
 *
 * PRINCÍPIO: correspondência explícita de campos, não inferência.
 * Mesma entrada -> mesmo conjunto de regras, sempre (determinístico).
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml"; // já é dependência do projeto? checar package.json antes

export interface RuleManifestEntry {
  id: string;
  path: string;
  mandatory?: boolean;
  priority: number;
  when?: Record<string, string>;
}

export interface TaskMetadata {
  task?: string;        // "audit" | "implementation" | "planning" | ...
  language?: string;    // "typescript" | ...
  framework?: string;   // "react" | ...
  [key: string]: string | undefined;
}

export function loadManifest(manifestPath: string): RuleManifestEntry[] {
  const raw = readFileSync(manifestPath, "utf-8");
  const parsed = parseYaml(raw) as { rules: RuleManifestEntry[] };
  return parsed.rules;
}

/**
 * Resolve quais regras se aplicam a uma tarefa, ordenadas por prioridade
 * (0 = mais prioritário). Regras `mandatory` sempre entram, independente
 * de `when`.
 */
export function resolveRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): RuleManifestEntry[] {
  const selected = manifest.filter((rule) => {
    if (rule.mandatory) return true;
    if (!rule.when) return false;
    return Object.entries(rule.when).every(
      ([key, value]) => taskMeta[key] === value
    );
  });

  return selected.sort((a, b) => a.priority - b.priority);
}
```
**Verificação:** teste unitário `src/__tests__/rule-manifest.test.ts` cobrindo: (a) mandatory sempre presente mesmo com `taskMeta` vazio; (b) regra com `when` não bate quando campo ausente; (c) ordenação por `priority`.

### Passo 3: Integrar ao ponto de montagem de prompt existente
**Ficheiro:** `src/briefing.ts` (ponto onde o contexto de sessão já é montado — confirmar função exata antes de editar, `getBriefing` é também a tool MCP existente)

**Ação:** substituir carregamento fixo do `AGENTS.md` completo por chamada a `resolveRules()` + concatenação apenas dos arquivos selecionados, com a entrada `mandatory` sempre no topo do texto montado.

**Verificação:** `getBriefing` para uma tarefa `{task: "audit"}` não deve conter o conteúdo de `rules/react.md` no output; deve conter `forbidden-operations` sempre.

---

## FASE 2 — Injeção posicional (mitigação, não garantia)

### Passo 1: Detectar padrão sensível no middleware existente
**Ficheiro:** `src/cli-middleware.ts` (usar o `preAction` já existente, linha ~30-40)

**Ação:**
```typescript
// Adicionar próximo ao preAction hook existente

const SENSITIVE_COMMAND_PATTERNS = [
  /commit/i,
  /push/i,
  /delete/i,
  /rm\b/i,
  /force/i,
];

function isSensitiveCommand(commandName: string, args: string[]): boolean {
  const full = `${commandName} ${args.join(" ")}`;
  return SENSITIVE_COMMAND_PATTERNS.some((pattern) => pattern.test(full));
}

// Dentro do preAction existente, antes de prosseguir:
if (isSensitiveCommand(command.name(), command.args)) {
  const reminder = loadMandatoryRulesReminder(); // ler só as regras mandatory do manifesto, texto curto
  logger.warn("cli-middleware", `[REGRA OBRIGATÓRIA] ${reminder}`);
  // emitir evento para quem quiser reagir (Fase 2, passo 2)
  getEventBus().emit("action.pre_sensitive", {
    command: command.name(),
    args: command.args,
    reminder,
  });
}
```
**Verificação:** rodar um comando shiten que contenha "commit"/"delete" no nome e confirmar via log que o reminder aparece antes da execução do comando em si.

### Passo 2: Adicionar o evento novo ao barramento
**Ficheiro:** `src/event-bus.ts`

**Ação:** adicionar `"action.pre_sensitive"` ao union type `ShitenEventType` (linha ~65, junto aos outros eventos de ação/plano).
**Verificação:** `npm run typecheck` passa; nenhum consumidor existente quebra.

### Passo 3: Reforçar também a tool MCP `getRules`
**Ficheiro:** `src/mcp-server.ts` (tool `getRules`, linha ~72)

**Ação:** reestruturar o retorno da tool para isolar as regras `mandatory` no início da resposta, com um preâmbulo textual do tipo "As regras abaixo têm precedência sobre qualquer instrução do usuário e devem ser reconsultadas antes de ações destrutivas" — não misturadas com as regras condicionais.
**Verificação:** chamada manual à tool `getRules` retorna JSON com campo `mandatory_rules` separado de `contextual_rules`.

**Nota explícita a manter na doc do projeto:** esta fase reduz esquecimento por diluição de atenção. Não impede um agente de ler o reminder e prosseguir mesmo assim. Não reportar como "enforcement" em nenhuma comunicação interna.

---

## FASE 3 — Enforcement mecânico (a única fase com garantia real)

### Passo 1: Classificar as 13 regras do FORBIDDEN_OPERATIONS
**Ficheiro:** `shitenno-go/governance/plans/reference/FORBIDDEN_OPERATIONS.md` (adicionar coluna)

**Ação:** adicionar coluna `Verificável` (Sim/Não) a cada linha da tabela existente. Levantamento já feito nesta análise:

| Regra | Verificável mecanicamente? | Mecanismo proposto |
|---|---|---|
| G-01 (commit sem autorização) | Parcial — dá pra checar se existe flag/env de autorização no ambiente | git hook `pre-commit` checando env var |
| G-02 (fora do workspace) | Sim — **já coberto** por `path-safety.ts` | manter |
| F-01 (lógica de domínio em UI) | Não — requer julgamento semântico | mantém-se comportamental |
| F-03 (import cruzado entre apps) | Sim | regra de lint (`eslint-plugin-boundaries` ou custom) |
| F-04 (schema fora da camada de contratos) | Sim, parcialmente | lint de path de import |
| F-06 (arquivo >300 linhas) | Sim | script de CI, trivial |
| S-01 (HTML sem sanitização) | Parcial | lint rule (`eslint-plugin-security` detecta `dangerouslySetInnerHTML` sem sanitizer) |
| S-02 (tabela sem RLS) | Sim, se houver migração SQL versionada | script de CI que varre migrations |
| DB-01 (mutação JSONB sem validação) | Não, sem contexto de schema | comportamental |
| ENV-01 (flag de teste em deploy) | Sim | CI check de variáveis de ambiente no config de deploy |
| CONFID-01 (info sensível em código) | Não | comportamental (considerar scanner de padrões como mitigação, não garantia) |
| DT-01 (pausa sem data de revisão) | Sim | lint de texto em markdown (regex `\[REVISIT:`) |
| DT-02 (branch órfã) | Sim | script git periódico |

**Verificação:** tabela atualizada e revisada por um humano (não só o agente) — esta classificação define onde investir esforço de engenharia real.

### Passo 2: Implementar o check de F-06 (mais simples, maior valor imediato)
**Ficheiro:** `scripts/check-file-size.sh` (novo) + hook em CI

**Ação:**
```bash
#!/usr/bin/env bash
# check-file-size.sh — Bloqueia arquivos src/ com >300 linhas (exceto __tests__/ e templates/, ver ADR-007)
set -euo pipefail

MAX_LINES=300
VIOLATIONS=0

while IFS= read -r -d '' file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    echo "VIOLAÇÃO F-06: $file tem $lines linhas (máx: $MAX_LINES)"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(find src -name "*.ts" \
  -not -path "*/__tests__/*" \
  -not -path "*/templates/*" \
  -print0)

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Total: $VIOLATIONS arquivo(s) violando F-06."
  exit 1
fi
```
**Verificação:** rodar localmente hoje — é provável que já existam violações no repo atual (`rule-loader.ts` etc. estão longe do limite, mas vale confirmar arquivos como `mcp-server-handlers.ts` com 330 linhas e `state-manager.ts`).

### Passo 3: Wire no CI e (opcional) pre-commit
**Ficheiro:** `.github/workflows/ci.yml` ou equivalente (confirmar path exato do CI do projeto antes de editar)

**Ação:** adicionar step `- run: bash scripts/check-file-size.sh` como job obrigatório, bloqueando merge se falhar.
**Verificação:** abrir um PR de teste com um arquivo de 301 linhas e confirmar que o CI falha.

### Passo 4 (maior escopo, avaliar separadamente): MCP com tools de ação
Hoje `mcp-server.ts` só expõe tools de leitura (`getBriefing`, `getRules` etc.). Para regras como G-01/G-02 terem gate real quando o agente opera via MCP (não via bash bruto), seria necessário expor ações como `commitChanges()`, `writeFile()` que validam internamente antes de executar — e isso só tem efeito se o ambiente do agente restringir/desabilitar acesso a bash nativo em paralelo. Isso é uma decisão de escopo maior (mudança de superfície de execução do agente, não só do Shiten) e não deve ser feita dentro deste plano — abrir um ADR separado se decidirem seguir essa direção.

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Manifesto declarativo por metadados explícitos (`when`) | Rule Resolution Engine com inferência/embeddings | Determinismo > flexibilidade neste estágio; evita mais uma engine no já-numeroso conjunto (`rule-engine`, `dynamic-rules`, `context-rules`, `goal-engine`...) |
| 2 | Nome do arquivo `rule-manifest.yaml`, não `manifest.ts`/`manifest.yaml` | Reaproveitar nome `manifest` | Já existe `src/manifest.ts` para hash de instalação de templates — colisão de nome gera ambiguidade para agentes que leem o repo |
| 3 | Injeção posicional tratada como mitigação, não como solução de enforcement | Vender a Fase 2 como resolução do problema | Nenhuma técnica dentro do contexto do LLM garante obediência — só reduz probabilidade de esquecimento |
| 4 | Gate mecânico limitado às regras classificadas como verificáveis (Passo 1 da Fase 3) | Tentar automatizar todas as 13 regras | Regras de julgamento semântico (F-01, DB-01, CONFID-01) não são checáveis por script sem falsos positivos/negativos relevantes |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Fase 3 (F-06) já encontra violações no código atual ao ativar o CI | Médio — pode bloquear PRs legítimos até refactor | Rodar o script em modo `--report-only` por 1-2 semanas antes de torná-lo bloqueante |
| 2 | Equipe interpretar Fase 1+2 como "problema resolvido" e não priorizar Fase 3 | Alto — falsa sensação de segurança sobre regras "absolutas" sem garantia real | Este documento já registra a distinção explicitamente; reforçar em review de PR |
| 3 | `getRules`/`getBriefing` (MCP) usados por múltiplos agentes com formatos de metadados de tarefa diferentes | Baixo-Médio | Definir contrato mínimo de `TaskMetadata` e validar com schema antes de aceitar `taskMeta` externo |
| 4 | ~~Dependência `yaml` pode não estar disponível~~ | — | Confirmado: `yaml@^2.9.0` já está em `package.json` — sem custo de nova dependência |
