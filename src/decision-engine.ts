/**
 * decision-engine.ts — Decision Engine with Specialized Evaluators
 *
 * Evaluates proposed actions using multiple specialized evaluators.
 * Each evaluator scores on a specific dimension (goal alignment, risk, impact, etc.).
 * The engine combines scores into a final decision with confidence.
 *
 * Architecture: Evaluators → DecisionEngine → Decision Record
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export type DecisionRecommendation = "proceed" | "proceed_with_caution" | "block" | "defer";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface DecisionRequest {
  /** Unique identifier for this decision request. */
  id: string;
  /** Human-readable description of the proposed action. */
  action: string;
  /** Category: goal, architecture, security, performance, quality, etc. */
  category: string;
  /** Optional: specific goal ID this action targets. */
  targetGoalId?: string;
  /** Context data for evaluators. */
  context: Record<string, unknown>;
  /** ISO timestamp. */
  timestamp: string;
}

export interface EvaluatorScore {
  /** Evaluator name. */
  evaluator: string;
  /** Score 0-100 (higher = more favorable). */
  score: number;
  /** Human-readable explanation. */
  reasoning: string;
  /** Optional: specific concerns or recommendations. */
  concerns?: string[];
  /** Optional: suggested mitigations. */
  mitigations?: string[];
}

export interface Decision {
  /** Unique decision ID. */
  id: string;
  /** The original request. */
  request: DecisionRequest;
  /** Individual evaluator scores. */
  scores: EvaluatorScore[];
  /** Weighted composite score (0-100). */
  compositeScore: number;
  /** Final recommendation. */
  recommendation: DecisionRecommendation;
  /** Confidence in the recommendation (0-100). */
  confidence: number;
  /** ISO timestamp of decision. */
  decidedAt: string;
  /** Optional: human justification. */
  justification?: string;
}

export interface DecisionFilter {
  category?: string;
  recommendation?: DecisionRecommendation;
  since?: string;
}

// ── Evaluator Interface ────────────────────────────────────────────────────

export interface Evaluator {
  /** Unique name for this evaluator. */
  name: string;
  /** Weight for combining scores (default: 1.0). */
  weight: number;
  /** Evaluate a decision request and return a score. */
  evaluate(request: DecisionRequest): EvaluatorScore | Promise<EvaluatorScore>;
}

// ── Specialized Evaluators ─────────────────────────────────────────────────

/**
 * GoalEvaluator — Scores how well an action aligns with project goals.
 */
export class GoalEvaluator implements Evaluator {
  name = "goal";
  weight = 1.5;

  private goals: Array<{ id: string; status: string; targets: string[] }>;

  constructor(goals: Array<{ id: string; status: string; targets: string[] }>) {
    this.goals = goals;
  }

  evaluate(request: DecisionRequest): EvaluatorScore {
    if (!request.targetGoalId) {
      return {
        evaluator: this.name,
        score: 50,
        reasoning: "No target goal specified — neutral score",
      };
    }

    const goal = this.goals.find((g) => g.id === request.targetGoalId);
    if (!goal) {
      return {
        evaluator: this.name,
        score: 20,
        reasoning: `Target goal ${request.targetGoalId} not found`,
        concerns: ["Action targets a non-existent goal"],
      };
    }

    if (goal.status === "completed") {
      return {
        evaluator: this.name,
        score: 30,
        reasoning: `Target goal ${goal.id} is already completed`,
        concerns: ["Action may be redundant"],
      };
    }

    if (goal.status === "abandoned") {
      return {
        evaluator: this.name,
        score: 10,
        reasoning: `Target goal ${goal.id} is abandoned`,
        concerns: ["Action targets an abandoned goal"],
      };
    }

    return {
      evaluator: this.name,
      score: 80,
      reasoning: `Action aligns with active goal ${goal.id}`,
    };
  }
}

/**
 * RiskEvaluator — Scores based on risk level of the action.
 */
