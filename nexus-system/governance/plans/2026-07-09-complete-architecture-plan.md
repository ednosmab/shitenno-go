# Plano Completo: Nexus System — Reactive + Proactive + Histórico + Agentes IA

> **Data:** 2026-07-09
> **Estado:** Planeado
> **Fases:** 15 (1-5 "hoje" + A-D "amanhã" + E-F limpeza)
> **Estimativa:** ~2.050 linhas, ~30 ficheiros

---

## Visão Geral

Transformar o Nexus num sistema reactivo, proactivo, com histórico consultável e interface para agentes de IA — eliminando código morto, unificando health scores, e completando a visão de "amanhã" sem orquestração multi-agente.

## Arquitectura Alvo

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROACTIVE-DRIVEN (Fase 3 + B)               │
│  Tendências, recomendações automáticas, challenges dinâmicos    │
├─────────────────────────────────────────────────────────────────┤
│                     REACTIVE-DRIVEN (Fase 1)                    │
│  Eventos → Engineering State consolida → comandos subscrevem    │
├─────────────────────────────────────────────────────────────────┤
│                     HISTÓRICO (Fase A)                          │
│  Snapshots acumulativos, retenção, query temporal               │
├─────────────────────────────────────────────────────────────────┤
│                     AGENTES IA (Fase C)                         │
│  nexus context --for-agent, seleção de modelo, schema estável  │
├─────────────────────────────────────────────────────────────────┤
│                     REPORT-DRIVEN (Fase 2)                      │
│  Comandos leem estado consolidado → display ao utilizador       │
├─────────────────────────────────────────────────────────────────┤
│                     EVENT-DRIVEN (capô)                         │
│  Event Bus + Subscribers + Dead-Letter + Persistência           │
└─────────────────────────────────────────────────────────────────┘
```

## Ordem de Execução

```
Fase 1 (reativo) ──▶ Fase 2 (comandos) ──▶ Fase 3 (proactive) ──▶ Fase 4 (limpar)
                                                                      │
                                                                      ▼
Fase 5 (health scores)                                          Fase E (módulos órfãos)
                                                                      │
Fase A (histórico) ◀─────────────────────────────────────────────────┘
     │
     ├──▶ Fase D (mutações) ─────────────────────────────────┐
     │                                                         │
     └──▶ Fase B (tendências) ──▶ Fase C (agentes IA) ◀──────┘
                                                          │
                                                          ▼
                                                    Fase F (eventos)
```

---

## FASE 1 — Engineering State como orquestrador reativo

**Objetivo:** `consolidateEngineeringState()` subscreve eventos e reconsolida automaticamente.

### Passo 1.1: Criar `initializeEngineeringState()` em `engineering-state.ts`

```typescript
// Adicionar no final de engineering-state.ts

export function initializeEngineeringState(
  projectRoot: string,
  nexusDir: string
): () => void {
  const bus = getEventBus();

  const reconsolidate = () => {
    const state = consolidateEngineeringState(projectRoot, nexusDir);
    saveEngineeringState(nexusDir, state);
  };

  const unsubscribers = [
    bus.subscribe("maturity.changed", reconsolidate),
    bus.subscribe("debt.detected", reconsolidate),
    bus.subscribe("knowledge.analyzed", reconsolidate),
    bus.subscribe("lifecycle.state_changed", reconsolidate),
    bus.subscribe("asset.created", reconsolidate),
    bus.subscribe("asset.updated", reconsolidate),
    bus.subscribe("asset.archived", reconsolidate),
  ];

  return () => unsubscribers.forEach((unsub) => unsub());
}
```

### Passo 1.2: Integrar no bootstrap `bin/nexus.ts`

```typescript
// Após initializeTaskPipeline():
initializeEngineeringState(projectRoot, nexusDir);
```

### Passo 1.3: Criar teste `src/__tests__/reactive-state.test.ts`

- Testar que `initializeEngineeringState()` subscreve eventos
- Testar que `maturity.changed` triggers reconsolidação
- Testar que `engineering_state.consolidated` é publicado
- Testar cleanup (unsubscribe)

**Validação:** `pnpm run test`

---

## FASE 2 — Comandos subscrevem `engineering_state.consolidated`

**Objetivo:** Comandos recebem estado via evento em vez de ler `node:fs`.

### Passo 2.1: Criar `src/engineering-state-subscription.ts`

```typescript
import { getEventBus } from "./event-bus.js";
import { consolidateEngineeringState, type EngineeringState } from "./engineering-state.js";

