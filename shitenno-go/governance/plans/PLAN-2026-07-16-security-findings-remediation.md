# Plano de Ação — Remediação de Achados de Segurança

**Status:** In-progress
**Updated_at:** 2026-07-17T07:10:15.445Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Origem:** AUDIT-2026-07-16-end-to-end-execution-report.md (execução real do `shiten audit --level enterprise`)
**Achados:** 67 `unsafe_deserialize`, 6 `path_traversal`, 5 `regex_dos`, 2 `xss_risk`, 2 `dep_confusion`

**Antes de qualquer coisa: fiz triagem manual de uma amostra de cada categoria, não confiei no relatório do detector às cegas — e isso já muda o plano.** Três dos achados que investiguei são **falsos positivos confirmados**, um deles revelando um bug real no próprio audit tool. Recomendo triar manualmente antes de rodar `--apply` em qualquer coisa desta lista; o detector de `path_traversal` em particular tem uma taxa de falso positivo visível na amostra que investiguei.

---

## Achado 0 (bug no audit tool, não no projeto): exclusão de auto-referência desatualizada

Os 2 achados de `xss_risk` (`engineering-detectors-security.ts:123-124`) são **falso positivo confirmado**. São os próprios padrões regex que o detector de XSS usa para procurar XSS em outros arquivos (`/\.innerHTML\s*[=+]/`, `/dangerouslySetInnerHTML/`, etc.) — o detector está encontrando essas strings dentro de si mesmo.

**Causa raiz real, achada no código:**
```typescript
// src/audit/constants.ts
export const SECURITY_DETECTOR_SELF_PATHS = [
  "src/health-auditor.ts",
  "src/audit/taint/",
  "src/audit/engineering-detectors.ts", // ← esse arquivo foi dividido em -security.ts, -quality.ts, -supply.ts
];
```
Quando `engineering-detectors.ts` foi dividido, a lista de auto-exclusão não foi atualizada para cobrir os arquivos novos. Fix trivial:

```typescript
export const SECURITY_DETECTOR_SELF_PATHS = [
  "src/health-auditor.ts",
  "src/audit/taint/",
  "src/audit/engineering-detectors.ts",
  "src/audit/engineering-detectors-security.ts",
  "src/audit/engineering-detectors-quality.ts",
  "src/audit/engineering-detectors-supply.ts",
];
```

**Critério de aceite:** rodar `shiten audit --level enterprise --no-cache` de novo depois do fix — os 2 `xss_risk` devem desaparecer. Se aparecerem outros falsos positivos por auto-referência em detectores futuros, este é o padrão a olhar primeiro.

---

## Achado 0.1 (bug no audit tool): `path_traversal` com taxa de falso positivo real

Investiguei `src/git-hooks-installer.ts:45,47` (dois dos 6 achados de `path_traversal`):
```typescript
for (const hookName of ["post-commit", "post-merge"] as const) {  // ← constante fixa, não input externo
  const hookPath = join(targetDir, hookName);
  ...
  writeFileSync(hookPath, ...);  // linha 45
  ...
  chmodSync(hookPath, 0o755);    // linha 47
}
```
`hookName` vem de um array literal no próprio código — não é possível um atacante influenciar esse valor. O detector está sinalizando qualquer `join()` com segundo argumento variável, sem diferenciar "variável vem de array de compilação" de "variável vem de input externo". **Falso positivo confirmado para esta instância específica.**

**Não recomendo alterar `git-hooks-installer.ts`** — não há vulnerabilidade real aqui. Recomendo, em vez disso, melhorar o detector para ignorar `for...of` sobre arrays de literais `as const` — mas isso é uma melhoria do audit tool, não deste plano de remediação (registrar como item de backlog separado).

**As outras 4 instâncias de `path_traversal` precisam de triagem manual antes de qualquer fix:**
- `src/audit/doc-lifecycle/auditor.ts:153,156`
- `src/commands/feedback.ts:109` — aqui não consegui confirmar em tempo hábil se `feedback.date` (usado em `join(feedbackDir, `${feedback.date}.md`)`) é sempre derivado do sistema (seguro) ou pode ser influenciado por dado de sessão/usuário (risco real) — **marcar como prioridade de investigação antes de decidir se corrige**
- `src/scaffolder.ts:213`

