# ADR-005: Automated Task Completion Pipeline

**Status:** Done
**Created:** 2026-07-08
**Type:** feature

## Objective
Fix the systemic gap where plan status isn't auto-updated from "andamento" to "done" when tasks complete. Implement a 3-layer pipeline: 5 completion gates, backlog state machine, and event-driven auto-archive.

## Steps

### Phase 1: 5th Gate (plan_status)
- [x] Add `checkPlanStatus` gate to `src/task-completion.ts`
- [x] Gate reads plan frontmatter and checks `status: done`
- [x] Update `close-session.ts` to show "5 gates"

### Phase 2: Backlog State Machine
- [x] Create `src/backlog-state-machine.ts` with 8 states and transitions
- [x] Implement BFS shortest path for `completeTask()`
- [x] Add `update_backlog_status` action to rule engine
- [x] Create `RULE-016.json` and `RULE-017.json`

### Phase 3: Event-Driven Archive
- [x] Add `archive_plan` action to rule engine
- [x] Create `src/task-completion-pipeline.ts` orchestrator
- [x] Update `RULE-015.json` to use new action
- [x] Integrate pipeline into `close-session.ts`

### Phase 4: Tests
- [x] Update `task-completion.test.ts` for 5 gates (12 tests)
- [x] Create `backlog-state-machine.test.ts` (24 tests)
- [x] All 36 tests pass
- [x] TypeScript compiles clean
- [x] Lint passes

## Files Modified
- `src/task-completion.ts` - Added 5th gate `checkPlanStatus`
- `src/backlog-state-machine.ts` - New: state machine with BFS path finding
- `src/task-completion-pipeline.ts` - New: orchestrator
- `src/rule-engine.ts` - Added `update_backlog_status` and `archive_plan` actions
- `src/commands/close-session.ts` - Integrated pipeline
- `shitenno-go/governance/rules/RULE-015.json` - Updated
- `shitenno-go/governance/rules/RULE-016.json` - New
- `shitenno-go/governance/rules/RULE-017.json` - New
- `shitenno-go/docs/adrs/ADR-005-automated-task-completion-pipeline.md` - Status: Accepted
- `src/__tests__/task-completion.test.ts` - Updated for 5 gates
- `src/__tests__/backlog-state-machine.test.ts` - New: 24 tests

## Verification
- `npx tsc --noEmit` passes
- `pnpm run build` succeeds
- `pnpm run lint` passes
- 36/36 ADR-005 tests pass
