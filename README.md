# nexus-governance

> AI governance framework that grows with your project — scoring, pattern detection, health auditing.

A CLI tool that analyses your project's complexity, detects patterns in engineering history, and audits governance health. It adapts to your team's level (Junior / Pleno / Senior) and provides actionable suggestions.

---

## Features

| Command | Description | Phase |
|---------|-------------|-------|
| `nexus init` | Initialize governance framework in your project | — |
| `nexus status` | Check governance health + complexity scoring | Phase 1 |
| `nexus detect` | Detect patterns in history and propose candidate rules | Phase 2 |
| `nexus audit` | Audit Nexus governance health (metacognition) | Phase 3 |
| `nexus upgrade` | Upgrade governance level (L1 → L2 → L3) | — |
| `nexus validate` | Validate session integrity | — |
| `nexus sync` | Sync project governance files from nexus-system | — |

---

## Installation

```bash
npm install -g nexus-governance
```

Or run directly with npx:

```bash
npx nexus-governance status
```

### Requirements

- Node.js ≥ 18.0.0
- Git (recommended, for behavioral metrics)

---

## Quick Start

```bash
# 1. Initialize in your project
nexus init

# 2. Check governance health
nexus status

# 3. Detect patterns
nexus detect

# 4. Audit governance health
nexus audit
```

---

## Commands

### `nexus init`

Scaffolds the full governance framework into your project.

```bash
nexus init              # interactive setup
nexus init -d /path     # specify target directory
nexus init --force      # force creation inside nexus-cli
```

**What it creates:**
- `opencode.json` — AI agent configuration (project root)
- `nexus-system/` — governance framework directory
- `nexus-profile/` — project profile with area definitions
- Skills, scripts, docs, and governance templates based on team level

### `nexus status`

Analyses your project's complexity and governance health.

```bash
nexus status              # auto-detect project
nexus status -d /path     # specify directory
nexus status --no-cache   # skip cache, recalculate
```

**Outputs:**
- Governance health checks (opencode.json, AGENTS.md, skills, scripts, etc.)
- Complexity score with static + behavioral metrics
- Per-area breakdown (file count, churn, sensitive surface, violations, dependencies)
- Actionable suggestions

### `nexus detect`

Reads history and reports to detect recurring patterns.

```bash
nexus detect              # auto-detect project
nexus detect -d /path     # specify directory
nexus detect --no-cache   # skip cache, recalculate
```

**Detects:**
- Recurring errors (same area, 3+ occurrences)
- Reverted decisions (rollback patterns)
- Hot areas (consistently high scores across reports)

### `nexus audit`

Metacognitive audit — the system evaluating its own governance effectiveness.

```bash
nexus audit              # auto-detect project
nexus audit -d /path     # specify directory
nexus audit --no-cache   # skip cache, recalculate
```

**Audits:**
- Dead rules (never mentioned in history)
- Violation hotspots (high error rate)
- Missing docs (critical files absent)
- Orphan directories (empty structure)
- Stale context buffer

### `nexus upgrade`

Add more governance capabilities as your project grows.

```bash
nexus upgrade                    # interactive level selection
nexus upgrade --level pleno      # upgrade to L2
nexus upgrade --level senior     # upgrade to L3
nexus upgrade --list             # show available upgrades
```

**Levels:**
- **L1 (Junior):** Docs + Skills + Scripts
- **L2 (Pleno):** + Governance + Context Buffer
- **L3 (Senior):** + Cognition + Contracts + Reports + ADRs

### `nexus validate`

Validates session integrity before closing.

```bash
nexus validate              # run all checks
nexus validate --fix        # attempt automatic repairs
```

### `nexus sync`

Sync project governance files from an external nexus-system.

```bash
nexus sync --nexus-path /path/to/nexus-system
nexus sync --dry-run        # preview changes without applying
nexus sync --force          # overwrite without confirmation
```

---

## Architecture

```
nexus-cli/
├── bin/nexus.ts              # CLI entry point (Commander.js)
├── src/
│   ├── analyser.ts           # Project analysis & stack detection
│   ├── scorer.ts             # Complexity scoring engine (Phase 1)
│   ├── pattern-detector.ts   # Pattern extraction (Phase 2)
│   ├── health-auditor.ts     # Governance health audit (Phase 3)
│   ├── cache.ts              # Disk cache with SHA256 checksums
│   ├── scaffolder.ts         # Project scaffolding
│   ├── prompts.ts            # Interactive prompts (inquirer)
│   ├── utils.ts              # Shared utilities
│   ├── commands/             # CLI command implementations
│   ├── templates/            # Template files for scaffolding
│   └── __tests__/            # Unit + integration tests
```

### Performance

The scoring engine uses several optimizations:

- **Batch git log** — Single `git log` call for all areas (vs N separate calls)
- **Parallel area scoring** — `Promise.all` with event loop interleaving
- **Shared file cache** — `FileContentCache` avoids repeated reads
- **Pre-read history** — Single pass over history for all areas

### Caching

Results are cached to `.nexus-cache.json` at project root. Cache is invalidated when:
- `git HEAD` changes (any commit)
- `package.json` is modified
- `opencode.json` is modified
- `nexus-profile/` or `nexus-system/` changes

Cache hit: **<1ms** vs 15-106ms without cache.

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

### `nexus-profile/` (Project Profile)

Auto-generated during `nexus init`. Defines:
- Project name
- Source areas to monitor
- Sensitive keywords
- Churn window (days)
- Scoring weights

---

## Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev status

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Benchmarks
npx vitest bench src/__tests__/benchmarks.bench.ts
```

---

## Testing

- **105 unit tests** across 8 test files
- **24 CLI integration tests** (end-to-end)
- **Performance benchmarks** for scoring, detection, and audit engines

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode
npx vitest bench       # run benchmarks
```

---

## License

MIT
