import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MaturityDimensions, Capability, MaturityProfile } from "../domain/entities/engineering-state.js";

export interface MaturitySnapshot {
  timestamp: string;
  dimensions: MaturityDimensions;
  overallScore: number;
  installedCapabilities: Capability[];
}

export function recordMaturitySnapshot(
  nexusDir: string,
  profile: MaturityProfile
): void {
  const telemetryDir = join(nexusDir, "telemetry");
  if (!existsSync(telemetryDir)) {
    mkdirSync(telemetryDir, { recursive: true });
  }

  const snapshot: MaturitySnapshot = {
    timestamp: profile.computedAt,
    dimensions: { ...profile.dimensions },
    overallScore: profile.overallScore,
    installedCapabilities: [...profile.installedCapabilities],
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `maturity-${date}.json`;
  const filePath = join(telemetryDir, filename);

  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
}

export function readMaturityHistory(nexusDir: string): MaturitySnapshot[] {
  const telemetryDir = join(nexusDir, "telemetry");
  if (!existsSync(telemetryDir)) return [];

  const files = readdirSync(telemetryDir)
    .filter((f) => f.startsWith("maturity-") && f.endsWith(".json"))
    .sort();

  return files.map((file) => {
    try {
      const content = readFileSync(join(telemetryDir, file), "utf-8");
      return JSON.parse(content) as MaturitySnapshot;
    } catch {
      return null;
    }
  }).filter((s): s is MaturitySnapshot => s !== null);
}
