# CLI Reference

> Complete reference for all Nexus CLI commands.

## Global Options

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Project directory (default: current directory) |
| `--json` | Output as JSON (where supported) |
| `--help` | Show help |
| `--version` | Show version |

## Commands

### nexus init

Initialize Nexus in a project.

```bash
nexus init [--dir <path>] [--answers-file <path>] [--force]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--answers-file <path>` | JSON file with pre-filled answers (skips interactive prompts) |
| `--force` | Force creation even inside nexus-cli directory |

**What it does:**
- Analyzes project structure (stack, packages, apps, TypeScript, tests, CI)
- Runs interactive questionnaire to assess maturity (or loads from `--answers-file`)
- Calculates maturity profile across 7 dimensions
- Scaffolds governance structure: `nexus-system/`, `opencode.json`, `nexus-profile/`
- Installs core capability + recommended capabilities based on maturity

**Exit codes:** 0 (success), 1 (error)

---

### nexus status

Health check, complexity scoring, and maturity overview.

```bash
nexus status [--dir <path>] [--json] [--no-cache]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and recalculate |

**What it does:**
- Runs 7 health checks (opencode.json, AGENTS.md, skills, governance, context buffer, scripts, agent contracts)
- Calculates complexity score with per-area breakdown
- Displays maturity profile with dimension bars
- Detects installed capabilities
- Generates complexity report in `reports/`

**Exit codes:** 0 (success), 1 (error)

---

### nexus detect

Detect patterns from project history and session logs.

```bash
nexus detect [--dir <path>] [--json] [--no-cache]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and recalculate |

**What it does:**
- Analyzes session history for recurring errors and reverted decisions
- Detects hot areas (consistently high complexity)
- Generates candidate rules (requires Tech Lead approval)
- Writes pattern report to `reports/`

**Exit codes:** 0 (success), 1 (error)

---

### nexus audit

Audit governance health and knowledge graph.

```bash
nexus audit [--dir <path>] [--json] [--no-cache]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and recalculate |

**What it does:**
- Detects dead rules, violation hotspots, missing docs, orphan directories, stale buffers
- Analyzes knowledge graph (artifacts, relations, orphans, hubs)
- Runs custom check hooks from plugins
- Generates health report with governance optimization proposals

**Exit codes:** 0 (success), 1 (error)

---

### nexus evolve

Show evolution recommendations with dual paths.

```bash
nexus evolve [--dir <path>] [--json] [--accept <id>] [--reject <id>] [--reason <text>] [--comfortable] [--challenging]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--accept <id>` | Accept a recommendation (record feedback) |
| `--reject <id>` | Reject a recommendation (record feedback) |
| `--reason <text>` | Reason for accept/reject |
| `--comfortable` | Choose the comfortable path (within current thinking) |
| `--challenging` | Choose the challenging path (beyond current thinking) |

**What it does:**
- Generates recommendations across 4 categories: capability, knowledge, governance, automation
- Shows dual paths for each recommendation (comfortable vs challenging)
- Integrates growth profile for challenge calibration
- Records feedback and adjusts confidence based on history
- Suppresses recommendations rejected 5+ times

**Exit codes:** 0 (success), 1 (error)

---

### nexus run

Execute the full 5-stage analysis pipeline.

```bash
nexus run [--dir <path>] [--json]
```

**Stages:**

| # | Stage | What it does |
|---|-------|-------------|
| 1 | `analyze` | Analyze project structure |
| 2 | `score` | Calculate complexity score |
| 3 | `detect` | Detect patterns in history |
| 4 | `audit` | Audit governance health |
| 5 | `evolve` | Generate evolution recommendations (conditional) |

**Exit codes:** 0 (success), 1 (error)

---

### nexus upgrade

Install or upgrade governance capabilities.

```bash
nexus upgrade [--dir <path>] [--capability <name>] [--list] [--accept-recommended] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--capability <cap>` | Capability to add (`knowledge`, `architecture`, `governance`, `ai`, `quality`, `metrics`, `operations`, `compliance`) |
| `--list` | List all capabilities and their status |
| `--accept-recommended` | Install all recommended capabilities from maturity profile |

**What it does:**
- Detects currently installed capabilities
- Resolves dependencies between capabilities
- Copies template files from `templates/base/`
- Publishes `capability.installed` event
- If no `--capability` specified, launches interactive selection

**Exit codes:** 0 (success), 1 (error)

---

### nexus validate

Validate configuration files and session state.

```bash
nexus validate [--dir <path>] [--json] [--fix]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--fix` | Attempt to fix issues automatically |

**What it does:**
- Validates context buffer, ADR directory, opencode.json consistency
- Checks agent contracts validity (plan, build, review roles required)
- Verifies session status and git status
- If `--fix`: creates default opencode.json and context_buffer.yaml

**Exit codes:** 0 (success), 1 (error)

---

### nexus sync

Synchronize files from a local nexus-system directory.

```bash
nexus sync [--dir <path>] --nexus-path <path> [--dry-run] [--force] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--nexus-path <path>` | Path to source nexus-system directory (or `NEXUS_SYSTEM_PATH` env) |
| `--dry-run` | Show what would be changed without making changes |
| `--force` | Overwrite all files without asking |

**What it does:**
- Copies files from source nexus-system to target project
- Preserves project-specific customizations during merge
- Supports JSON merge for opencode.json (preserves agent models/permissions)
- Supports Markdown section merge for AGENTS.md, opencode-context.md, Nexus-System_GUIDE.md

**Exit codes:** 0 (success), 1 (error)

---

### nexus assess

Re-evaluate maturity profile and show deltas.

```bash
nexus assess [--dir <path>] [--json]
```

**What it does:**
- Runs full maturity questionnaire (or synthesizes from previous profile in JSON mode)
- Calculates new maturity profile across 7 dimensions
- Compares to previous assessment with delta display
- Shows evolution sparkline
- Records feedback for recommended capabilities

**Exit codes:** 0 (success), 1 (error)

---

### nexus clean

Clean cache and temporary files.

```bash
nexus clean [--dir <path>] [--json]
```

**What it does:**
- Removes `.nexus-cache.json` from project root
- Removes `*.tsbuildinfo` files
- Invalidates internal cache

**Exit codes:** 0 (success), 1 (error)

---

### nexus doctor

System diagnostics with risks, improvements, and teaching moments.

```bash
nexus doctor [--dir <path>] [--json]
```

**What it does:**
- Consolidates engineering state from all subsystems
- Detects knowledge debt across 10 gap types
- Analyzes risks (critical debt, low maturity, blockers, no tests)
- Suggests improvements (no CI/CD, few capabilities, knowledge graph issues)
- Shows teaching moments (ADR vs Skill distinction, capability system, knowledge lifecycle)
- Calculates health score (100 - deductions for risks)

**Exit codes:** 0 (success), 1 (error)

---

### nexus report

Generate user performance report with dimensions, trends, and insights.

```bash
nexus report [--dir <path>] [--json] [--period <days>] [--save]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--period <days>` | Period in days (default: 30) |
| `--save` | Save report to `reports/` directory |

**What it does:**
- Generates performance report across 7 metrics (architectural vision, scope management, prompt quality, decision making, risk management, technical communication, sustainable velocity)
- Shows growth profile, session metrics, feedback stats
- Displays maturity and debt trends from telemetry snapshots
- Generates insights (strengths, improvements, patterns, suggestions)
- Provides actionable next steps

**Exit codes:** 0 (success), 1 (error)

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |

---

*Last updated: 2026-06-29*
