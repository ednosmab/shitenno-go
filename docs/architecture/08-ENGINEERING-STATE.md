# 08 — ENGINEERING STATE

> How to measure and govern the health of an engineering project.

## Definition

**Engineering State** is the measurable condition of a project's engineering practices, governance maturity, and knowledge health at a specific point in time.

It is not a single number. It is a multi-dimensional snapshot that回答 three questions:

1. **Where are we now?** (maturity profile)
2. **What's wrong?** (knowledge debt, health issues)
3. **What should we do next?** (recommendations)

## The Three Components

### 1. Maturity Profile

Seven dimensions, each scored 0-100:

| Dimension | What It Measures | Weight |
|-----------|-----------------|--------|
| Architecture | Design docs, ADRs, modularity, monorepo | 0.18 |
| Quality | Tests, linting, TDD practices | 0.18 |
| Automation | CI/CD, scripts, build pipeline | 0.15 |
| Documentation | Skills, guides, runbooks | 0.15 |
| Governance | Workflows, contracts, context buffer | 0.12 |
| AI | Agent contracts, cognition layer | 0.12 |
| Observability | Reports, history, metrics | 0.10 |

**Overall Score:** Weighted average of all dimensions.

### 2. Knowledge Debt

Gaps between what should exist and what does exist:

| Debt Type | Description |
|-----------|-------------|
| `adr_missing` | No ADRs for a project with decisions |
| `runbook_missing` | No runbooks for operational tasks |
| `skill_missing` | No skills extracted from patterns |
| `docs_missing` | Critical governance docs missing |
| `automation_missing` | Manual processes that should be automated |
| `contract_missing` | AI agents without governance contracts |
| `workflow_missing` | No defined workflow |
| `review_missing` | No session review process |
| `test_missing` | No tests for codebase |
| `adr_stale` | ADRs that reference outdated information |

### 3. Recommendations

Prioritized next actions based on current state:

| Priority | Description |
|----------|-------------|
| `urgent` | Must be addressed now |
| `high` | Should be addressed soon |
| `medium` | Worth addressing |
| `low` | Nice to have |

## How It's Measured

### Static Metrics (project structure)

```
packages, apps, files, dependencies, monorepo, TypeScript
```

### Behavioral Metrics (team behavior)

```
commits/week, violations, sessions without close, bug fixes, ADRs, skills
```

### Per-Area Metrics

Each project subdirectory gets its own complexity score:

| Metric | What It Measures |
|--------|-----------------|
| Churn | How often files change |
| Violations | How often rules are broken |
| Sensitive Surface | How many critical files exist |
| Dependency Depth | How many layers of imports |
| Incident-Free Age | How long since last issue |
| Context Pressure | How much context is needed |

## The Analysis Pipeline

```
analyze → score → detect → audit → evolve → recommend
    │        │        │        │        │          │
    │        │        │        │        │          └── Next best action
    │        │        │        │        └── What could improve
    │        │        │        └── What's wrong
    │        │        └── What patterns exist
    │        └── How complex is it
    └── What is the project
```

## Usage

Engineering State is consumed by:

1. **`nexus status`** — Shows current state with health check and complexity
2. **`nexus detect`** — Detects patterns from historical state
3. **`nexus audit`** — Audits governance health
4. **`nexus doctor`** — Provides advisory based on consolidated state
5. **`nexus assess`** — Re-evaluates maturity profile
6. **Auto-evolution** — Recommends system improvements
7. **AI agents** — Receives governed context based on state

## Implementation

- **Scoring engine:** `src/scorer.ts` (917 lines)
- **Maturity profile:** `src/maturity-profile.ts` (521 lines)
- **Knowledge debt:** `src/knowledge-debt.ts` (504 lines)
- **Health auditor:** `src/health-auditor.ts` (356 lines)
- **Pattern detector:** `src/pattern-detector.ts` (375 lines)
- **State manager:** `src/state-manager.ts` (457 lines)
