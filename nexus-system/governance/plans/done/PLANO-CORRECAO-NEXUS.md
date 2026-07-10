# Plano de Correção — Nexus System

> **Estado:** ✅ done (2026-07-10)
>
> Gerado a partir de validação de execução real (install → typecheck → build → test → CLI → self-audit),
> não de leitura de código. Cada item tem: causa raiz, evidência, e diff pronto para colar.
>
> **Ordem de aplicação recomendada:** 1 → 2 → 3 → 4 → 5, rodando `npm run build && npx vitest run`
> depois de cada bloco para confirmar que nada regrediu.

---

## Bug 1 — `feedback-utils.ts` não existe (CLI não sobe)

### Evidência
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/feedback-utils.js'
imported from src/commands/feedback.ts
```
`src/commands/feedback.ts` importa `parseUserRating` e `parseUserTags` de `../feedback-utils.js`,
mas esse arquivo não existe em nenhum lugar do projeto. Isso quebra **qualquer** comando do CLI,
inclusive `nexus --help`, porque o import falha no carregamento do módulo.

### Correção — criar `src/feedback-utils.ts`

```ts
/**
 * feedback-utils.ts — helpers for parsing CLI feedback flags.
 */

export function parseUserRating(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function parseUserTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}
```

### Teste de regressão sugerido — `src/__tests__/feedback-utils.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseUserRating, parseUserTags } from "../feedback-utils.js";

describe("parseUserRating", () => {
  it("returns undefined when input is undefined", () => {
    expect(parseUserRating(undefined)).toBeUndefined();
  });
  it("clamps values below 1 to 1", () => {
    expect(parseUserRating("0")).toBe(1);
  });
  it("clamps values above 5 to 5", () => {
    expect(parseUserRating("9")).toBe(5);
  });
  it("rounds decimal values", () => {
    expect(parseUserRating("3.6")).toBe(4);
  });
  it("returns undefined for non-numeric input", () => {
    expect(parseUserRating("abc")).toBeUndefined();
  });
});

describe("parseUserTags", () => {
  it("returns undefined when input is undefined", () => {
    expect(parseUserTags(undefined)).toBeUndefined();
  });
  it("splits comma-separated tags and trims whitespace", () => {
    expect(parseUserTags(" bug , ui ,perf")).toEqual(["bug", "ui", "perf"]);
  });
  it("returns undefined for empty string", () => {
    expect(parseUserTags("")).toBeUndefined();
  });
});
```

---

## Bug 2 — `banner()` importado em 5 comandos mas nunca exportado

### Evidência
```
error TS2305: Module '"../formatting.js"' has no exported member 'banner'.
```
Ocorre em `commands/init.ts`, `status.ts`, `audit.ts`, `detect.ts`, `validate.ts`.

### Correção — adicionar em `src/formatting.ts`

Abrir `src/formatting.ts` e adicionar a função antes de `statusIcon`:

```ts
export function banner(title: string, subtitle?: string): void {
  const label = subtitle ? `${title} — ${subtitle}` : title;
  const width = label.length + 4;
  console.log("╔" + "═".repeat(width) + "╗");
  console.log("║  " + label + "  ║");
  console.log("╚" + "═".repeat(width) + "╝");
}

