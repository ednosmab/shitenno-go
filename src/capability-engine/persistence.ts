import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CapabilityEngineResult } from "./types.js";

export function saveCapabilityEngineResult(
  nexusDir: string,
  result: CapabilityEngineResult
): void {
  const filePath = join(nexusDir, "capability-engine.json");
  writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
}

export function loadCapabilityEngineResult(
  nexusDir: string
): CapabilityEngineResult | null {
  const filePath = join(nexusDir, "capability-engine.json");
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as CapabilityEngineResult;
  } catch {
    return null;
  }
}
