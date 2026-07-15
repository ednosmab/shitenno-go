import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Capability } from "../domain/entities/engineering-state.js";

export function detectCapabilitySignalsFromFilesystem(nexusDir: string): Capability[] {
  const installed: Capability[] = ["core"];
  if (!existsSync(nexusDir)) return installed;

  if (
    existsSync(join(nexusDir, "docs", "skills")) ||
    existsSync(join(nexusDir, "docs", "AGENTS.md"))
  ) {
    installed.push("knowledge");
  }

  if (
    existsSync(join(nexusDir, "docs", "adrs")) ||
    existsSync(join(nexusDir, "docs", "sdr")) ||
    existsSync(join(nexusDir, "docs", "plans"))
  ) {
    installed.push("architecture");
  }

  if (
    existsSync(join(nexusDir, "governance", "WORKFLOW.md")) ||
    existsSync(join(nexusDir, "governance", "context"))
  ) {
    installed.push("governance");
  }

  if (
    existsSync(join(nexusDir, "governance", "agents")) ||
    existsSync(join(nexusDir, "cognition"))
  ) {
    installed.push("ai");
  }

  if (existsSync(join(nexusDir, "scripts", "validate-session.ts"))) {
    installed.push("quality");
  }

  if (existsSync(join(nexusDir, "reports"))) {
    installed.push("metrics");
  }

  if (
    existsSync(join(nexusDir, "scripts", "close-session.ts")) ||
    existsSync(join(nexusDir, "docs", "runbooks"))
  ) {
    installed.push("operations");
  }

  if (
    existsSync(join(nexusDir, "docs", "FORBIDDEN_OPERATIONS.md")) ||
    existsSync(join(nexusDir, "docs", "DESDO.md")) ||
    existsSync(join(nexusDir, "governance", "premortem"))
  ) {
    installed.push("compliance");
  }

  return installed;
}
