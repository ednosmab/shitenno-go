# Architecture

> How domain concepts are organized to function. System design and implementation.

## Purpose

This directory describes how domain concepts are implemented in software. Documents here contain interfaces, modules, patterns, and technical contracts.

## Audience

- Architects designing system components
- Contributors implementing features
- AI agents working on the codebase

## Documents

### Core Design

| Document | Purpose |
|----------|---------|
| [Design Principles](./design-principles.md) | Immutable implementation principles |
| [Domain Model Mapping](./domain-model-mapping.md) | Module-to-Meta-Model alignment |
| [Validation Matrix](./validation-matrix.md) | Complete module alignment validation |

### Engines

| Document | Purpose |
|----------|---------|
| [Capability Engine](./capability-engine.md) | Capability Model implementation |
| [Engineering State Architecture](./engineering-state-architecture.md) | Engineering State implementation |
| [Complexity Scoring](./complexity-scoring.md) | Scoring engine implementation |
| [Knowledge Debt](./knowledge-debt.md) | Debt detection implementation |
| [Knowledge Graph](./knowledge-graph.md) | Artifact graph implementation |
| [Recommendation Engine](./recommendation-engine.md) | Auto-evolution specification |
| [Pipeline Engine](./pipeline-engine.md) | Command orchestration |
| [Adaptive Governance](./adaptive-governance.md) | Rule engine specification |

### Infrastructure

| Document | Purpose |
|----------|---------|
| [Event Bus](./event-bus.md) | Pub/sub architecture |
| [State Machine](./state-machine.md) | Lifecycle gates |
| [Plugin System](./plugin-system.md) | Hooks and extensibility |
| [Feedback Loops](./feedback-loops.md) | Learning from acceptance/rejection |
| [Context Management](./context-management.md) | P0-P4 hierarchy |
| [Command Architecture](./command-architecture.md) | Command patterns |

### Quality & AI

| Document | Purpose |
|----------|---------|
| [Quality Attributes](./quality-attributes.md) | Performance, security, usability |
| [AI Readiness](./ai-readiness.md) | AI readiness criteria |
| [AI Agent Guidelines](./ai-agent-guidelines.md) | Rules for AI agents |
| [Anti-Patterns](./anti-patterns.md) | What NOT to do |
| [Future Engines](./future-engines.md) | 5 future engines specification |

### Reference

| Document | Purpose |
|----------|---------|
| [Ubiquitous Language (Quick)](./ubiquitous-language-quick.md) | Quick reference for daily development |

## Reading Order

1. **Design Principles** — The rules that govern implementation
2. **Domain Model Mapping** — How modules map to concepts
3. **Validation Matrix** — Current alignment status
4. Specific engine docs as needed for your task

## Module Map

```
Source Module               Architecture Doc
─────────────────────────   ─────────────────────────────
capability-engine.ts    →   capability-engine.md
engineering-state.ts    →   engineering-state-architecture.md
scorer.ts               →   complexity-scoring.md
knowledge-debt.ts       →   knowledge-debt.md
knowledge-graph.ts      →   knowledge-graph.md
recommendation-engine.ts →  recommendation-engine.md
pipeline.ts             →   pipeline-engine.md
rule-engine.ts          →   adaptive-governance.md
event-bus.ts            →   event-bus.md
nexus-state-machine.ts  →   state-machine.md
plugin-system.ts        →   plugin-system.md
feedback-loops.ts       →   feedback-loops.md
state-manager.ts        →   engineering-state-architecture.md
```

## Related Documentation

- [Domain](../domain/) — The concepts these modules implement
- [Implementation](../implementation/) — How these modules were built
- [Evolution](../evolution/) — How these modules will evolve

---

*Last updated: 2026-06-29*
