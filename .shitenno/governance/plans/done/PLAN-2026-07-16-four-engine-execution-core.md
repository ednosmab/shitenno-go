# Plano de Ação — Núcleo de Execução Unificado (4 Engines)

**Status:** Done
**Updated_at:** 2026-07-17T05:55:00.609Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Justificado por:** ADR-008-human-over-autonomous-precedence.md, ADR-009-unified-execution-core.md
**Substitui/expande:** PLAN-2026-07-16-decision-core-convergence.md (aquela versão só cobria `action-engine`/`rule-engine`; esta cobre as quatro engines com autoridade real: `action-engine`, `rule-engine/actions`, `autofix-engine`, `policy-engine`)
**Depende de:** PLAN-2026-07-16-cli-daemon-authority-arbitration.md (Fases 1-3, fornece `ACTION_TIER` e o mecanismo de claim de recurso)

---

## Recapitulando o achado (as quatro engines, com evidência)

| Engine | Executa de verdade? | Tem auditoria/rollback? | Consultada por política? |
|---|---|---|---|
| `action-engine.ts` (`shiten act`) | **Não** — `ScriptExecutor`/`CreateReminderExecutor` são stubs | Sim (`FileExecutionRepository`, hash, rollback record) | Não |
| `rule-engine/actions.ts` (daemon) | Sim (`execSync` com `isScriptAllowed`) | Não | Não |
| `audit/autofix-engine.ts` | Sim (backup + `execSync` de verificação + revert automático, threshold 0.85) | Parcial (revert automático, mas sem `ExecutionRecord` compartilhado) | Não |
| `policy-engine.ts` | N/A (não executa, só avalia) | N/A | **É a política, mas ninguém a consulta** |

---

## FASE 1: `decision-core/tiers.ts` e `precedence.ts` (reaproveitados)

Já especificados em PLAN-2026-07-16-cli-daemon-authority-arbitration.md, Fases 1-2. Não recriar — importar de lá. Se aquele plano ainda não rodou, ele é pré-requisito bloqueante desta fase.

---

## FASE 2: `decision-core/policy-gate.ts` — Consultar `policy-engine.ts` (0.5 dia)

```typescript
import type { PolicyEngine, PolicyEvaluation } from "../policy-engine.js";
import type { RuleAction, RuleContext } from "../domain/rules/rule.js";

export interface PolicyGateResult {
  allowed: boolean;
  reason?: string;
  evaluation?: PolicyEvaluation;
}

export function checkPolicyGate(
  action: RuleAction,
  context: RuleContext,
  policyEngine: PolicyEngine
): PolicyGateResult {
  const evaluation = policyEngine.evaluate({
    actionType: action.type,
    ...action.params,
    shitenDir: context.shitenDir,
  });

  const enforced = evaluation.results.find((r) => r.violated && r.mode === "enforce");
  if (enforced) {
    return { allowed: false, reason: enforced.message, evaluation };
  }

  // Advisory violations não bloqueiam, mas devem gerar visibilidade
  const advisory = evaluation.results.filter((r) => r.violated && r.mode === "advisory");
  if (advisory.length > 0) {
    for (const a of advisory) {
      publishChallenge({ severity: "low", message: `Policy warning (non-blocking): ${a.message}` });
    }
  }

  return { allowed: true, evaluation };
}
```

**Critério de aceite:** uma política `enforce` que proíbe, por exemplo, `remove_file` em caminhos de `src/` fora de teste, bloqueia a ação mesmo que ela já tivesse passado no gate de tier/precedência do ADR-008. Uma política `advisory` não bloqueia, mas gera um `challenge.generated` visível.

---

## FASE 3: Migrar os Três Executores Reais (2-2.5 dias)

### 3.1 `decision-core/executors/run-script.ts` — de `rule-engine/actions.ts`
```typescript
import { execSync } from "node:child_process";
import { isScriptAllowed, getAllowedScriptCommand } from "../../rule-engine/security.js";
import type { ActionExecutor } from "./types.js";

export class RunScriptExecutor implements ActionExecutor {
  name = "run_script" as const;

  async execute(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const script = String(params.script ?? "");
    if (!isScriptAllowed(script)) {
      throw new Error(`Script not in allowlist: ${script}`);
    }
    const command = getAllowedScriptCommand(script);
    const output = execSync(command, { encoding: "utf-8", timeout: 60_000 });
    return { executed: true, script, output: output.slice(0, 2000) };
  }
}
```
Mesma estrutura para `RunLocalScriptExecutor` e `RunShitenCommandExecutor` — código já existente em `rule-engine/actions.ts`, só realocado e envolvido na interface `ActionExecutor`.

