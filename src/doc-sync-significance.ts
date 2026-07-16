/**
 * doc-sync-significance.ts — Change Significance Calculator
 *
 * Determines whether a file change in shitenno-go/ is significant enough
 * to trigger documentation sync. Uses 4 weighted criteria:
 * - Artifact type (40%)
 * - Directory affected (30%)
 * - Change frequency (20%)
 * - Change size (10%)
 *
 * PRINCIPLE: Not all changes are equal. A new skill is more significant
 * than a telemetry log update.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ArtifactType =
  | "skill"
  | "adr"
  | "workflow"
  | "rule"
  | "doc"
  | "config"
  | "script"
  | "telemetry"
  | "report"
  | "feedback"
  | "generated"
  | "unknown";

export type SignificanceLevel = "ignore" | "low" | "medium" | "high";

export interface SignificanceResult {
  score: number;
  level: SignificanceLevel;
  reasons: string[];
  shouldSync: boolean;
  outputLevel: "silent" | "minimal" | "verbose";
}

export interface ChangeFrequency {
  count: number;
  windowStart: number;
  lastChange: number;
}

// ── Weights ──────────────────────────────────────────────────────────────────

const ARTIFACT_WEIGHT = 0.4;
const DIRECTORY_WEIGHT = 0.3;
const FREQUENCY_WEIGHT = 0.2;
const SIZE_WEIGHT = 0.1;

// ── Artifact Scores ──────────────────────────────────────────────────────────

const ARTIFACT_SCORES: Record<ArtifactType, number> = {
  skill: 1.0,
  adr: 1.0,
  workflow: 0.9,
  rule: 0.7,
  doc: 0.6,
  config: 0.3,
  script: 0.3,
  telemetry: 0.0,
  report: 0.0,
  feedback: 0.0,
  generated: 0.0,
  unknown: 0.1,
};

// ── Directory Scores ─────────────────────────────────────────────────────────

const DIRECTORY_SCORES: Record<string, number> = {
  "docs/skills/": 1.0,
  "docs/adrs/": 0.9,
  "docs/generated/": 0.0,
  "governance/agents/": 0.9,
  "governance/WORKFLOW": 1.0,
  "governance/context/": 0.6,
  "governance/rules/": 0.7,
  "governance/contracts/": 0.8,
  "governance/handoffs/": 0.6,
  "governance/policies/": 0.7,
  "governance/premortem/": 0.6,
  "governance/reviews/": 0.6,
  "docs/": 0.7,
  "core/": 0.4,
  "scripts/": 0.3,
  "cognition/": 0.5,
  "telemetry/": 0.0,
  "reports/": 0.0,
  "feedback/": 0.0,
  "session-feedback/": 0.0,
};

// ── Detect Artifact Type ─────────────────────────────────────────────────────

export function detectArtifactType(filePath: string, shitenDir: string): ArtifactType {
  const relative = filePath.slice(shitenDir.length + 1);

  if (relative.startsWith("docs/generated/")) return "generated";
  if (relative.startsWith("docs/skills/")) return "skill";
  if (relative.startsWith("docs/adrs/")) return "adr";
  if (relative.startsWith("governance/WORKFLOW")) return "workflow";
  if (relative.startsWith("governance/rules/")) return "rule";
  if (relative.startsWith("governance/agents/")) return "config";
  if (relative.startsWith("governance/")) return "doc";
  if (relative.startsWith("docs/")) return "doc";
  if (relative.startsWith("scripts/")) return "script";
  if (relative.startsWith("telemetry/")) return "telemetry";
  if (relative.startsWith("reports/")) return "report";
  if (relative.startsWith("feedback/")) return "feedback";
  if (relative.startsWith("session-feedback/")) return "feedback";
  if (relative.startsWith("core/")) return "config";
  if (relative.startsWith("cognition/")) return "doc";

  if (relative.endsWith(".json") || relative.endsWith(".yaml")) return "config";
  if (relative.endsWith(".md")) return "doc";
  if (/\.(ts|tsx|js|jsx|vue|svelte)$/.test(relative)) return "script";

  return "unknown";
}

// ── Detect Directory Score ───────────────────────────────────────────────────

export function detectDirectoryScore(filePath: string, shitenDir: string): number {
  const relative = filePath.slice(shitenDir.length + 1);

  // Check longest prefix first (most specific match)
  const sortedPrefixes = Object.keys(DIRECTORY_SCORES).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (relative.startsWith(prefix)) {
      return DIRECTORY_SCORES[prefix] ?? 0.1;
    }
  }

  return 0.1; // default low score
}

// ── Calculate Frequency Score ────────────────────────────────────────────────

export function calculateFrequencyScore(history: ChangeFrequency): number {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window

  // Reset if window expired
  if (now - history.windowStart > windowMs) {
    return 0.2; // first change in new window
  }

  const recentChanges = history.count;
  if (recentChanges <= 1) return 0.2;
  if (recentChanges <= 5) return 0.5;
  if (recentChanges <= 10) return 0.8;
  return 1.0;
}

// ── Calculate Size Score ─────────────────────────────────────────────────────

export function calculateSizeScore(
  oldContent: string | null,
  newContent: string
): number {
  if (oldContent === null) {
    // New file — count lines
    const lines = newContent.split("\n").length;
    if (lines < 20) return 0.5;
    if (lines < 100) return 0.8;
    return 1.0;
  }

  const oldLines = oldContent.split("\n").length;
  const newLines = newContent.split("\n").length;
  const linesChanged = Math.abs(newLines - oldLines);

  if (linesChanged < 5) return 0.2;
  if (linesChanged < 20) return 0.5;
  if (linesChanged < 100) return 0.8;
  return 1.0;
}

// ── Calculate Significance ───────────────────────────────────────────────────

export function calculateSignificance(
  filePath: string,
  shitenDir: string,
  oldContent: string | null,
  newContent: string,
  frequency: ChangeFrequency
): SignificanceResult {
  const reasons: string[] = [];

  // 1. Artifact type score
  const artifactType = detectArtifactType(filePath, shitenDir);
  const artifactScore = ARTIFACT_SCORES[artifactType];
  if (artifactScore >= 0.7) {
    reasons.push(`artifact:${artifactType}(${artifactScore})`);
  }

  // 2. Directory score
  const directoryScore = detectDirectoryScore(filePath, shitenDir);
  if (directoryScore >= 0.6) {
    const relative = filePath.slice(shitenDir.length + 1);
    const matchedDir = Object.keys(DIRECTORY_SCORES).find((d) =>
      relative.startsWith(d)
    );
    reasons.push(`directory:${matchedDir}(${directoryScore})`);
  }

  // 3. Frequency score
  const frequencyScore = calculateFrequencyScore(frequency);
  if (frequencyScore >= 0.5) {
    reasons.push(`frequency:${frequency.count}changes(${frequencyScore})`);
  }

  // 4. Size score
  const sizeScore = calculateSizeScore(oldContent, newContent);
  if (sizeScore >= 0.5) {
    reasons.push(`size:(${sizeScore})`);
  }

  // Weighted sum
  const score =
    artifactScore * ARTIFACT_WEIGHT +
    directoryScore * DIRECTORY_WEIGHT +
    frequencyScore * FREQUENCY_WEIGHT +
    sizeScore * SIZE_WEIGHT;

  // Determine level and output
  let level: SignificanceLevel;
  let outputLevel: "silent" | "minimal" | "verbose";
  let shouldSync: boolean;

  if (score < 0.3) {
    level = "ignore";
    outputLevel = "silent";
    shouldSync = false;
  } else if (score < 0.6) {
    level = "low";
    outputLevel = "silent";
    shouldSync = true;
  } else if (score < 0.8) {
    level = "medium";
    outputLevel = "minimal";
    shouldSync = true;
  } else {
    level = "high";
    outputLevel = "verbose";
    shouldSync = true;
  }

  return {
    score,
    level,
    reasons,
    shouldSync,
    outputLevel,
  };
}

// ── Change History Tracker ───────────────────────────────────────────────────

export class ChangeHistoryTracker {
  private history: Map<string, ChangeFrequency> = new Map();

  recordChange(filePath: string): ChangeFrequency {
    const now = Date.now();
    const existing = this.history.get(filePath);

    if (!existing || now - existing.windowStart > 60_000) {
      // New window
      const freq: ChangeFrequency = {
        count: 1,
        windowStart: now,
        lastChange: now,
      };
      this.history.set(filePath, freq);
      return freq;
    }

    // Same window — increment
    existing.count++;
    existing.lastChange = now;
    return existing;
  }

  getFrequency(filePath: string): ChangeFrequency {
    return (
      this.history.get(filePath) || {
        count: 0,
        windowStart: Date.now(),
        lastChange: Date.now(),
      }
    );
  }

  clear(): void {
    this.history.clear();
  }
}