export function subscribeToEngineeringState(
  projectRoot: string,
  nexusDir: string
): { getState: () => EngineeringState; unsubscribe: () => void } {
  const bus = getEventBus();
  let latestState = consolidateEngineeringState(projectRoot, nexusDir);

  const unsubscribe = bus.subscribe("engineering_state.consolidated", () => {
    latestState = consolidateEngineeringState(projectRoot, nexusDir);
  });

  return {
    getState: () => latestState,
    unsubscribe,
  };
}
```

### Passo 2.2: Migrar `doctor.ts`

- Remover `import { existsSync } from "node:fs"`
- Remover `import { consolidateState } from "../state-manager.js"`
- Adicionar `import { subscribeToEngineeringState } from "../engineering-state-subscription.js"`
- Substituir `consolidateState()` por `getState()`
- Chamar `unsubscribe()` no fim

### Passo 2.3: Migrar `digest.ts`

- Remover `import { readFileSync, existsSync } from "node:fs"`
- Usar `state.maturity?.overallScore`, `state.knowledgeDebt?.totalGaps`

### Passo 2.4: Migrar `mcp.ts`

- Remover `import { existsSync } from "node:fs"`
- Usar `getState()` para verificar inicialização

### Passo 2.5: Migrar `status.ts` (parcial)

- Substituir `consolidateEngineeringState()` por `getState()`
- Manter fs reads para writes legítimos e input externo

### Passo 2.6: Actualizar `eslint.config.js`

Remover excepções: `doctor.ts`, `digest.ts`, `mcp.ts`

**Validação:** `pnpm run lint && pnpm run test`

---

## FASE 3 — Proactive Level 1 (wiring)

**Objetivo:** Ligamos `recommendation-engine` e `challenge-generator` ao ciclo reativo.

### Passo 3.1: Criar `src/proactive-engine.ts`

```typescript
import { getEventBus } from "./event-bus.js";
import { runRecommendationEngine } from "./recommendation-engine.js";
import { evaluateCapabilities } from "./capability-engine.js";
import { consolidateEngineeringState } from "./engineering-state.js";

export function initializeProactiveEngine(
  projectRoot: string,
  nexusDir: string
): () => void {
  const bus = getEventBus();

  const onStateConsolidated = async () => {
    const state = consolidateEngineeringState(projectRoot, nexusDir);
    const capResult = evaluateCapabilities(state, nexusDir);
    const recResult = runRecommendationEngine(state, capResult, nexusDir);

    const highPriority = recResult.recommendations.filter((r) => r.priority === "high");
    if (highPriority.length > 0) {
      bus.publish("evolution.recommended", {
        totalRecommendations: highPriority.length,
        byPriority: { high: highPriority.length, medium: 0, low: 0 },
        source: "proactive-engine",
      });
    }

    if (state.entropy.score > 30) {
      bus.publish("challenge.generated", {
        type: "entropy_reduction",
        severity: state.entropy.score > 50 ? "high" : "medium",
        description: `Entropy score is ${state.entropy.score}/100`,
      });
    }
  };

  const unsubscribe = bus.subscribe("engineering_state.consolidated", onStateConsolidated);
  return unsubscribe;
}
```

### Passo 3.2: Integrar no bootstrap `bin/nexus.ts`

### Passo 3.3: Adicionar `challenge.generated` ao event bus

Em `event-bus.ts`: `| "challenge.generated"`

Em `event-payloads.ts`:
```typescript
export interface ChallengeGeneratedPayload extends EventMeta {
  type: "entropy_reduction" | "knowledge_gap" | "capability_stale";
  severity: "low" | "medium" | "high";
  description: string;
}
```

### Passo 3.4: Criar teste `src/__tests__/proactive-engine.test.ts`

**Validação:** `pnpm run test`

---

## FASE 4 — Limpar sistemas paralelos

**Objetivo:** Eliminar `consolidateState()` de state-manager.

### Passo 4.1: Deprecar `consolidateState()` em `state-manager.ts`

```typescript
/** @deprecated Use consolidateEngineeringState() from engineering-state.ts instead. */
export function consolidateState(projectRoot: string, nexusDir: string): NexusState {
  // ... existing code ...
}
```

### Passo 4.2: Migrar `auto-evolution.ts` (linha 317)

- Remover `import { consolidateState } from "./state-manager.js"`
- Usar `consolidateEngineeringState()` ou `subscribeToEngineeringState()`

### Passo 4.3: Manter só `SessionMemory` em `state-manager.ts`

### Passo 4.4: Criar teste `src/__tests__/single-source-of-truth-v2.test.ts`

**Validação:** `pnpm run lint && pnpm run test`

---

## FASE 5 — Health Score Unification

**Objetivo:** Unificar as 3 fórmulas de health score com labels claras.

### Passo 5.1: Criar `src/health-score-registry.ts`

```typescript
export type HealthScoreType = "code_security" | "engineering_risk" | "knowledge_health";

