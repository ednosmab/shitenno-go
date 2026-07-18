# Plano: Engineering State como Única Fonte de Verdade — Shitenno-go

**Status:** Done

## Contexto

Auditoria end-to-end do Shitenno-go (build + typecheck + 1679 testes passando + execução real de `init`, `status`, `run`, `audit`, `doctor` em um projeto TypeScript novo) revelou que, apesar da base filosófica e arquitetural estar bem projetada (event sourcing, capability lifecycle, knowledge graph, ADRs), **a implementação ainda viola o próprio princípio central do sistema**: "Engineering State é a fonte única de verdade" (ADR-002).

Foram encontrados 5 bugs concretos e reproduzíveis. Quatro são independentes; um (capacidades instaladas divergentes) é sintoma de uma falha de design em três camadas do código, não um bug isolado. Este documento consolida diagnóstico + plano de correção completo.

---

## Diagnóstico raiz: por que capacidades/health divergem entre comandos

`consolidateEngineeringState()` em `src/engineering-state.ts` — a função que o próprio código documenta como *"Single Source of Truth"* — grava **dois valores contraditórios da mesma informação dentro do mesmo objeto de estado**:

```ts
const maturityProfile = loadMaturityProfile(shitenDir);          // valor persistido/oficial
const installedCapabilities = detectInstalledCapabilities(shitenDir); // heurística de filesystem

const state = {
  maturity: maturityProfile,        // contém maturityProfile.installedCapabilities
  capabilities: installedCapabilities, // valor DIFERENTE, calculado por heurística
  // ...
};
```

Essa contradição se propaga em 3 camadas:

| Camada | Arquivo:linha | Problema |
|---|---|---|
| **Escrita/consolidação** | `src/engineering-state.ts:527` | Grava dois valores diferentes da mesma informação no mesmo objeto |
| **Leitura/exibição** | `src/commands/status.ts:66` | Chama `detectInstalledCapabilities()` em vez de ler o profile persistido — por isso `status` mostra 7 capacidades "instaladas" enquanto `doctor`/`audit` mostram 1 |
| **Governança/automação** | `src/rule-engine.ts:1228` | Regras com `requiredCapability` são avaliadas contra a heurística de filesystem, não contra o estado persistido — **automações podem disparar com base em dado errado** |

Único uso legítimo da heurística: `src/maturity-profile.ts:197`, dentro de `calculateMaturityProfile()` — é o *write path*, o único lugar onde filesystem deve virar verdade persistida pela primeira vez.

`upgrade.ts` também usa a heurística, mas de forma legítima (compara disco vs. registrado para decidir o que migrar) — deve ser mantido, só precisa de nome mais claro (ver Fase 3).

---

## Os 5 bugs

### Bug 1 — `VALID_ACTION_TYPES` fora de sincronia com `ActionType`
**Sintoma:** warning `[RuleEngine] WARN Invalid rule in RULE-019.json: Invalid action type: "auto_populate_next_p0"` disparado em todo comando.
**Causa:** `src/constants.ts` (`VALID_ACTION_TYPES`, 9 valores) está dessincronizado do tipo `ActionType` em `src/rule-engine.ts` (20 valores). `RULE-019.json` usa um valor que existe no tipo mas não no array de validação runtime.

### Bug 2 — Detecção de stack ignora linguagem/runtime base
**Sintoma:** `shiten init`/`status` reportam `Stack: none detected` mesmo com `typescript` + `tsconfig.json` presentes.
**Causa:** `detectStack()` em `src/analyser.ts` só mapeia frameworks (react, vue, next...), não linguagens/runtimes base (typescript, node, express, etc.).

### Bug 3 — Scaffold nasce com health score 1/100
**Sintoma:** projeto recém-criado via `shiten init` já sai com 3 itens críticos e score 1/100.
**Causa:** `expectedDocs` em `src/state-manager.ts` marca `WORKFLOW.md` como `critical: true` **incondicionalmente**, mesmo quando a capacidade `governance` (única que gera esse arquivo) não foi instalada.

