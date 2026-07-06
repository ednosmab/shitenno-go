/**
 * Audit module — Health score calculation
 */

import type { HealthIssue } from "./types.js";

/**
 * Calculate health score from issues and total files.
 * Score ranges from 0 (worst) to 100 (best).
 */
export function calculateHealthScore(issues: HealthIssue[], totalFiles: number): number {
  const weights: Record<number, number> = { 3: 5, 2: 2, 1: 0.5 };
  const bySeverity = { 3: 0, 2: 0, 1: 0 };
  for (const issue of issues) bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
  const rawPenalty = Object.entries(bySeverity).reduce(
    (sum, [sev, count]) => sum + (weights[Number(sev)] ?? 0) * Math.sqrt(count), 0
  );
  const normalizer = Math.max(totalFiles, 10);
  const density = rawPenalty / normalizer;
  const score = 100 * Math.exp(-density * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}
