/**
 * performance-reporter.ts — User Performance Reporting
 *
 * Generates rich performance reports for the user, inspired by the
 * manual feedback templates in feedback/. Captures 7 dimensions,
 * growth trajectory, session metrics, and personal insights.
 *
 * PRINCIPLE: To improve, one must first see oneself clearly.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  getAllDimensionSummaries,
  getFeedbackRecords,
  detectFeedbackPatterns,
  type PerformanceDimension,
  type DimensionSummary,
  DIMENSION_LABELS,
} from "./feedback-loops.js";
import {
  getSessionMetrics,
  type SessionMetrics,
} from "./session-tracker.js";
import {
  loadGrowthProfile,
  type GrowthProfile,
} from "./growth-profile.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DimensionReport {
  score: number;
  trend: "improving" | "stable" | "declining";
  acceptRate: number;
  evidence: string[];
}

export interface Insight {
  type: "strength" | "improvement" | "pattern" | "suggestion";
  dimension: PerformanceDimension;
  text: string;
  evidence?: string;
}

export interface PerformanceReport {
  period: { from: string; to: string; days: number };
  profile: {
    dominantDimension: PerformanceDimension;
    weakestDimension: PerformanceDimension;
    growthPattern: string;
    growthCapacity: number;
    challengeLevel: number;
  };
  dimensions: Record<PerformanceDimension, DimensionReport>;
  sessions: {
    total: number;
    avgDuration: number;
    mostActiveDay: string;
    commandFrequency: Record<string, number>;
  };
  feedback: {
    totalInteractions: number;
    acceptanceRate: number;
    challengingRatio: number;
    patterns: string[];
    suppressedCount: number;
  };
  debtTrend: { current: number; previous: number; delta: number };
  maturityTrend: { current: number; previous: number; delta: number };
  insights: Insight[];
  nextSteps: string[];
  summary: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTelemetryPath(nexusDir: string, filename: string): string {
  return join(nexusDir, "telemetry", filename);
}

function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function calculateDimensionScore(summary: DimensionSummary): number {
  const total = summary.acceptCount + summary.rejectCount + summary.deferCount;
  if (total === 0) return 50; // neutral default
  // Score: based on acceptance rate, with penalty for high rejection
  const base = (summary.acceptCount / total) * 100;
  const penalty = (summary.rejectCount / total) * 30;
  return Math.max(0, Math.min(100, Math.round(base - penalty + 20)));
}

function detectTrend(current: number, previous: number): "improving" | "stable" | "declining" {
  const delta = current - previous;
  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "stable";
}

// ── Main Function ────────────────────────────────────────────────────────────

/** Generate a full performance report for the user. */
export function generatePerformanceReport(
  projectRoot: string,
  nexusDir: string,
  options?: { days?: number }
): PerformanceReport {
  const days = options?.days || 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Gather data from all sources
  const dimensionSummaries = getAllDimensionSummaries(nexusDir);
  const sessionMetrics = getSessionMetrics(nexusDir, days);
  const growthProfile = loadGrowthProfile(nexusDir);
  const feedbackRecords = getFeedbackRecords(nexusDir);
  const patterns = detectFeedbackPatterns(nexusDir);

  // Filter records to period
  const periodRecords = feedbackRecords.filter(
    (r) => new Date(r.timestamp) >= periodStart
  );

  // Calculate dimension scores
  const dimensions = {} as Record<PerformanceDimension, DimensionReport>;
  let maxScore = -1;
  let minScore = 101;
  let dominantDim: PerformanceDimension = "decision_making";
  let weakestDim: PerformanceDimension = "decision_making";

  for (const [dim, summary] of Object.entries(dimensionSummaries)) {
    const d = dim as PerformanceDimension;
    const score = calculateDimensionScore(summary);
    const periodRecordsForDim = periodRecords.filter((r) => r.dimension === d);
    const previousScore = score; // Simplified: use same score for trend (historical comparison TODO)

    dimensions[d] = {
      score,
      trend: detectTrend(score, previousScore),
      acceptRate: summary.acceptCount + summary.rejectCount > 0
        ? Math.round((summary.acceptCount / (summary.acceptCount + summary.rejectCount)) * 100)
        : 50,
      evidence: summary.evidence,
    };

    if (score > maxScore) { maxScore = score; dominantDim = d; }
    if (score < minScore) { minScore = score; weakestDim = d; }
  }

  // Calculate aggregate feedback metrics
  const totalInteractions = periodRecords.length;
  const accepted = periodRecords.filter((r) => r.action === "accepted").length;
  const rejected = periodRecords.filter((r) => r.action === "rejected").length;
  const challenging = periodRecords.filter((r) => r.pathChoice === "challenging").length;
  const totalPathChoices = periodRecords.filter((r) => r.pathChoice).length;

  // Determine most active day
  const dayFrequency: Record<string, number> = {};
  for (const session of [] as unknown[]) {
    // Placeholder — session data would come from session tracker
  }

  // Debt and maturity trends (from telemetry snapshots)
  const currentMaturity = readJsonFile<number>(
    getTelemetryPath(nexusDir, "maturity-current.json"), 0
  );
  const previousMaturity = readJsonFile<number>(
    getTelemetryPath(nexusDir, "maturity-previous.json"), currentMaturity
  );
  const currentDebt = readJsonFile<number>(
    getTelemetryPath(nexusDir, "debt-current.json"), 100
  );
  const previousDebt = readJsonFile<number>(
    getTelemetryPath(nexusDir, "debt-previous.json"), currentDebt
  );

  // Generate insights
  const insights = generateInsights(
    dimensions,
    sessionMetrics,
    growthProfile,
    { current: currentDebt, previous: previousDebt, delta: currentDebt - previousDebt },
    { current: currentMaturity, previous: previousMaturity, delta: currentMaturity - previousMaturity }
  );

  // Generate next steps
  const nextSteps = generateNextSteps(insights, dimensions, growthProfile);

  // Generate summary
  const summary = generateSummary(
    dimensions,
    sessionMetrics,
    totalInteractions,
    accepted,
    rejected,
    growthProfile
  );

  return {
    period: {
      from: periodStart.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      days,
    },
    profile: {
      dominantDimension: dominantDim,
      weakestDimension: weakestDim,
      growthPattern: growthProfile.patterns[0]?.type || "balanced",
      growthCapacity: growthProfile.growthCapacity,
      challengeLevel: growthProfile.challengeLevel,
    },
    dimensions,
    sessions: {
      total: sessionMetrics.totalSessions,
      avgDuration: sessionMetrics.avgDuration,
      mostActiveDay: Object.entries(dayFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A",
      commandFrequency: sessionMetrics.commandFrequency,
    },
    feedback: {
      totalInteractions,
      acceptanceRate: totalInteractions > 0 ? Math.round((accepted / totalInteractions) * 100) : 0,
      challengingRatio: totalPathChoices > 0 ? Math.round((challenging / totalPathChoices) * 100) : 50,
      patterns: patterns.map((p) => p.description),
      suppressedCount: patterns.filter((p) => p.type === "always_rejects").length,
    },
    debtTrend: {
      current: currentDebt,
      previous: previousDebt,
      delta: currentDebt - previousDebt,
    },
    maturityTrend: {
      current: currentMaturity,
      previous: previousMaturity,
      delta: currentMaturity - previousMaturity,
    },
    insights,
    nextSteps,
    summary,
  };
}

// ── Insight Generation ───────────────────────────────────────────────────────

function generateInsights(
  dimensions: Record<PerformanceDimension, DimensionReport>,
  sessionMetrics: SessionMetrics,
  growthProfile: GrowthProfile,
  debtTrend: { current: number; previous: number; delta: number },
  maturityTrend: { current: number; previous: number; delta: number }
): Insight[] {
  const insights: Insight[] = [];

  // Find strongest and weakest dimensions
  let maxScore = -1;
  let minScore = 101;
  let strongest: PerformanceDimension = "decision_making";
  let weakest: PerformanceDimension = "decision_making";

  for (const [dim, report] of Object.entries(dimensions)) {
    const d = dim as PerformanceDimension;
    if (report.score > maxScore) { maxScore = report.score; strongest = d; }
    if (report.score < minScore) { minScore = report.score; weakest = d; }
  }

  // Strength
  insights.push({
    type: "strength",
    dimension: strongest,
    text: `Sua força está em ${DIMENSION_LABELS[strongest]}. Score: ${maxScore}/100.`,
    evidence: dimensions[strongest].evidence[0],
  });

  // Improvement area
  insights.push({
    type: "improvement",
    dimension: weakest,
    text: `Área com mais potencial de melhoria: ${DIMENSION_LABELS[weakest]}. Score: ${minScore}/100.`,
  });

  // Growth pattern insight
  const pattern = growthProfile.patterns[0];
  if (pattern?.type === "prefers_comfort") {
    insights.push({
      type: "pattern",
      dimension: "decision_making",
      text: "Você tende a escolher o caminho confortável. Tente aceitar 1 recomendação desafiadora por sessão para acelerar crescimento.",
    });
  } else if (pattern?.type === "prefers_growth") {
    insights.push({
      type: "strength",
      dimension: "decision_making",
      text: "Excelente — você busca desafio. Isso acelera aprendizado, mas garanta que não está se sobrecarregando.",
    });
  }

  // Debt trend
  if (debtTrend.delta > 10) {
    insights.push({
      type: "improvement",
      dimension: "architectural_vision",
      text: `Knowledge Debt subiu ${debtTrend.delta} pontos. Considere criar ADRs ou extrair skills dos padrões emergentes.`,
    });
  } else if (debtTrend.delta < -10) {
    insights.push({
      type: "strength",
      dimension: "scope_management",
      text: `Knowledge Debt reduziu ${Math.abs(debtTrend.delta)} pontos. Seu trabalho de governança está surtindo efeito.`,
    });
  }

  // Maturity trend
  if (maturityTrend.delta > 5) {
    insights.push({
      type: "strength",
      dimension: "scope_management",
      text: `Maturidade subiu ${maturityTrend.delta} pontos. Seu projeto está evoluindo bem.`,
    });
  }

  // Session duration
  if (sessionMetrics.avgDuration > 180) {
    insights.push({
      type: "suggestion",
      dimension: "sustainable_velocity",
      text: `Sessões médias de ${Math.round(sessionMetrics.avgDuration / 60)}h. Considere sessões mais curtas (45-90min) para manter foco.`,
    });
  }

  // Low prompt quality
  const promptScore = dimensions.prompt_quality?.score || 50;
  if (promptScore < 40) {
    insights.push({
      type: "improvement",
      dimension: "prompt_quality",
      text: "Suas descrições de tarefa podem ser mais claras. Tente: contexto + o que quer + restrições.",
    });
  }

  return insights;
}

function generateNextSteps(
  insights: Insight[],
  dimensions: Record<PerformanceDimension, DimensionReport>,
  growthProfile: GrowthProfile
): string[] {
  const steps: string[] = [];

  // Based on weakest dimension
  const weakest = insights.find((i) => i.type === "improvement");
  if (weakest) {
    steps.push(`Focar em ${DIMENSION_LABELS[weakest.dimension]} na próxima sessão`);
  }

  // Based on growth pattern
  const pattern = growthProfile.patterns[0];
  if (pattern?.type === "prefers_comfort") {
    steps.push("Aceitar pelo menos 1 recomendação desafiadora");
  }

  // Based on debt
  const debtInsight = insights.find((i) => i.dimension === "architectural_vision" && i.type === "improvement");
  if (debtInsight) {
    steps.push("Criar 1 ADR para decisão recente não documentada");
  }

  if (steps.length === 0) {
    steps.push("Manter o ritmo atual — está funcionando");
  }

  return steps.slice(0, 5);
}

function generateSummary(
  dimensions: Record<PerformanceDimension, DimensionReport>,
  sessionMetrics: SessionMetrics,
  totalInteractions: number,
  accepted: number,
  rejected: number,
  growthProfile: GrowthProfile
): string {
  const parts: string[] = [];

  const dimScores = Object.values(dimensions).map((d) => d.score);
  const avgScore = dimScores.length > 0
    ? Math.round(dimScores.reduce((a, b) => a + b, 0) / dimScores.length)
    : 0;

  parts.push(`Score médio: ${avgScore}/100.`);
  parts.push(`${sessionMetrics.totalSessions} sessões.`);
  parts.push(`${totalInteractions} interações (${accepted} aceites, ${rejected} rejeitadas).`);
  parts.push(`Capacidade de crescimento: ${Math.round(growthProfile.growthCapacity * 100)}%.`);

  return parts.join(" ");
}

// ── Report Writer ────────────────────────────────────────────────────────────

/** Write performance report to disk. */
export function writePerformanceReport(
  nexusDir: string,
  report: PerformanceReport
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `performance-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
