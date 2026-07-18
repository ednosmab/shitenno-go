# Plano Complementar — Achados da Revisão Manual (fora do plano original)

**Status:** Done
**Updated_at:** 2026-07-17T07:40:00.000Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Origem:** revisão de código linha a linha do `PLAN-2026-07-16-security-findings-remediation.md` e do `AUDIT-2026-07-16-end-to-end-execution-report.md`, contra o código real em `shitenno-go-feat-audit.zip`. Sem `npm install` (rede indisponível neste ambiente) — toda verificação foi leitura de código + testes empíricos com Node puro, sem dependências.

**Não repete nada do plano original.** Ele já cobre corretamente os Achados 0, 0.1 e a Fase 5 (dep_confusion) — confirmei os três lendo o código-fonte e não há nada a acrescentar ali. Este plano cobre quatro itens que ficaram de fora: um fechamento, um risco de colisão de arquitetura, um bug novo e mais grave que os já catalogados, e um item de backlog.

---

## Achado A (fechamento): `feedback.ts:109` não é mais "prioridade de investigação"

O plano original deixou este item em aberto: *"não consegui confirmar em tempo hábil se `feedback.date` [...] é sempre derivado do sistema (seguro) ou pode ser influenciado por dado de sessão/usuário"*.

Rastreei a cadeia completa: `feedback.date` vem de `generatePersonalizedFeedback()` → `engine/feedback/generator.ts:14-15`, que deriva de `record.timestamp` → `session-feedback.ts:118`:

```typescript
timestamp: new Date().toISOString(),
```

Gerado no servidor no momento da gravação, sem nenhum caminho de CLI (`--outcome`, `--notes`, `--areas` etc.) que o alcance. **Falso positivo confirmado, mesmo padrão do Achado 0.1.**

**Ação:** nenhuma mudança em `feedback.ts`. Só fechar o item na lista de triagem.

**Ressalva de defesa em profundidade (opcional, baixa prioridade):** se o arquivo de registros de feedback for editado ou corrompido manualmente, um `timestamp`/`date` malicioso poderia, em teoria, virar path traversal via `join(feedbackDir, `${feedback.date}.md`)`. Isso só se resolve como efeito colateral da Fase 3 do plano original (`safeJsonParse` com validação de shape) quando ela for estendida aos leitores de `session-feedback.ts` — não precisa de trabalho dedicado.

---

## Achado B (crítico para a Fase 3 do plano original): não criar `src/safe-json.ts` do zero — já existem dois módulos órfãos que fazem quase isso

A Fase 3 do plano propõe um arquivo novo `src/safe-json.ts` exportando `safeJsonParse`. **Isso colide com infraestrutura que já existe e está morta:**

| Arquivo | Uso real no projeto | O que já tem |
|---|---|---|
| `src/validation.ts` | 1 de 13 exports usado (`escapeRegex`, em 2 arquivos) | `safeJsonParse`, `safeJsonParseFile`, `validateRequiredFields`, `sanitizeForYaml`, `isSafeFieldName`, `sanitizeIdentifier` |
| `src/shared/validation.ts` | **0 imports em todo o projeto** | Cópia quase idêntica do acima |

O próprio `orphaned-modules.test.ts` (Fase E) já rastreia esse padrão no projeto (`doc-engine.ts`, `advanced-infrastructure.ts` etc.) — só não inclui `src/shared/validation.ts`, que é o caso mais grave: zero uso, não zero uso *parcial*.

Criar um terceiro `safeJsonParse` com assinatura diferente (`(raw, schema, context) => T | null`) ao lado de dois que já existem (`(raw, fallback) => T`) é exatamente o tipo de duplicação que os detectores `unused_export` (409 achados) e `srp_violation` (38 achados) já estão sinalizando no projeto. Consolidar agora evita adicionar um quarto candidato à mesma lista.

### Ação recomendada — substitui a proposta de arquivo novo da Fase 3

1. **Escolher `src/validation.ts` como base** (já tem 1 export vivo, então já está no grafo de import — menor atrito para ativar o resto).
2. Estender sua `safeJsonParse` existente para aceitar validação de shape, mantendo compatibilidade com o único uso atual:

