/**
 * Security primitives for the rule engine.
 *
 * Centralizes allowlists, ID validation, and prototype-pollution protection
 * used across rule loading, storage, and execution.
 */

// ── Allowed Scripts ──────────────────────────────────────────────────────────

/** Comandos permitidos para execução via regras. */
const ALLOWED_SCRIPTS: Record<string, string> = {
  "git-status": "git status --short",
  "git-diff": "git diff --stat",
  "git-log": "git log --oneline -5",
  "list-files": "find . -maxdepth 2 -type f | head -20",
};

/** Comandos Nexus permitidos para execução via regras. */
const ALLOWED_NEXUS_COMMANDS: Record<string, string> = {
  "briefing": "briefing --summary",
  "docs-audit": "docs-audit --json",
  "status": "status --quiet",
  "validate": "validate",
};

export function isScriptAllowed(script: string): boolean {
  return script in ALLOWED_SCRIPTS;
}

export function isNexusCommandAllowed(command: string): boolean {
  return command in ALLOWED_NEXUS_COMMANDS;
}

export function getAllowedScriptCommand(script: string): string | undefined {
  return ALLOWED_SCRIPTS[script];
}

export function getAllowedNexusCommand(command: string): string | undefined {
  return ALLOWED_NEXUS_COMMANDS[command];
}

// ── Rule ID Validation ───────────────────────────────────────────────────────

export function isValidRuleId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

// ── Prototype Pollution Protection ───────────────────────────────────────────

export const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf"]);
