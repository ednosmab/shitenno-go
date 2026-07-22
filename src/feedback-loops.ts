/**
 * feedback-loops.ts — Recommendation Feedback System
 *
 * Tracks acceptance/rejection of recommendations and adjusts
 * future recommendations based on patterns.
 * Now includes dimension tracking for user performance reporting.
 *
 * PRINCIPLE: The system learns from human decisions.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";
import { getEventBus } from "./event-bus.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Performance dimensions inspired by the feedback template. */
export type PerformanceMetric =
  | "architectural_vision"
  | "scope_management"
  | "prompt_quality"
  | "decision_making"
  | "risk_management"
  | "technical_communication"
  | "sustainable_velocity";

/** Human-readable labels for each dimension. */
export const METRIC_LABELS: Record<PerformanceMetric, string> = {
  architectural_vision: "Visão Arquitectural",
  scope_management: "Gestão de Scope",
  prompt_quality: "Qualidade de Prompts",
  decision_making: "Tomada de Decisão",
  risk_management: "Gestão de Risco",
  technical_communication: "Comunicação Técnica",
  sustainable_velocity: "Velocidade Sustentável",
};

export interface FeedbackRecord {
  id: string;
  recommendationId: string;
  action: "accepted" | "rejected" | "deferred";
  reason?: string;
  timestamp: string;
  context: {
    maturityScore: number;
    installedCapabilities: string[];
    knowledgeDebt: number;
  };
  /** Path choice made by the user (for dual-path system). */
  pathChoice?: "comfortable" | "challenging";
  /** Performance dimension this feedback relates to. */
  dimension?: PerformanceMetric;
  /** Concrete evidence for the assessment. */
  evidence?: string;
  /** Session ID where this feedback was given. */
  sessionId?: string;
}

export interface FeedbackSummary {
  recommendationId: string;
  acceptCount: number;
  rejectCount: number;
  deferCount: number;
  totalInteractions: number;
  acceptanceRate: number;
  lastAction: "accepted" | "rejected" | "deferred" | null;
  lastTimestamp: string | null;
  /** Path choice statistics (for dual-path system). */
  pathChoiceStats?: {
    comfortableCount: number;
    challengingCount: number;
    lastPathChoice: "comfortable" | "challenging" | null;
  };
}

export interface FeedbackPattern {
  type: "always_rejects" | "always_accepts" | "rejects_after_threshold" | "defers_frequently";
  recommendationType: string;
  confidence: number;
  description: string;
}

// ── Storage ──────────────────────────────────────────────────────────────────

function getFeedbackDir(shitennoDir: string): string {
  return join(shitennoDir, "feedback");
}

function getRecordsDir(shitennoDir: string): string {
  return join(getFeedbackDir(shitennoDir), "records");
}

function getSummaryPath(shitennoDir: string): string {
  return join(getFeedbackDir(shitennoDir), "summary.json");
}

// ── Core Functions ───────────────────────────────────────────────────────────