```typescript
// src/validation.ts — estender, não substituir

/**
 * Safe JSON.parse com fallback simples (comportamento existente, mantido
 * para não quebrar o único call site já ativo).
 */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Nova variante para os pontos de alta sensibilidade da Fase 3 do plano
 * original (action-engine.ts, engineering-detectors-supply.ts): loga o
 * motivo da falha e valida a forma do dado, em vez de mascarar em silêncio.
 */
export function safeJsonParseValidated<T>(
  raw: string,
  validate: (v: unknown) => v is T,
  context: string,
): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("validation", `Failed to parse JSON in ${context}`);
    return null;
  }
  if (!validate(parsed)) {
    logger.warn("validation", `Shape validation failed in ${context}`);
    return null;
  }
  return parsed;
}
```

3. **Deletar `src/shared/validation.ts`** (código morto confirmado, zero imports) em vez de mantê-lo como um segundo lugar onde alguém pode "achar" um `safeJsonParse` diferente.
4. Aplicar `safeJsonParseValidated` nos mesmos pontos que a Fase 3 original já priorizou (`action-engine.ts:204,228`, os 4 pontos de `engineering-detectors-supply.ts`) — a ordem de prioridade do plano original continua correta, só muda de onde vem a função.
5. Adicionar `src/validation.ts` (agora com uso real e completo) ao `orphaned-modules.test.ts`, e **remover** a entrada equivalente para `src/shared/validation.ts` do teste, já que o arquivo deixará de existir.

**Critério de aceite:** `grep -rln "shared/validation" src` retorna vazio; `safeJsonParseValidated` usada nos 5 pontos de maior sensibilidade com teste de arquivo corrompido retornando `null`; nenhuma quebra no único call site existente de `escapeRegex`/`safeJsonParse`.

---

## Achado C (novo, mais grave que os 5 já catalogados): ReDoS **confirmado empiricamente** em `detectEmptyCatchBlocks`

A Fase 4 do plano original pede teste de caracterização para as 5 ocorrências de `regex_dos` já sinalizadas pelo detector. Apliquei a mesma técnica a um regex que o **próprio detector de `regex_dos` não sinalizou**, em `src/audit/engineering-detectors-quality.ts:314`:

```typescript
const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|\s)*)\}/g;
```

Teste (Node puro, sem dependências, `catch (e) {` + N espaços, sem fechar chave — força backtracking total):

| entrada | tempo |
|---|---|
| 1.000 espaços | 5ms |
| 20.000 espaços | 884ms |
| 50.000 espaços | 5,3s |
| 100.000 espaços | **timeout (>20s)** |

**Isso é backtracking catastrófico real, não hipótese.** A causa: `\s` é uma alternativa de 1 caractere dentro de um grupo repetido `(?:...)*`, e ela pode ser "repartida" de várias formas equivalentes junto com o `\s*` externo — cada caractere de espaço extra multiplica o número de partições possíveis. Roda em `file.content` de todo arquivo escaneado em `while(exec())`, então um único arquivo malformado, minificado ou corrompido pode travar o `shiten audit` inteiro.

### Correção — testada e comprovadamente linear

A causa raiz é o `\s` como alternativa independente e repetível. A correção remove essa ambiguidade: espaço em branco só é consumido como sufixo de um comentário, nunca como alternativa própria dentro do grupo repetido.

```typescript
// src/audit/engineering-detectors-quality.ts:314 — antes
const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|\s)*)\}/g;

// depois — \s deixa de ser alternativa própria repetida; passa a ser
// sufixo opcional de cada comentário. Elimina a partição ambígua.
const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*\}/g;
```

Reteste com a correção (mesmo input adversarial, escalado 20x mais longe):

| entrada | tempo |
|---|---|
| 1.000 espaços | 0ms |
| 50.000 espaços | 0ms |
| 500.000 espaços | 6ms |
| 2.000.000 espaços | 29ms |

Correção verificada como **não regressiva** contra os três casos que o detector precisa continuar pegando:
- `catch (e) {}` → ainda detecta catch vazio puro
- `catch (e) { /* a */ // b\n }` → ainda detecta múltiplos comentários seguidos
- `catch (e) { doSomething(); }` → continua **não** marcando catch com corpo real como falso positivo

