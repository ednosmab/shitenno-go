/**
 * constants.ts — Shared Constants for Nexus
 *
 * Eliminates duplication of VIOLATION_KEYWORDS and COMMAND_GATES.
 */

/** Keywords indicating violations in commits/logs. */
export const VIOLATION_KEYWORDS = [
  "bug", "fix", "hotfix", "error", "issue", "broken", "regressão",
  "problema", "incidente", "falha", "crash", "exception",
  "reverted", "rollback", "revert", "violated", "violacao",
  "undeclared", "missing", "unexpected", "failed",
];

/** Command → minimum lifecycle state mapping. */
export const COMMAND_GATES: Record<string, string> = {
  init: "uninitialized",
  status: "discovered",
  detect: "discovered",
  audit: "discovered",
  upgrade: "assessed",
  validate: "assessed",
  assess: "discovered",
  doctor: "discovered",
  run: "assessed",
  sync: "governed",
  clean: "governed",
  evolve: "governed",
  briefing: "discovered",
  feedback: "discovered",
  bench: "discovered",
  dashboard: "discovered",
  "docs-audit": "discovered",
};

/** Timeout for git commands (ms). */
export const GIT_TIMEOUT = 5000;

/** Timeout for rule scripts (ms). */
export const RULE_SCRIPT_TIMEOUT = 30000;

/** Valid action types for rule engine. */
export const VALID_ACTION_TYPES = [
  "update_context_buffer",
  "create_reminder",
  "update_quick_board",
  "log_event",
  "trigger_assessment",
  "trigger_health_check",
  "update_backlog",
  "run_script",
  "run_nexus_command",
] as const;
