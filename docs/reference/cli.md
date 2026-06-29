# CLI Reference

> Complete reference for all Nexus CLI commands.

## Global Options

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Project directory (default: current directory) |
| `--json` | Output as JSON |
| `--help` | Show help |
| `--version` | Show version |

## Commands

### nexus init

Initialize Nexus in a project.

```bash
nexus init [--dir <path>]
```

**What it does:**
- Creates `nexus-system/` directory
- Scaffolds governance structure
- Installs core capability
- Creates `opencode.json`

**Exit codes:** 0 (success), 1 (error)

---

### nexus status

Health check and complexity scoring.

```bash
nexus status [--dir <path>] [--json]
```

**What it does:**
- Calculates complexity score
- Checks governance health
- Reports installed capabilities
- Shows maturity profile

**Exit codes:** 0 (success), 1 (error)

---

### nexus detect

Detect patterns from project history.

```bash
nexus detect [--dir <path>] [--json]
```

**What it does:**
- Analyzes commit history
- Detects repeated patterns
- Identifies hot areas
- Reports knowledge debt

**Exit codes:** 0 (success), 1 (error)

---

### nexus audit

Audit governance compliance.

```bash
nexus audit [--dir <path>] [--json]
```

**What it does:**
- Checks all governance rules
- Validates installed capabilities
- Reports violations
- Suggests improvements

**Exit codes:** 0 (success), 1 (error)

---

### nexus evolve

Generate evolution recommendations.

```bash
nexus evolve [--dir <path>] [--json]
```

**What it does:**
- Analyzes current state
- Compares to target state
- Generates recommendations
- Prioritizes by impact

**Exit codes:** 0 (success), 1 (error)

---

### nexus run

Execute the full analysis pipeline.

```bash
nexus run [--dir <path>] [--json]
```

**What it does:**
- Runs all analysis stages
- Generates comprehensive report
- Stores results in cache
- Publishes events

**Exit codes:** 0 (success), 1 (error)

---

### nexus upgrade

Install or upgrade capabilities.

```bash
nexus upgrade --capability <name> [--dir <path>]
```

**What it does:**
- Installs specified capability
- Resolves dependencies
- Scaffolds required files
- Updates capability mapping

**Exit codes:** 0 (success), 1 (error)

---

### nexus validate

Run validation checks.

```bash
nexus validate [--dir <path>] [--json]
```

**What it does:**
- Validates all installed capabilities
- Checks file integrity
- Verifies governance rules
- Reports pass/fail status

**Exit codes:** 0 (success), 1 (error)

---

### nexus sync

Synchronize knowledge with external state.

```bash
nexus sync [--dir <path>] [--json]
```

**What it does:**
- Syncs with external repositories
- Updates knowledge artifacts
- Reconciles differences
- Maintains consistency

**Exit codes:** 0 (success), 1 (error)

---

### nexus assess

Assess engineering maturity.

```bash
nexus assess [--dir <path>] [--json]
```

**What it does:**
- Evaluates 7 maturity dimensions
- Calculates overall score
- Compares to previous assessment
- Recommends capability upgrades

**Exit codes:** 0 (success), 1 (error)

---

### nexus clean

Clean cache and temporary files.

```bash
nexus clean [--dir <path>]
```

**What it does:**
- Removes cached analysis results
- Cleans temporary files
- Preserves knowledge artifacts

**Exit codes:** 0 (success), 1 (error)

---

### nexus doctor

System diagnostics.

```bash
nexus doctor [--dir <path>] [--json]
```

**What it does:**
- Checks system health
- Validates installation
- Reports issues
- Suggests fixes

**Exit codes:** 0 (success), 1 (error)

---

### nexus report

Generate reports.

```bash
nexus report [--dir <path>] [--json]
```

**What it does:**
- Generates comprehensive report
- Includes all analysis results
- Saves to `nexus-system/reports/`

**Exit codes:** 0 (success), 1 (error)

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation error |
| 3 | Not initialized |

---

*Last updated: 2026-06-29*
