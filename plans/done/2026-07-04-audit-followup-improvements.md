# Plan: Follow-up — Nexus Audit Improvements

**Date:** 2026-07-04
**Status:** ✅ ALL DONE (2026-07-04)
**Source:** Code review feedback after expanding nexus audit with 7 dimensions

---

## Improvement 1: Shared File Collector (P1)

**What:** The 5 engineering detectors (`detectOrphanModules`, `detectComplexityHotspots`, `detectTestCoverageGaps`, `detectTypeSafetyIssues`, `detectConsoleUsage`) each independently walk `src/`. This is 5 redundant directory traversals.

**Solution:** Create a shared `collectSourceFiles(projectRoot)` helper that walks `src/` once and returns a `SourceFileInfo[]` array. Each detector then filters from this pre-computed list.

```typescript
interface SourceFileInfo {
  fullPath: string;
  relPath: string;
  basename: string;
  content: string;
  lineCount: number;
}
```

**Impact:** ~5x fewer filesystem reads during audit. Faster execution.

---

## Improvement 2: Expand Console Detection (P2)

**What:** `detectConsoleUsage` only catches `log|warn|error|info`. It misses `console.debug` and `console.trace`.

**Solution:** Extend regex to `console\.(log|warn|error|info|debug|trace)\(`.

---

## Improvement 3: Configurable Thresholds (P2)

**What:** Severity thresholds are hardcoded: `missing_test > 10`, `orphan_module > 200 lines`, `oversized_file > 1000 lines`. These should be tunable constants at the top of the file.

**Solution:** Extract to named constants:
```typescript
const ORPHAN_SEVERITY_THRESHOLD = 200;
const OVERSIZED_WARNING_THRESHOLD = 1000;
const MISSING_TEST_WARNING_THRESHOLD = 10;
```

---

## Improvement 4: Document Vitest Assumption (P2)

**What:** `detectTestHealth` silently returns no issues if vitest is not installed. Worth a comment.

**Solution:** Add comment: `// If vitest not installed, execSync throws ENOENT — no failure patterns in output, so we skip gracefully`.

---

## Priority Order

1. **P1** — Shared file collector (performance optimization)
2. **P2** — Expand console detection, configurable thresholds, document assumptions

---

## Validation Results

1. `npx tsc --noEmit` — ✅ 0 errors
2. `npx vitest run src/__tests__/health-auditor.test.ts` — ✅ 60/60 pass
3. `npm run build` — ✅ success
4. `npx nexus audit --level full --no-cache` — ✅ 45 detectors, ~100+ issues

## Additional Fixes (code reviewer feedback)

- **Shared collector truly shared**: `collectSourceFiles()` called once in `auditHealth()`, passed to all 9 engineering detectors
- **CONTROL_FLOW_KEYWORDS** moved outside loop for efficiency
- **`as string` assertion** replaced with null guard
- **Empty method detection** excludes control flow keywords via Set
- **TODO limit** reduced to 5 per file to prevent output flooding

## Phase 3 Detectors (also implemented in this session)

| Detector | Level | Issue Type | What it detects |
|---|---|---|---|
| `detectEmptyCatchBlocks` | standard | `empty_catch` | Empty catch blocks silencing errors |
| `detectHighComplexity` | standard | `high_complexity` | Per-function cyclomatic complexity >15 |
| `detectCircularDeps` | full | `circular_dep` | Circular import dependencies |
| `detectUnusedExports` | standard | `unused_export` | Exported symbols never imported |
| `detectDeadCodePatterns` | standard | `dead_code` | @ts-ignore, empty methods, TODOs |
