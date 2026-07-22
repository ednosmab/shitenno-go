/**
 * performance-reporter.ts — User Performance Reporting
 *
 * Generates rich performance reports for the user, inspired by the
 * manual feedback templates in feedback/. Captures 7 dimensions,
 * growth trajectory, session metrics, and personal insights.
 *
 * PRINCIPLE: To improve, one must first see oneself clearly.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  getAllDimensionSummaries,
  getFeedbackRecords,
  detectFeedbackPatterns,
  type PerformanceMetric,
  type DimensionSummary,
  type FeedbackRecord,
  type FeedbackPattern,
  METRIC_LABELS,
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
  dimension: PerformanceMetric | null;
  text: string;
  evidence?: string;
}

export interface PerformanceReport {
  period: { from: string; to: string; days: number };
  profile: {
    dominantDimension: PerformanceMetric | null;
    weakestDimension: PerformanceMetric | null;
    growthPattern: string;
    growthCapacity: number;
    challengeLevel: number;
  };
  dimensions: Record<PerformanceMetric, DimensionReport>;
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

interface TelemetryTrend {
  current: number;
  previous: number;
  delta: number;
}

interface FeedbackMetrics {
  totalInteractions: number;
  accepted: number;
  rejected: number;
  challenging: number;
  totalPathChoices: number;
}

interface DimensionReportResult {
  dimensions: Record<PerformanceMetric, DimensionReport>;
  dominantDim: PerformanceMetric | null;
  weakestDim: PerformanceMetric | null;
}

interface DimensionExtremes {
  strongest: PerformanceMetric | null;
  weakest: PerformanceMetric | null;
  maxScore: number;
  minScore: number;
  allTied: boolean;
}

interface InsightContext {
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessionMetrics: SessionMetrics;
  growthProfile: GrowthProfile;
  debtTrend: TelemetryTrend;
  maturityTrend: TelemetryTrend;
}

interface SummaryContext {
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessionMetrics: SessionMetrics;
  totalInteractions: number;
  accepted: number;
  rejected: number;
  growthProfile: GrowthProfile;
}

interface ReportData {
  periodStart: Date;
  now: Date;
  days: number;
  dominantDim: PerformanceMetric | null;
  weakestDim: PerformanceMetric | null;
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessionMetrics: SessionMetrics;
  dayFrequency: Record<string, number>;
  feedbackMetrics: FeedbackMetrics;
  patterns: FeedbackPattern[];
  debtTrend: TelemetryTrend;
  maturityTrend: TelemetryTrend;
  growthProfile: GrowthProfile;
  insights: Insight[];
  nextSteps: string[];
  summary: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLatestTelemetryFile(shitennoDir: string, prefix: string, rank = 0): string {
  const telemetryDir = join(shitennoDir, "telemetry");
  if (!existsSync(telemetryDir)) return "";
  try {
    const files = readdirSync(telemetryDir)
      .filter((f: string) => f.startsWith(`${prefix}-`) && f.endsWith(".json"))
      .sort()
      .reverse();
    return files[rank] ? join(telemetryDir, files[rank]) : "";
  } catch {
    return "";
  }
}

interface TelemetrySnapshot {
  overallScore?: number;
  healthScore?: number;
  dimensions?: Record<string, number>;
}

function readJsonFile<T>(path: string, fallback: T): T {
  if (!path || !existsSync(path)) return fallback;
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

function readTelemetryValue(
  shitennoDir: string,
  prefix: string,
  extract: (data: TelemetrySnapshot) => number | undefined,
  options?: { rank?: number; fallback?: number }
): number {
  const rank = options?.rank ?? 0;
  const fallback = options?.fallback ?? 0;
  const file = getLatestTelemetryFile(shitennoDir, prefix, rank);
  const data = file ? readJsonFile<TelemetrySnapshot>(file, {}) : {};
  return extract(data) ?? fallback;
}

function buildDimensionReports(
  dimensionSummaries: Record<string, DimensionSummary>,
  feedbackRecords: FeedbackRecord[],
  periodStart: Date,
  days: number
): DimensionReportResult {
  const dimensions = {} as Record<PerformanceMetric, DimensionReport>;
  let maxScore = -1;
  let minScore = 101;
  let dominantDim: PerformanceMetric | null = null;
  let weakestDim: PerformanceMetric | null = null;

  const previousPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
  const previousPeriodRecords = feedbackRecords.filter(
    (r) => new Date(r.timestamp) >= previousPeriodStart && new Date(r.timestamp) < periodStart
  );

  for (const [dim, summary] of Object.entries(dimensionSummaries)) {
    const d = dim as PerformanceMetric;
    const score = calculateDimensionScore(summary);
    const previousDimRecords = previousPeriodRecords.filter((r) => r.dimension === d);
    const previousSummary: DimensionSummary = {
      dimension: d,
      acceptCount: previousDimRecords.filter((r) => r.action === "accepted").length,
      rejectCount: previousDimRecords.filter((r) => r.action === "rejected").length,
      deferCount: previousDimRecords.filter((r) => r.action === "deferred").length,
      evidence: [],
    };
    const previousScore = calculateDimensionScore(previousSummary);

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

  if (maxScore === minScore && maxScore >= 0) {
    dominantDim = null;
    weakestDim = null;
  }

  return { dimensions, dominantDim, weakestDim };
}

function computeFeedbackMetrics(periodRecords: FeedbackRecord[]): FeedbackMetrics {
  return {
    totalInteractions: periodRecords.length,
    accepted: periodRecords.filter((r) => r.action === "accepted").length,
    rejected: periodRecords.filter((r) => r.action === "rejected").length,
    challenging: periodRecords.filter((r) => r.pathChoice === "challenging").length,
    totalPathChoices: periodRecords.filter((r) => r.pathChoice).length,
  };
}

function computeDayFrequency(feedbackRecords: FeedbackRecord[]): Record<string, number> {
  const dayFrequency: Record<string, number> = {};
  for (const record of feedbackRecords) {
    const day = record.timestamp.split("T")[0];
    if (day) {
      dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    }
  }
  return dayFrequency;
}

function assembleReport(data: ReportData): PerformanceReport {
  return {
    period: {
      from: data.periodStart.toISOString().slice(0, 10),
      to: data.now.toISOString().slice(0, 10),
      days: data.days,
    },
    profile: {
      dominantDimension: data.dominantDim,
      weakestDimension: data.weakestDim,
      growthPattern: data.growthProfile.patterns[0]?.type || "balanced",
      growthCapacity: data.growthProfile.growthCapacity,
      challengeLevel: data.growthProfile.challengeLevel,
    },
    dimensions: data.dimensions,
    sessions: {
      total: data.sessionMetrics.totalSessions,
      avgDuration: data.sessionMetrics.avgDuration,
      mostActiveDay: Object.entries(data.dayFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A",
      commandFrequency: data.sessionMetrics.commandFrequency,
    },
    feedback: {
      totalInteractions: data.feedbackMetrics.totalInteractions,
      acceptanceRate: data.feedbackMetrics.totalInteractions > 0
        ? Math.round((data.feedbackMetrics.accepted / data.feedbackMetrics.totalInteractions) * 100)
        : 0,
      challengingRatio: data.feedbackMetrics.totalPathChoices > 0
        ? Math.round((data.feedbackMetrics.challenging / data.feedbackMetrics.totalPathChoices) * 100)
        : 50,
      patterns: data.patterns.map((p) => p.description),
      suppressedCount: data.patterns.filter((p) => p.type === "always_rejects").length,
    },
    debtTrend: data.debtTrend,
    maturityTrend: data.maturityTrend,
    insights: data.insights,
    nextSteps: data.nextSteps,
    summary: data.summary,
  };
}

// ── Main Function ────────────────────────────────────────────────────────────

/** Generate a full performance report for the user. */
export function generatePerformanceReport(
  _projectRoot: string,
  shitennoDir: string,
  options?: { days?: number }
): PerformanceReport {
  const days = options?.days || 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const dimensionSummaries = getAllDimensionSummaries(shitennoDir);
  const sessionMetrics = getSessionMetrics(shitennoDir, days);
  const growthProfile = loadGrowthProfile(shitennoDir);
  const feedbackRecords = getFeedbackRecords(shitennoDir);
  const patterns = detectFeedbackPatterns(shitennoDir);

  const periodRecords = feedbackRecords.filter(
    (r) => new Date(r.timestamp) >= periodStart
  );

  const { dimensions, dominantDim, weakestDim } = buildDimensionReports(
    dimensionSummaries, feedbackRecords, periodStart, days
  );
  const feedbackMetrics = computeFeedbackMetrics(periodRecords);
  const dayFrequency = computeDayFrequency(feedbackRecords);

  const currentMaturity = readTelemetryValue(shitennoDir, "maturity", (d) => d.overallScore, { fallback: 0 });
  const previousMaturity = readTelemetryValue(shitennoDir, "maturity", (d) => d.overallScore, { rank: 1, fallback: currentMaturity });
  const currentDebt = readTelemetryValue(shitennoDir, "knowledge-debt", (d) => d.healthScore != null ? 100 - d.healthScore : undefined, { fallback: 100 });
  const previousDebt = readTelemetryValue(shitennoDir, "knowledge-debt", (d) => d.healthScore != null ? 100 - d.healthScore : undefined, { rank: 1, fallback: currentDebt });

  const debtTrend: TelemetryTrend = { current: currentDebt, previous: previousDebt, delta: currentDebt - previousDebt };
  const maturityTrend: TelemetryTrend = { current: currentMaturity, previous: previousMaturity, delta: currentMaturity - previousMaturity };

  const insights = generateInsights({ dimensions, sessionMetrics, growthProfile, debtTrend, maturityTrend });
  const nextSteps = generateNextSteps(insights, growthProfile);
  const summary = generateSummary({ dimensions, sessionMetrics, totalInteractions: feedbackMetrics.totalInteractions, accepted: feedbackMetrics.accepted, rejected: feedbackMetrics.rejected, growthProfile });

  return assembleReport({
    periodStart, now, days, dominantDim, weakestDim, dimensions,
    sessionMetrics, dayFrequency, feedbackMetrics, patterns,
    debtTrend, maturityTrend, growthProfile, insights, nextSteps, summary,
  });
}

