/**
 * errors.ts — Typed Errors for Nexus
 *
 * Replaces process.exit(1) with errors that Commander catches.
 */

export class NexusError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = "NexusError";
  }
}

export class NotInitializedError extends NexusError {
  constructor() {
    super("Project not initialized. Run `nexus init` first.", "NOT_INITIALIZED");
  }
}

export class InvalidRuleError extends NexusError {
  constructor(detail: string) {
    super(`Invalid rule: ${detail}`, "INVALID_RULE");
  }
}

export class ScriptNotAllowedError extends NexusError {
  constructor(script: string) {
    super(`Script "${script}" is not in the allowlist.`, "SCRIPT_NOT_ALLOWED");
  }
}