export class RiskEvaluator implements Evaluator {
  name = "risk";
  weight = 1.2;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const riskLevel = (request.context.riskLevel as RiskLevel) ?? "medium";
    const riskScores: Record<RiskLevel, number> = {
      low: 85,
      medium: 60,
      high: 30,
      critical: 10,
    };

    const score = riskScores[riskLevel];
    const concerns: string[] = [];
    const mitigations: string[] = [];

    if (riskLevel === "high" || riskLevel === "critical") {
      concerns.push(`High risk action (${riskLevel})`);
      mitigations.push("Consider staged rollout");
      mitigations.push("Add monitoring and rollback plan");
    }

    return {
      evaluator: this.name,
      score,
      reasoning: `Risk level: ${riskLevel}`,
      concerns: concerns.length > 0 ? concerns : undefined,
      mitigations: mitigations.length > 0 ? mitigations : undefined,
    };
  }
}

/**
 * ImpactEvaluator — Scores based on expected impact.
 */
export class ImpactEvaluator implements Evaluator {
  name = "impact";
  weight = 1.0;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const impact = (request.context.impact as string) ?? "medium";
    const impactScores: Record<string, number> = {
      minimal: 40,
      low: 55,
      medium: 70,
      high: 85,
      critical: 95,
    };

    const score = impactScores[impact] ?? 50;

    return {
      evaluator: this.name,
      score,
      reasoning: `Expected impact: ${impact}`,
    };
  }
}

/**
 * ConfidenceEvaluator — Scores based on available information.
 */
export class ConfidenceEvaluator implements Evaluator {
  name = "confidence";
  weight = 0.8;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const hasContext = Object.keys(request.context).length > 0;
    const hasGoal = !!request.targetGoalId;
    const hasDescription = request.action.length > 10;

    let score = 40;
    if (hasContext) score += 20;
    if (hasGoal) score += 20;
    if (hasDescription) score += 20;

    const concerns: string[] = [];
    if (!hasContext) concerns.push("No context provided");
    if (!hasGoal) concerns.push("No target goal specified");

    return {
      evaluator: this.name,
      score: Math.min(100, score),
      reasoning: `Confidence based on: context=${hasContext}, goal=${hasGoal}, description=${hasDescription}`,
      concerns: concerns.length > 0 ? concerns : undefined,
    };
  }
}

/**
 * DebtEvaluator — Scores based on technical debt impact.
 */
export class DebtEvaluator implements Evaluator {
  name = "debt";
  weight = 0.9;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const introducesDebt = (request.context.introducesDebt as boolean) ?? false;
    const debtSeverity = (request.context.debtSeverity as string) ?? "none";

    if (!introducesDebt) {
      return {
        evaluator: this.name,
        score: 85,
        reasoning: "No technical debt introduced",
      };
    }

    const severityScores: Record<string, number> = {
      none: 85,
      low: 65,
      medium: 40,
      high: 20,
    };

    const score = severityScores[debtSeverity] ?? 50;

    return {
      evaluator: this.name,
      score,
      reasoning: `Introduces ${debtSeverity} technical debt`,
      concerns: [`Technical debt: ${debtSeverity}`],
      mitigations: ["Create follow-up task to address debt"],
    };
  }
}

// ── Repository ─────────────────────────────────────────────────────────────

export interface DecisionRepository {
  save(decision: Decision): void;
  findById(id: string): Decision | undefined;
  findAll(filter?: DecisionFilter): Decision[];
  count(filter?: DecisionFilter): number;
}

export class FileDecisionRepository implements DecisionRepository {
  private dir: string;

  constructor(nexusDir: string) {
    this.dir = join(nexusDir, "governance", "decisions");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(decision: Decision): void {
    const filepath = join(this.dir, `${decision.id}.json`);
    writeFileSync(filepath, JSON.stringify(decision, null, 2), "utf-8");
  }

  findById(id: string): Decision | undefined {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      return JSON.parse(readFileSync(filepath, "utf-8")) as Decision;
    } catch {
      return undefined;
    }
  }

