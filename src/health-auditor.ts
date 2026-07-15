/**
 * health-auditor.ts — Thin orchestrator for health audit
 *
 * Detector registry split into audit/detector-map.ts.
 * All types, constants, shared utilities, detectors in audit/*.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type { AuditLevel, HealthIssue, GovernanceOptimization, HealthAuditReport, SourceFileInfo } from "./audit/types.js";
export { collectSourceFiles } from "./audit/shared.js";

export {
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
  detectCircularDeps,
} from "./audit/engineering-detectors.js";

import type { AuditLevel, HealthIssue, HealthAuditReport } from "./audit/types.js";
import { DETECTORS_BY_LEVEL } from "./audit/constants.js";
import { collectSourceFiles, readHistory, readRules, deduplicateIssues } from "./audit/shared.js";
import { calculateHealthScore } from "./audit/health-score.js";
import { proposeOptimizations } from "./audit/optimization-proposer.js";
import { buildDetectorMap } from "./audit/detector-map.js";

export function auditHealth(
  projectRoot: string,
  nexusDir: string,
  level: AuditLevel = "standard"
): HealthAuditReport {
  const startTime = Date.now();
  const history = readHistory(nexusDir);
  const rules = readRules(nexusDir);
  const activeDetectors = new Set(DETECTORS_BY_LEVEL[level]);
  const sourceFiles = collectSourceFiles(projectRoot);

  const detectorMap = buildDetectorMap(projectRoot, nexusDir, sourceFiles, rules, history);

  const issues: HealthIssue[] = [];
  for (const [name, fn] of Object.entries(detectorMap)) {
    if (activeDetectors.has(name)) {
      issues.push(...fn());
    }
  }

  const deduped = deduplicateIssues(issues);
  const healthScore = calculateHealthScore(deduped, sourceFiles.length);
  const optimizations = proposeOptimizations(deduped);

  const critical = deduped.filter((i) => i.severity === 3).length;
  const warnings = deduped.filter((i) => i.severity === 2).length;
  const info = deduped.filter((i) => i.severity === 1).length;

  const parts: string[] = [];
  parts.push(`Score de saúde: ${healthScore}/100`);
  parts.push(`Nível: ${level} (${activeDetectors.size} detectors).`);
  parts.push(`${rules.length} regras, ${history.length} sessões analisadas.`);
  if (critical > 0) parts.push(`${critical} crítico(s).`);
  if (warnings > 0) parts.push(`${warnings} aviso(s).`);
  if (info > 0) parts.push(`${info} info.`);
  if (optimizations.length > 0) parts.push(`${optimizations.length} optimização(ões) proposta(s).`);

  const durationMs = Date.now() - startTime;

  return {
    auditedAt: new Date().toISOString(),
    totalRules: rules.length,
    historyEntries: history.length,
    sessionsAnalyzed: history.length,
    issues: deduped,
    optimizations,
    healthScore,
    summary: parts.join(" "),
    level,
    durationMs,
    filesScanned: sourceFiles.length,
    detectorsRun: Array.from(activeDetectors),
  };
}

export function writeHealthReport(nexusDir: string, report: HealthAuditReport): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `health-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
