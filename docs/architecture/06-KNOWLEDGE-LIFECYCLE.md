# 06 — KNOWLEDGE LIFECYCLE

> Knowledge flows through 9 stages of formalization.

## The Lifecycle

```
Observation → Hypothesis → Experiment → Decision → ADR → Skill → Contract → Automation → CLI
```

Each stage formalizes knowledge further. The output of one stage is the input of the next.

## The 9 Stages

### Stage 1: Observation

**What:** "I noticed something."
**Formality:** Informal, personal
**Example:** "When I forget to run tests before committing, bugs slip through."

### Stage 2: Hypothesis

**What:** "I think it works like this."
**Formality:** Tentative, falsifiable
**Example:** "I think running tests before every commit prevents regression bugs."

### Stage 3: Experiment

**What:** "Let me test it."
**Formality:** Structured, evidence-based
**Example:** "For 2 weeks, I'll run tests before every commit and track bug rates."

### Stage 4: Decision

**What:** "We decided to..."
**Formality:** Explicit, recorded
**Example:** "We decided to require test execution before every commit."

### Stage 5: ADR (Architecture Decision Record)

**What:** "Here's the record."
**Formality:** Formal, versioned, with context and consequences
**Example:** ADR-001: "Require test execution before commit" with context, decision, consequences, alternatives.

### Stage 6: Skill

**What:** "This is a pattern."
**Formality:** Reusable, with when-to-apply and when-NOT-to-apply
**Example:** A skill document describing TDD workflow, including anti-patterns and examples.

### Stage 7: Contract

**What:** "Agents must follow this."
**Formality:** Binding, with allowed/restricted actions
**Example:** An AI agent contract requiring test execution before code changes.

### Stage 8: Automation

**What:** "This is automated."
**Formality:** Scripted, repeatable, idempotent
**Example:** A pre-commit hook that runs tests automatically.

### Stage 9: CLI

**What:** "This is a command."
**Formality:** One-click execution, documented, versioned
**Example:** `nexus validate` that checks session integrity including test status.

## Stage Properties

| Property | Description |
|----------|-------------|
| **Irreversibility** | Each stage is harder to reverse than the previous |
| **Formality** | Formality increases from Stage 1 to Stage 9 |
| **Traceability** | Later stages reference earlier stages |
| **Enforceability** | Only Stage 7+ can be enforced on AI agents |

## The Knowledge Graph Connection

Each stage produces artifacts that become nodes in the knowledge graph:

| Stage | Artifact Type | Graph Node |
|-------|--------------|------------|
| Decision | ADR | `adr` node |
| Skill | Skill doc | `skill` node |
| Contract | Contract YAML | `contract` node |
| Automation | Script | `script` node |
| CLI | Command | (part of Nexus core) |

Relations between stages are captured as edges:
- ADR `generates` Skill
- Skill `uses` Contract
- Contract `executes` Script
- Script `supersedes` manual process

## Why This Matters

Without a lifecycle, knowledge is just documentation. With a lifecycle, knowledge is a process that compounds.

The lifecycle ensures that:
1. Decisions are recorded (Stage 5)
2. Patterns are extracted (Stage 6)
3. AI agents are governed (Stage 7)
4. Repetitive work is automated (Stage 8)
5. The system evolves (Stage 9)

## Implementation

The lifecycle is not implemented as a single module. Instead, each stage maps to existing Nexus components:

- **Stages 1-4:** Human processes (not tracked by Nexus)
- **Stage 5:** ADR templates and `docs/adrs/` directory
- **Stage 6:** Skill templates and `docs/skills/` directory
- **Stage 7:** Agent contracts in `governance/agents/`
- **Stage 8:** Scripts in `scripts/` directory
- **Stage 9:** CLI commands in `src/commands/`