// ── Insight Generation ───────────────────────────────────────────────────────

function findDimensionExtremes(dimensions: Record<PerformanceMetric, DimensionReport>): DimensionExtremes {
  let maxScore = -1;
  let minScore = 101;
  let strongest: PerformanceMetric | null = null;
  let weakest: PerformanceMetric | null = null;

  for (const [dim, report] of Object.entries(dimensions)) {
    const d = dim as PerformanceMetric;
    if (report.score > maxScore) { maxScore = report.score; strongest = d; }
    if (report.score < minScore) { minScore = report.score; weakest = d; }
  }

  const allTied = maxScore === minScore && maxScore >= 0;
  if (allTied) {
    strongest = null;
    weakest = null;
  }

  return { strongest, weakest, maxScore, minScore, allTied };
}

function addDimensionInsights(
  insights: Insight[],
  dimensions: Record<PerformanceMetric, DimensionReport>,
  extremes: DimensionExtremes
): void {
  if (extremes.strongest) {
    insights.push({
      type: "strength",
      dimension: extremes.strongest,
      text: `Sua força está em ${METRIC_LABELS[extremes.strongest]}. Score: ${extremes.maxScore}/100.`,
      evidence: dimensions[extremes.strongest].evidence[0],
    });
  } else {
    insights.push({
      type: "strength",
      dimension: null,
      text: `Todas as dimensões estão equilibradas com score ${extremes.maxScore}/100.`,
    });
  }

  if (extremes.weakest) {
    insights.push({
      type: "improvement",
      dimension: extremes.weakest,
      text: `Área com mais potencial de melhoria: ${METRIC_LABELS[extremes.weakest]}. Score: ${extremes.minScore}/100.`,
    });
  } else {
    insights.push({
      type: "improvement",
      dimension: null,
      text: "Nenhuma dimensão se destaca como área de melhoria — todas equilibradas.",
    });
  }
}

