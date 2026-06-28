# 07 — CAPABILITY MODEL

> Install what you need, not what a label dictates.

## The 9 Capabilities

Nexus functionality is organized into 9 modular capabilities. Each capability maps to specific files and directories.

### Capability Definitions

| ID | Name | Dimensions Impacted | Dependencies | Always Installed |
|----|------|-------------------|--------------|-----------------|
| `core` | Core | — | — | Yes |
| `knowledge` | Knowledge | documentation:0.4, quality:0.1 | core | No |
| `architecture` | Architecture | architecture:0.4, documentation:0.2 | core | No |
| `governance` | Governance | governance:0.5, documentation:0.1 | core | No |
| `ai` | AI | ai:0.5, governance:0.2 | governance | No |
| `quality` | Quality | quality:0.4, automation:0.1 | core | No |
| `metrics` | Metrics | observability:0.4, quality:0.1 | quality | No |
| `operations` | Operations | automation:0.4, governance:0.1 | core | No |
| `compliance` | Compliance | governance:0.3, quality:0.2 | governance | No |

### Dependency Graph

```
                    ┌─────────┐
                    │  core   │
                    └────┬────┘
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │knowledge│   │ quality │   │  ops    │
     └─────────┘   └────┬────┘   └─────────┘
                        │
                   ┌────┴────┐
                   │ metrics │
                   └─────────┘
          │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │  arch   │   │ govern. │   │         │
     └─────────┘   └────┬────┘   └─────────┘
                   ┌────┴────┐
              ┌────┴────┐ ┌──┴──────┐
              │  ai     │ │ compli. │
              └─────────┘ └─────────┘
```

## Capability Mapping

Each capability maps to directories and files:

### Core (always installed)
- **Directories:** `nexus-system/`, `nexus-system/docs/`, `nexus-system/scripts/`, `nexus-system/core/`, `nexus-system/governance/`, `nexus-profile/`
- **Files:** AGENTS.md, FORBIDDEN_OPERATIONS.md, DESDO.md, CONCEPTUAL_MODEL.md, KNOWLEDGE_LIFECYCLE.md, BACKLOG.md, SYSTEM_MAP.md, opencode-context.md, Nexus-System_GUIDE.md, types.ts, feedback/README.md

### Knowledge
- **Directories:** `nexus-system/docs/skills/`
- **Files:** 21 skill files (selected based on other installed capabilities)

### Architecture
- **Directories:** `nexus-system/docs/adrs/`, `nexus-system/docs/sdr/`, `nexus-system/docs/plans/`, `nexus-system/docs/session-template/`, `nexus-system/docs/layers/`
- **Files:** ADR-TEMPLATE.md, SDR-TEMPLATE.md, TEMPLATE.md, session-template.md

### Governance
- **Directories:** `nexus-system/governance/context/`
- **Files:** WORKFLOW.md, context_buffer.yaml

### AI
- **Directories:** `nexus-system/governance/contracts/`, `nexus-system/governance/handoffs/`, `nexus-system/governance/policies/`, `nexus-system/cognition/`
- **Files:** 4 agent contracts, CONTRACTS_INDEX.md, handoff template, CONTEXT_HIERARCHY.md, operational memory, 3 prompt READMEs

### Quality
- **Files:** scripts/validate-session.ts

### Metrics
- **Directories:** `nexus-system/reports/`, `nexus-system/docs/history/`
- **Files:** reports/README.md

### Operations
- **Directories:** `nexus-system/docs/runbooks/`
- **Files:** scripts/close-session.ts, scripts/premortem-check.ts, runbooks/merge.md

### Compliance
- **Directories:** `nexus-system/governance/premortem/`, `nexus-system/governance/reviews/`
- **Files:** PREMORTEM.md, SESSION_REVIEW.md

## Recommendation Engine

Capabilities are recommended based on maturity dimension scores:

```typescript
function recommendCapabilities(
  dimensions: MaturityDimensions,
  installed: Capability[]
): Capability[] {
  const recommended: Capability[] = [];
  
  for (const cap of CAPABILITIES) {
    if (cap.alwaysInstalled) continue;
    if (installed.includes(cap.id)) continue;
    
    // Calculate relevance score
    let totalWeight = 0;
    let matchCount = 0;
    for (const [dim, weight] of Object.entries(cap.dimensions)) {
      totalWeight += weight;
      if (dimensions[dim] >= CAPABILITY_THRESHOLD) {
        matchCount += weight;
      }
    }
    
    const relevance = totalWeight > 0 ? (matchCount / totalWeight) * 100 : 0;
    
    if (relevance >= CAPABILITY_THRESHOLD) {
      // Check dependencies
      const depsMet = cap.requires.every(
        (dep) => installed.includes(dep) || recommended.includes(dep)
      );
      if (depsMet) {
        recommended.push(cap.id);
      }
    }
  }
  
  return recommended;
}
```

## Detection

Installed capabilities are detected by filesystem presence:

| Capability | Detection Criteria |
|------------|-------------------|
| `knowledge` | `docs/skills/` or `docs/AGENTS.md` exists |
| `architecture` | `docs/adrs/` or `docs/sdr/` or `docs/plans/` exists |
| `governance` | `governance/WORKFLOW.md` or `governance/context/` exists |
| `ai` | `governance/agents/` or `cognition/` exists |
| `quality` | `scripts/validate-session.ts` exists |
| `metrics` | `reports/` exists |
| `operations` | `scripts/close-session.ts` or `docs/runbooks/` exists |
| `compliance` | `docs/FORBIDDEN_OPERATIONS.md` or `docs/DESDO.md` or `governance/premortem/` exists |

## Implementation

- **Capability definitions:** `CAPABILITIES` array in `src/maturity-profile.ts`
- **File mappings:** `getCapabilityMapping()` in `src/capability-mapping.ts`
- **Detection:** `detectInstalledCapabilities()` in `src/maturity-profile.ts`
- **Recommendation:** `recommendCapabilities()` in `src/maturity-profile.ts`
- **Installation:** `installCapabilities()` in `src/commands/upgrade.ts`