### 3.2 `decision-core/executors/create-reminder.ts` — de `rule-engine/actions.ts`
Migrar o bloco `case "create_reminder"` (manipulação real de `context_buffer.yaml`) tal como está, só trocando `return { success, message }` pelo shape de retorno de `ActionExecutor.execute`.

### 3.3 `decision-core/executors/apply-autofix.ts` — de `audit/autofix-engine.ts`
**Este é o mais delicado — preservar a garantia de confiança/verificação, não só portar a função:**
```typescript
import { applyAndVerify, type ApplyResult } from "../../audit/autofix-engine.js"; // reexport, não reescrita
import type { ActionExecutor } from "./types.js";

export class ApplyAutofixExecutor implements ActionExecutor {
  name = "apply_autofix" as const; // novo tipo de ActionType, ver Fase 4

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const suggestion = params.suggestion as Suggestion; // shape já definido em suggestion-engine.ts
    const result: ApplyResult = applyAndVerify(suggestion, context.projectRoot, {
      minConfidence: 0.85, // preservar o default — não abaixar isso na migração
      dryRun: Boolean(params.dryRun),
    });
    if (result.status === "reverted") {
      throw new Error(`Autofix reverted: ${result.reason}`);
    }
    return { status: result.status, suggestion: result.suggestion };
  }
}
```
**Nota importante para o agente:** `applyAndVerify` continua vivendo em `audit/autofix-engine.ts` — este executor é um **adaptador**, não uma reescrita. O motivo de não mover a lógica inteira é que `autofix-engine.ts` tem uma garantia própria (backup + revert automático via `tsc --noEmit`) que é específica do domínio de audit e não deve ser generalizada/diluída só para caber no molde dos outros executores.

**Critério de aceite da Fase 3:** todos os testes existentes de `rule-engine/actions.ts` e `audit/autofix-engine.ts` continuam passando, agora exercitando os executores migrados/adaptados.

---

## FASE 4: Estender `ACTION_TIER` e o Schema de Ação (0.5 dia)

`apply_autofix` é um tipo de ação novo (hoje `autofix-engine.ts` não passa pelo rule-engine, é chamado direto por `shiten audit --fix`). Adicionar:

```typescript
// decision-core/tiers.ts
export const ACTION_TIER: Record<ActionType, 1 | 2 | 3> = {
  // ...já existentes...
  apply_autofix: 3, // mutação de arquivo de código-fonte — sempre Tier 3
};
```

`VALID_ACTION_TYPES` (`rule-engine/validation.ts`) ganha `"apply_autofix"` na lista.

**Critério de aceite:** `shiten audit --fix` (que hoje chama `autofix-engine.ts` direto) passa a rotear por `invoke.ts` com `mode: "deliberate"` — o usuário rodou o comando, é decisão humana, não precisa do gate de Tier 3, mas passa pelo `policy-gate.ts` e fica registrado em `execution-log.ts` como qualquer outra ação.

---

## FASE 5: `invoke.ts` Final — Integrando Tier + Policy + Execução (1 dia)

