# Shitenno-go

> A CLI tool for preserving engineering context across AI-assisted work sessions — scoring, pattern detection, health auditing.

Shiten analyzes your project's complexity, detects patterns in engineering history, and audits governance health, so you (and the AI agents you work with) don't lose context between sessions. It adapts suggestions to a declared experience level (Junior / Pleno / Senior).

**Status:** built and validated for solo use. Team usage (2+ people on the same project) has not been tested with real users yet — see [Known Limitations](docs/KNOWN_LIMITATIONS.md) before relying on it in a shared repository.

---

## Quick Start

### 1. Install

```bash
npm install -g shitenno-go
```

Or run directly with npx:

```bash
npx shitenno-go status
```

### 2. Initialize your project

```bash
shiten init
```

```
╔══════════════════════════════════════════╗
║  shiten init — Maturity-Based Discovery   ║
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

Shiten detects your stack, generates a maturity profile, and creates the governance structure (`opencode.json`, `shitenno-go/`, skills, scripts).

### 3. Check status

```bash
shiten status
```

```
╔══════════════════════════════════════╗
║      shiten status — Health Check     ║
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

## All Commands (38)

### Core Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shiten init` | Initialize governance in a project | First time setup |
| `shiten status` | Health check + complexity scoring | During development, before commits |
| `shiten run` | Full 5-stage pipeline | Periodic health audits |
| `shiten upgrade` | Add governance capabilities | When you need more features |
| `shiten validate` | Session integrity check | Before important commits |

### Analysis Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shiten detect` | Pattern detection from history | Find recurring errors |
| `shiten audit` | Self-evaluation of governance | Find dead rules, hotspots |
| `shiten evolve` | Adaptive recommendations | Get next-step suggestions |
| `shiten assess` | Re-evaluate maturity profile | After major changes |
| `shiten doctor` | System diagnostics | When something feels off |

### Governance Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shiten plan` | Generate execution plans | Create step-by-step plans |
| `shiten goal` | Set and track goals | Define project objectives |
| `shiten decide` | Decision tracking | Record and manage decisions |
| `shiten policy` | Manage governance policies | Configure rules and policies |
| `shiten act` | Execute agent actions | Run agent-driven tasks |

### Context Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shiten context` | Full project context for AI agents | Load context for AI sessions |
| `shiten briefing` | Pre-session briefing | Context loading before sessions |
| `shiten digest` | Generate digest summaries | Quick status overviews |
| `shiten feedback` | Submit session feedback | Record session outcomes |
| `shiten history` | View engineering state history | Review past snapshots |

### Utility Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shiten sync` | Sync governance from external source | Multi-project setups |
| `shiten clean` | Clean cache and temp files | Housekeeping |
| `shiten report` | Generate reports | Sharing status with stakeholders |
| `shiten bench` | Run benchmarks | Performance testing |
| `shiten console` | Interactive console | Real-time governance monitoring |
| `shiten dashboard` | Open governance dashboard | Visual project overview |
| `shiten profile` | View maturity profile | Detailed maturity analysis |
| `shiten reminders` | Track pending tasks and follow-ups | Never forget action items |
| `shiten mcp` | MCP server for AI integration | Connect AI agents |
| `shiten update` | Update Shiten system | Keep governance current |
| `shiten shell-init` | Shell integration setup | Configure shell completions |
| `shiten docs-audit` | Audit documentation sync | Validate docs match code |

---

## Who Is This For

Today, Shiten is built and used by a single developer to preserve engineering context across their own AI-assisted sessions. It has not been run by a team yet, so claims about team size or onboarding time would be speculation — this section will be filled in with real numbers once that's actually tested.

If you use AI agents (Claude Code, Cursor, opencode, etc.) and lose context between sessions on solo projects, that's the validated use case today.

---

## Token Economy

Shiten caches a project briefing on disk (`briefing-cache.ts`) and reuses it via a content hash instead of recomputing on every session, which mechanically means fewer tokens spent re-reading project state when the cache is warm. We have not run controlled measurements of how much this saves in practice — no percentage numbers are published until they come from actual measured sessions, not projections.

---

## Architecture

```
shitenno-cli/
├── bin/shiten.ts              # CLI entry point (Commander.js)
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
└── shitenno-go/             # Governance data (per-project)
```

### Key Statistics

| Metric | Count |
|--------|-------|
| CLI Commands | 40 |
| Source Files | 269 |
| Test Files | 130 |
| Audit Detectors | 100+ |
| Engine Modules | 12 |

*(Counts as of the last README update — likely to drift; run `shiten docs-audit` to check against current code before quoting these elsewhere.)*

### How It Works

Shiten operates on three layers:

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

Shiten implements multiple security measures:

| Measure | Description |
|---------|-------------|
| **Script allowlist** | Only approved scripts can be executed via rules |
| **Rule ID validation** | IDs restricted to alphanumeric, hyphens, underscores |
| **Regex protection** | Patterns validated against complexity excess |
| **Prototype pollution guard** | Access to `__proto__`, `constructor` blocked |
| **Plugin validation** | Hooks and names validated before registration |
| **Atomic cache writes** | Temp file + rename prevents corruption |
| **Cache permissions** | `.shiten-cache.json` created with `chmod 0o600` |
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

### `shitenno-go/` (Project Directory)

Created automatically during `shiten init`. Contains:
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

- **~2000 tests** across 130 test files (written after implementation, not TDD — see [Known Limitations](docs/KNOWN_LIMITATIONS.md))
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
