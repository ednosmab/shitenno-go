# Documentation Structure

> Current directory layout of the Nexus System documentation.

```
docs/
├── INDEX.md                    # Master index
├── BACKLOG.md                  # Active work tracker
├── skeleton-path.md            # This file
│
├── handbook/                    # User handbook + philosophy
│   ├── README.md
│   ├── handbook.template.md
│   ├── philosophy/              # Engineering principles
│   │   ├── engineering-manifesto.md
│   │   ├── principles.md
│   │   └── vision.md
│   ├── 01-fundamentals/         # Getting started
│   ├── 02-commands/             # CLI reference
│   └── 03-architecture/         # Internal design
│
├── domain/                     # Business knowledge
│   ├── ubiquitous-language.md
│   ├── meta-model.md
│   ├── three-tier-state.md
│   ├── knowledge-lifecycle.md
│   ├── capability-model.md
│   ├── engineering-state.md
│   ├── problem-statement.md
│   ├── knowledge.md
│   ├── engineering-assets.md
│   └── decisions.md
│
├── architecture/               # System design
│   ├── design-principles.md
│   ├── capability-engine.md
│   ├── engineering-state-architecture.md
│   ├── domain-model-mapping.md
│   ├── validation-matrix.md
│   ├── complexity-scoring.md
│   ├── knowledge-debt.md
│   ├── context-management.md
│   ├── adaptive-governance.md
│   ├── knowledge-graph.md
│   ├── event-bus.md
│   ├── pipeline-engine.md
│   ├── feedback-loops.md
│   ├── state-machine.md
│   ├── plugin-system.md
│   ├── recommendation-engine.md
│   ├── command-architecture.md
│   ├── quality-attributes.md
│   ├── future-engines.md
│   ├── ai-readiness.md
│   ├── ai-agent-guidelines.md
│   ├── anti-patterns.md
│   └── ubiquitous-language-quick.md
│
├── implementation/             # Technical implementation
│   ├── core-evolution.md
│   ├── validation-checklist.md
│   ├── roadmap.md
│   ├── readme-refactor.md      # [Historical]
│   └── cli-refactor.md         # [Historical]
│
├── engineering/                # Development process
│   └── skeleton-path.md
│
├── evolution/                  # Future roadmap
│   ├── README.md
│   ├── 00-EXECUTIVE-SUMMARY.md
│   ├── 01-CURRENT-STATE-ASSESSMENT.md
│   ├── 03-TARGET-ARCHITECTURE.md
│   ├── 26-ARCHITECTURE-INVARIANTS.md
│   ├── skeleton-path.md
│   ├── domain/
│   ├── platform/
│   ├── quality/
│   ├── roadmap/
│   └── ai/
│
├── adr/                        # Architecture Decision Records [Planned]
│
├── reference/                  # Reference material [Planned]
│
└── history/                    # Historical documents [Planned]
    └── plans/
```

*Last updated: 2026-06-29*
