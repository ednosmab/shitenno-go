# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-07-04

### Added

- **Audit levels:** `--level quick|full` for granular audit depth control
- **33 audit detectors:** Expanded from basic checks to comprehensive governance analysis
- **Taint analysis:** Track data flow through governance rules and detect contamination
- **13 new CLI commands:** `act`, `plan`, `goal`, `decide`, `policy`, `console`, `digest`, `bench`, `briefing`, `feedback`, `profile`, `dashboard`, `shell-init`
- **`nexus docs-audit`:** Validate documentation synchronization with codebase
- **Dashboard command:** Visual governance overview with real-time metrics
- **Shell integration:** Auto-completion setup for bash/zsh/fish

### Changed

- Expanded test suite from 484 to 1045+ tests across 63 files
- Updated all documentation to reflect 26 CLI commands
- Improved audit coverage from 79% to 93%

### Fixed

- Documentation sync issues across 6 critical files
- Broken reference to `Requisitos_plataforma.md` in AGENTS.md
- Incorrect test and command counts in README

## [0.1.0] — 2026-06-26

### Added

- **CLI commands:** `init`, `status`, `detect`, `audit`, `upgrade`, `validate`, `sync`, `clean`
- **Scoring engine** (`scorer.ts`):
  - Static metrics: packages, apps, files, dependencies, monorepo
  - Behavioral metrics: validate failures, ADRs, branches, commits/week, sessions, bug fixes, agents, skills
  - Per-area scoring with churn, violations, sensitive surface, dependency depth, incident-free age, context pressure
  - Report writer: JSON reports saved to `nexus-system/reports/`
- **Pattern detector** (`pattern-detector.ts`):
  - Recurring error detection (3+ occurrences in same area)
  - Reverted decision detection (rollback patterns)
  - Hot area detection (consistently high scores across reports)
  - Candidate rule proposals (FORBIDDEN_OPERATIONS / AGENTS.md)
- **Health auditor** (`health-auditor.ts`):
  - Dead rule detection (never mentioned in history)
  - Violation hotspot detection (50%+ violation rate)
  - Missing docs detection (critical files)
  - Orphan directory detection
  - Stale buffer detection
  - Governance optimization proposals
- **Project analyzer** (`analyser.ts`):
  - Stack detection (React, Next.js, Vue, Svelte, Angular, etc.)
  - Package manager detection (pnpm, yarn, npm)
  - Monorepo detection
  - Source file counting
  - CI/linter/test detection
- **Scaffolder** (`scaffolder.ts`):
  - Three-tier governance levels (Junior / Pleno / Senior)
  - 21 engineering skills
  - Template customization with project-specific placeholders
  - Area auto-detection
- **Disk cache** (`cache.ts`):
  - SHA256 checksums for key files (.git/HEAD, package.json, opencode.json, nexus-profile/, nexus-system/)
  - Cache invalidation on init/upgrade/sync
  - `--no-cache` flag on status/detect/audit commands
  - Cache hit: <1ms vs 15-106ms without cache
- **Performance optimizations:**
  - Batch git log (single call for all areas)
  - Parallel area scoring (Promise.all + setImmediate)
  - Shared FileContentCache for keyword scanning
  - Pre-read history (single pass for all areas)
  - Benchmarks: Large project 223ms → 106ms (-52%)
- **Interactive prompts** (`prompts.ts`): AI model selection, stack, database, styling, team level
- **Test suite:** 105 unit tests + 24 CLI integration tests
- **CLI integration tests** (`cli-integration.test.ts`): End-to-end tests for all commands
- **Performance benchmarks** (`benchmarks.bench.ts`): Scaling tests for all engines
- **`--json` flag** on all commands (`status`, `detect`, `audit`, `validate`, `sync`, `upgrade --list`, `clean`): Structured JSON output for CI/scripting
- **Health bar visualization** (`formatting.ts`): ASCII progress bars for complexity scores and health scores
- **`nexus clean` command**: Explicitly clear cache and temporary files
- **GitHub Actions CI** (`.github/workflows/ci.yml`): Typecheck + build + test on Node 18/20/22
- **GitHub Actions Release** (`.github/workflows/release.yml`): Automated npm publish on git tags
- **Formatting utilities** (`formatting.ts`): `healthBar`, `miniBar`, `outputJson`, `statusIcon` — shared across all commands
- **Unit tests for formatting** (`formatting.test.ts`): 18 tests covering healthBar, miniBar, outputJson, statusIcon
- **README.md**: Full project documentation with architecture, commands, development guide
- **CHANGELOG.md**: Version history with all features documented
- **`.npmignore`**: Clean npm publish configuration
- **`vitest.config.ts`**: Test configuration with coverage and excluded benchmarks
- **`package.json`**: Added `exports` field, `bench`/`lint`/`clean` scripts

### Fixed

- Batch git log index alignment bug (shortAreas vs otherAreas)
- Cache indentation bug in `invalidateCache` else branch
- Unused `countSourceFilesInDir` import removal
- Dead comment cleanup in scorer.ts
- Version consistency: reads from `package.json` instead of hardcoded string
- Removed unused `fseReadFileSync` import from sync.ts
- Removed unused `coloredScore` export from formatting.ts