### Bug 4 — `status` e `doctor`/`audit` reportam números diferentes para o mesmo fato *(o mais grave — ver Diagnóstico raiz acima)*
**Sintoma:** `shiten doctor` mostra Health 85/100 e 1 capacidade instalada; `shiten audit` mostra Score 1/100; `shiten status` mostra 7 capacidades instaladas. O arquivo persistido (`maturity-profile.json`) diz `installedCapabilities: ["core"]`.

### Bug 5 — Pipeline reporta estágio pulado como sucesso
**Sintoma:** `shiten run` imprime `⚠ Skipping evolve stage (requires 'governed' state)` e, duas linhas depois, `✔ evolve (0ms)` / "5 stage(s) succeeded".
**Causa:** `Pipeline.execute()` em `src/pipeline.ts` só tem `success: boolean`. Quando um estágio pula por gate de lifecycle, ele retorna o contexto sem erro e cai no branch `success: true` — não existe estado "skipped".

---

## Plano de correção

### Fase 1 — Corrigir a consolidação (parar de gravar contradição)

`consolidateEngineeringState()` passa a usar exclusivamente o profile persistido para `capabilities`. A heurística de filesystem vira **sinal de drift**, não substitui o valor:

```ts
// src/engineering-state.ts
export function consolidateEngineeringState(
  projectRoot: string,
  shitenDir: string
): EngineeringState {
  const projectAnalysis = analyseProject(projectRoot);
  const lifecycle = detectLifecycleState(projectRoot, shitenDir);
  const maturityProfile = loadMaturityProfile(shitenDir);

  // ÚNICA fonte de verdade para "o que está instalado":
  const installedCapabilities = maturityProfile.installedCapabilities;

  // Heurística de filesystem vira um SINAL, não substitui o valor acima.
  const fsDetected = detectCapabilitySignalsFromFilesystem(shitenDir); // ver Fase 3 (rename)
  const capabilityDrift = {
    detectedNotRegistered: fsDetected.filter((c) => !installedCapabilities.includes(c)),
    registeredNotDetected: installedCapabilities.filter((c) => !fsDetected.includes(c)),
  };

  // ...resto da função permanece igual...

  const state = {
    // ...
    capabilities: installedCapabilities, // sempre igual a maturity.installedCapabilities
    capabilityDrift,                     // novo campo — usado por audit/doctor para alertar
    // ...
  };

  return state;
}
```

`capabilityDrift` deve virar um achado de primeira classe em `shiten audit`: se `detectedNotRegistered` não estiver vazio, reportar como item de governança ("capacidade parece configurada no disco mas não registrada — rode `shiten sync`"), em vez de cada comando decidir sozinho em qual fonte confiar.

### Fase 2 — Corrigir a governança (rule-engine)

```ts
// src/rule-engine.ts — dentro do handler de evento que monta o RuleContext
const maturityProfile = loadMaturityProfile(shitenDir);
const context: RuleContext = {
  trigger: actualTrigger,
  eventData: payload as Record<string, unknown>,
  projectRoot,
  shitenDir,
  timestamp: new Date().toISOString(),
  installedCapabilities: maturityProfile.installedCapabilities, // era detectInstalledCapabilities(shitenDir)
};
```
Impede que regras com `requiredCapability` disparem ações (`create_adr`, `update_backlog`, etc.) baseadas em detecção de filesystem em vez do que foi de fato registrado como instalado.

### Fase 3 — Corrigir a leitura (`status.ts`) e reclassificar a função de heurística

```ts
// src/commands/status.ts
const maturityProfile = loadMaturityProfile(ctx.shitenDir);
const installedCapabilities = maturityProfile.installedCapabilities; // era detectInstalledCapabilities()
```

Renomear a função de heurística para deixar o contrato explícito (evita que volte a ser usada como fonte de verdade por engano no futuro):

