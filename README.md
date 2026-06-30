# Nexus System

> A system that thinks about how you work.

Nexus is not a tool. It is not a framework. It is not a linter. It is not a CI pipeline.

Nexus is a system that organizes engineering knowledge so that humans and AI agents can continuously understand a project's state, make better decisions, and evolve with confidence.

**Proprietary Software** — This software is owned by Edson Ramos. All rights reserved. See [LICENSE](LICENSE) for details.

---

## Why Does Nexus Exist

Engineering teams accumulate knowledge but fail to govern it.

ADRs are written but never referenced. Skills are documented but never extracted from patterns. Workflows are defined but never enforced. Context is lost between sessions. Decisions are repeated because no one remembers the previous one.

This is **Knowledge Debt** — the silent killer of engineering productivity.

Nexus detects Knowledge Debt before it compounds. It connects the artifacts that should be connected. It recommends the knowledge that should exist but does not.

---

## How Does Nexus Think

Nexus interprets projects through a conceptual flow:

```
Reality
  ↓ (observation)
Observation
  ↓ (formalization)
Knowledge
  ↓ (persistence)
Engineering Assets
  ↓ (evaluation)
Capabilities
  ↓ (measurement)
Engineering State
  ↓ (analysis)
Decisions
  ↓ (selection)
Actions
  ↓ (execution)
Project Evolution
```

This is not a pipeline. It is the mental model of the Nexus — how understanding transforms into evolution.

---

## The Nexus Engineering Model

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

Every piece of information belongs to one of three tiers:

- **Knowledge** (Permanent) — ADRs, Skills, Contracts, Workflows
- **State** (Current) — Maturity, Capabilities, Complexity
- **Memory** (Temporary) — Session, Task, Blockers, Reminders

---

## How Humans and AI Collaborate

Nexus provides governed context for AI agents. It ensures that AI agents receive the right knowledge, at the right time, in the right format.

```
Human Knowledge → Engineering Assets → Governed Context → AI Agent
```

The governance loop:

```
ASSESS → RECOMMEND → APPROVE → IMPLEMENT → (re-assess)
```

Nexus proposes. Humans decide. This rule is absolute.

---

## Core Principles

1. **Code is consequence of knowledge** — Code exists because knowledge was organized
2. **Architecture is consequence of domain** — Architecture serves the domain, not itself
3. **Capabilities evolve before features** — Maturity before functionality
4. **AI amplifies good engineering** — Structure makes AI useful
5. **Every decision generates knowledge** — Recorded decisions compound
6. **Engineering State is more important than code state** — What it means matters more than what exists

---

## Meta Model

The Meta Model defines how Nexus sees a project:

| Element | Definition |
|---------|-----------|
| **Reality** | The actual project: code, team, processes |
| **Observation** | A perception of something that deserves attention |
| **Knowledge** | Validated understanding, formalized and stored |
| **Engineering Assets** | Persistent containers of knowledge |
| **Capabilities** | Modular units of governance maturity |
| **Engineering State** | Measurable condition of engineering practices |
| **Decisions** | Choices between alternatives, recorded with context |
| **Actions** | Operations that modify the project |
| **Project Evolution** | Continuous improvement of engineering practices |

For the complete specification, see [docs/domain/ubiquitous-language.md](docs/domain/ubiquitous-language.md).

---

## Architecture Overview

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

9 capabilities. 7 maturity dimensions. 13 CLI commands. 40+ core modules.

For the complete architecture, see [docs/INDEX.md](docs/INDEX.md).

---

## Quick Start

### Install

```bash
npm install -g nexus-system
```

### Initialize

```bash
nexus init
```

Creates governance structure: `opencode.json`, `nexus-system/`, `nexus-profile/`, skills, scripts, templates.

### Check Status

```bash
nexus status
```

Shows complexity score, governance health, and actionable suggestions.

### Detect Patterns

```bash
nexus detect
```

Reads history and reports to identify recurring errors, reverted decisions, and hot areas.

### Full Pipeline

```bash
nexus run
```

Executes the 5-stage pipeline: Analyse → Score → Detect → Audit → Evolve.

### All Commands

| Command | Function |
|---------|----------|
| `nexus init` | Initialize governance structure |
| `nexus status` | Health check + complexity scoring |
| `nexus detect` | Pattern detection from history |
| `nexus audit` | Self-evaluation: dead rules, violation hotspots |
| `nexus evolve` | Adaptive recommendations based on maturity |
| `nexus run` | Full 5-stage pipeline execution |
| `nexus upgrade` | Install governance capabilities |
| `nexus validate` | Session integrity validation |
| `nexus sync` | Sync governance from external nexus |
| `nexus clean` | Clean cache and temp files |
| `nexus assess` | Re-evaluate maturity profile |
| `nexus doctor` | System health diagnostics |
| `nexus report` | Generate reports |

---

## Security

- **Restricted cache** — `.nexus-cache.json` created with `chmod 0o600`
- **Sanitized YAML** — Inputs escaped against injection in rule engine
- **No process.exit()** — Errors handled via Commander, never via direct exit
- **Script allowlist** — Only approved scripts can be executed
- **Rule validation** — Schema validated before persistence

---

## Requirements

- Node.js >= 18.0.0
- Git (recommended, for behavioral metrics)

## Development

```bash
npm install
npm run dev status     # development mode
npm run build          # build with tsup
npm test               # 484+ tests (31 files)
npm run typecheck      # type checking
npm run lint           # ESLint with TypeScript rules
npm run bench          # benchmarks
```

## Testing

Local validation: `bash tests/e2e/validate.sh` (36 tests across 3 personas).

## License

**Proprietary** — Copyright (c) 2026 Edson Ramos. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without express written permission from the author.

For licensing inquiries, contact: edson.ramos@nexus-system.com