export function statusIcon(
```
*(mantenha o resto da assinatura de `statusIcon` como está — só adicione o bloco de `banner` acima dela).*

### Teste de regressão sugerido — `src/__tests__/formatting.test.ts` (adicionar ao arquivo existente, ou criar se não existir)

```ts
import { describe, it, expect, vi } from "vitest";
import { banner } from "../formatting.js";

describe("banner", () => {
  it("prints a 3-line box containing the title", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    banner("nexus status", "Health Check");
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("nexus status — Health Check");
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it("works without a subtitle", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    banner("nexus init");
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("nexus init");
    spy.mockRestore();
  });
});
```

---

## Bug 3 — 5 regras de governança com JSON inválido (`RULE-011` a `RULE-015`)

### Evidência
```
[RuleEngine] WARN  Failed to parse RULE-011.json
```
Causa raiz: a chave `params` aparece **sem aspas** dentro do objeto `actions` em todos os 5 arquivos
(`{ "type": "run_nexus_command", params: { ... } }` em vez de `"params": { ... }`).
JSON não aceita chaves sem aspas — só JS/JSON5 aceitam.

### Correção — substituir `params:` por `"params":` nos 5 arquivos

📁 `nexus-system/governance/rules/RULE-011.json`
```json
{
  "id": "RULE-011",
  "description": "Auto-audit when health status is critical",
  "trigger": "health_check",
  "conditions": [
    { "field": "eventData.status", "operator": "equals", "value": "critical" }
  ],
  "actions": [
    { "type": "run_nexus_command", "params": { "command": "validate" } },
    { "type": "create_reminder", "params": { "message": "Health status is CRITICAL — immediate action required" } }
  ],
  "priority": 1,
  "dependencies": [],
  "enabled": true,
  "tags": ["health", "critical", "auto-audit"]
}
```

📁 `nexus-system/governance/rules/RULE-012.json`
```json
{
  "id": "RULE-012",
  "description": "Update context buffer on significant maturity change",
  "trigger": "maturity_change",
  "conditions": [
    { "field": "eventData.delta", "operator": "greater_than", "value": 5 }
  ],
  "actions": [
    { "type": "update_context_buffer", "params": { "field": "current_task.description", "value": "Maturity changed significantly" } },
    { "type": "log_event", "params": { "event": "maturity_shift", "message": "Significant maturity change detected" } }
  ],
  "priority": 2,
  "dependencies": [],
  "enabled": true,
  "tags": ["maturity", "context", "tracking"]
}
```

📁 `nexus-system/governance/rules/RULE-013.json`
```json
{
  "id": "RULE-013",
  "description": "Create backlog item when knowledge debt gaps exceed threshold",
  "trigger": "knowledge_debt_detected",
  "conditions": [
    { "field": "eventData.gapCount", "operator": "greater_than", "value": 3 }
  ],
  "actions": [
    { "type": "update_backlog", "params": { "item": "Address critical knowledge debt (3+ gaps detected)" } },
    { "type": "create_reminder", "params": { "message": "High knowledge debt detected — create ADRs and skills" } }
  ],
  "priority": 1,
  "dependencies": [],
  "enabled": true,
  "tags": ["knowledge", "debt", "backlog", "critical"]
}
```

📁 `nexus-system/governance/rules/RULE-014.json`
```json
{
  "id": "RULE-014",
  "description": "Create reminder when validation fails",
  "trigger": "validation_fail",
  "conditions": [],
  "actions": [
    { "type": "create_reminder", "params": { "message": "Validation failed — review issues and fix" } },
    { "type": "update_quick_board", "params": { "item": "Fix validation failures", "section": "parado" } }
  ],
  "priority": 2,
  "dependencies": [],
  "enabled": true,
  "tags": ["validation", "reminder", "fix"]
}
```

📁 `nexus-system/governance/rules/RULE-015.json`
```json
{
  "id": "RULE-015",
  "description": "Verify active plans on session end",
  "trigger": "session_end",
  "conditions": [],
  "actions": [
    { "type": "log_event", "params": { "event": "session_end_check", "message": "Session ended — verify no pending plans" } }
  ],
  "priority": 3,
  "dependencies": [],
  "enabled": true,
  "tags": ["session", "plans", "verification"]
}
```

### Prevenção estrutural (recomendado, não obrigatório)

Esse tipo de erro (JS-object-literal colado num arquivo `.json`) tende a se repetir porque é fácil
de escrever sem perceber. Vale adicionar uma checagem de sanidade no próprio rule engine para falhar
alto (erro visível, não warning silencioso) quando um `RULE-*.json` não parseia, em vez de só logar
e seguir em frente. Em `src/rule-engine.ts`, no ponto onde o warning é emitido:

```ts
// Antes:
logger.warn("RuleEngine", `Failed to parse ${file}`);

// Sugestão: contar falhas e expor no resultado de nexus audit/doctor
logger.warn("RuleEngine", `Failed to parse ${file} — rule ignored, JSON inválido`);
invalidRuleFiles.push(file); // acumular e reportar em nexus audit
```
Isso torna o problema visível em `nexus audit` (que é exatamente o comando cujo propósito é
detectar esse tipo de dívida silenciosa) em vez de aparecer só como ruído de log.

---

## Bug 4 — Plugins de exemplo com sintaxe TypeScript em arquivos `.js`

### Evidência
```
[PluginSystem] ERROR Failed to load plugin from "event-logger": SyntaxError: missing ) after argument list
[PluginSystem] ERROR Failed to load plugin from "health-monitor": SyntaxError: Unexpected token ':'
```
Causa raiz: os hooks usam anotações de tipo (`input: unknown`, `as Record<...>`) dentro de arquivos
`.js` puros, que o Node executa como JavaScript — sintaxe TS não é válida ali.

### Correção — `nexus-system/plugins/event-logger/plugin.js`

```js
/**
 * event-logger plugin — Command metrics logging
 *
 * Logs metrics for each command execution to plugin-metrics.jsonl.
 */

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const eventLoggerPlugin = {
  name: "event-logger",
  version: "1.0.0",
  description: "Logs metrics for each command execution",
  hooks: {
    "custom-metric": async (input) => {
      const ctx = input || {};
      const nexusDir = ctx.nexusDir;
      const command = ctx.command || "unknown";
      const duration = ctx.duration || 0;

      if (!nexusDir) return null;

      const telemetryDir = join(nexusDir, "telemetry");
      if (!existsSync(telemetryDir)) {
        mkdirSync(telemetryDir, { recursive: true });
      }

      const metricsPath = join(telemetryDir, "plugin-metrics.jsonl");
      const entry = {
        timestamp: new Date().toISOString(),
        command,
        duration,
        plugin: "event-logger",
      };

      appendFileSync(metricsPath, JSON.stringify(entry) + "\n", "utf-8");

      return null;
    },
  },
};

