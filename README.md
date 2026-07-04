# Nexus System

Nexus is a CLI that gives persistent context about your project to you and AI agents, so no one — human or AI — starts each session from zero.

---

## Quick Start

### 1. Install

```bash
npm install -g nexus-system
```

### 2. Initialize your project

```bash
nexus init
```

```
╔══════════════════════════════════════════╗
║  nexus init — Maturity-Based Discovery   ║
╚══════════════════════════════════════════╝

- Analysing project...
✔ Project analysis complete

  Detected:
    Stack:     typescript
    Packages:  3
    Apps:      2
    Source:    255 files
    Manager:   pnpm
    TypeScript: yes
    Tests:     yes
    CI/CD:     yes
```

Nexus detects your stack, generates a maturity profile, and creates the governance structure (`opencode.json`, `nexus-system/`, skills, scripts).

### 3. Check status

```bash
nexus status
```

```
╔══════════════════════════════════════╗
║      nexus status — Health Check     ║
╚══════════════════════════════════════╝

  Governance Health:
    ✔ opencode.json: Configured with 4 agents
    ✔ AGENTS.md: 45 rules configured
    ✔ skills/: 22 skills installed
    ✔ context_buffer.yaml: Valid
  Summary: ✔ 7 passed  ⚠ 0 warnings  ✘ 0 failed

  🎯 Maturity Profile:
    Overall Score: 59/100 ████████████░░░░░░░░ 59%
    Quality       ████████████████ 100%
    Automation    ████████████████ 100%
    AI            ████████████░░░░  75%

  📊 Complexity Score: 12/20
```

That's it. Your project now has governed context for you and your AI agents.

---

## Who Is This For

| Team size | Profile | What Nexus solves |
|---|---|---|
| **Solo** | Developer working alone who loses context between sessions | Preserves state so you resume without re-reading everything |
| **2-5 people** | Small team where knowledge lives in one person's head | Makes tacit knowledge explicit and verifiable |
| **5-15 people** | Growing team where onboarding is painful | New members onboard in hours, not weeks |
| **AI-assisted teams** | Teams where AI agents operate without governance context | Agents receive governed, hierarchical context |

The problem is not limited to large enterprises. It affects any team that makes decisions and does not record them, detects patterns and does not formalize them, or uses AI agents without governed context.

---

## All Commands

| Command | Purpose | When to use |
|---|---|---|
| `nexus init` | Initialize governance in a project | First time setup |
| `nexus status` | Health check + complexity scoring | During development, before commits |
| `nexus run` | Full 5-stage pipeline | Periodic health audits |
| `nexus upgrade` | Add governance capabilities | When you need more features |
| `nexus validate` | Session integrity check | Before important commits |
| `nexus detect` | Pattern detection from history | Find recurring errors |
| `nexus audit` | Self-evaluation of governance | Find dead rules, hotspots |
| `nexus evolve` | Adaptive recommendations | Get next-step suggestions |
| `nexus assess` | Re-evaluate maturity profile | After major changes |
| `nexus doctor` | System diagnostics | When something feels off |
| `nexus sync` | Sync governance from external source | Multi-project setups |
| `nexus clean` | Clean cache and temp files | Housekeeping |
| `nexus report` | Generate reports | Sharing status with stakeholders |
| `nexus act` | Execute agent actions | Run agent-driven tasks |
| `nexus plan` | Generate execution plans | Create step-by-step plans |
| `nexus goal` | Set and track goals | Define project objectives |
| `nexus decide` | Decision tracking | Record and manage decisions |
| `nexus policy` | Manage governance policies | Configure rules and policies |
| `nexus console` | Interactive console | Real-time governance monitoring |
| `nexus digest` | Generate digest summaries | Quick status overviews |
| `nexus bench` | Run benchmarks | Performance testing |
| `nexus briefing` | Pre-session briefing | Context loading before sessions |
| `nexus feedback` | Submit session feedback | Record session outcomes |
| `nexus profile` | View maturity profile | Detailed maturity analysis |
| `nexus dashboard` | Open governance dashboard | Visual project overview |
| `nexus shell-init` | Shell integration setup | Configure shell completions |
| `nexus docs-audit` | Audit documentation sync | Validate docs match code |

---

## Token Economy — How Nexus Saves You Money

> **Note:** The numbers below are projected estimates based on typical session patterns, not measured benchmarks. Actual savings depend on project size, session complexity, and cache hit rates.

Without Nexus, every AI session starts from zero context — the agent must read multiple files to understand the project. Nexus compresses all of that into a cached briefing.

| Scenario | Without Nexus | With Nexus | Savings |
|---|---|---|---|
| Average session (feature) | ~15-25k tokens | ~2-5k tokens | **60-80%** |
| Cache hit (stable project) | ~15-25k tokens | ~0-1k tokens | **95-100%** |
| Trivial task (typo, rename) | ~10-15k tokens | ~3-4k tokens | **70-75%** |
| Complex refactor | ~20-30k tokens | ~8-10k tokens | **50-65%** |

Loading profiles (`minimal`, `lite`, `full`) control how much context is loaded per task type. See [docs/ROI.md](docs/ROI.md) for the full analysis.

---

## How It Works

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

9 capabilities. 7 maturity dimensions. 26 CLI commands. 40+ core modules.

For the complete architecture, see [docs/INDEX.md](docs/INDEX.md).

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
npm test               # 1045+ tests (63 files)
npm run typecheck      # type checking
npm run lint           # ESLint with TypeScript rules
npm run bench          # benchmarks
```

## Testing

Local validation: `bash tests/e2e/validate.sh` (36 tests across 3 personas).

## License

**Proprietary** — Copyright (c) 2026 Edson Ramos. All rights reserved. See [LICENSE](LICENSE) for details.

For licensing inquiries, contact: edson.ramos@nexus-system.com
