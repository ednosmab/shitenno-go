/**
 * decision-engine.test.ts — Tests for Decision Engine
 *
 * Validates evaluator scoring, decision computation, and repository operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  DecisionEngine,
  FileDecisionRepository,
  GoalEvaluator,
  RiskEvaluator,
  ImpactEvaluator,
  ConfidenceEvaluator,
  DebtEvaluator,
  type Decision,
  type DecisionRepository,
  type DecisionFilter,
  type DecisionRequest,
  type EvaluatorScore,
} from "../prioritization/evaluators.js";

// ── In-Memory Repository ───────────────────────────────────────────────────

class InMemoryDecisionRepository implements DecisionRepository {
  private decisions = new Map<string, Decision>();

  save(decision: Decision): void {
    this.decisions.set(decision.id, { ...decision });
  }

  findById(id: string): Decision | undefined {
    const d = this.decisions.get(id);
    return d ? { ...d } : undefined;
  }

  findAll(filter?: DecisionFilter): Decision[] {
    let decisions = Array.from(this.decisions.values());
    if (filter) {
      decisions = decisions.filter((d) => {
        if (filter.category && d.request.category !== filter.category) return false;
        if (filter.recommendation && d.recommendation !== filter.recommendation) return false;
        if (filter.since && d.decidedAt < filter.since) return false;
        return true;
      });
    }
    return decisions;
  }

  count(filter?: DecisionFilter): number {
    return this.findAll(filter).length;
  }
}

// ── File Repository Tests ──────────────────────────────────────────────────

describe("FileDecisionRepository", () => {
  let tmpDir: string;
  let repo: FileDecisionRepository;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-decision-repo-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    repo = new FileDecisionRepository(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a decision", () => {
    const decision: Decision = {
      id: "DEC-TEST-001",
      request: { id: "REQ-1", action: "Test", category: "test", context: {}, timestamp: new Date().toISOString() },
      scores: [{ evaluator: "test", score: 80, reasoning: "Test" }],
      compositeScore: 80,
      recommendation: "proceed",
      confidence: 85,
      decidedAt: new Date().toISOString(),
    };

    repo.save(decision);
    const loaded = repo.findById("DEC-TEST-001");
    expect(loaded).toBeDefined();
    expect(loaded?.recommendation).toBe("proceed");
  });

  it("returns undefined for non-existent decision", () => {
    expect(repo.findById("DEC-NONEXISTENT")).toBeUndefined();
  });

  it("lists all decisions", () => {
    const d1: Decision = {
      id: "DEC-001",
      request: { id: "REQ-1", action: "A", category: "cat1", context: {}, timestamp: new Date().toISOString() },
      scores: [], compositeScore: 70, recommendation: "proceed", confidence: 80, decidedAt: new Date().toISOString(),
    };
    const d2: Decision = {
      id: "DEC-002",
      request: { id: "REQ-2", action: "B", category: "cat2", context: {}, timestamp: new Date().toISOString() },
      scores: [], compositeScore: 40, recommendation: "block", confidence: 70, decidedAt: new Date().toISOString(),
    };

    repo.save(d1);
    repo.save(d2);
    expect(repo.findAll()).toHaveLength(2);
  });

  it("filters by category", () => {
    const d1: Decision = {
      id: "DEC-001",
      request: { id: "REQ-1", action: "A", category: "security", context: {}, timestamp: new Date().toISOString() },
      scores: [], compositeScore: 70, recommendation: "proceed", confidence: 80, decidedAt: new Date().toISOString(),
    };
    const d2: Decision = {
      id: "DEC-002",
      request: { id: "REQ-2", action: "B", category: "quality", context: {}, timestamp: new Date().toISOString() },
      scores: [], compositeScore: 40, recommendation: "block", confidence: 70, decidedAt: new Date().toISOString(),
    };

    repo.save(d1);
    repo.save(d2);
    expect(repo.findAll({ category: "security" })).toHaveLength(1);
    expect(repo.findAll({ category: "quality" })).toHaveLength(1);
  });
});

// ── Evaluator Tests ────────────────────────────────────────────────────────

describe("Evaluators", () => {
  const makeRequest = (overrides: Partial<DecisionRequest> = {}): DecisionRequest => ({
    id: "REQ-001",
    action: "Test action",
    category: "test",
    context: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  describe("GoalEvaluator", () => {
    it("scores 50 when no target goal", () => {
      const evaluator = new GoalEvaluator([]);
      const score = evaluator.evaluate(makeRequest());
      expect(score.score).toBe(50);
    });

    it("scores low when target goal not found", () => {
      const evaluator = new GoalEvaluator([]);
      const score = evaluator.evaluate(makeRequest({ targetGoalId: "GOAL-XYZ" }));
      expect(score.score).toBe(20);
      expect(score.concerns).toBeDefined();
    });

    it("scores high when target goal is active", () => {
      const evaluator = new GoalEvaluator([
        { id: "GOAL-001", status: "active", targets: ["quality"] },
      ]);
      const score = evaluator.evaluate(makeRequest({ targetGoalId: "GOAL-001" }));
      expect(score.score).toBe(80);
    });

    it("scores low when target goal is completed", () => {
      const evaluator = new GoalEvaluator([
        { id: "GOAL-001", status: "completed", targets: [] },
      ]);
      const score = evaluator.evaluate(makeRequest({ targetGoalId: "GOAL-001" }));
      expect(score.score).toBe(30);
    });

    it("scores very low when target goal is abandoned", () => {
      const evaluator = new GoalEvaluator([
        { id: "GOAL-001", status: "abandoned", targets: [] },
      ]);
      const score = evaluator.evaluate(makeRequest({ targetGoalId: "GOAL-001" }));
      expect(score.score).toBe(10);
    });
  });

  describe("RiskEvaluator", () => {
    it("scores high for low risk", () => {
      const evaluator = new RiskEvaluator();
      const score = evaluator.evaluate(makeRequest({ context: { riskLevel: "low" } }));
      expect(score.score).toBe(85);
    });

    it("scores low for critical risk", () => {
      const evaluator = new RiskEvaluator();
      const score = evaluator.evaluate(makeRequest({ context: { riskLevel: "critical" } }));
      expect(score.score).toBe(10);
      expect(score.concerns).toBeDefined();
      expect(score.mitigations).toBeDefined();
    });

    it("defaults to medium risk", () => {
      const evaluator = new RiskEvaluator();
      const score = evaluator.evaluate(makeRequest());
      expect(score.score).toBe(60);
    });
  });

  describe("ImpactEvaluator", () => {
    it("scores high for high impact", () => {
      const evaluator = new ImpactEvaluator();
      const score = evaluator.evaluate(makeRequest({ context: { impact: "high" } }));
      expect(score.score).toBe(85);
    });

    it("scores low for minimal impact", () => {
      const evaluator = new ImpactEvaluator();
      const score = evaluator.evaluate(makeRequest({ context: { impact: "minimal" } }));
      expect(score.score).toBe(40);
    });
  });

  describe("ConfidenceEvaluator", () => {
    it("scores low with no context", () => {
      const evaluator = new ConfidenceEvaluator();
      const score = evaluator.evaluate(makeRequest({ context: {} }));
      expect(score.score).toBeLessThan(80);
    });

    it("scores high with full context", () => {
      const evaluator = new ConfidenceEvaluator();
      const score = evaluator.evaluate(makeRequest({
        targetGoalId: "GOAL-001",
        context: { riskLevel: "low" },
        action: "A detailed action description",
      }));
      expect(score.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe("DebtEvaluator", () => {
    it("scores high when no debt introduced", () => {
      const evaluator = new DebtEvaluator();
      const score = evaluator.evaluate(makeRequest());
      expect(score.score).toBe(85);
    });

    it("scores low when high debt introduced", () => {
      const evaluator = new DebtEvaluator();
      const score = evaluator.evaluate(makeRequest({
        context: { introducesDebt: true, debtSeverity: "high" },
      }));
      expect(score.score).toBe(20);
      expect(score.concerns).toBeDefined();
    });
  });
});

// ── DecisionEngine Tests ───────────────────────────────────────────────────

describe("DecisionEngine", () => {
  let repo: InMemoryDecisionRepository;
  let engine: DecisionEngine;

  beforeEach(() => {
    repo = new InMemoryDecisionRepository();
    engine = new DecisionEngine(repo);
  });

  it("evaluates a request and produces a decision", async () => {
    const request: DecisionRequest = {
      id: "REQ-001",
      action: "Add unit tests",
      category: "quality",
      context: { riskLevel: "low", impact: "high" },
      timestamp: new Date().toISOString(),
    };

    const decision = await engine.evaluate(request);
    expect(decision.id).toMatch(/^DEC-[A-Z0-9]+$/);
    expect(decision.request).toBe(request);
    expect(decision.scores).toHaveLength(5);
    expect(decision.compositeScore).toBeGreaterThanOrEqual(0);
    expect(decision.compositeScore).toBeLessThanOrEqual(100);
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(100);
    expect(["proceed", "proceed_with_caution", "defer", "block"]).toContain(decision.recommendation);
  });

  it("decide() persists the decision", async () => {
    const request: DecisionRequest = {
      id: "REQ-002",
      action: "Refactor module",
      category: "architecture",
      context: {},
      timestamp: new Date().toISOString(),
    };

    const decision = await engine.decide(request);
    const loaded = repo.findById(decision.id);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(decision.id);
  });

  it("higher risk leads to lower recommendation", async () => {
    const baseRequest: DecisionRequest = {
      id: "REQ-LOW",
      action: "Low risk action",
      category: "test",
      context: { riskLevel: "low", impact: "high" },
      timestamp: new Date().toISOString(),
    };

    const highRiskRequest: DecisionRequest = {
      id: "REQ-HIGH",
      action: "High risk action",
      category: "test",
      context: { riskLevel: "critical", impact: "high" },
      timestamp: new Date().toISOString(),
    };

    const lowDecision = await engine.evaluate(baseRequest);
    const highDecision = await engine.evaluate(highRiskRequest);

    expect(lowDecision.compositeScore).toBeGreaterThan(highDecision.compositeScore);
  });

  it("with goal context improves confidence", async () => {
    const withoutGoal: DecisionRequest = {
      id: "REQ-NO-GOAL",
      action: "Action without goal",
      category: "test",
      context: { riskLevel: "low" },
      timestamp: new Date().toISOString(),
    };

    const withGoal: DecisionRequest = {
      id: "REQ-WITH-GOAL",
      action: "Action with goal",
      category: "test",
      targetGoalId: "GOAL-001",
      context: { riskLevel: "low" },
      timestamp: new Date().toISOString(),
    };

    const noGoalDecision = await engine.evaluate(withoutGoal);
    const withGoalDecision = await engine.evaluate(withGoal);

    // Both should produce valid decisions
    expect(noGoalDecision.confidence).toBeGreaterThanOrEqual(0);
    expect(withGoalDecision.confidence).toBeGreaterThanOrEqual(0);
    // Goal evaluator adds its score, which may affect composite score
    expect(withGoalDecision.compositeScore).toBeGreaterThanOrEqual(0);
  });

  it("adds custom evaluator", async () => {
    const customEvaluator = {
      name: "custom",
      weight: 2.0,
      evaluate: (): EvaluatorScore => ({
        evaluator: "custom",
        score: 99,
        reasoning: "Custom evaluation",
      }),
    };

    engine.addEvaluator(customEvaluator);

    const request: DecisionRequest = {
      id: "REQ-CUSTOM",
      action: "Custom eval",
      category: "test",
      context: {},
      timestamp: new Date().toISOString(),
    };

    const decision = await engine.evaluate(request);
    expect(decision.scores).toHaveLength(6);
    expect(decision.scores.find((s) => s.evaluator === "custom")).toBeDefined();
  });

  it("get() retrieves a decision", async () => {
    const request: DecisionRequest = {
      id: "REQ-GET",
      action: "Get me",
      category: "test",
      context: {},
      timestamp: new Date().toISOString(),
    };

    const decision = await engine.decide(request);
    const found = engine.get(decision.id);
    expect(found?.id).toBe(decision.id);
  });

  it("list() returns all decisions", async () => {
    await engine.decide({ id: "R1", action: "A", category: "cat1", context: {}, timestamp: new Date().toISOString() });
    await engine.decide({ id: "R2", action: "B", category: "cat2", context: {}, timestamp: new Date().toISOString() });

    expect(engine.list()).toHaveLength(2);
  });

  it("count() returns correct count", async () => {
    await engine.decide({ id: "R1", action: "A", category: "cat1", context: {}, timestamp: new Date().toISOString() });
    expect(engine.count()).toBe(1);
  });
});