export interface HealthScoreResult {
  type: HealthScoreType;
  label: string;
  score: number;
  maxScore: number;
  formula: string;
}

export function getCodeSecurityScore(issues: HealthIssue[], totalFiles: number): HealthScoreResult {
  // exponential decay (actual health-auditor formula)
}

export function getEngineeringRiskScore(findings: Finding[]): HealthScoreResult {
  // 100 - penalties (actual doctor formula)
}

export function getKnowledgeHealthScore(debt: number, graph: number, entropy: number): HealthScoreResult {
  // weighted average (actual engineering-state formula)
}

export function getOverallHealth(): HealthScoreResult {
  // Combina os 3scores com pesos configuráveis
}
```

### Passo 5.2: Actualizar `engineering-state.ts`

O `healthScores.overall` passa a usar `getOverallHealth()`.

### Passo 5.3: Actualizar `doctor.ts` e `audit.ts`

Display com labels correctas: "Code Health", "Engineering Risk", "Knowledge Health".

### Passo 5.4: Criar teste `src/__tests__/health-score-registry.test.ts`

**Validação:** `pnpm run test`

---

## FASE A — Histórico: de "estado único" para "linha do tempo consultável"

**Depende de:** Fase 1

### Passo A.1: Modificar `saveEngineeringState()` para acumular snapshots

```typescript
// src/engineering-state.ts
export function saveEngineeringState(nexusDir: string, state: EngineeringState): void {
  const snapshotsDir = join(nexusDir, "history", "snapshots");
  mkdirSync(snapshotsDir, { recursive: true });

  const snapshotId = state.consolidatedAt.replace(/[:.]/g, "-");
  const snapshotPath = join(snapshotsDir, `${snapshotId}.json`);
  writeFileSync(snapshotPath, JSON.stringify(state, null, 2), "utf-8");

  // Manter latest para compatibilidade
  const latestPath = join(nexusDir, "engineering-state.json");
  writeFileSync(latestPath, JSON.stringify(state, null, 2), "utf-8");

  pruneOldSnapshots(snapshotsDir);
}
```

### Passo A.2: Política de retenção

```typescript
const RETENTION_POLICY = {
  keepAllWithinDays: 7,
  keepDailyWithinDays: 90,
  keepWeeklyBeyondDays: 90,
};

function pruneOldSnapshots(snapshotsDir: string): void {
  // Agrupar por dia/semana, manter só o mais recente de cada grupo
}
```

### Passo A.3: Criar `src/engineering-state-history.ts`

```typescript
export function getSnapshotAt(nexusDir: string, timestamp: string): EngineeringState | null;
export function listSnapshots(nexusDir: string, range?: { from: string; to: string }): SnapshotMeta[];
export function diffSnapshots(a: EngineeringState, b: EngineeringState): EngineeringStateDelta;
// Reaproveitar IncrementalConsolidator.computeDelta() de engineering-state-evolved.ts
```

### Passo A.4: Criar `src/commands/history.ts`

```
nexus history [--from <date>] [--to <date>] [--diff]
```

### Passo A.5: Criar teste `src/__tests__/engineering-state-history.test.ts`

**Validação:** `nexus history --diff` mostra exactamente o que mudou

---

## FASE D — Governança de mutações (proveniência)

**Depende de:** Fase A

### Passo D.1: Criar `src/engineering-state-mutations.ts`

```typescript
export function proposeStateMutation(
  mutation: StateMutation,
  source: { module: string; trigger: string }
): void {
  const validated = ruleEngine.validateMutation(mutation);
  if (!validated.allowed) {
    logger.warn(`Mutação rejeitada: ${mutation.description}`);
    return;
  }
  saveEngineeringState(mutation.nexusDir, mutation.newState);
  bus.publish("state.mutated", { source, mutation: mutation.description });
}
```

### Passo D.2: Criar teste `src/__tests__/state-mutations.test.ts`

**Validação:** Toda mutação tem proveniência registada

---

## FASE B — Previsão de tendência (substituir threshold estático)

**Depende de:** Fase A

### Passo B.1: Criar `src/trend-engine.ts`

```typescript
export interface TrendPoint { timestamp: string; value: number; }
export interface TrendResult {
  direction: "improving" | "stable" | "degrading";
  slope: number;
  confidence: "low" | "medium" | "high";
  projectedIn30Days: number;
}

