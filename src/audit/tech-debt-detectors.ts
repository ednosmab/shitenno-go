/**
 * Audit module — Technical Debt Quantification detectors
 *
 * Detectors that calculate tech debt cost, TDR, remediation effort,
 * debt trends, hotspots, domain balance, ROI, and accumulation rate.
 * All analysis is deterministic — no LLM calls, no external APIs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── Constants for calculation ────────────────────────────────────────────────

const HOURS_PER_SEVERITY: Record<number, number> = {
  1: 1,   // Low: ~1 hour
  2: 4,   // Medium: ~4 hours
  3: 8,   // High: ~8 hours
};

const DEFAULT_DEVELOPER_COST_PER_HOUR = 50; // USD

// ── 31.1 Tech Debt Cost ─────────────────────────────────────────────────────

export function detectTechDebtCost(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const totalHours = existingIssues.reduce(
    (sum, issue) => sum + (HOURS_PER_SEVERITY[issue.severity] || 1),
    0,
  );

  const totalCost = totalHours * DEFAULT_DEVELOPER_COST_PER_HOUR;

  if (totalCost > 1000) {
    issues.push({
      type: "tech_debt_cost",
      severity: totalCost > 10000 ? 3 : 2,
      description: `Custo estimado de dívida técnica: $${totalCost.toLocaleString()} (${totalHours}h × $${DEFAULT_DEVELOPER_COST_PER_HOUR}/h)`,
      location: "project-wide",
      recommendation: "Priorizar correção dos issues de maior severidade para reduzir custo.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.2 Technical Debt Ratio ───────────────────────────────────────────────

export function detectTDR(
  projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) return issues;

  const projectValue = 50000; // Estimate: $50k project value

  const totalHours = existingIssues.reduce(
    (sum, issue) => sum + (HOURS_PER_SEVERITY[issue.severity] || 1),
    0,
  );

  const fixCost = totalHours * DEFAULT_DEVELOPER_COST_PER_HOUR;
  const tdr = (fixCost / projectValue) * 100;

  if (tdr > 10) {
    issues.push({
      type: "high_tdr",
      severity: tdr > 30 ? 3 : 2,
      description: `Technical Debt Ratio elevado: ${tdr.toFixed(1)}% (custo correção / valor projeto)`,
      location: "project-wide",
      recommendation: "TDR > 10% indica dívida técnica significativa. Priorizar redução.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.3 Remediation Effort ─────────────────────────────────────────────────

export function detectRemediationEffort(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const effortBySeverity = {
    low: existingIssues.filter((i) => i.severity === 1).length * (HOURS_PER_SEVERITY[1] || 1),
    medium: existingIssues.filter((i) => i.severity === 2).length * (HOURS_PER_SEVERITY[2] || 4),
    high: existingIssues.filter((i) => i.severity === 3).length * (HOURS_PER_SEVERITY[3] || 8),
  };

  const totalHours = effortBySeverity.low + effortBySeverity.medium + effortBySeverity.high;

  if (totalHours > 40) {
    issues.push({
      type: "high_remediation_effort",
      severity: totalHours > 100 ? 3 : 2,
      description: `Esforço de remediação estimado: ${totalHours}h (low: ${effortBySeverity.low}h, med: ${effortBySeverity.medium}h, high: ${effortBySeverity.high}h)`,
      location: "project-wide",
      recommendation: "Considerar sprint dedicado para redução de dívida técnica.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.4 Debt Trend ─────────────────────────────────────────────────────────

export function detectDebtTrend(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditDir = join(projectRoot, "audit-history");

  if (!existsSync(auditDir)) return issues;

  const historyFiles = readdirSync(auditDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(-2); // Last 2 snapshots

  if (historyFiles.length < 2) return issues;

  const prevFile = historyFiles[0];
  const currFile = historyFiles[1];
  if (!prevFile || !currFile) return issues;

  const prev = JSON.parse(readFileSync(join(auditDir, prevFile), "utf-8"));
  const curr = JSON.parse(readFileSync(join(auditDir, currFile), "utf-8"));

  const prevCount = prev.issues?.length || 0;
  const currCount = curr.issues?.length || 0;

  if (currCount > prevCount * 1.2) {
    issues.push({
      type: "debt_increasing",
      severity: 2,
      description: `Dívida técnica crescendo: ${prevCount} → ${currCount} issues (+${Math.round(((currCount - prevCount) / prevCount) * 100)}%)`,
      location: "audit-history",
      recommendation: "Investigar causas raiz do crescimento da dívida técnica.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 31.5 Hotspot Files ──────────────────────────────────────────────────────

export function detectHotspotFiles(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const issuesByFile = new Map<string, number>();
  for (const issue of existingIssues) {
    const file = issue.location.split(":")[0] || "unknown";
    issuesByFile.set(file, (issuesByFile.get(file) || 0) + 1);
  }

  const hotspots = Array.from(issuesByFile.entries())
    .filter(([, count]) => count > 5)
    .sort((a, b) => b[1] - a[1]);

  for (const [file, count] of hotspots.slice(0, 3)) {
    if (file && count) {
      issues.push({
        type: "debt_hotspot",
        severity: count > 10 ? 3 : 2,
        description: `Hotspot de dívida técnica: ${file} com ${count} issues`,
        location: file,
        recommendation: `Priorizar refatoração de ${file} — alto acumulo de issues.`,
        confidence: 0.85,
      });
    }
  }

  return issues;
}

// ── 31.6 Debt by Domain ─────────────────────────────────────────────────────

export function detectDebtByDomain(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const domainCount = new Map<string, number>();
  for (const issue of existingIssues) {
    const domain = issue.location.split("/")[0] || "root";
    domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
  }

  const total = existingIssues.length;
  const maxDomainCount = Math.max(...domainCount.values());
  const maxPercentage = (maxDomainCount / total) * 100;

  if (maxPercentage > 50) {
    const dominantDomain = Array.from(domainCount.entries())
      .find(([, count]) => count === maxDomainCount)?.[0] || "unknown";

    issues.push({
      type: "debt_domain_imbalance",
      severity: 2,
      description: `Dívida técnica concentrada em "${dominantDomain}" (${maxPercentage.toFixed(0)}% do total)`,
      location: "project-wide",
      recommendation: `Balancear esforço de correção — "${dominantDomain}" concentra maioria dos issues.`,
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.7 ROI Refactoring ────────────────────────────────────────────────────

export function detectROIRefactoring(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const highSeverityIssues = existingIssues.filter((i) => i.severity === 3);
  const refactoringCost = highSeverityIssues.length * 8 * DEFAULT_DEVELOPER_COST_PER_HOUR;
  const maintenanceReduction = existingIssues.length * 2 * DEFAULT_DEVELOPER_COST_PER_HOUR;

  const roi = refactoringCost > 0 ? ((maintenanceReduction - refactoringCost) / refactoringCost) * 100 : 0;

  if (roi < 50 && highSeverityIssues.length > 3) {
    issues.push({
      type: "low_roi_refactoring",
      severity: 1,
      description: `ROI de refatoração baixo: ${roi.toFixed(0)}% (custo: $${refactoringCost}, economia: $${maintenanceReduction})`,
      location: "project-wide",
      recommendation: "Considerar refatoração incremental em vez de grande refactor.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.8 Debt Accumulation Rate ─────────────────────────────────────────────

export function detectDebtAccumulationRate(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditDir = join(projectRoot, "audit-history");

  if (!existsSync(auditDir)) return issues;

  const historyFiles = readdirSync(auditDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(-2);

  if (historyFiles.length < 2) return issues;

  const prevFile = historyFiles[0];
  const currFile = historyFiles[1];
  if (!prevFile || !currFile) return issues;

  const prev = JSON.parse(readFileSync(join(auditDir, prevFile), "utf-8"));
  const curr = JSON.parse(readFileSync(join(auditDir, currFile), "utf-8"));

  const prevCount = prev.issues?.length || 0;
  const currCount = curr.issues?.length || 0;

  if (prevCount > 0) {
    const growthRate = ((currCount - prevCount) / prevCount) * 100;

    if (growthRate > 20) {
      issues.push({
        type: "debt_accelerating",
        severity: growthRate > 50 ? 3 : 2,
        description: `Taxa de acumulação de dívida acelerando: +${growthRate.toFixed(0)}% entre auditorias`,
        location: "audit-history",
        recommendation: "Implementar gates de qualidade no CI/CD para frear acumulação.",
        confidence: 0.9,
      });
    }
  }

  return issues;
}
