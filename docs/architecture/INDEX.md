# Nexus System — Architecture Documentation Index

> This is the Constitution of the Nexus System. Every document here is a source of truth for humans and AI agents.

## How to Read

Start from **00-VISION.md** and follow the numbering. Each document depends only on its predecessors.

## Document Map

### Foundation — The "Why"

| # | Document | Purpose |
|---|----------|---------|
| 00 | [VISION](./00-VISION.md) | Manifesto — why Nexus exists, where it's going |
| 01 | [PROBLEM-STATEMENT](./01-PROBLEM-STATEMENT.md) | Problem, Who, What, Non-Goals |
| 02 | [UBIQUITOUS-LANGUAGE](./02-UBIQUITOUS-LANGUAGE.md) | Canonical glossary with exact definitions |
| 03 | [DESIGN-PRINCIPLES](./03-DESIGN-PRINCIPLES.md) | Immutable principles that govern all decisions |
| 04 | [MENTAL-MODEL](./04-MENTAL-MODEL.md) | How to think about Nexus — conceptual diagram |

### Core Concepts — The "What"

| # | Document | Purpose |
|---|----------|---------|
| 05 | [THREE-TIER-STATE](./05-THREE-TIER-STATE.md) | Knowledge / State / Memory separation |
| 06 | [KNOWLEDGE-LIFECYCLE](./06-KNOWLEDGE-LIFECYCLE.md) | 9 stages: Observation → CLI Automation |
| 07 | [CAPABILITY-MODEL](./07-CAPABILITY-MODEL.md) | 9 capabilities, dependencies, thresholds |
| 08 | [ENGINEERING-STATE](./08-ENGINEERING-STATE.md) | Measuring and governing engineering health |
| 09 | [COMPLEXITY-EVOLUTION](./09-COMPLEXITY-EVOLUTION.md) | Scoring engine — static + behavioral |

### Infrastructure Concepts — The "How"

| # | Document | Purpose |
|---|----------|---------|
| 10 | [AI-READINESS](./10-AI-READINESS.md) | Criteria for AI-readiness |
| 11 | [KNOWLEDGE-DEBT](./11-KNOWLEDGE-DEBT.md) | 10 debt types, detection, scoring |
| 12 | [CONTEXT-MANAGEMENT](./12-CONTEXT-MANAGEMENT.md) | P0-P4 hierarchy, context buffer |
| 13 | [ADAPTIVE-GOVERNANCE](./13-ADAPTIVE-GOVERNANCE.md) | Rule engine formal specification |
| 14 | [KNOWLEDGE-GRAPH](./14-KNOWLEDGE-GRAPH.md) | Artifacts, relations, graph analysis |

### Technical Architecture — The "Build"

| # | Document | Purpose |
|---|----------|---------|
| 15 | [EVENT-BUS](./15-EVENT-BUS.md) | Pub/sub architecture for module communication |
| 16 | [PIPELINE-ENGINE](./16-PIPELINE-ENGINE.md) | Command orchestration pipeline |
| 17 | [FEEDBACK-LOOPS](./17-FEEDBACK-LOOPS.md) | Recommendations → acceptance → learning |
| 18 | [STATE-MACHINE](./18-STATE-MACHINE.md) | Nexus lifecycle gates |
| 19 | [PLUGIN-SYSTEM](./19-PLUGIN-SYSTEM.md) | Hooks and extensibility |
| 20 | [RECOMMENDATION-ENGINE](./20-RECOMMENDATION-ENGINE.md) | Auto-evolution formal spec |
| 21 | [COMMAND-ARCHITECTURE](./21-COMMAND-ARCHITECTURE.md) | Command patterns, shared infrastructure |

### Implementation Guides — The "Do"

| # | Document | Purpose |
|---|----------|---------|
| 22 | [README-REFACTOR](./22-README-REFACTOR.md) | Plan to rewrite the README |
| 23 | [CLI-REFACTOR](./23-CLI-REFACTOR.md) | Plan to refactor CLI commands |
| 24 | [CORE-EVOLUTION](./24-CORE-EVOLUTION.md) | Core evolution roadmap |
| 25 | [QUALITY-ATTRIBUTES](./25-QUALITY-ATTRIBUTES.md) | Performance, security, usability |
| 26 | [AI-AGENT-GUIDELINES](./26-AI-AGENT-GUIDELINES.md) | Rules for AI agents |
| 27 | [ANTI-PATTERNS](./27-ANTI-PATTERNS.md) | What NOT to do |
| 28 | [VALIDATION-CHECKLIST](./28-VALIDATION-CHECKLIST.md) | Validation checklist per capability |
| 29 | [ROADMAP](./29-ROADMAP.md) | Visual roadmap with phases and milestones |

## For AI Agents

When working on Nexus, read only the document(s) relevant to your task:

| Task | Read |
|------|------|
| Implement a feature | 03 + the specific capability doc |
| Fix a bug | 08 + the affected module doc |
| Add a new capability | 07 + 19 + 06 |
| Refactor commands | 21 + 23 |
| Write tests | 03 + 25 |
| Review a PR | 03 + 27 + 28 |
| Understand the system | 00 → 04 (sequential) |
