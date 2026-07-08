/**
 * inference-engine.ts — Plan Inference Engine
 *
 * Pure module (no side effects, no UI dependencies).
 * Produces canonical InferenceResult[] from filesystem state.
 *
 * Each consumer (CLI, TUI, MCP, opencode) decides how to render.
 */

import { readFileSync, statSync } from "node:fs";
import { MarkdownPlanEngine, type MarkdownPlan } from "./markdown-plan-engine.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type InferredStatus =
  | "done"           // all checkboxes [x] or explicit "done"
  | "in_progress"    // has open checkboxes or explicit "andamento"
  | "paused"         // explicit "parado"
  | "obsolete"       // old plan with no activity
  | "inconsistent";  // status contradicts checkbox state

export type Recommendation =
  | "archive"        // plan is done, move to done/
  | "remove"         // plan is obsolete/abandoned, archive with note
  | "keep"           // plan is actively in progress
  | "investigate";   // plan has inconsistencies, needs review

export interface CheckboxSummary {
  total: number;
  closed: number;
  open: number;
  percentage: number;
}

export interface PlanInference {
  /** Plan ID. */
  id: string;
  /** Plan title. */
  title: string;
  /** Raw status from frontmatter. */
  rawStatus: string;
  /** Inferred status from checkboxes + metadata. */
  inferredStatus: InferredStatus;
  /** Checkbox summary (0/0 if no checkboxes). */
  checkboxes: CheckboxSummary;
  /** Age in days since file last modified. */
  ageInDays: number;
  /** Metadata field "estado" if present. */
  estado: string | null;
  /** Recommendation for the user. */
  recommendation: Recommendation;
  /** Human-readable reason for the recommendation. */
  reason: string;
  /** Confidence score (0-1). */
  confidence: number;
}