```ts
// src/maturity-profile.ts
/**
 * Detecta capacidades por evidência de filesystem.
 * ⚠️ Isto é um SINAL para reconciliação (usado por `init`, `upgrade`, `sync`),
 * NUNCA a fonte de verdade para leitura de estado. Para saber o que está
 * instalado, use `loadMaturityProfile(shitenDir).installedCapabilities`.
 */
export function detectCapabilitySignalsFromFilesystem(shitenDir: string): Capability[] {
  // ...implementação inalterada, apenas renomeada de detectInstalledCapabilities...
}
```
Atualizar todos os imports (`engineering-state.ts`, `rule-engine.ts`, `upgrade.ts`) para o novo nome. `upgrade.ts` continua usando a função normalmente — é um uso legítimo (comparar disco vs. registrado para decidir migração).

### Fase 4 — Corrigir Bugs 1, 2, 3, 5 (independentes do problema de capacidades)

**Bug 1 — sincronizar `VALID_ACTION_TYPES` com `ActionType`:**
```ts
// src/rule-engine.ts
export type ActionType =
  | "update_context_buffer" | "create_reminder" | "remove_reminder"
  | "update_quick_board" | "create_adr" | "create_skill" | "log_event"
  | "send_notification" | "trigger_assessment" | "trigger_health_check"
  | "update_backlog" | "run_local_script" | "run_script" | "run_shiten_command"
  | "update_file" | "create_file" | "remove_file" | "update_backlog_status"
  | "archive_plan" | "auto_populate_next_p0";

// Fonte única de verdade em runtime, gerada a partir do tipo acima.
export const VALID_ACTION_TYPES: readonly ActionType[] = [
  "update_context_buffer", "create_reminder", "remove_reminder",
  "update_quick_board", "create_adr", "create_skill", "log_event",
  "send_notification", "trigger_assessment", "trigger_health_check",
  "update_backlog", "run_local_script", "run_script", "run_shiten_command",
  "update_file", "create_file", "remove_file", "update_backlog_status",
  "archive_plan", "auto_populate_next_p0",
] as const;
```
```ts
// src/constants.ts — reexportar em vez de manter uma segunda lista manual
export { VALID_ACTION_TYPES } from "./rule-engine.js";
```

Teste de guarda (não existe hoje — teria pego RULE-019.json no CI):
```ts
// src/__tests__/rule-templates.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateRule } from "../rule-engine.js";

describe("shipped rule templates", () => {
  const dir = "src/templates/base/governance/rules";
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    it(`${file} deve ser uma regra válida`, () => {
      const rule = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      expect(validateRule(rule)).toEqual([]);
    });
  }
});
```

**Bug 2 — detecção de stack, adicionar sinais de base:**
```ts
// src/analyser.ts
const stackMap: Record<string, string[]> = {
  // ...existentes (react, vue, next, etc.)...
  typescript: ["typescript"],
  express: ["express"],
  fastify: ["fastify"],
  nestjs: ["@nestjs/core"],
};

function detectStack(rootDir: string): string[] {
  const stack: string[] = [];
  const pkg = readPackageJson(rootDir);

  if (existsSync(join(rootDir, "tsconfig.json"))) stack.push("typescript");
  if (pkg) stack.push("node");

  if (!pkg) return [...new Set(stack)];
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, deps] of Object.entries(stackMap)) {
    if (deps.some((d) => d in allDeps)) stack.push(name);
  }
  return [...new Set(stack)];
}
```