```typescript
export async function invokeAction(params: InvokeActionParams): Promise<InvokeResult> {
  const { action, context, mode } = params;

  // 1. Gate de política — roda ANTES de qualquer outra checagem (ADR-009)
  const policyResult = checkPolicyGate(action, context, getPolicyEngine(context.shitenDir));
  if (!policyResult.allowed) {
    return { success: false, blocked: true, message: `Blocked by policy: ${policyResult.reason}` };
  }

  // 2. Gate de precedência/tier — só relevante em modo autonomous (ADR-008)
  const tier = ACTION_TIER[action.type];
  if (mode === "autonomous") {
    if (tier === 2 && isResourceClaimed(getResourceIdFromAction(action))) {
      publishChallenge({ severity: "low", message: `Deferred "${action.type}" — resource in active use` });
      return { success: false, deferred: true, message: "Deferred" };
    }
    if (tier === 3 && !params.ruleAutonomousFlag) {
      publishChallenge({ severity: "medium", message: `Proposed "${action.type}" — confirm via shiten act` });
      return { success: false, deferred: true, message: "Proposed, awaiting confirmation" };
    }
  }

  // 3. Execução real + auditoria (mesma lógica já descrita no plano anterior)
  const executor = EXECUTORS[action.type];
  const executionId = randomUUID();
  const record = startExecutionRecord(executionId, action, mode);
  try {
    const result = await executor.execute(action.params, context);
    finishExecutionRecord(record, "completed", result);
    return { success: true, message: `Executed ${action.type}` };
  } catch (err) {
    finishExecutionRecord(record, "failed", { error: String(err) });
    return { success: false, message: `Failed: ${err}` };
  }
}
```

**Critério de aceite:** uma ação bloqueada por política nunca chega a ser tentada (não gera `ExecutionRecord` de tentativa) — política é veto antes de qualquer coisa, não um executor que falha.

---

## FASE 6: Rewire dos Quatro Chamadores (1.5 dia)

- `src/rule-engine/engine.ts` → `invokeAction({ mode: "autonomous", ruleId })`
- `src/action-engine.ts` (`shiten act`) → `invokeAction({ mode: "deliberate", sessionId })`
- `src/commands/audit.ts` (fluxo `--fix`) → `invokeAction({ mode: "deliberate", sessionId, action: { type: "apply_autofix", params: { suggestion } } })`
- Qualquer outro chamador direto de `PolicyEngine.evaluate` fora deste fluxo — auditar se deveria passar a rotear por `invoke.ts` também, para não criar uma quinta porta de entrada.

**Critério de aceite:** `grep -rn "executeAction(" src --include="*.ts"` e `grep -rn "applyAndVerify(" src/commands --include="*.ts"` só retornam chamadas de dentro de `decision-core/`, não de fora.

---

## FASE 7: Descomissionar (0.5 dia)

Remover as classes stub de `action-engine.ts` (`ScriptExecutor`, `CreateReminderExecutor` antigos) e os `case` blocks já migrados de `rule-engine/actions.ts`. Manter `autofix-engine.ts` como está (o executor da Fase 3.3 é um adaptador, não uma substituição) — só remover a chamada direta a `applyAndVerify` de dentro de `commands/audit.ts`, trocando por `invokeAction`.

---

## Sequenciamento

```
Depende de: PLAN-2026-07-16-cli-daemon-authority-arbitration.md (Fases 1-3)

DIA 1:      Fase 1 (import de tiers/precedence já existentes) + Fase 2 (policy-gate)
DIA 2-3.5:  Fase 3 (migrar os três executores reais)
DIA 4:      Fase 4 (estender tier/schema para apply_autofix)
DIA 5:      Fase 5 (invoke.ts final)
DIA 6-6.5:  Fase 6 (rewire dos quatro chamadores)
DIA 7:      Fase 7 (descomissionar)
```

**Total: ~7 dias**, depois do plano de arbitragem.

---

## Ordem Geral Consolidada (todos os planos até agora)

```
1. PLAN-2026-07-16-system-resilience-REVISADO.md         7-10 dias
2. PLAN-2026-07-16-daemon-log-rotation.md                 0.5-1 dia
3. PLAN-2026-07-16-cli-daemon-authority-arbitration.md    3.5-4 dias
4. PLAN-2026-07-16-four-engine-execution-core.md (este)   ~7 dias
5. PLAN-2026-07-16-daemon-full-integration.md              3-4 dias
                                                    Total: ~21-26 dias
```

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---|---|---|
| Engines com autoridade de execução sem coordenação | 4, isoladas | 1 núcleo, 3 executores adaptados |
| `shiten act` executando scripts de verdade | Não | Sim |
| Ações de qualquer origem consultando política antes de agir | Nenhuma | Todas, via `policy-gate.ts` |
| `apply_autofix` com registro de execução auditável | Não (isolado do resto) | Sim, mesmo `execution-log.ts` das demais ações |
| Pontos de entrada externos para execução de ação | 4 (um por engine) | 1 (`invoke.ts`) |
