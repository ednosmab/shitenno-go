# Plan: Expand `shiten audit` — 7 New Dimensions

**Date:** 2026-07-04
**Status:** ✅ DONE

---

## Results

| Metric | Before | After | Delta |
|---|---|---|---|
| **Detectors (standard)** | 19 | 23 | +4 |
| **Detectors (full)** | 33 | 40 | +7 |
| **Issues (standard)** | 48 | 71 | +23 |
| **Issues (full)** | 66 | ~91 | +25 |
| **Optimizations (full)** | 65 | 90 | +25 |

### New Issue Types Detected

| Dimension | Issue Type | Standard | Full |
|---|---|---|---|
| Test Health | `test_failure` | — | 22 failures |
| Orphan Modules | `orphan_module` | 10 | 10 |
| Complexity Hotspots | `oversized_file` | 11 | 11 |
| Test Coverage | `missing_test` | 47 modules | 47 modules |
| ESLint | `lint_error` | — | — (0 errors) |
| Type Safety | `any_type_usage` | — | 1 |
| Dead Code | `console_log_outside_cmd` | — | 86 |

---

## What Was Implemented

### health-auditor.ts
- Added 7 new detector functions: `detectTestHealth`, `detectOrphanModules`, `detectComplexityHotspots`, `detectTestCoverageGaps`, `detectLintIssues`, `detectTypeSafetyIssues`, `detectConsoleUsage`
- Extended `HealthIssue.type` union with 8 new types
- Extended `GovernanceOptimization.action` union with 6 new actions
- Updated `DETECTORS_BY_LEVEL` (standard +4, full +7)
- Updated `detectorMap` and `proposeOptimizations`

### audit.ts
- Added new issue type counts in JSON output (`issueCounts` object)
- Added new issue type display in human-readable output

### Fixes Applied (from code review)
1. **Test failure counting**: Parsed vitest summary line `(\d+) failed` instead of fragile regex
2. **Dead interface fields**: Removed unused `testResults`/`lintResults` from `HealthAuditReport`
3. **Naming**: Renamed `detectDeadCode` → `detectConsoleUsage`
4. **ESLint warnings**: Now captured on success path (exit 0) + error path
5. **Type safety**: Fixed `summaryMatch[1]` → `summaryMatch?.[1]`

---

## Validation
- TypeScript: 0 errors ✅
- Tests: 60/60 pass ✅
- Build: success ✅
- Code review: approved ✅
