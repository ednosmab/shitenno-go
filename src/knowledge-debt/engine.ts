import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "../event-bus.js";
import type { KnowledgeGap, DebtType, DebtSeverity, KnowledgeDebtReport } from "./types.js";
import {
  detectMissingAdrs,
  detectMissingRunbooks,
  detectMissingSkills,
  detectMissingDocs,
  detectMissingAutomation,
  detectMissingContracts,
  detectMissingWorkflows,
  detectStaleAdrs,
} from "./detection.js";
import { calculateDebtHealth, generateRecommendations } from "./scoring.js";

export function detectKnowledgeDebt(
  _projectRoot: string,
  nexusDir: string
): KnowledgeDebtReport {
  const gaps: KnowledgeGap[] = [];
  const now = new Date().toISOString();

  gaps.push(...detectMissingAdrs(nexusDir, now));
  gaps.push(...detectMissingRunbooks(nexusDir, now));
  gaps.push(...detectMissingSkills(nexusDir, now));
  gaps.push(...detectMissingDocs(nexusDir, now));
  gaps.push(...detectMissingAutomation(nexusDir, now));
  gaps.push(...detectMissingContracts(nexusDir, now));
  gaps.push(...detectMissingWorkflows(nexusDir, now));
  gaps.push(...detectStaleAdrs(nexusDir, now));

  const gapsBySeverity: Record<DebtSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const gapsByType: Record<DebtType, number> = {} as Record<DebtType, number>;

  for (const gap of gaps) {
    gapsBySeverity[gap.severity]++;
    gapsByType[gap.type] = (gapsByType[gap.type] || 0) + 1;
  }

  const healthScore = calculateDebtHealth(gaps);
  const recommendations = generateRecommendations(gaps);

  const critical = gapsBySeverity.critical;
  const high = gapsBySeverity.high;
  const parts: string[] = [];
  parts.push(`${gaps.length} knowledge gap(s) detected.`);
  if (critical > 0) parts.push(`${critical} critical.`);
  if (high > 0) parts.push(`${high} high.`);
  parts.push(`Debt Health: ${healthScore}/100.`);

  for (const gap of gaps) {
    getEventBus().publish("debt.detected", {
      debtType: "knowledge",
      severity: gap.severity,
      source: gap.location || "unknown",
      description: gap.description,
      timestamp: new Date().toISOString(),
    });
  }

  getEventBus().publish("knowledge_debt.detected", {
    gapCount: gaps.length,
    gaps: gaps.map((g) => ({ source: g.location || "unknown", gap: g.description, severity: g.severity })),
    timestamp: new Date().toISOString(),
  });

  return {
    generatedAt: now,
    totalGaps: gaps.length,
    gapsBySeverity,
    gapsByType,
    gaps,
    healthScore,
    summary: parts.join(" "),
    recommendations,
  };
}

export function writeDebtReport(
  nexusDir: string,
  report: KnowledgeDebtReport
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `knowledge-debt-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