  findAll(filter?: DecisionFilter): Decision[] {
    if (!existsSync(this.dir)) return [];

    const { readdirSync } = require("node:fs");
    const files = readdirSync(this.dir).filter((f: string) => f.endsWith(".json"));
    const decisions: Decision[] = [];

    for (const file of files) {
      try {
        const decision = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as Decision;
        if (this.matchesFilter(decision, filter)) {
          decisions.push(decision);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return decisions;
  }

  count(filter?: DecisionFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(decision: Decision, filter?: DecisionFilter): boolean {
    if (!filter) return true;
    if (filter.category && decision.request.category !== filter.category) return false;
    if (filter.recommendation && decision.recommendation !== filter.recommendation) return false;
    if (filter.since && decision.decidedAt < filter.since) return false;
    return true;
  }
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class DecisionEngine {
  private evaluators: Evaluator[];

  constructor(
    private repo: DecisionRepository,
    evaluators?: Evaluator[]
  ) {
    this.evaluators = evaluators ?? [
      new GoalEvaluator([]),
      new RiskEvaluator(),
      new ImpactEvaluator(),
      new ConfidenceEvaluator(),
      new DebtEvaluator(),
    ];
  }

  /** Add a custom evaluator. */
  addEvaluator(evaluator: Evaluator): void {
    this.evaluators.push(evaluator);
  }

  /** Evaluate a request and produce a decision. */
  evaluate(request: DecisionRequest): Promise<Decision> {
    return Promise.all(
      this.evaluators.map((e) => e.evaluate(request))
    ).then((scores) => {
      // Calculate weighted composite score
      let totalWeight = 0;
      let weightedSum = 0;
      for (const score of scores) {
        const evaluator = this.evaluators.find((e) => e.name === score.evaluator);
        const weight = evaluator?.weight ?? 1.0;
        weightedSum += score.score * weight;
        totalWeight += weight;
      }
      const compositeScore = Math.round(weightedSum / totalWeight);

      // Determine recommendation
      const recommendation = this.computeRecommendation(compositeScore, scores);

      // Calculate confidence
      const confidence = this.computeConfidence(scores);

      const decision: Decision = {
        id: `DEC-${randomUUID().slice(0, 8).toUpperCase()}`,
        request,
        scores,
        compositeScore,
        recommendation,
        confidence,
        decidedAt: new Date().toISOString(),
      };

      return decision;
    });
  }

  /** Evaluate and persist the decision. */
  decide(request: DecisionRequest): Promise<Decision> {
    return this.evaluate(request).then((decision) => {
      this.repo.save(decision);
      return decision;
    });
  }

  /** Get a decision by ID. */
  get(id: string): Decision | undefined {
    return this.repo.findById(id);
  }

  /** List decisions with optional filter. */
  list(filter?: DecisionFilter): Decision[] {
    return this.repo.findAll(filter);
  }

  /** Count decisions. */
  count(filter?: DecisionFilter): number {
    return this.repo.count(filter);
  }

  private computeRecommendation(
    compositeScore: number,
    scores: EvaluatorScore[]
  ): DecisionRecommendation {
    // Check for any critical concerns
    const hasCriticalConcerns = scores.some(
      (s) => s.concerns?.some((c) => c.toLowerCase().includes("critical"))
    );
    if (hasCriticalConcerns) return "block";

    // Check risk evaluator specifically
    const riskScore = scores.find((s) => s.evaluator === "risk");
    if (riskScore && riskScore.score < 20) return "block";

    if (compositeScore >= 75) return "proceed";
    if (compositeScore >= 50) return "proceed_with_caution";
    if (compositeScore >= 30) return "defer";
    return "block";
  }

  private computeConfidence(scores: EvaluatorScore[]): number {
    if (scores.length === 0) return 0;
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.abs(s.score - avgScore), 0) / scores.length;
    // Lower variance = higher confidence
    const confidence = Math.max(0, Math.min(100, 100 - variance));
    return Math.round(confidence);
  }
}