**Bug 3 — criticidade condicional de documentos de governança:**
```ts
// src/state-manager.ts — expectedDocs precisa saber quais capacidades estão instaladas
function buildExpectedDocs(installedCapabilities: Capability[]) {
  return [
    { name: "AGENTS.md", path: "docs/AGENTS.md", critical: true },
    { name: "FORBIDDEN_OPERATIONS.md", path: "docs/FORBIDDEN_OPERATIONS.md", critical: true },
    { name: "DESDO.md", path: "docs/DESDO.md", critical: true },
    { name: "CONCEPTUAL_MODEL.md", path: "docs/CONCEPTUAL_MODEL.md", critical: false },
    { name: "KNOWLEDGE_LIFECYCLE.md", path: "docs/KNOWLEDGE_LIFECYCLE.md", critical: false },
    // WORKFLOW.md só é crítico se a capacidade governance foi de fato instalada
    { name: "WORKFLOW.md", path: "governance/WORKFLOW.md",
      critical: installedCapabilities.includes("governance") },
    { name: "SYSTEM_MAP.md", path: "governance/SYSTEM_MAP.md", critical: false },
  ];
}
```
Propagar `installedCapabilities` (lido de `maturity-profile.json`) para dentro da função que hoje monta `expectedDocs` como lista estática.

**Bug 5 — distinguir "skipped" de "success" no pipeline:**
```ts
// src/pipeline.ts
export interface PipelineContext {
  // ...
  stageResults: Array<{ stage: string; duration: number; status: "success" | "failed" | "skipped" }>;
}

// dentro de execute(), após stage.execute(current):
const skipped = (current as { __lastStageSkipped?: boolean }).__lastStageSkipped === true;
current.stageResults.push({
  stage: stage.name,
  duration,
  status: skipped ? "skipped" : "success",
});
```
```ts
// src/commands/run.ts — evolveStage sinaliza explicitamente que pulou
const evolveStage: PipelineStage = {
  name: "evolve",
  description: "Generate evolution recommendations",
  execute: async (ctx: PipelineContext) => {
    if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.shitenDir, false)) {
      console.log(chalk.yellow("  ⚠ Skipping evolve stage (requires 'governed' state)"));
      return { ...ctx, __lastStageSkipped: true };
    }
    const report = analyzeEvolution(ctx.projectRoot, ctx.shitenDir);
    writeEvolutionReport(ctx.shitenDir, report);
    return { ...ctx, evolutionReport: report, __lastStageSkipped: false };
  },
};
```
```ts
// resumo final do comando run
const successCount = result.stageResults.filter((s) => s.status === "success").length;
const skippedCount = result.stageResults.filter((s) => s.status === "skipped").length;
const failCount = result.stageResults.filter((s) => s.status === "failed").length;
spinner.succeed(
  `Pipeline complete — ${successCount} succeeded` +
  (skippedCount > 0 ? `, ${skippedCount} skipped` : "") +
  (failCount > 0 ? `, ${failCount} failed` : "")
);
```

### Fase 5 — Ponto único de acesso ao Engineering State para todos os comandos

Hoje, 15 arquivos em `src/commands/` importam `fs` diretamente e recomputam peças do estado de forma independente. Criar um accessor único e obrigatório:

```ts
// src/engineering-state-access.ts (novo arquivo)
import { consolidateEngineeringState, saveEngineeringState, type EngineeringState } from "./engineering-state.js";

/**
 * Ponto único de leitura do Engineering State para comandos.
 * Garante que, dentro da mesma invocação de CLI, todo comando (status,
 * doctor, audit, run) enxergue exatamente o mesmo snapshot — evita
 * recomputar N vezes e divergir por causa de mudanças no meio da execução.
 */
let cachedState: EngineeringState | null = null;

export function getEngineeringState(
  projectRoot: string,
  shitenDir: string,
  forceRefresh = false
): EngineeringState {
  if (!forceRefresh && cachedState) return cachedState;
  cachedState = consolidateEngineeringState(projectRoot, shitenDir);
  saveEngineeringState(shitenDir, cachedState);
  return cachedState;
}
```

Migrar `status.ts`, `doctor.ts`, `audit.ts`, `run.ts` (e os demais 11 comandos que hoje leem fs diretamente) para chamar `getEngineeringState(...)` em vez de recompor peças soltas (`loadMaturityProfile` + heurística + `auditHealth` + ...) de forma independente.

