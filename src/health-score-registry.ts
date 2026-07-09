/**
 * health-score-registry.ts — Unified Health Score System
 *
 * Provides three distinct health scores with clear labels:
 * - Code Security: Exponential decay based on audit issues
 * - Engineering Risk: Penalty-based (100 - penalties)
 * - Knowledge Health: Weighted average of knowledge debt, graph, and entropy
 *
 * PRINCIPLE: Each score measures a different dimension. Labels prevent confusion.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type HealthScoreType = "code_security" | "engineering_risk" | "knowledge_health";

export interface HealthScoreResult {
  type: HealthScoreType;
  label: string;
  score: number;
  maxScore: number;
  formula: string;
}

// ── Code Security Score ────────────────────────────────────────────────────

/**
 * Calculate Code Security score using exponential decay.
 * Based on the actual health-auditor formula.
 */
export function getCodeSecurityScore(
  issues: { severity: string }[],
  totalFiles: number
): HealthScoreResult {
  if (totalFiles === 0) {
    return {
      type: "code_security",
      label: "Code Health",
      score: 100,
      maxScore: 100,
      formula: "No files to audit",
    };
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const mediumCount = issues.filter((i) => i.severity === "medium").length;

  const penaltyPerFile =
    (criticalCount * 10 + highCount * 5 + mediumCount * 2) / totalFiles;
  const score = Math.round(100 * Math.exp(-penaltyPerFile));

  return {
    type: "code_security",
    label: "Code Health",
    score: Math.max(0, Math.min(100, score)),
    maxScore: 100,
    formula: `100 * exp(-penalty_per_file), penalty = (critical*10 + high*5 + medium*2) / files`,
  };
}

// ── Engineering Risk Score ─────────────────────────────────────────────────

/**
 * Calculate Engineering Risk score using penalty-based approach.
 * Based on the actual doctor formula: 100 - penalties.
 */
export function getEngineeringRiskScore(
  findings: { severity: string }[]
): HealthScoreResult {
  let penalties = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case "critical":
        penalties += 25;
        break;
      case "high":
        penalties += 15;
        break;
      case "medium":
        penalties += 8;
        break;
      case "low":
        penalties += 3;
        break;
    }
  }

  const score = Math.max(0, 100 - penalties);

  return {
    type: "engineering_risk",
    label: "Engineering Risk",
    score,
    maxScore: 100,
    formula: "100 - (critical*25 + high*15 + medium*8 + low*3)",
  };
}

// ── Knowledge Health Score ─────────────────────────────────────────────────

/**
 * Calculate Knowledge Health score using weighted average.
 * Based on the actual engineering-state formula.
 */
export function getKnowledgeHealthScore(
  knowledgeDebtScore: number,
  knowledgeGraphScore: number,
  entropyScore: number
): HealthScoreResult {
  const weights = { knowledgeDebt: 0.4, knowledgeGraph: 0.3, entropy: 0.3 };
  const entropyInverse = 100 - entropyScore;

  const score = Math.round(
    knowledgeDebtScore * weights.knowledgeDebt +
    knowledgeGraphScore * weights.knowledgeGraph +
    entropyInverse * weights.entropy
  );

  return {
    type: "knowledge_health",
    label: "Knowledge Health",
    score: Math.max(0, Math.min(100, score)),
    maxScore: 100,
    formula: "debt*0.4 + graph*0.3 + (100-entropy)*0.3",
  };
}

// ── Overall Health Score ───────────────────────────────────────────────────

/**
 * Combine all three scores into an overall health score.
 * Uses configurable weights.
 */
export function getOverallHealth(
  codeSecurity: HealthScoreResult,
  engineeringRisk: HealthScoreResult,
  knowledgeHealth: HealthScoreResult,
  weights = { codeSecurity: 0.35, engineeringRisk: 0.35, knowledgeHealth: 0.3 }
): HealthScoreResult {
  const score = Math.round(
    codeSecurity.score * weights.codeSecurity +
    engineeringRisk.score * weights.engineeringRisk +
    knowledgeHealth.score * weights.knowledgeHealth
  );

  return {
    type: "code_security",
    label: "Overall Health",
    score: Math.max(0, Math.min(100, score)),
    maxScore: 100,
    formula: "code*0.35 + risk*0.35 + knowledge*0.3",
  };
}