export default eventLoggerPlugin;
```

### Correção — `nexus-system/plugins/health-monitor/plugin.js`

```js
/**
 * health-monitor plugin — Post-analysis health logging
 *
 * Logs analysis completion and runs additional health checks.
 */

const healthMonitorPlugin = {
  name: "health-monitor",
  version: "1.0.0",
  description: "Logs analysis completion and runs additional health checks",
  hooks: {
    "post-analysis": (input) => {
      const ctx = input || {};
      const command = ctx.command || "unknown";
      const timestamp = new Date().toISOString();

      console.log(`  [health-monitor] Analysis completed for command: ${command} at ${timestamp}`);

      return input;
    },
    "custom-check": async (input) => {
      const ctx = input || {};
      const nexusDir = ctx.nexusDir;

      if (!nexusDir) return null;

      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");

      const criticalFiles = [
        join(nexusDir, "governance", "context", "context_buffer.yaml"),
        join(nexusDir, "docs", "AGENTS.md"),
      ];

      const missing = criticalFiles.filter((f) => !existsSync(f));

      if (missing.length > 0) {
        return `[health-monitor] Warning: ${missing.length} critical file(s) missing`;
      }

      return null;
    },
  },
};

export default healthMonitorPlugin;
```

### Prevenção estrutural (recomendado)

Se a intenção é permitir plugins com tipagem no futuro, o `plugin-system.ts` deveria carregar
`.ts`/`.mjs` via um runtime que suporte isso (ex. `tsx`/`jiti`), ou documentar explicitamente que
plugins **precisam** ser JS puro. Do jeito que está, é fácil escrever um novo plugin de exemplo
com o mesmo erro. Um teste simples resolve isso:

```ts
// src/__tests__/plugin-examples-syntax.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

describe("bundled example plugins", () => {
  const pluginsDir = join(process.cwd(), "nexus-system", "plugins");

  for (const name of readdirSync(pluginsDir)) {
    it(`${name}/plugin.js is loadable as a valid ES module`, async () => {
      const path = join(pluginsDir, name, "plugin.js");
      await expect(import(path)).resolves.toBeDefined();
    });
  }
});
```

---

## Bug 5 — `nexus init --answers-file` crasha com o `answers.json` bundlado

### Evidência
```
TypeError: Cannot read properties of undefined (reading 'join')
    at fillPlaceholders (src/scaffolder.ts:314:34)