export function computeTrend(points: TrendPoint[]): TrendResult {
  // Regressão linear simples sobre últimos N snapshots
}
```

### Passo B.2: Integrar ao Proactive Engine

Substituir `if (state.entropy.score > 30)` por detecção de tendência.

### Passo B.3: Criar teste `src/__tests__/trend-engine.test.ts`

**Validação:** Tendência detectada ANTES de cruzar threshold fixo

---

## FASE C — Interface para agentes IA

**Depende de:** Fases A + B + D

### Passo C.1: Criar `src/commands/context.ts`

```
nexus context --for-agent
```

Output JSON denso e determinístico:
```json
{
  "engineeringState": { ... },
  "recentTrend": { "entropy": "degrading", "knowledgeDebt": "stable" },
  "openRisks": [ ... ],
  "recentDecisions": [ ... ],
  "recommendedNextActions": [ ... ]
}
```

### Passo C.2: Criar `src/model-config.ts`

```typescript
export interface ModelConfig {
  provider: "anthropic" | "opencode";
  model: string;
  contextInjectionMode: "full" | "summary";
}
```

Ler de `answers.json` (já coletado no `nexus init`).

### Passo C.3: Criar teste `src/__tests__/context-command.test.ts`

**Validação:** `nexus context --for-agent` é determinístico

---

## FASE E — Activar Módulos Órfãos

**Objetivo:** 7 módulos mortos (~1.400 linhas) são activados.

### Passo E.1: Activar `doc-engine.ts`

- Subscrever `engineering_state.consolidated`
- Chamar `generateAll(state)` quando estado é consolidado
- Publicar `docs.generated` após geração

### Passo E.2: Activar `context-buffer-writer.ts`

- Subscrever `task.completed`, `session.start`, `session.end`
- Auto-actualizar `context_buffer.yaml`
- Substituir manipulação inline YAML em `task-pipeline.ts`

### Passo E.3: Activar `advanced-infrastructure.ts`

- Integrar `DeadLetterQueue` ao `event-bus.ts` error handling
- Quando handler falha, evento vai para dead-letter queue
- `EventReplayer` disponível para `close-session`

### Passo E.4: Activar `doc-sync-hook.ts`

- Chamar `registerDocSyncHook()` no `bin/nexus.ts` bootstrap
- `file-watcher.ts` já publica `docs.sync.triggered`

### Passo E.5: Activar `validation.ts`

- Adoptar por comandos que duplicam try/catch JSON parsing
- Substituir `JSON.parse` inline em `rule-engine.ts`, `maturity-profile.ts`

### Passo E.6: Activar `errors.ts`

- Substituir `process.exit(1)` por typed errors em comandos
- Commander já caught errors automaticamente

### Passo E.7: Activar `engineering-state-access.ts`

- Usar em `pipeline.ts`, `console/data-collector.ts`, `status.ts`
- Evitar recomputação redundante de `consolidateEngineeringState()`

### Passo E.8: Criar teste `src/__tests__/orphaned-modules.test.ts`

**Validação:** Todos os 7 módulos têm pelo menos 1 subscriber/consumidor

---

## FASE F — Corrigir Eventos Problemáticos

### Passo F.1: Corrigir eventos fantasma (subscribed, never published)

| Evento | Fix |
|--------|-----|
| `session.start` | `cli-middleware.ts` publica no início da CLI |
| `session.end` | `cli-middleware.ts` publica no fim da CLI |
| `plan.archived` | `plan-lifecycle.ts` publica quando plano é arquivado |

### Passo F.2: Corrigir eventos órfão (published, never consumed)

| Evento | Fix |
|--------|-----|
| `command.completed` | Adicionar ao `EVENT_TO_TRIGGER` em `rule-engine.ts` |
| `doc.lifecycle.audited` | Adicionar subscriber em dashboard/metrics |
| `system.updated` | Adicionar ao `EVENT_TO_TRIGGER` em `rule-engine.ts` |

### Passo F.3: Corrigir `pipeline.complete` duplicado

- Split em `pipeline.started` + `pipeline.completed`
- Actualizar `pipeline.ts` para usar os 2 tipos
- Actualizar `rule-engine.ts` EVENT_TO_TRIGGER

### Passo F.4: Criar teste `src/__tests__/event-topology.test.ts`

**Validação:** Todos os eventos têm publisher + subscriber

---

## Mapa Completo de Ficheiros

| Ficheiro | Fase | Acção |
|----------|------|-------|
| `src/engineering-state.ts` | 1, A | +subscriber, +snapshots, +retenção |
| `src/engineering-state-subscription.ts` | 2 | **Novo** |
| `src/proactive-engine.ts` | 3 | **Novo** |
| `src/state-manager.ts` | 4 | Deprecar `consolidateState()` |
| `src/auto-evolution.ts` | 4 | Migrar de consolidateState |
| `src/health-score-registry.ts` | 5 | **Novo** |
| `src/engineering-state-history.ts` | A | **Novo** |
| `src/commands/history.ts` | A | **Novo** |
| `src/engineering-state-mutations.ts` | D | **Novo** |
| `src/trend-engine.ts` | B | **Novo** |
| `src/commands/context.ts` | C | **Novo** |
| `src/model-config.ts` | C | **Novo** |
| `src/doc-engine.ts` | E | Activar |
| `src/context-buffer-writer.ts` | E | Activar |
| `src/advanced-infrastructure.ts` | E | Activar |
| `src/doc-sync-hook.ts` | E | Activar |
| `src/validation.ts` | E | Activar |
| `src/errors.ts` | E | Activar |
| `src/engineering-state-access.ts` | E | Activar |
| `src/event-bus.ts` | F | +`pipeline.started`, +`challenge.generated` |
| `src/event-payloads.ts` | 3, F | +payloads |
| `src/cli-middleware.ts` | F | +publish `session.start/end` |
| `src/plan-lifecycle.ts` | F | +publish `plan.archived` |
| `src/rule-engine.ts` | F | +`command.completed` ao EVENT_TO_TRIGGER |
| `src/commands/doctor.ts` | 2 | Migrar |
| `src/commands/digest.ts` | 2 | Migrar |
| `src/commands/mcp.ts` | 2 | Migrar |
| `src/commands/status.ts` | 2 | Migrar parcialmente |
| `eslint.config.js` | 2 | Remover excepções |
| `bin/nexus.ts` | 1,3,E | +3 imports, +3 chamadas |

---

## Resumo de Acções

| Fase | Ficheiros Novos | Ficheiros Modificados | Linhas est. |
|------|-----------------|----------------------|-------------|
| 1 | 1 (teste) | 2 | ~35 |
| 2 | 2 (helper+teste) | 5 | ~100 |
| 3 | 2 (engine+teste) | 3 | ~80 |
| 4 | 1 (teste) | 2 | ~35 |
| 5 | 2 (registry+teste) | 3 | ~40 |
| A | 3 (history+cmd+teste) | 1 | ~120 |
| D | 2 (mutations+teste) | 0 | ~60 |
| B | 2 (trend+teste) | 1 | ~80 |
| C | 3 (context+model+teste) | 0 | ~100 |
| E | 1 (teste) | 7 | ~200 |
| F | 1 (teste) | 5 | ~60 |
| **Total** | **~20 novos** | **~29 modificados** | **~910** |

---

## Trade-offs Finais

| | Actual | Após Plano |
|---|---|---|
| **Comandos com node:fs** | 14 | 8 (só WRITE/medição) |
| **Sistemas de estado** | 3 paralelos | 1 central |
| **Eventos sem subscriber** | 6 | 0 |
| **Módulos órfãos** | 7 (~1.400 linhas) | 0 |
| **Proactividade** | Nenhuma | Level 1 + tendências |
| **Histórico** | Nenhum | Snapshots + retenção |
| **Agentes IA** | Nenhuma | `nexus context --for-agent` |
| **Health scores** | 3 fórmulas divergentes | 1 unificada com labels |
| **Consistência** | Cada comando calcula | Estado único, reativo |

---

## Critérios de Conclusão

```
pnpm run lint && pnpm run test && pnpm run build — todos passam
nexus history --diff mostra causa (não só efeito)
nexus context --for-agent é determinístico e não requer reanálise
Trocar modelo em answers.json muda formato do contexto, não conteúdo factual
Tendência de degradação detectada ANTES de cruzar threshold fixo
Todos os 7 módulos órfãos têm subscriber
Todos os 6 eventos problemáticos resolvidos
3 fórmulas de health score → 1 unificada com labels
```
