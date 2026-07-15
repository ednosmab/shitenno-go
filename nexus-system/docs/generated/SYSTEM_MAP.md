# System Map

> Generated: 2026-07-14T04:51:49.123Z
> Session Score: 99/100

## Overview

- **Project:** nexus-cli
- **Root:** /media/edson-ubuntu/Data2/projeto-formação_tech/nexus-cli
- **Stack:** typescript, node, react
- **Lifecycle:** governed

## Assets

### Adrs (5)

- ADR-001: Single Agent Architecture — docs/adrs/ADR-001-single-agent-architecture.md
- ADR-002: Event-Driven Architecture with Centralized Engineering State — docs/adrs/ADR-002-event-driven-state.md
- ADR-003: Knowledge Graph as Foundation for Documentation — docs/adrs/ADR-003-knowledge-graph-persistence.md
- ADR-005: Automated Task Completion Pipeline — docs/adrs/ADR-005-automated-task-completion-pipeline.md
- ADR-006: Restrict Filesystem Access in CLI Commands — docs/adrs/ADR-006-filesystem-access-restriction.md

### Skills (17)

- architectural integrity — docs/skills/architectural_integrity.md
- ci cd pipeline — docs/skills/ci_cd_pipeline.md
- clean code standards — docs/skills/clean_code_standards.md
- codebase hygiene git — docs/skills/codebase_hygiene_git.md
- design patterns — docs/skills/design_patterns.md
- domain driven design (ddd) — docs/skills/domain_driven_design_(ddd).md
- error handling observability — docs/skills/error_handling_observability.md
- handbook-fill — docs/skills/handbook-fill.md
- operacao no nexus — docs/skills/operacao_no_nexus.md
- optimistic ui — docs/skills/optimistic_ui.md
- ... and 7 more

### Contracts (4)

- AI CONTRACT executor v1 — governance/agents/AI-CONTRACT-executor-v1.yaml
- AI CONTRACT orchestrator v1 — governance/agents/AI-CONTRACT-orchestrator-v1.yaml
- AI CONTRACT planner v1 — governance/agents/AI-CONTRACT-planner-v1.yaml
- AI CONTRACT reviewer v1 — governance/agents/AI-CONTRACT-reviewer-v1.yaml

### Policys (13)

- Doc Lifecycle — check Plans + ADRs for staleness at session start — governance/rules/RULE-011-doc-lifecycle-check.json
- Auto-audit when health status is critical — governance/rules/RULE-011.json
- Session Briefing — show project summary at session start — governance/rules/RULE-012-session-briefing.json
- Update context buffer on significant maturity change — governance/rules/RULE-012.json
- Create backlog item when knowledge debt gaps exceed threshold — governance/rules/RULE-013.json
- Create reminder when validation fails — governance/rules/RULE-014.json
- Archive active plans on session end — governance/rules/RULE-015.json
- Auto-transition backlog to em validacao on task completion — governance/rules/RULE-016.json
- Update context buffer on task completion — governance/rules/RULE-017.json
- Update context buffer when a plan is archived (moved to done/) — governance/rules/RULE-018.json
- ... and 3 more

### Workflows (1)

- Main Workflow — governance/WORKFLOW.md

### Runbooks (1)

- merge — docs/runbooks/merge.md

### Plans (3)

- 2026 07 12 migrar console log para logger — governance/plans/2026-07-12-migrar-console-log-para-logger.md
- PLAN doc semantic sync — governance/plans/PLAN-doc-semantic-sync.md
- README — governance/plans/README.md

### Scripts (6)

- backlog — scripts/backlog.ts
- close session — scripts/close-session.ts
- generate changelog — scripts/generate-changelog.ts
- premortem check — scripts/premortem-check.ts
- sync docs — scripts/sync-docs.ts
- validate session — scripts/validate-session.ts

### Docs (14)

- AGENTS — docs/AGENTS.md
- BACKLOG — docs/BACKLOG.md
- CONCEPTUAL MODEL — docs/CONCEPTUAL_MODEL.md
- DESDO — docs/DESDO.md
- ENTERPRISE AUDIT PLAN — docs/ENTERPRISE_AUDIT_PLAN.md
- ENTERPRISE AUDIT PLAN V2 — docs/ENTERPRISE_AUDIT_PLAN_V2.md
- FORBIDDEN OPERATIONS — docs/FORBIDDEN_OPERATIONS.md
- INDEX — docs/INDEX.md
- KNOWLEDGE LIFECYCLE — docs/KNOWLEDGE_LIFECYCLE.md
- Nexus-System GUIDE — docs/Nexus-System_GUIDE.md
- ... and 4 more

### Reports (8)

- complexity nexus cli 2026 07 12 session1 — reports/complexity-nexus-cli-2026-07-12-session1.json
- complexity nexus cli 2026 07 13 session1 — reports/complexity-nexus-cli-2026-07-13-session1.json
- doc lifecycle 2026 07 12 — reports/doc-lifecycle-2026-07-12.json
- doc lifecycle 2026 07 13 — reports/doc-lifecycle-2026-07-13.json
- doc sync 2026 07 12 — reports/doc-sync-2026-07-12.json
- doc sync 2026 07 13 — reports/doc-sync-2026-07-13.json
- patterns 2026 07 12 — reports/patterns-2026-07-12.json
- patterns 2026 07 13 — reports/patterns-2026-07-13.json

### Contexts (1)

- Session Context Buffer — governance/context/context_buffer.yaml

### Prompts (3)

- executor prompt: README — cognition/prompts/executor/README.md
- planner prompt: README — cognition/prompts/planner/README.md
- reviewer prompt: README — cognition/prompts/reviewer/README.md