```
Causa raiz: `nexus-system/answers.json` (o exemplo shippado no próprio repositório) só tem o bloco
`maturity`, mas a interface `UserAnswers` (`src/prompts.ts`) exige também `principalModel`,
`executorModel`, `stack`, `database`, `styling`. `fillPlaceholders()` chama `answers.stack.join(", ")`
sem checar se `stack` existe.

Isso afeta diretamente o primeiro comando do Quick Start do README (`nexus init`), no modo não
interativo — o caminho que qualquer automação/CI usaria.

### Correção A — consertar o arquivo de exemplo `nexus-system/answers.json`

```json
{
  "principalModel": "opencode/mimo-v2.5-free",
  "executorModel": "opencode/mimo-v2.5-free",
  "stack": ["typescript", "node"],
  "database": "postgresql",
  "styling": "tailwind",
  "maturity": {
    "usedNexusBefore": true,
    "isFirstProject": false,
    "projectAge": "established",
    "teamSize": "solo",
    "hasDedicatedTeam": false,
    "hasArchitectureDocs": true,
    "hasADRs": true,
    "hasTechnicalReviews": true,
    "hasCICD": false,
    "hasAutomatedTests": true,
    "hasValidationPipeline": false,
    "intendsToUseAI": true,
    "aiWillImplement": true,
    "requiresHumanReview": true,
    "hasDefinedPatterns": true,
    "hasReviewProcess": true,
    "hasDecisionControl": true
  }
}
```

### Correção B (defesa em profundidade, recomendada além da A) — tornar `fillPlaceholders` resiliente

Em `src/scaffolder.ts`, a função não deveria confiar cegamente em campos opcionais/ausentes vindos
de um `--answers-file` escrito à mão por um usuário:

```ts
// Antes:
function fillPlaceholders(content: string, answers: UserAnswers): string {
  const stackStr = answers.stack.join(", ") || "a definir";
  const dbStr = answers.database || "a definir";
  const stylingStr = answers.styling || "a definir";
  // ...
}

// Depois:
function fillPlaceholders(content: string, answers: UserAnswers): string {
  const stackStr = Array.isArray(answers.stack) && answers.stack.length > 0
    ? answers.stack.join(", ")
    : "a definir";
  const dbStr = answers.database || "a definir";
  const stylingStr = answers.styling || "a definir";
  // ...
}
```

### Correção C (fail-fast explícito) — validar `--answers-file` antes de usar

Em `src/commands/init.ts`, onde o arquivo de respostas é carregado, validar os campos obrigatórios
e falhar com mensagem clara em vez de deixar o `TypeError` genérico estourar lá na frente:

```ts
function validateAnswersFile(answers: Partial<UserAnswers>): string[] {
  const missing: string[] = [];
  if (!Array.isArray(answers.stack)) missing.push("stack (array de strings)");
  if (!answers.database) missing.push("database");
  if (!answers.styling) missing.push("styling");
  if (!answers.maturity) missing.push("maturity");
  return missing;
}

// No fluxo de --answers-file, logo após o JSON.parse:
const missingFields = validateAnswersFile(loadedAnswers);
if (missingFields.length > 0) {
  console.error(chalk.red(`  ✘ Answers file incompleto. Campos faltando: ${missingFields.join(", ")}`));
  process.exitCode = 1;
  return;
}
```

### Teste de regressão sugerido — `src/__tests__/scaffolder-answers-file.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { scaffoldNexusSystem } from "../scaffolder.js";
import type { UserAnswers } from "../prompts.js";

const baseMaturity = {
  usedNexusBefore: true, isFirstProject: false, projectAge: "established",
  teamSize: "solo", hasDedicatedTeam: false, hasArchitectureDocs: true,
  hasADRs: true, hasTechnicalReviews: true, hasCICD: false,
  hasAutomatedTests: true, hasValidationPipeline: false, intendsToUseAI: true,
  aiWillImplement: true, requiresHumanReview: true, hasDefinedPatterns: true,
  hasReviewProcess: true, hasDecisionControl: true,
} as UserAnswers["maturity"];

describe("scaffoldNexusSystem with minimal answers file", () => {
  it("does not throw when stack/database/styling are provided", () => {
    const answers: UserAnswers = {
      principalModel: "test-model",
      executorModel: "test-model",
      stack: ["typescript"],
      database: "postgresql",
      styling: "tailwind",
      maturity: baseMaturity,
    };
    expect(() => scaffoldNexusSystem("/tmp/nexus-answers-test", answers, ["core"])).not.toThrow();
  });
});
```

---

## Checklist final de aplicação

- [x] Bug 1 — criar `src/feedback-utils.ts`
- [x] Bug 2 — adicionar `banner()` em `src/formatting.ts`
- [x] Bug 3 — corrigir os 5 `RULE-0{11..15}.json`
- [x] Bug 4 — corrigir os 2 `plugin.js`
- [x] Bug 5 — corrigir `nexus-system/answers.json` **e** blindar `fillPlaceholders`
- [x] Rodar `npm run build && npx vitest run && npx tsc --noEmit` — todos devem passar limpos
- [x] Rodar `npx tsx bin/nexus.ts init --dir <projeto-vazio> --answers-file nexus-system/answers.json` como teste manual de fumaça
- [x] Registrar este ciclo em `docs/history/` (o próprio projeto já tem esse costume — ver `nexus-relatorio-bugs-correcoes.md`), fechando o loop de "Every Decision Generates Knowledge" (Princípio 5)