---

## FASE 1: Consolidar um Helper de Path Seguro (0.5 dia)

Para as instâncias que forem confirmadas como reais (não o caso de `git-hooks-installer.ts`), usar um helper único em vez de correções pontuais dispersas.

**Ficheiro novo:** `src/path-safety.ts`
```typescript
import { resolve, relative, isAbsolute } from "node:path";

/**
 * Resolve um path dentro de um diretório raiz, rejeitando qualquer tentativa
 * de escapar dele via "..", symlink absoluto, ou path absoluto externo.
 */
export function resolveWithinRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, ...segments);
  const rel = relative(resolvedRoot, candidate);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathTraversalError(`Path "${segments.join("/")}" escapes root "${root}"`);
  }
  return candidate;
}

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}
```

**Critério de aceite:** teste unitário cobrindo `resolveWithinRoot("/a/b", "../../etc/passwd")` lançando `PathTraversalError`, e `resolveWithinRoot("/a/b", "c", "d.md")` retornando o path normal.

## FASE 2: Aplicar o Helper Onde For Confirmado Real (0.5-1 dia, após triagem)

Exemplo de aplicação em `commands/feedback.ts` (só depois de confirmar que `feedback.date` pode de fato vir de fora):
```typescript
import { resolveWithinRoot } from "../path-safety.js";

const feedbackPath = resolveWithinRoot(feedbackDir, `${feedback.date}.md`);
```

**Não aplicar em `git-hooks-installer.ts`** — já estabelecido como falso positivo acima.

---

## FASE 3: Validação de Schema no `unsafe_deserialize` (1.5-2 dias)

67 ocorrências de `JSON.parse` sem validação de schema é o maior volume. **Não é viável nem necessário corrigir as 67 uma por uma com lógica distinta** — a maioria é `JSON.parse(readFileSync(...))` lendo arquivos gerados pelo próprio sistema (registros de execução, cache, estado do daemon), onde o risco real não é injeção, é **corrupção silenciosa de dado gerando comportamento indefinido a jusante** se o arquivo for editado manualmente ou corrompido.

**Estratégia: um helper único de parse seguro, aplicado nos pontos de maior sensibilidade primeiro.**

```typescript
// src/safe-json.ts
import type { ZodSchema } from "zod"; // já é dependência do projeto? checar antes — se não for, usar validação manual leve (ver abaixo)

export function safeJsonParse<T>(raw: string, schema: ZodSchema<T>, context: string): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("safe-json", `Failed to parse JSON in ${context}`);
    return null;
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    logger.warn("safe-json", `Schema validation failed in ${context}: ${result.error.message}`);
    return null;
  }
  return result.data;
}
```

**Se `zod` não estiver nas dependências** (verificar `package.json` antes de assumir), usar uma validação manual leve em vez de adicionar uma dependência nova só para isto:
```typescript
export function safeJsonParse<T>(raw: string, validate: (v: unknown) => v is T, context: string): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("safe-json", `Failed to parse JSON in ${context}`);
    return null;
  }
  if (!validate(parsed)) {
    logger.warn("safe-json", `Shape validation failed in ${context}`);
    return null;
  }
  return parsed;
}
```

**Priorizar aplicação nesta ordem** (do mais crítico ao menos crítico, com base em quem consome o dado):
1. `src/action-engine.ts:204,228` (`ExecutionRecord`) — consumido pelo núcleo de execução do ADR-009; um registro corrompido aqui pode confundir decisões de rollback
2. `src/audit/engineering-detectors-supply.ts` (4 ocorrências) — parseia `package.json`/lockfiles de terceiros, é a superfície mais próxima de dado externo real
3. Demais 61 ocorrências — aplicar o mesmo helper progressivamente, sem bloquear o resto do trabalho nisso; não é uma emergência, é higiene.

**Critério de aceite:** `action-engine.ts` e os 4 pontos de `engineering-detectors-supply.ts` usando `safeJsonParse` com teste cobrindo arquivo corrompido/schema inválido retornando `null` em vez de lançar exceção não tratada.

---

## FASE 4: `regex_dos` — Triagem Antes de "Corrigir" (0.5-1 dia)

