# Plan: Shiten Audit Phase 3 — 5 Remaining Gaps

**Date:** 2026-07-04
**Status:** Active
**Source:** Audit analysis after Phase 2 (7 engineering dimensions)

---

## Context

Phase 2 added 7 engineering audit dimensions (test health, orphan modules, complexity hotspots, test coverage gaps, ESLint, type safety, dead code). The audit now has 40 detectors and catches ~92 issues at full level.

However, 5 significant gaps remain that a manual technical audit would catch but the automated audit does not.

---

## Gap 1: Empty Catch Blocks (P0)

**What:** `catch { /* skip */ }` silences errors silently. Found ~30+ instances in health-auditor.ts alone.

**Detector:** `detectEmptyCatchBlocks`
**Level:** `standard` (static analysis — fast)
**Issue type:** `empty_catch`
**Severity:** 2 (warning) per instance

**Implementation:**
- Use `collectSourceFiles()` (shared helper already exists)
- Regex: `/catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/.*|\/\*[\s\S]*?\*\/|\s)*)\}/g`
- For each match, report file, line number, and surrounding context
- Recommendation: add error handling or use `logger.debug()` instead of silent skip

**Example output:**
```
[WARNING] catch vazio em "src/health-auditor.ts" linha 423
  Fix: Substituir `catch { /* skip */ }` por `catch (e) { logger.debug(...) }`
```

---

## Gap 2: Circular Dependencies (P1)

**What:** Modules that import each other (directly or transitively) create hidden coupling.

**Detector:** `detectCircularDeps`
**Level:** `full` (requires dependency graph analysis)
**Issue type:** `circular_dep`
**Severity:** 3 (critical) for direct cycles, 2 (warning) for transitive

**Implementation:**
- Build import graph from `collectSourceFiles()` results
- For each file, extract imports: `from "./xxx.js"` patterns
- Build adjacency list: `Map<string, Set<string>>`
- DFS cycle detection: for each unvisited node, track visit stack
- Report each cycle found with the full path

**Example output:**
```
[CRITICAL] Dependência circular: state-manager → policy-engine → state-manager
  Fix: Extrair interface comum para quebrar o ciclo
```

**Alternative:** Use `madge` package (`npx madge --circular src/`) for battle-tested detection. Trade-off: adds a dependency.

---

## Gap 3: Cyclomatic Complexity (P1)

**What:** Files with high branching complexity are hard to maintain. Current "oversized_file" only counts lines, not logic branches.

**Detector:** `detectHighComplexity`
**Level:** `standard` (static analysis — fast)
**Issue type:** `high_complexity`
**Severity:** 2 (warning) for complexity > 15, 3 (critical) for > 25

**Implementation:**
- Use `collectSourceFiles()` (shared helper)
- For each file, count branching keywords per function:
  - `if`, `else if`, `switch`, `case`, `for`, `while`, `do`, `catch`, `&&`, `||`, `? :`
- Calculate: `complexity = 1 + sum(branches)`
- Per-function granularity: detect function boundaries with regex
- Report files with average function complexity > 15

**Example output:**
```
[WARNING] Alta complexidade ciclomática em "src/scorer.ts"
  Função `computeScore`: complexidade 23 (máx recomendado: 15)
  Função `analyzeArea`: complexidade 18
```

---

## Gap 4: Unused Exports (P2)

**What:** Exported symbols that are never imported by any other file.

**Detector:** `detectUnusedExports`
**Level:** `standard` (static analysis — fast)
**Issue type:** `unused_export`
**Severity:** 1 (info) per instance

**Implementation:**
- Use `collectSourceFiles()` results
- For each file, extract exported symbols: `export function X`, `export const X`, `export interface X`, `export type X`, `export class X`
- For each exported symbol, search all other files for imports referencing it
- If no imports found → unused export
- **Exception:** Skip barrel files (`index.ts`), entry points (`bin/shiten.ts`), re-exports
- **Exception:** Skip `default` exports (harder to track)

**Example output:**
```
[INFO] Export não usado: "computeHealthScore" em "src/health-auditor.ts"
  Fix: Remover export ou adicionar import em módulo que o utiliza
```

---

## Gap 5: Dead Code Patterns (P2)

**What:** Real dead code beyond console.log: unreachable code, empty functions, commented-out code blocks.

**Detector:** `detectDeadCodePatterns`
**Level:** `standard` (static analysis — fast)
**Issue type:** `dead_code`
**Severity:** 1 (info) per instance

**Implementation:**
- Use `collectSourceFiles()` results
- Detect patterns:
  1. **Unreachable code:** Lines after `return`, `throw`, `break`, `continue` in same block
  2. **Empty function bodies:** `function x() {}` or `() => {}`
  3. **Commented-out code:** Blocks of 3+ consecutive lines that look like code (contain `=`, `(`, `{`, `;`)
  4. **@ts-ignore / @ts-expect-error:** Type safety bypasses

**Example output:**
```
[INFO] Código inalcançável em "src/scorer.ts" linha 142
  Fix: Remover código após return ou adicionar lógica condicional
```

---

## New HealthIssue Types

```typescript
| "empty_catch"
| "circular_dep"
| "high_complexity"
| "unused_export"
| "dead_code"
```

## New GovernanceOptimization Actions

```typescript
| "fix_empty_catch"
| "break_cycle"
| "reduce_complexity"
| "remove_unused_export"
| "remove_dead_code"
```

## DETECTORS_BY_LEVEL Updates

```typescript
standard: [
  // ... existing 23 detectors ...
  "detectEmptyCatchBlocks",
  "detectHighComplexity",
  "detectUnusedExports",
  "detectDeadCodePatterns",
],
full: [
  // ... existing 40 detectors ...
  "detectEmptyCatchBlocks",
  "detectHighComplexity",
  "detectUnusedExports",
  "detectDeadCodePatterns",
  "detectCircularDeps",
],
```

## Files to Modify

| File | Change |
|------|--------|
| `src/health-auditor.ts` | Add 5 new detector functions, new types, update DETECTORS_BY_LEVEL, update detectorMap, update proposeOptimizations |

## Implementation Order

1. **P0 — detectEmptyCatchBlocks** (fast, high value, catches real bugs)
2. **P1 — detectHighComplexity** (fast, complements existing oversized_file)
3. **P1 — detectCircularDeps** (full level only, complex but high value)
4. **P2 — detectUnusedExports** (fast, reduces noise)
5. **P2 — detectDeadCodePatterns** (fast, catches real issues)

## Validation

1. `npx tsc --noEmit` — 0 errors
2. `npx vitest run src/__tests__/health-auditor.test.ts` — pass
3. `npm run build` — success
4. `npx shiten audit --level full --no-cache` — verify new issue types appear
5. Compare issue count before/after (should increase by ~20-40 new issues)