function addGrowthPatternInsight(insights: Insight[], growthProfile: GrowthProfile): void {
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
}

function addTrendInsights(insights: Insight[], debtTrend: TelemetryTrend, maturityTrend: TelemetryTrend): void {
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

  if (maturityTrend.delta > 5) {
    insights.push({
      type: "strength",
      dimension: "scope_management",
      text: `Maturidade subiu ${maturityTrend.delta} pontos. Seu projeto está evoluindo bem.`,
    });
  }
}

function addSessionQualityInsights(
  insights: Insight[],
  sessionMetrics: SessionMetrics,
  dimensions: Record<PerformanceMetric, DimensionReport>
): void {
  if (sessionMetrics.avgDuration > 180) {
    insights.push({
      type: "suggestion",
      dimension: "sustainable_velocity",
      text: `Sessões médias de ${Math.round(sessionMetrics.avgDuration / 60)}h. Considere sessões mais curtas (45-90min) para manter foco.`,
    });
  }

  const promptScore = dimensions.prompt_quality?.score || 50;
  if (promptScore < 40) {
    insights.push({
      type: "improvement",
      dimension: "prompt_quality",
      text: "Suas descrições de tarefa podem ser mais claras. Tente: contexto + o que quer + restrições.",
    });
  }
}

function generateInsights(ctx: InsightContext): Insight[] {
  const insights: Insight[] = [];
  const extremes = findDimensionExtremes(ctx.dimensions);
  addDimensionInsights(insights, ctx.dimensions, extremes);
  addGrowthPatternInsight(insights, ctx.growthProfile);
  addTrendInsights(insights, ctx.debtTrend, ctx.maturityTrend);
  addSessionQualityInsights(insights, ctx.sessionMetrics, ctx.dimensions);
  return insights;
}

