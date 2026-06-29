# 28 — VALIDATION CHECKLIST

> Validation checklist per capability.

## Core Capability

- [ ] `opencode.json` exists at project root
- [ ] `nexus-system/` directory exists
- [ ] `nexus-system/docs/AGENTS.md` exists
- [ ] `nexus-system/docs/FORBIDDEN_OPERATIONS.md` exists (from `src/templates/base/docs/FORBIDDEN_OPERATIONS.md`)
- [ ] `nexus-system/docs/DESDO.md` exists
- [ ] `nexus-system/docs/CONCEPTUAL_MODEL.md` exists
- [ ] `nexus-system/docs/KNOWLEDGE_LIFECYCLE.md` exists
- [ ] `nexus-system/docs/BACKLOG.md` exists
- [ ] `nexus-system/governance/SYSTEM_MAP.md` exists
- [ ] `nexus-system/docs/opencode-context.md` exists
- [ ] `nexus-system/docs/Nexus-System_GUIDE.md` exists
- [ ] `nexus-system/core/complexity/types.ts` exists
- [ ] `nexus-system/docs/feedback/README.md` exists

## Knowledge Capability

- [ ] `nexus-system/docs/skills/` directory exists
- [ ] At least 1 skill file present
- [ ] Skills match project stack

## Architecture Capability

- [ ] `nexus-system/docs/adrs/` directory exists
- [ ] `nexus-system/docs/adrs/ADR-TEMPLATE.md` exists
- [ ] `nexus-system/docs/sdr/` directory exists
- [ ] `nexus-system/docs/sdr/SDR-TEMPLATE.md` exists
- [ ] `nexus-system/docs/plans/` directory exists
- [ ] `nexus-system/docs/plans/TEMPLATE.md` exists

## Governance Capability

- [ ] `nexus-system/governance/context/` directory exists
- [ ] `nexus-system/governance/WORKFLOW.md` exists
- [ ] `nexus-system/governance/context/context_buffer.yaml` exists
- [ ] Context buffer is valid YAML

## AI Capability

- [ ] `nexus-system/governance/agents/` directory exists
- [ ] At least 1 agent contract exists
- [ ] Agent contracts are valid YAML
- [ ] `nexus-system/governance/contracts/CONTRACTS_INDEX.md` exists
- [ ] `nexus-system/governance/handoffs/TEMPLATE.md` exists
- [ ] `nexus-system/cognition/context/CONTEXT_HIERARCHY.md` exists
- [ ] `nexus-system/cognition/memory/MEM-operational-state-v1.json` exists

## Quality Capability

- [ ] `nexus-system/scripts/validate-session.ts` exists
- [ ] Script is syntactically valid TypeScript

## Metrics Capability

- [ ] `nexus-system/reports/` directory exists
- [ ] `nexus-system/docs/history/` directory exists
- [ ] `nexus-system/reports/README.md` exists

## Operations Capability

- [ ] `nexus-system/docs/runbooks/` directory exists
- [ ] `nexus-system/scripts/close-session.ts` exists
- [ ] `nexus-system/scripts/premortem-check.ts` exists
- [ ] `nexus-system/docs/runbooks/merge.md` exists

## Compliance Capability

- [ ] `nexus-system/governance/premortem/` directory exists
- [ ] `nexus-system/governance/premortem/PREMORTEM.md` exists
- [ ] `nexus-system/governance/reviews/` directory exists
- [ ] `nexus-system/governance/reviews/SESSION_REVIEW.md` exists

## System-Wide Checks

- [ ] `nexus status` runs without errors
- [ ] `nexus validate` passes all checks
- [ ] `nexus detect` completes successfully
- [ ] `nexus audit` completes successfully
- [ ] `nexus doctor` completes successfully
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] All tests pass (`npm test`)
