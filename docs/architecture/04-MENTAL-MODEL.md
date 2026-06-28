# 04 — MENTAL MODEL

> How to think about Nexus. Read this before anything else.

## The Three Layers

Nexus operates on three layers:

```
┌─────────────────────────────────────────────┐
│              GOVERNANCE LAYER                │
│  Rules, Workflows, Contracts, Premortem     │
│  "How we work"                              │
├─────────────────────────────────────────────┤
│              KNOWLEDGE LAYER                │
│  ADRs, Skills, Runbooks, Scripts            │
│  "What we know"                             │
├─────────────────────────────────────────────┤
│              ANALYSIS LAYER                 │
│  Scoring, Patterns, Health, Debt            │
│  "What we measure"                          │
└─────────────────────────────────────────────┘
```

Each layer depends on the layers below it. You cannot govern what you don't know. You cannot know what you don't measure.

## The Knowledge Lifecycle

Knowledge flows through 9 stages:

```
Observation → Hypothesis → Experiment → Decision → ADR → Skill → Contract → Automation → CLI
```

Each stage formalizes knowledge further. The output of one stage is the input of the next.

```
"I noticed something"     → Observation
"I think it works like..." → Hypothesis
"Let me test it"          → Experiment
"We decided to..."        → Decision
"Here's the record"       → ADR
"This is a pattern"       → Skill
"Agents must follow this" → Contract
"This is automated"       → Automation
"This is a command"       → CLI
```

## The Three-Tier State

Every piece of information belongs to one of three tiers:

```
┌─────────────────────────────────────────┐
│          KNOWLEDGE (Permanent)           │
│  ADRs, Skills, Contracts, Workflows     │
│  "What we decided"                      │
├─────────────────────────────────────────┤
│           STATE (Current)               │
│  Maturity, Capabilities, Complexity     │
│  "Where we are now"                     │
├─────────────────────────────────────────┤
│          MEMORY (Temporary)             │
│  Session, Task, Blockers, Reminders     │
│  "What we're doing right now"           │
└─────────────────────────────────────────┘
```

## The Capability Model

Nexus functionality is organized into 9 capabilities:

```
                    ┌─────────┐
                    │  core   │ (always installed)
                    └────┬────┘
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │knowledge│   │  qual.  │   │  ops    │
     └────┬────┘   └────┬────┘   └─────────┘
          │              │
     ┌────┴────┐   ┌────┴────┐
     │  arch   │   │ metrics │
     └────┬────┘   └─────────┘
          │
     ┌────┴────┐
     │ govern. │
     └────┬────┘
    ┌─────┴─────┐
    │           │
┌───┴───┐  ┌───┴────┐
│  ai   │  │compli. │
└───────┘  └────────┘
```

Dependencies flow downward. `ai` requires `governance`. `governance` requires `core`. You cannot install a capability before its dependencies.

## The Analysis Pipeline

When Nexus analyzes a project, data flows through a pipeline:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ ANALYZE  │ →  │  SCORE   │ →  │  DETECT  │ →  │  AUDIT   │ →  │ EVOLVE   │
│          │    │          │    │          │    │          │    │          │
│ Stack    │    │ Static   │    │ Patterns │    │ Health   │    │ Recommend│
│ Structure│    │ Behavioral│   │ Hot areas│    │ Dead rule│    │ Next best│
│ Git      │    │ Per-area │    │ Reverted │    │ Missing  │    │ action   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     └───────────────┴───────────────┴───────────────┴───────────────┘
                                 │
                         Shared State
                    (nexus-system/reports/)
```

Each stage reads from shared state and writes its output. The next stage consumes the previous output.

## The Governance Loop

Nexus operates in a continuous governance loop:

```
    ┌──────────────────────────────────────────────┐
    │                                              │
    ▼                                              │
 ASSESS ──→ RECOMMEND ──→ APPROVE ──→ IMPLEMENT ──┘
    │              │            │            │
    │              │            │            │
    └──────────────┴────────────┴────────────┘
              Feedback Loop
```

1. **Assess** — Measure current state
2. **Recommend** — Suggest next actions
3. **Approve** — Human decides
4. **Implement** — Execute approved actions
5. **Re-assess** — Measure the effect

The loop never ends. Governance is not a destination; it's a practice.

## The Rule Engine

Rules are the nervous system of Nexus:

```
Event → Trigger → Conditions → Actions
 │         │           │            │
 │         │           │            └── Side effects
 │         │           └── Predicates (AND logic)
 │         └── Event type filter
 └── Any system event
```

Rules are declarative (data, not code). They are stored as JSON files. They can be added, modified, or removed without changing Nexus core.

## The Maturity Dimensions

Nexus measures maturity across 7 dimensions:

```
Architecture ████████░░ 80
Governance   ██████░░░░ 60
Quality      █████████░ 90
Automation   ████░░░░░░ 40
AI           ██░░░░░░░░ 20
Documentation ███████░░░ 70
Observability ███░░░░░░░ 30
             ────────────
Overall:      58 (Pleno)
```

Each dimension is computed independently. Teams can be strong in some dimensions and weak in others. Nexus recommends capabilities to strengthen weak dimensions.

## The Key Insight

Nexus is not a tool you use. It's a system that uses your project data to understand itself and recommend its own evolution.

The CLI is the interface. The system is the intelligence. The governance is the value.