Investiguei `src/context-buffer-writer.ts:418`:
```typescript
const impedimentsRegex = /^impediments:\s*\n((?:\s+- .*\n)*)/m;
```
O grupo `(?:\s+- .*\n)*` tem quantificador aninhado, mas `\s+` e `.*` não competem pelo mesmo texto de forma ambígua (não há sobreposição de charset entre eles na prática) — **candidato a falso positivo também, mas quero deixar isso marcado como "provável", não "confirmado"**, porque análise de ReDoS por inspeção manual tem seus próprios limites; o ideal é testar empiricamente.

**Ação recomendada, não "reescrever a regex às cegas":**
```typescript
// teste de caracterização antes de qualquer mudança
import { describe, it, expect } from "vitest";

describe("impedimentsRegex ReDoS resistance", () => {
  it("does not hang on adversarial input", () => {
    const adversarial = "impediments:\n" + "  - x\n".repeat(50_000) + "!"; // sem match no final, força backtracking se vulnerável
    const start = Date.now();
    /^impediments:\s*\n((?:\s+- .*\n)*)/m.exec(adversarial);
    expect(Date.now() - start).toBeLessThan(1000); // deve ser sub-segundo mesmo em input grande
  });
});
```
Rodar esse teste para as 5 ocorrências de `regex_dos` antes de decidir reescrever qualquer uma — só reescrever as que de fato travam. Isso evita gastar esforço "corrigindo" regex que já são seguras.

**Critério de aceite:** as 5 regex marcadas têm um teste de caracterização; as que passam ficam como estão (com um comentário `// regex_dos: falso positivo confirmado por teste, ver <link do teste>` para não serem re-sinalizadas e re-investigadas no futuro); as que falham são reescritas com quantificadores não aninhados ou trocadas por parsing não-regex.

---

## FASE 5: `dep_confusion` — Bug do Detector, Não do Projeto (0.25 dia)

Os 2 achados (`${item.state}`, `${entry.name}`) são o mesmo tipo de falso positivo do Achado 0 — o detector de dependências "phantom"/"confusion" está confundindo interpolação de template literal com nome de import. Verificar `src/audit/engineering-detectors-supply.ts` (mesmo arquivo dos outros achados de `unsafe_deserialize`) — o regex que extrai "nomes de dependência importados" provavelmente está capturando `${...}` dentro de template strings como se fosse um identificador de import. Fix é no regex de extração do detector, não no projeto auditado.

**Critério de aceite:** rodar `shiten audit` de novo depois do fix — os 2 `dep_confusion` desaparecem sem nenhuma mudança em `backlog-state-machine.ts`/`plugin-system.ts`.

---

## Sequenciamento

```
DIA 1:      Achado 0 + 0.1 (fixes triviais nos detectores) + Fase 1 (path-safety.ts)
DIA 2:      Fase 2 (aplicar path-safety onde confirmado real, após completar a triagem pendente)
DIA 3-4.5:  Fase 3 (safe-json.ts + aplicação priorizada)
DIA 5:      Fase 4 (testes de caracterização de regex_dos)
DIA 5.25:   Fase 5 (fix do detector dep_confusion)
```

**Total: ~5.5 dias.** Pode rodar em paralelo a qualquer um dos outros cinco planos — não compartilha módulos com eles, exceto `action-engine.ts` (Fase 3.1 aqui, e o plano de núcleo de 4 engines mexe no mesmo arquivo) — **coordenar para não colidir: aplicar `safeJsonParse` antes da migração de `action-engine.ts` para `decision-core/`, não depois, para que a migração já herde o parse seguro.**

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---|---|---|
| `xss_risk` (falso positivo confirmado) | 2 | 0 |
| `dep_confusion` (falso positivo, bug do detector) | 2 | 0 |
| `path_traversal` genuinamente revisados manualmente | 0 | 6 (2 confirmados falso-positivo, 4 triados) |
| `unsafe_deserialize` com validação de schema | 0/67 | ≥5 pontos de maior sensibilidade (`action-engine.ts`, `engineering-detectors-supply.ts`) |
| `regex_dos` com teste de caracterização | 0/5 | 5/5 |
| Helper reutilizável de path seguro | Não existe | `src/path-safety.ts`, usado nos pontos confirmados reais |