### Fase 6 — Guardas arquiteturais (impedir que o problema volte)

```js
// .eslintrc.js (ou equivalente)
module.exports = {
  overrides: [
    {
      files: ["src/commands/*.ts"],
      rules: {
        "no-restricted-imports": ["error", {
          paths: [{
            name: "node:fs",
            message: "Comandos não devem ler o filesystem diretamente. Use getEngineeringState() de engineering-state-access.ts."
          }]
        }]
      }
    },
    {
      // exceção explícita: só estes módulos podem tocar fs diretamente
      files: [
        "src/engineering-state.ts", "src/maturity-profile.ts",
        "src/state-manager.ts", "src/analyser.ts"
      ],
      rules: { "no-restricted-imports": "off" }
    }
  ]
};
```

```ts
// src/__tests__/architecture-boundaries.test.ts
import { readdirSync, readFileSync } from "node:fs";

describe("boundary: commands não leem filesystem diretamente", () => {
  const commandsDir = "src/commands";
  for (const file of readdirSync(commandsDir).filter((f) => f.endsWith(".ts"))) {
    it(`${file} não importa node:fs`, () => {
      const content = readFileSync(`${commandsDir}/${file}`, "utf-8");
      expect(/from ["']node:fs["']/.test(content)).toBe(false);
    });
  }
});
```

### Fase 7 — Teste de aceitação final (critério de "pronto")

Escrever **antes** de considerar o plano concluído — deve começar falhando (prova que captura os bugs reais) e passar a passar só ao final da Fase 5:

```ts
// src/__tests__/single-source-of-truth.test.ts
describe("Engineering State é fonte única de verdade", () => {
  it("status, doctor e audit reportam o mesmo health score e as mesmas capacidades", async () => {
    const { projectRoot, shitenDir } = await createFixtureProject(); // helper já existente na suíte

    const state = getEngineeringState(projectRoot, shitenDir, true);

    const statusOutput = await runCommandCapture("status", { dir: projectRoot });
    const doctorOutput = await runCommandCapture("doctor", { dir: projectRoot });
    const auditOutput = await runCommandCapture("audit", { dir: projectRoot });

    expect(extractCapabilities(statusOutput)).toEqual(state.capabilities);
    expect(extractHealthScore(doctorOutput)).toEqual(state.healthScores.overall);
    expect(extractHealthScore(auditOutput)).toEqual(state.healthScores.overall);
  });

  it("shiten run nunca reporta um estágio pulado como sucesso", async () => {
    const { projectRoot } = await createFixtureProject({ lifecycle: "ungoverned" });
    const output = await runCommandCapture("run", { dir: projectRoot });
    expect(output).toMatch(/skipped/i);
    expect(output).not.toMatch(/evolve.*✔|✔.*evolve/);
  });
});
```

---

## Ordem de execução recomendada

1. **Fase 7 (parcial)** — escrever o teste de aceitação primeiro, deixá-lo falhar (prova que os bugs são reais e reprodutíveis em teste automatizado, não só manualmente)
2. **Fase 1 + 2** — corrigir consolidação e governança (raiz do problema, inclusive risco de automação incorreta)
3. **Fase 3** — renomear função de heurística + corrigir `status.ts`
4. **Fase 4** — corrigir Bugs 1, 2, 3, 5 (independentes, podem ser paralelizados entre devs/agentes)
5. **Fase 5** — accessor único + cache por invocação (refatoração maior, toca os 15 arquivos de comando)
6. **Fase 6** — lint/CI guard (rede de segurança permanente)
7. **Fase 7 (final)** — rodar o teste de aceitação; deve passar

## Critério de conclusão

Rodar qualquer par de comandos (`status` + `doctor`, `audit` + `run`) sobre o mesmo estado de projeto nunca deve produzir dois números diferentes para o mesmo fato (health score, capacidades instaladas, resultado de estágio). Esse é o teste de aceitação real da promessa "Engineering State é fonte única de verdade" — não um detalhe de UX.
