# Nexus System

> AI governance framework that grows with your project — scoring, pattern detection, health auditing.

A CLI tool that analyzes your project's complexity, detects patterns in engineering history, and audits governance health. It adapts to your team's level (Junior / Pleno / Senior) and provides actionable suggestions.

---

## Quick Start

### 1. Install

```bash
npm install -g nexus-system
```

Or run directly with npx:

```bash
npx nexus-system status
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

## All Commands (35)

### Core Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `nexus init` | Initialize governance in a project | First time setup |
| `nexus status` | Health check + complexity scoring | During development, before commits |
| `nexus run` | Full 5-stage pipeline | Periodic health audits |
| `nexus upgrade` | Add governance capabilities | When you need more features |
| `nexus validate` | Session integrity check | Before important commits |

### Analysis Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `nexus detect` | Pattern detection from history | Find recurring errors |
| `nexus audit` | Self-evaluation of governance | Find dead rules, hotspots |
| `nexus evolve` | Adaptive recommendations | Get next-step suggestions |
| `nexus assess` | Re-evaluate maturity profile | After major changes |
| `nexus doctor` | System diagnostics | When something feels off |

### Governance Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `nexus plan` | Generate execution plans | Create step-by-step plans |
| `nexus goal` | Set and track goals | Define project objectives |
| `nexus decide` | Decision tracking | Record and manage decisions |
| `nexus policy` | Manage governance policies | Configure rules and policies |
| `nexus act` | Execute agent actions | Run agent-driven tasks |

### Context Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `nexus context` | Full project context for AI agents | Load context for AI sessions |
| `nexus briefing` | Pre-session briefing | Context loading before sessions |
| `nexus digest` | Generate digest summaries | Quick status overviews |
| `nexus feedback` | Submit session feedback | Record session outcomes |
| `nexus history` | View engineering state history | Review past snapshots |

### Utility Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `nexus sync` | Sync governance from external source | Multi-project setups |
| `nexus clean` | Clean cache and temp files | Housekeeping |
| `nexus report` | Generate reports | Sharing status with stakeholders |
| `nexus bench` | Run benchmarks | Performance testing |
| `nexus console` | Interactive console | Real-time governance monitoring |
| `nexus dashboard` | Open governance dashboard | Visual project overview |
| `nexus profile` | View maturity profile | Detailed maturity analysis |
| `nexus reminders` | Track pending tasks and follow-ups | Never forget action items |
| `nexus mcp` | MCP server for AI integration | Connect AI agents |
| `nexus update` | Update Nexus system | Keep governance current |
| `nexus shell-init` | Shell integration setup | Configure shell completions |
| `nexus docs-audit` | Audit documentation sync | Validate docs match code |

---

## Who Is This For

| Team size | Profile | What Nexus solves |
|-----------|---------|-------------------|
| **Solo** | Developer working alone who loses context between sessions | Preserves state so you resume without re-reading everything |
| **2-5 people** | Small team where knowledge lives in one person's head | Makes tacit knowledge explicit and verifiable |
| **5-15 people** | Growing team where onboarding is painful | New members onboard in hours, not weeks |
| **AI-assisted teams** | Teams where AI agents operate without governance context | Agents receive governed, hierarchical context |

---

## Token Economy — How Nexus Saves You Money

> **Note:** The numbers below are projected estimates based on typical session patterns, not measured benchmarks. Actual savings depend on project size, session complexity, and cache hit rates.

Without Nexus, every AI session starts from zero context — the agent must read multiple files to understand the project. Nexus compresses all of that into a cached briefing.

| Scenario | Without Nexus | With Nexus | Savings |
|----------|---------------|------------|---------|
| Average session (feature) | ~15-25k tokens | ~2-5k tokens | **60-80%** |
| Cache hit (stable project) | ~15-25k tokens | ~0-1k tokens | **95-100%** |
| Trivial task (typo, rename) | ~10-15k tokens | ~3-4k tokens | **70-75%** |
| Complex refactor | ~20-30k tokens | ~8-10k tokens | **50-65%** |

---

## Architecture

```
nexus-cli/
├── bin/nexus.ts              # CLI entry point (Commander.js)
├── src/
│   ├── analyser.ts           # Project analysis & stack detection
│   ├── scorer.ts             # Complexity scoring engine
│   ├── pattern-detector.ts   # Pattern extraction from history
│   ├── health-auditor.ts     # Governance health auditing
│   ├── rule-engine.ts        # Declarative rule engine
│   ├── event-bus.ts          # Pub/sub system for modules
│   ├── plugin-system.ts      # Extensibility system
│   ├── cache.ts              # Disk cache with SHA256 checksums
│   ├── logger.ts             # Centralized logging
│   ├── constants.ts          # Shared constants
│   ├── errors.ts             # Typed errors
│   ├── utils.ts              # Shared utilities
│   ├── shared.ts             # CLI infrastructure
│   ├── engineering-state.ts  # Single source of truth
│   ├── knowledge-graph.ts    # Knowledge graph
│   ├── knowledge-debt.ts     # Knowledge debt detection
│   ├── maturity-profile.ts   # Maturity profiling
│   ├── feedback-engine.ts    # Personalized feedback
│   ├── recommendation-engine.ts  # Smart recommendations
│   ├── action-engine.ts      # Action execution
│   ├── capability-engine.ts  # Capability management
│   ├── decision-engine.ts    # Decision tracking
│   ├── goal-engine.ts        # Goal management
│   ├── policy-engine.ts      # Policy enforcement
│   ├── trend-engine.ts       # Trend prediction
│   ├── inference-engine.ts   # Inference engine
│   ├── proactive-engine.ts   # Proactive suggestions
│   ├── commands/             # CLI command implementations
│   │   ├── init.ts
│   │   ├── status.ts
│   │   ├── audit.ts
│   │   ├── ... (32 commands)
│   │   └── mcp.ts
│   ├── audit/                # Audit detectors
│   │   ├── engineering-detectors.ts
│   │   ├── governance-detectors.ts
│   │   ├── architecture-detectors.ts
│   │   ├── security-detectors.ts
│   │   ├── suggestion-engine.ts
│   │   └── ... (100+ detectors)
│   ├── templates/            # Scaffolding templates
│   └── __tests__/            # 111 test files
├── docs/                     # Documentation
└── nexus-system/             # Governance data (per-project)
```

### Key Statistics

| Metric | Count |
|--------|-------|
| CLI Commands | 35 |
| Source Files | 148 |
| Test Files | 117 |
| Audit Detectors | 100+ |
| Engine Modules | 12 |

### How It Works

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

---

## Security

Nexus implements multiple security measures:

| Measure | Description |
|---------|-------------|
| **Script allowlist** | Only approved scripts can be executed via rules |
| **Rule ID validation** | IDs restricted to alphanumeric, hyphens, underscores |
| **Regex protection** | Patterns validated against complexity excess |
| **Prototype pollution guard** | Access to `__proto__`, `constructor` blocked |
| **Plugin validation** | Hooks and names validated before registration |
| **Atomic cache writes** | Temp file + rename prevents corruption |
| **Cache permissions** | `.nexus-cache.json` created with `chmod 0o600` |
| **Supply chain security** | Pinned action SHAs in CI/CD workflows |

---

## Configuration

### `opencode.json` (Project Root)

```json
{
  "model": "mimo-v2.5-free",
  "agent": {
    "plan": { "role": "planner", "model": "mimo-v2.5-free" },
    "build": { "role": "executor", "model": "deepseek-v4-flash-free" },
    "review": { "role": "auditor", "model": "mimo-v2.5-free" }
  }
}
```

### `nexus-system/` (Project Directory)

Created automatically during `nexus init`. Contains:
- `engineering-state.json` — Canonical project state
- `maturity-profile.json` — Maturity assessment
- `governance/` — Rules, policies, workflows
- `docs/` — ADRs, skills, runbooks
- `reports/` — Generated reports
- `telemetry/` — Session tracking

---

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev status

# Build
npm run build

# Test
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Benchmarks
npm run bench
```

### Testing

- **1791+ tests** across 111 test files
- **24 CLI integration tests** (end-to-end)
- **Performance benchmarks** for scoring, detection, and audit engines

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run bench         # Run benchmarks
```

### CI/CD

- **Lint job** — ESLint + TypeScript + npm audit (fast fail)
- **Test job** — Build + test across Node 18/20/22
- **Coverage job** — Code coverage report
- **Release job** — Version verification + npm publish + GitHub release

---

## Requirements

- Node.js >= 18.0.0
- Git (recommended, for behavioral metrics)

## License

MIT — See [LICENSE](LICENSE) for details.
