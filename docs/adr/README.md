# Architecture Decision Records

> Tracking architectural decisions for the Nexus System.

## What is an ADR?

An Architecture Decision Record (ADR) captures a significant architectural decision along with its context and consequences.

## When to Create an ADR

Create an ADR when:

- Making a decision that affects the system architecture
- Choosing between multiple alternatives
- Establishing a new pattern or convention
- Changing an existing architectural decision

## ADR Lifecycle

```
Proposed → Accepted → Deprecated/Superseded
```

- **Proposed:** Under review
- **Accepted:** Approved and in effect
- **Deprecated:** No longer recommended
- **Superseded:** Replaced by a newer ADR

## Numbering

ADRs are numbered sequentially: ADR-001, ADR-002, etc.

## Template

See [TEMPLATE.md](./TEMPLATE.md).

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-001 | Three-Tier State Model | Accepted | 2026-06-28 |
| ADR-002 | P0-P4 Context Hierarchy | Accepted | 2026-06-28 |
| ADR-003 | Event-Driven Architecture | Accepted | 2026-06-28 |
| ADR-004 | Plugin System with HookBus | Accepted | 2026-06-28 |
| ADR-005 | Pipeline with 5 Stages | Accepted | 2026-06-28 |
| ADR-006 | 5-State Lifecycle Machine | Accepted | 2026-06-28 |
| ADR-007 | Knowledge Graph with 14 Artifact Types | Accepted | 2026-06-28 |
| ADR-008 | Scoring Engine Approach | Accepted | 2026-06-28 |
| ADR-009 | Single-Agent Full-Stack Architect | Accepted | 2026-06-28 |
| ADR-010 | 4-Step Context Management | Accepted | 2026-06-28 |

## Governance

- ADRs are proposed by contributors
- ADRs are approved by the Architecture Board
- Once accepted, ADRs should not be changed
- To reverse an ADR, create a new one that supersedes it

---

*Last updated: 2026-06-29*
