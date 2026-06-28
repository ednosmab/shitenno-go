# 05 — THREE-TIER STATE

> Knowledge is permanent. State is current. Memory is temporary.

## The Principle

Every piece of information in Nexus belongs to exactly one of three tiers. Mixing these tiers causes confusion, bugs, and governance failures.

## The Three Tiers

### Knowledge (Permanent)

Knowledge artifacts survive across sessions. They represent decisions made, patterns discovered, and agreements formalized.

```typescript
interface KnowledgeState {
  adrs: Array<{ id: string; title: string; status: string; path: string }>;
  skills: Array<{ id: string; name: string; path: string }>;
  contracts: Array<{ id: string; name: string; role: string; path: string }>;
  governanceDocs: Array<{ name: string; path: string; critical: boolean }>;
  scripts: Array<{ id: string; name: string; path: string }>;
  runbooks: Array<{ id: string; name: string; path: string }>;
}
```

**Storage:** Files on disk under `nexus-system/`
**Lifetime:** Until explicitly archived or deleted
**Examples:** ADRs, skills, contracts, workflows, runbooks, scripts

### State (Current)

State represents where the project is right now. It changes as the project evolves.

```typescript
interface ProjectState {
  maturity: {
    overallScore: number;
    dimensions: Record<string, number>;
    computedAt: string;
  } | null;
  installedCapabilities: string[];
  recommendedCapabilities: string[];
  knowledgeDebt: {
    totalGaps: number;
    healthScore: number;
    detectedAt: string;
  } | null;
  complexity: {
    score: number;
    level: string;
    computedAt: string;
  } | null;
  projectInfo: {
    name: string;
    stack: string[];
    hasGit: boolean;
    hasCI: boolean;
    hasTests: boolean;
    hasTypeScript: boolean;
    packageCount: number;
    sourceFileCount: number;
  };
}
```

**Storage:** `maturity-profile.json`, `reports/`, analyser output
**Lifetime:** Overwritten on each analysis
**Examples:** Maturity score, complexity score, installed capabilities

### Memory (Temporary)

Memory exists only for the duration of a session. It tracks what's happening right now.

```typescript
interface SessionMemory {
  sessionId: string | null;
  branch: string | null;
  operationType: string | null;
  currentTask: {
    id: string | null;
    type: string | null;
    description: string | null;
    status: string | null;
  };
  quickBoard: {
    emCurso: string | null;
    parado: string[];
    proximo: string[];
  };
  reminders: string[];
  nextSteps: string[];
  blockers: string[];
  documentsLoaded: string[];
}
```

**Storage:** `governance/context/context_buffer.yaml`
**Lifetime:** Single session, cleared on session close
**Examples:** Current task, blockers, reminders, loaded documents

## The Consolidation Function

```typescript
function consolidateState(
  projectRoot: string,
  nexusDir: string
): NexusState {
  return {
    knowledge: readKnowledgeState(nexusDir),
    project: readProjectState(projectRoot, nexusDir),
    memory: readSessionMemory(nexusDir),
    consolidatedAt: new Date().toISOString(),
  };
}
```

This function merges all three tiers into a single snapshot. It is read-only — it never modifies state.

## Why Separation Matters

| Without Separation | With Separation |
|-------------------|-----------------|
| A session reminder looks like an ADR | Reminders are in Memory, ADRs in Knowledge |
| A maturity score gets archived with decisions | Scores are in State, decisions in Knowledge |
| Clearing session data deletes governance docs | Session cleanup only touches Memory |
| AI agents confuse temporary with permanent | Agents can be told which tier to read |

## Data Flow

```
Knowledge (disk)  ──┐
                    ├──▶ consolidateState() ──▶ NexusState (snapshot)
State (disk)     ──┤
                    │
Memory (buffer)  ──┘
```

Each tier is read independently. The consolidation function is a pure merge — no side effects, no mutations.

## Implementation

- **Reader functions:** `readKnowledgeState()`, `readProjectState()`, `readSessionMemory()`
- **Consolidation:** `consolidateState()`
- **Report:** `stateToText()`
- **File:** `src/state-manager.ts`
