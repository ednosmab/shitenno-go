# 18 — STATE MACHINE

> Nexus lifecycle gates.

## The States

Nexus itself has a lifecycle. It progresses through states:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  uninitialized → discovered → assessed → governed → evolved     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| State | Description | Entry Criteria |
|-------|-------------|---------------|
| `uninitialized` | No Nexus configuration exists | Default state |
| `discovered` | `nexus init` has been run | opencode.json + nexus-system/ exist |
| `assessed` | Maturity has been evaluated | maturity-profile.json exists |
| `governed` | Governance rules are in place | WORKFLOW.md + contracts exist |
| `evolved` | System has recommended and implemented improvements | evolution report exists |

## State Definitions

```typescript
type NexusLifecycleState = 
  | "uninitialized"
  | "discovered" 
  | "assessed"
  | "governed"
  | "evolved";
```

## State Transitions

```typescript
interface StateTransition {
  from: NexusLifecycleState;
  to: NexusLifecycleState;
  trigger: string;
  guards: Array<(context: PipelineContext) => boolean>;
}
```

### Valid Transitions

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `uninitialized` | `discovered` | `nexus init` | opencode.json created |
| `discovered` | `assessed` | `nexus assess` or `nexus status` | maturity-profile.json exists |
| `assessed` | `governed` | `nexus upgrade --capability governance` | WORKFLOW.md exists |
| `governed` | `evolved` | `nexus run` pipeline completes | evolution report exists |
| `evolved` | `governed` | `nexus assess` (regression) | maturity decreased |
| `governed` | `assessed` | `nexus assess` (regression) | governance removed |

## Invalid Transitions

These transitions are blocked:

| From | To | Why Blocked |
|------|----|-------------|
| `uninitialized` | `assessed` | Must discover first |
| `uninitialized` | `governed` | Must discover first |
| `uninitialized` | `evolved` | Must discover first |
| `discovered` | `evolved` | Must assess first |
| `discovered` | `governed` | Must assess first |

## The State Machine Interface

```typescript
interface NexusStateMachine {
  getState(): NexusLifecycleState;
  canTransition(to: NexusLifecycleState): boolean;
  transition(to: NexusLifecycleState, context: PipelineContext): boolean;
  getHistory(): Array<{ from: NexusLifecycleState; to: NexusLifecycleState; timestamp: string }>;
}
```

## Implementation

```typescript
class DefaultNexusStateMachine implements NexusStateMachine {
  private current: NexusLifecycleState;
  private history: Array<{ from: NexusLifecycleState; to: NexusLifecycleState; timestamp: string }> = [];

  constructor(initialState: NexusLifecycleState = "uninitialized") {
    this.current = initialState;
  }

  getState(): NexusLifecycleState {
    return this.current;
  }

  canTransition(to: NexusLifecycleState): boolean {
    return isValidTransition(this.current, to);
  }

  transition(to: NexusLifecycleState, context: PipelineContext): boolean {
    if (!this.canTransition(to)) return false;

    const from = this.current;
    this.current = to;
    this.history.push({ from, to, timestamp: new Date().toISOString() });

    // Publish event
    getEventBus().publish("lifecycle.state_changed", { from, to });

    return true;
  }

  getHistory() {
    return [...this.history];
  }
}
```

## Detection

The current state is detected from filesystem:

```typescript
function detectLifecycleState(projectRoot: string, nexusDir: string): NexusLifecycleState {
  if (!existsSync(join(projectRoot, "opencode.json"))) return "uninitialized";
  if (!existsSync(join(nexusDir, "maturity-profile.json"))) return "discovered";
  if (!existsSync(join(nexusDir, "governance", "WORKFLOW.md"))) return "assessed";
  
  const reportsDir = join(nexusDir, "reports");
  if (existsSync(reportsDir)) {
    const evolutionReports = readdirSync(reportsDir)
      .filter(f => f.startsWith("evolution-") && f.endsWith(".json"));
    if (evolutionReports.length > 0) return "evolved";
  }
  
  return "governed";
}
```

## Gate Enforcement

Some commands are gated by state:

| Command | Required State |
|---------|---------------|
| `nexus init` | `uninitialized` |
| `nexus status` | `discovered`+ |
| `nexus detect` | `assessed`+ |
| `nexus audit` | `assessed`+ |
| `nexus upgrade` | `assessed`+ |
| `nexus validate` | `discovered`+ |
| `nexus assess` | `discovered`+ |
| `nexus doctor` | `assessed`+ |
| `nexus run` | `assessed`+ |

## Event Integration

State transitions publish events:

```typescript
bus.subscribe("lifecycle.state_changed", ({ from, to }) => {
  console.log(`Nexus lifecycle: ${from} → ${to}`);
});
```

## Implementation

- **File:** `src/nexus-state-machine.ts` (~220 lines)
- **Detection:** `detectLifecycleState()`
- **State machine:** `DefaultNexusStateMachine`
- **Integration:** Commands check state before executing