export interface InferenceSummary {
  /** When this inference was generated. */
  generatedAt: string;
  /** Total active plans analyzed. */
  totalPlans: number;
  /** Plans by inferred status. */
  byStatus: Record<InferredStatus, number>;
  /** Plans by recommendation. */
  byRecommendation: Record<Recommendation, number>;
  /** Individual plan inferences. */
  plans: PlanInference[];
  /** Human-readable summary. */
  summary: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const OBSOLETE_THRESHOLD_DAYS = 30;

// ── Checkbox Analysis ──────────────────────────────────────────────────────

function countCheckboxes(content: string): CheckboxSummary {
  const closed = (content.match(/^- \[x\]/gm) || []).length;
  const open = (content.match(/^- \[ \]/gm) || []).length;
  const total = closed + open;
  return {
    total,
    closed,
    open,
    percentage: total > 0 ? Math.round((closed / total) * 100) : 0,
  };
}

// ── Age Calculation ────────────────────────────────────────────────────────

function calculateAgeInDays(filePath: string): number {
  try {
    const stat = statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

// ── Status Inference ───────────────────────────────────────────────────────

function inferStatus(
  rawStatus: string,
  checkboxes: CheckboxSummary,
  ageInDays: number,
  estado: string | null
): InferredStatus {
  // Explicit "parado" / "paused"
  if (rawStatus === "parado") return "paused";

  // Check for obsolete signals
  const isAbandoned =
    estado?.includes("AGUARDA APROVACAO") ||
    estado?.includes("abandoned") ||
    estado?.includes("cancelled");
  if (isAbandoned && ageInDays > OBSOLETE_THRESHOLD_DAYS) return "obsolete";

  // Explicit "done" — but check for checkbox inconsistency
  if (rawStatus === "done") {
    if (checkboxes.total > 0 && checkboxes.open > 0) return "inconsistent";
    return "done";
  }

  // No checkboxes — use raw status
  if (checkboxes.total === 0) {
    if (isAbandoned) return "obsolete";
    return "in_progress";
  }

  // Has checkboxes — infer from checkbox state
  if (checkboxes.open === 0) return "done";
  if (checkboxes.closed === 0) return "in_progress";

  // Mix of [x] and [ ]
  return "in_progress";
}

// ── Recommendation Generation ──────────────────────────────────────────────

function generateRecommendation(
  inferredStatus: InferredStatus,
  checkboxes: CheckboxSummary,
  ageInDays: number,
  rawStatus: string
): { recommendation: Recommendation; reason: string; confidence: number } {
  switch (inferredStatus) {
    case "done":
      return {
        recommendation: "archive",
        reason:
          checkboxes.total > 0
            ? `All ${checkboxes.total} checkboxes complete`
            : "Status explicitly marked as done",
        confidence: checkboxes.total > 0 ? 0.95 : 0.8,
      };

    case "obsolete":
      return {
        recommendation: "remove",
        reason: `Plan inactive for ${ageInDays}+ days with abandoned status`,
        confidence: 0.85,
      };

    case "inconsistent":
      return {
        recommendation: "investigate",
        reason: `Status says "${rawStatus}" but ${checkboxes.open} of ${checkboxes.total} steps still open`,
        confidence: 0.7,
      };

    case "paused":
      return {
        recommendation: "keep",
        reason: "Plan is paused — review before archiving",
        confidence: 0.6,
      };

    case "in_progress":
    default: {
      if (ageInDays > OBSOLETE_THRESHOLD_DAYS && checkboxes.percentage < 50) {
        return {
          recommendation: "remove",
          reason: `Only ${checkboxes.percentage}% complete after ${ageInDays} days`,
          confidence: 0.7,
        };
      }
      return {
        recommendation: "keep",
        reason:
          checkboxes.total > 0
            ? `${checkboxes.closed}/${checkboxes.total} steps complete (${checkboxes.percentage}%)`
            : "Plan is actively in progress",
        confidence: 0.6,
      };
    }
  }
}

// ── InferenceEngine ────────────────────────────────────────────────────────

export class InferenceEngine {
  private engine: MarkdownPlanEngine;

  constructor(nexusDir: string) {
    this.engine = new MarkdownPlanEngine(nexusDir);
  }

  /**
   * Infer status and generate recommendation for a single plan.
   */
  inferPlan(plan: MarkdownPlan): PlanInference {
    const content = readFileSync(plan.filePath, "utf-8");
    const checkboxes = countCheckboxes(content);
    const ageInDays = calculateAgeInDays(plan.filePath);
    const estado = plan.metadata["estado"] || null;

    const inferredStatus = inferStatus(
      plan.status,
      checkboxes,
      ageInDays,
      estado
    );

    const { recommendation, reason, confidence } = generateRecommendation(
      inferredStatus,
      checkboxes,
      ageInDays,
      plan.status
    );

    return {
      id: plan.id,
      title: plan.title,
      rawStatus: plan.status,
      inferredStatus,
      checkboxes,
      ageInDays,
      estado,
      recommendation,
      reason,
      confidence,
    };
  }

  /**
   * Infer status for all plans (including done — for inconsistency detection).
   */
  inferAllPlans(): PlanInference[] {
    const plans = this.engine.listAll();
    return plans.map((plan) => this.inferPlan(plan));
  }

  /**
   * Generate a full inference summary.
   * Filters out truly done plans (status=done AND not inconsistent).
   */
  generateSummary(): InferenceSummary {
    const allInferences = this.inferAllPlans();

    // Filter: keep plans that need attention
    const inferences = allInferences.filter((inf) => {
      // Keep inconsistencies (status=done but checkboxes open)
      if (inf.inferredStatus === "inconsistent") return true;
      // Keep everything that's not truly done
      if (inf.inferredStatus !== "done") return true;
      // Filter out truly done plans
      return false;
    });

    const byStatus: Record<InferredStatus, number> = {
      done: 0,
      in_progress: 0,
      paused: 0,
      obsolete: 0,
      inconsistent: 0,
    };

    const byRecommendation: Record<Recommendation, number> = {
      archive: 0,
      remove: 0,
      keep: 0,
      investigate: 0,
    };

    for (const inf of inferences) {
      byStatus[inf.inferredStatus]++;
      byRecommendation[inf.recommendation]++;
    }

    const summaryText = this.buildSummaryText(inferences, byStatus, byRecommendation);

    return {
      generatedAt: new Date().toISOString(),
      totalPlans: inferences.length,
      byStatus,
      byRecommendation,
      plans: inferences,
      summary: summaryText,
    };
  }

  private buildSummaryText(
    inferences: PlanInference[],
    _byStatus: Record<InferredStatus, number>,
    byRecommendation: Record<Recommendation, number>
  ): string {
    if (inferences.length === 0) return "No active plans found.";

    const parts: string[] = [];

    if (byRecommendation.archive > 0) {
      parts.push(`${byRecommendation.archive} ready to archive`);
    }
    if (byRecommendation.remove > 0) {
      parts.push(`${byRecommendation.remove} recommended to remove`);
    }
    if (byRecommendation.investigate > 0) {
      parts.push(`${byRecommendation.investigate} need investigation`);
    }
    if (byRecommendation.keep > 0) {
      parts.push(`${byRecommendation.keep} in progress`);
    }

    return `${inferences.length} active plan(s): ${parts.join(", ")}`;
  }
}