/** Record a feedback event. */
export function recordFeedback(
  shitennoDir: string,
  record: Omit<FeedbackRecord, "id" | "timestamp">
): FeedbackRecord {
  const recordsDir = getRecordsDir(shitennoDir);

  if (!existsSync(recordsDir)) {
    mkdirSync(recordsDir, { recursive: true });
  }

  const fullRecord: FeedbackRecord = {
    ...record,
    id: `FB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  // Write individual record
  const filename = `${fullRecord.timestamp.split("T")[0]}-${fullRecord.id}.json`;
  writeFileSync(join(recordsDir, filename), JSON.stringify(fullRecord, null, 2));

  // Update summary
  updateSummary(shitennoDir, fullRecord);

  // Publish event to event bus
  const eventType = fullRecord.action === "accepted"
    ? "recommendation.accepted"
    : "recommendation.rejected";

  if (fullRecord.action === "accepted" || fullRecord.action === "rejected") {
    try {
      getEventBus().publish(eventType, {
        recommendationId: fullRecord.recommendationId,
        action: fullRecord.action,
        reason: fullRecord.reason,
        feedbackId: fullRecord.id,
      });
    } catch (error) {
      // Event bus may not be initialized in all contexts
      logger.debug("feedback-loops", "Failed to publish event:", error);
    }
  }

  return fullRecord;
}

/** Get all feedback records. */
export function getFeedbackRecords(shitennoDir: string): FeedbackRecord[] {
  const recordsDir = getRecordsDir(shitennoDir);
  if (!existsSync(recordsDir)) return [];

  const files = readdirSync(recordsDir).filter((f) => f.endsWith(".json"));
  const records: FeedbackRecord[] = [];

  for (const file of files) {
    try {
      const content = JSON.parse(readFileSync(join(recordsDir, file), "utf-8"));
      records.push(content);
    } catch {
      logger.debug("feedback-loops", "Failed to parse feedback record:", file);
    }
  }

  return records.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/** Get feedback summary for a specific recommendation. */
export function getFeedbackSummary(
  shitennoDir: string,
  recommendationId: string
): FeedbackSummary | null {
  const summaryPath = getSummaryPath(shitennoDir);
  if (!existsSync(summaryPath)) return null;

  try {
    const summaries: Record<string, FeedbackSummary> = JSON.parse(
      readFileSync(summaryPath, "utf-8")
    );
    return summaries[recommendationId] || null;
  } catch {
    return null;
  }
}

/** Get all feedback summaries. */
export function getAllFeedbackSummaries(shitennoDir: string): Record<string, FeedbackSummary> {
  const summaryPath = getSummaryPath(shitennoDir);
  if (!existsSync(summaryPath)) return {};

  try {
    return JSON.parse(readFileSync(summaryPath, "utf-8"));
  } catch {
    return {};
  }
}

// ── Learning Functions ───────────────────────────────────────────────────────

/** Adjust confidence based on feedback. */
export function adjustConfidence(
  currentConfidence: number,
  action: "accepted" | "rejected",
  weight: number = 0.1
): number {
  if (action === "accepted") {
    return Math.min(1.0, currentConfidence + (1 - currentConfidence) * weight);
  } else {
    return Math.max(0.0, currentConfidence - currentConfidence * weight);
  }
}

/** Check if a recommendation should be suppressed. */
export function shouldSuppress(
  summary: FeedbackSummary,
  suppressThreshold: number = 5
): boolean {
  return summary.rejectCount >= suppressThreshold;
}

/** Detect feedback patterns. */
export function detectFeedbackPatterns(shitennoDir: string): FeedbackPattern[] {
  const summaries = getAllFeedbackSummaries(shitennoDir);
  const patterns: FeedbackPattern[] = [];

  for (const [recId, summary] of Object.entries(summaries)) {
    if (summary.totalInteractions < 3) continue;

    // Pattern: Always rejects
    if (summary.acceptCount === 0 && summary.rejectCount >= 3) {
      patterns.push({
        type: "always_rejects",
        recommendationType: recId,
        confidence: summary.rejectCount / summary.totalInteractions,
        description: `Recommendation "${recId}" has been rejected ${summary.rejectCount} times`,
      });
    }

    // Pattern: Always accepts
    if (summary.rejectCount === 0 && summary.acceptCount >= 3) {
      patterns.push({
        type: "always_accepts",
        recommendationType: recId,
        confidence: summary.acceptCount / summary.totalInteractions,
        description: `Recommendation "${recId}" has been accepted ${summary.acceptCount} times`,
      });
    }

    // Pattern: Defers frequently
    if (summary.deferCount >= 3 && summary.deferCount > summary.acceptCount + summary.rejectCount) {
      patterns.push({
        type: "defers_frequently",
        recommendationType: recId,
        confidence: summary.deferCount / summary.totalInteractions,
        description: `Recommendation "${recId}" has been deferred ${summary.deferCount} times`,
      });
    }
  }

  return patterns;
}

// ── Dimension Functions ──────────────────────────────────────────────────────

export interface DimensionSummary {
  dimension: PerformanceMetric;
  acceptCount: number;
  rejectCount: number;
  deferCount: number;
  evidence: string[];
}

/** Record feedback with a performance dimension. */
export function recordDimensionFeedback(
  shitennoDir: string,
  record: {
    recommendationId: string;
    action: "accepted" | "rejected" | "deferred";
    reason?: string;
    dimension: PerformanceMetric;
    evidence: string;
    sessionId?: string;
    pathChoice?: "comfortable" | "challenging";
    context?: {
      maturityScore: number;
      installedCapabilities: string[];
      knowledgeDebt: number;
    };
  }
): FeedbackRecord {
  return recordFeedback(shitennoDir, {
    recommendationId: record.recommendationId,
    action: record.action,
    reason: record.reason,
    dimension: record.dimension,
    evidence: record.evidence,
    sessionId: record.sessionId,
    pathChoice: record.pathChoice,
    context: record.context || {
      maturityScore: 0,
      installedCapabilities: [],
      knowledgeDebt: 0,
    },
  });
}

/** Get feedback summary for a specific dimension. */
export function getDimensionSummary(
  shitennoDir: string,
  dimension: PerformanceMetric
): DimensionSummary {
  const records = getFeedbackRecords(shitennoDir);
  const filtered = records.filter((r) => r.dimension === dimension);

  return {
    dimension,
    acceptCount: filtered.filter((r) => r.action === "accepted").length,
    rejectCount: filtered.filter((r) => r.action === "rejected").length,
    deferCount: filtered.filter((r) => r.action === "deferred").length,
    evidence: filtered
      .filter((r) => r.evidence)
      .map((r) => r.evidence!)
      .slice(-5), // last 5 evidence items
  };
}

/** Get feedback summaries for all dimensions. */
export function getAllDimensionSummaries(
  shitennoDir: string
): Record<PerformanceMetric, DimensionSummary> {
  const dimensions: PerformanceMetric[] = [
    "architectural_vision",
    "scope_management",
    "prompt_quality",
    "decision_making",
    "risk_management",
    "technical_communication",
    "sustainable_velocity",
  ];

  const result = {} as Record<PerformanceMetric, DimensionSummary>;
  for (const dim of dimensions) {
    result[dim] = getDimensionSummary(shitennoDir, dim);
  }
  return result;
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

function createEmptySummary(recId: string): FeedbackSummary {
  return {
    recommendationId: recId,
    acceptCount: 0,
    rejectCount: 0,
    deferCount: 0,
    totalInteractions: 0,
    acceptanceRate: 0,
    lastAction: null,
    lastTimestamp: null,
    pathChoiceStats: {
      comfortableCount: 0,
      challengingCount: 0,
      lastPathChoice: null,
    },
  };
}

function updateActionCounts(summary: FeedbackSummary, action: FeedbackRecord["action"]): void {
  switch (action) {
    case "accepted":
      summary.acceptCount++;
      break;
    case "rejected":
      summary.rejectCount++;
      break;
    case "deferred":
      summary.deferCount++;
      break;
  }
}

function updatePathChoiceStats(summary: FeedbackSummary, pathChoice: "comfortable" | "challenging"): void {
  if (!summary.pathChoiceStats) {
    summary.pathChoiceStats = {
      comfortableCount: 0,
      challengingCount: 0,
      lastPathChoice: null,
    };
  }

  if (pathChoice === "comfortable") {
    summary.pathChoiceStats.comfortableCount++;
  } else {
    summary.pathChoiceStats.challengingCount++;
  }
  summary.pathChoiceStats.lastPathChoice = pathChoice;
}

function updateSummary(shitennoDir: string, record: FeedbackRecord): void {
  const summaryPath = getSummaryPath(shitennoDir);
  const summaries: Record<string, FeedbackSummary> = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, "utf-8"))
    : {};

  const recId = record.recommendationId;
  if (!summaries[recId]) {
    summaries[recId] = createEmptySummary(recId);
  }

  const summary = summaries[recId];
  summary.totalInteractions++;
  updateActionCounts(summary, record.action);

  summary.acceptanceRate =
    summary.totalInteractions > 0
      ? summary.acceptCount / summary.totalInteractions
      : 0;
  summary.lastAction = record.action;
  summary.lastTimestamp = record.timestamp;

  if (record.pathChoice) {
    updatePathChoiceStats(summary, record.pathChoice);
  }

  writeFileSync(summaryPath, JSON.stringify(summaries, null, 2));
}