**Ação:** aplicar a troca de linha única acima. Adicionar teste de caracterização permanente (mesmo padrão que a Fase 4 do plano original propõe para as outras 5):

```typescript
describe("emptyCatchRegex ReDoS resistance", () => {
  it("does not hang on adversarial whitespace-only catch body", () => {
    const adversarial = "catch (e) {" + " ".repeat(500_000) + "x";
    const start = Date.now();
    emptyCatchRegex.exec(adversarial);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
```

**Critério de aceite:** teste acima passa; os 3 casos de regressão acima continuam corretos; rodar `shiten audit --level code-review` (que ativa `detectEmptyCatchBlocks`) contra os arquivos existentes do projeto não muda a contagem de `empty_catch` já reportada (confirma que a correção não altera comportamento em input real, só em input adversarial).

**Prioridade:** mais alta que a Fase 4 original — isto não é um "candidato provável" pendente de teste, é uma trava de serviço confirmada e explorável (qualquer arquivo de terceiros incluído no scan, ou um arquivo corrompido, já é o suficiente).

---

## Achado D (backlog, fora do escopo imediato de segurança): quebrar o ciclo `advanced-infrastructure.ts` ↔ `event-bus.ts`

Não é um achado de segurança, mas complementa a Parte 3 do relatório de auditoria (que apontou 2 ciclos e nenhum plano cobre). Diferenciando os dois:

- `auto-evolution.ts` ↔ `challenge-generator.ts`: uma das duas direções já é `import type` — ciclo só a nível de tipos, sem risco de ciclo em runtime (TS/esbuild eliminam o import no build). **Baixa prioridade, pode ficar como está.**
- `advanced-infrastructure.ts` ↔ `event-bus.ts`: as duas direções importam **valores** (`getEventBus`/`EventBus` de um lado, `DeadLetterQueue`/`createVersionedEvent` do outro) — ciclo real em runtime. Isso é a dívida técnica real que o relatório de auditoria citou.

**Ação sugerida (não urgente, mas correta):** extrair as interfaces/tipos compartilhados entre os dois módulos para um terceiro arquivo (`src/event-bus-types.ts` ou similar) e fazer ambos importarem dali, sem se importarem entre si. Registrar como item de backlog separado — não bloqueia nenhuma das fases de segurança acima.

---

## Sequenciamento (encaixa no cronograma do plano original, não substitui)

```
Junto com DIA 1 do plano original: Achado A (fechar, sem código) + Achado C (fix de 1 linha + teste, ~1h)
Antes do DIA 3 do plano original (Fase 3): Achado B — consolidar validation.ts ANTES de aplicar safeJsonParse
                                            em action-engine.ts, para a Fase 3 original já herdar a função certa
Backlog, sem data: Achado D
```

## Métricas de Sucesso

| Item | Antes | Depois |
|---|---|---|
| `feedback.ts` path_traversal | Marcado "prioridade de investigação" | Fechado como falso positivo confirmado (Achado A) |
| Módulos `safeJsonParse` duplicados/órfãos | 2 (`src/validation.ts` 1/13 exports; `src/shared/validation.ts` 0 imports) | `src/shared/validation.ts` deletado (0 imports); `src/validation.ts` mantido com API `(raw, fallback)` distinta. Nota: o codebase já possui `src/safe-json.ts` com `safeJsonParse(raw, validate, context)`, tornando a variante `safeJsonParseValidated` proposta no plano redundante — não foi adicionada para evitar o 3º duplicado. (Achado B) |
| `regex_dos` real em `detectEmptyCatchBlocks` | Não detectado pelo próprio detector, hang confirmado em >20s | Corrigido, sub-30ms até 2M caracteres, com teste de caracterização (Achado C) |
| Ciclo `advanced-infrastructure` ↔ `event-bus` | Sem plano | Registrado como item 3.33 no BACKLOG com abordagem definida (Achado D) |

**Execução:** código em `/media/edson-ubuntu/Data2/projeto-formação_tech/shitenno-cli/src` (não dentro de `shitenno-go/`, que é a camada de governança). typecheck limpo, lint 0 erros, testes de empty-catch + ReDoS passam. Falha pré-existente em `detectHighComplexity` é independente deste plano (reprodutível no baseline).