function generateNextSteps(
  insights: Insight[],

  growthProfile: GrowthProfile
): string[] {
  const steps: string[] = [];

  // Based on weakest dimension
  const weakest = insights.find((i) => i.type === "improvement");
  if (weakest?.dimension) {
    steps.push(`Focar em ${METRIC_LABELS[weakest.dimension]} na próxima sessão`);
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

function generateSummary(ctx: SummaryContext): string {
  const parts: string[] = [];

  const dimScores = Object.values(ctx.dimensions).map((d) => d.score);
  const avgScore = dimScores.length > 0
    ? Math.round(dimScores.reduce((a, b) => a + b, 0) / dimScores.length)
    : 0;

  parts.push(`Score médio: ${avgScore}/100.`);
  parts.push(`${ctx.sessionMetrics.totalSessions} sessões.`);
  parts.push(`${ctx.totalInteractions} interações (${ctx.accepted} aceites, ${ctx.rejected} rejeitadas).`);
  parts.push(`Capacidade de crescimento: ${Math.round(ctx.growthProfile.growthCapacity * 100)}%.`);

  return parts.join(" ");
}

// ── Report Writer ────────────────────────────────────────────────────────────

/** Write performance report to disk. */
export function writePerformanceReport(
  shitennoDir: string,
  report: PerformanceReport
): string | null {
  try {
    const reportsDir = join(shitennoDir, "reports");
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `performance-${date}.json`;
    const filepath = join(reportsDir, filename);

    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
