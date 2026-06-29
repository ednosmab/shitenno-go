# Evolution

> How the Nexus System should evolve. Target architecture, migration strategy, and future roadmap.

## Purpose

This directory describes the future direction of Nexus. Documents here answer: "How should the system evolve?" They complement the architecture docs (which answer "How does the system work today?").

## Audience

- Architects planning system evolution
- AI agents implementing evolution tasks
- Maintainers prioritizing work

## Documents

### Core

| Document | Purpose | Status |
|----------|---------|--------|
| [Executive Summary](./00-EXECUTIVE-SUMMARY.md) | High-level priorities | Stub |
| [Current State Assessment](./01-CURRENT-STATE-ASSESSMENT.md) | Strengths and risks | Stub |
| [Target Architecture](./03-TARGET-ARCHITECTURE.md) | Target architecture direction | Active |
| [Architecture Invariants](./26-ARCHITECTURE-INVARIANTS.md) | Invariants that must not be violated | Stub |

### Domain Evolution

| Document | Purpose | Status |
|----------|---------|--------|
| [Domain Refinement](./domain/04-DOMAIN-REFINEMENT.md) | Domain refinement direction | Stub |
| [Bounded Contexts](./domain/05-BOUNDED-CONTEXTS.md) | Bounded contexts definition | Stub |
| [Application Layer](./domain/06-APPLICATION-LAYER.md) | Application layer design | Stub |
| [Use Cases](./domain/07-USE-CASES.md) | Use case specifications | Stub |

### Platform Evolution

| Document | Purpose | Status |
|----------|---------|--------|
| [Domain Catalog](./platform/08-DOMAIN-CATALOG.md) | Domain catalog | Active |
| [Capability Evolution](./platform/09-CAPABILITY-EVOLUTION.md) | Capability evolution direction | Active |
| [Plugin System](./platform/10-PLUGIN-SYSTEM.md) | Plugin system evolution | Active |
| [Pipeline](./platform/11-PIPELINE.md) | Pipeline evolution | Active |
| [State Machine](./platform/12-STATE-MACHINE.md) | State machine evolution | Active |
| [Knowledge Graph](./platform/13-KNOWLEDGE-GRAPH.md) | Knowledge graph evolution | Active |
| [Telemetry](./platform/14-TELEMETRY.md) | Telemetry design | Active |

### Quality Evolution

| Document | Purpose | Status |
|----------|---------|--------|
| [Bug Fix Plan](./quality/15-BUG-FIX-PLAN.md) | Bug fix plan | Complete |
| [Testing Strategy](./quality/16-TESTING-STRATEGY.md) | Testing strategy | Active |
| [Performance](./quality/17-PERFORMANCE.md) | Performance targets | Active |
| [Security](./quality/18-SECURITY.md) | Security model | Active |
| [Documentation Strategy](./quality/19-DOCUMENTATION.md) | Documentation strategy | Active |
| [Architecture Governance](./quality/20-ARCHITECTURE-GOVERNANCE.md) | Architecture governance | Active |

### Migration Roadmap

| Document | Purpose | Status |
|----------|---------|--------|
| [Wave 1 — Stabilization](./roadmap/21-MIGRATION-WAVE-1.md) | Stabilization tasks | Active |
| [Wave 2 — Architecture](./roadmap/22-MIGRATION-WAVE-2.md) | Architecture tasks | Stub |
| [Wave 3 — Platform](./roadmap/23-MIGRATION-WAVE-3.md) | Platform tasks | Stub |
| [Wave 4 — Intelligence](./roadmap/24-MIGRATION-WAVE-4.md) | Intelligence tasks | Stub |
| [Long-Term Roadmap](./roadmap/25-LONG-TERM-ROADMAP.md) | Version-based roadmap | Active |

### AI Implementation

| Document | Purpose | Status |
|----------|---------|--------|
| [Master Evolution Plan](./ai/MASTER_EVOLUTION_PLAN.md) | Strategic objectives and roadmap | Active |
| [AI Implementation Guide](./ai/AI-IMPLEMENTATION-GUIDE.md) | Rules for AI-assisted implementation | Active |
| [Execution Order](./ai/EXECUTION-ORDER.md) | Prescribed execution order | Stub |
| [Task Catalog](./ai/TASK-CATALOG.md) | Catalog of all tasks | Active |
| [Rollback Plan](./ai/ROLLBACK-PLAN.md) | Rollback procedures | Stub |
| [Acceptance Criteria](./ai/ACCEPTANCE-CRITERIA.md) | Acceptance criteria | Stub |
| [Validation Checklist](./ai/VALIDATION-CHECKLIST.md) | Validation checklist | Active |

## Reading Order

1. **Master Evolution Plan** — Strategic overview
2. **Executive Summary** — Priorities
3. **Current State Assessment** — Where we are
4. **Target Architecture** — Where we're going
5. **Migration Waves** — How we'll get there
6. Specific evolution docs as needed

## Relationship to Architecture

Every evolution document should reference its corresponding architecture document:

| Evolution Doc | Architecture Doc |
|---------------|------------------|
| Capability Evolution | capability-engine.md |
| Plugin System | plugin-system.md |
| Pipeline | pipeline-engine.md |
| State Machine | state-machine.md |
| Knowledge Graph | knowledge-graph.md |

## Related Documentation

- [Architecture](../architecture/) — Current system design
- [Domain](../domain/) — Business knowledge
- [Implementation](../implementation/) — Build history

---

*Last updated: 2026-06-29*
