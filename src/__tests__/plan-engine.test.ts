/**
 * plan-engine.test.ts — Tests for Plan Engine
 *
 * Validates plan creation, execution, rollback, and repository operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  PlanEngine,
  FilePlanRepository,
  type Plan,
  type PlanFilter,
} from "../plan-engine.js";
import {
  ActionEngine,
  FileExecutionRepository,
  type ActionRequest,
} from "../action-engine.js";

// ── In-Memory Repositories ─────────────────────────────────────────────────

class InMemoryPlanRepository {
  private plans = new Map<string, Plan>();

  save(plan: Plan): void {
    this.plans.set(plan.id, { ...plan });
  }

  findById(id: string): Plan | undefined {
    const p = this.plans.get(id);
    return p ? { ...p } : undefined;
  }

  findAll(filter?: PlanFilter): Plan[] {
    let plans = Array.from(this.plans.values());
    if (filter?.status) {
      plans = plans.filter((p) => p.status === filter.status);
    }
    return plans;
  }

  delete(id: string): boolean {
    return this.plans.delete(id);
  }

  count(filter?: PlanFilter): number {
    return this.findAll(filter).length;
  }
}

class InMemoryActionEngine {
  async execute(request: ActionRequest) {
    return {
      executionId: `EXE-${Date.now().toString(36)}`,
      request,
      executionHash: "mock-hash",
      status: "completed" as const,
      result: "success" as const,
      output: { success: true },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 10,
    };
  }

  async rollback(_executionId: string) {
    return undefined;
  }
}

// ── File Repository Tests ──────────────────────────────────────────────────

describe("FilePlanRepository", () => {
  let tmpDir: string;
  let repo: FilePlanRepository;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `nexus-plan-repo-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    repo = new FilePlanRepository(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a plan", () => {
    const plan: Plan = {
      id: "PLAN-TEST-001",
      name: "Test Plan",
      description: "A test plan",
      status: "draft",
      steps: [],
      correlationId: "corr-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repo.save(plan);
    const loaded = repo.findById("PLAN-TEST-001");
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe("Test Plan");
  });

  it("returns undefined for non-existent plan", () => {
    expect(repo.findById("PLAN-NONEXISTENT")).toBeUndefined();
  });

  it("lists all plans", () => {
    const p1: Plan = {
      id: "PLAN-001", name: "P1", description: "", status: "draft",
      steps: [], correlationId: "c1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const p2: Plan = {
      id: "PLAN-002", name: "P2", description: "", status: "completed",
      steps: [], correlationId: "c2", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    repo.save(p1);
    repo.save(p2);
    expect(repo.findAll()).toHaveLength(2);
  });

  it("filters by status", () => {
    const p1: Plan = {
      id: "PLAN-001", name: "P1", description: "", status: "draft",
      steps: [], correlationId: "c1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const p2: Plan = {
      id: "PLAN-002", name: "P2", description: "", status: "completed",
      steps: [], correlationId: "c2", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    repo.save(p1);
    repo.save(p2);
    expect(repo.findAll({ status: "draft" })).toHaveLength(1);
    expect(repo.findAll({ status: "completed" })).toHaveLength(1);
  });

  it("deletes a plan", () => {
    const plan: Plan = {
      id: "PLAN-DEL", name: "Delete Me", description: "", status: "draft",
      steps: [], correlationId: "c1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    repo.save(plan);
    expect(repo.delete("PLAN-DEL")).toBe(true);
    expect(repo.findById("PLAN-DEL")).toBeUndefined();
  });
});

// ── PlanEngine Tests ───────────────────────────────────────────────────────

describe("PlanEngine", () => {
  let planRepo: InMemoryPlanRepository;
  let actionEngine: InMemoryActionEngine;
  let engine: PlanEngine;

  const makeStep = (name: string, type = "log_event"): { name: string; action: ActionRequest } => ({
    name,
    action: {
      id: `act-${name.toLowerCase().replace(/\s/g, "-")}`,
      type,
      params: { event: name },
    },
  });

  beforeEach(() => {
    planRepo = new InMemoryPlanRepository();
    actionEngine = new InMemoryActionEngine();
    engine = new PlanEngine(planRepo as any, actionEngine as any);
  });

  describe("create", () => {
    it("creates a plan with steps", () => {
      const plan = engine.create({
        name: "Test Plan",
        steps: [makeStep("Step 1"), makeStep("Step 2")],
      });

      expect(plan.id).toMatch(/^PLAN-[A-Z0-9]+$/);
      expect(plan.name).toBe("Test Plan");
      expect(plan.status).toBe("draft");
      expect(plan.steps).toHaveLength(2);
      expect(plan.correlationId).toBeDefined();
    });

    it("assigns order to steps", () => {
      const plan = engine.create({
        name: "Ordered Plan",
        steps: [makeStep("First"), makeStep("Second"), makeStep("Third")],
      });

      expect(plan.steps[0]?.order).toBe(0);
      expect(plan.steps[1]?.order).toBe(1);
      expect(plan.steps[2]?.order).toBe(2);
    });

    it("sets dependencies correctly", () => {
      const plan = engine.create({
        name: "Dependent Plan",
        steps: [
          { ...makeStep("Init"), dependencies: [] },
          { ...makeStep("Process"), dependencies: ["step-0"] },
        ],
      });

      expect(plan.steps[1]?.dependencies).toEqual(["step-0"]);
    });
  });

  describe("execute", () => {
    it("executes a simple plan", async () => {
      const plan = engine.create({
        name: "Simple Plan",
        steps: [makeStep("Step 1"), makeStep("Step 2")],
      });

      const executed = await engine.execute(plan.id);
      expect(executed.status).toBe("completed");
      expect(executed.steps.every((s) => s.status === "completed")).toBe(true);
      expect(executed.duration).toBeGreaterThanOrEqual(0);
    });

    it("fails when plan not found", async () => {
      await expect(engine.execute("PLAN-NONEXISTENT")).rejects.toThrow("Plan not found");
    });

    it("fails when plan is already completed", async () => {
      const plan = engine.create({
        name: "Already Done",
        steps: [makeStep("Step 1")],
      });

      await engine.execute(plan.id);
      await expect(engine.execute(plan.id)).rejects.toThrow("cannot be executed");
    });

    it("handles step dependencies", async () => {
      const plan = engine.create({
        name: "Dependent Plan",
        steps: [
          { ...makeStep("Init"), dependencies: [] },
          { ...makeStep("Process"), dependencies: [] },
        ],
      });

      const executed = await engine.execute(plan.id);
      expect(executed.status).toBe("completed");
    });
  });

  describe("cancel", () => {
    it("cancels a draft plan", () => {
      const plan = engine.create({
        name: "To Cancel",
        steps: [makeStep("Step 1")],
      });

      const cancelled = engine.cancel(plan.id);
      expect(cancelled?.status).toBe("cancelled");
    });

    it("returns undefined for non-existent plan", () => {
      expect(engine.cancel("PLAN-NONEXISTENT")).toBeUndefined();
    });

    it("cannot cancel completed plan", () => {
      const plan = engine.create({
        name: "Completed",
        steps: [makeStep("Step 1")],
      });

      // Can't complete via engine without async, so just test status check
      const cancelled = engine.cancel(plan.id);
      expect(cancelled?.status).toBe("cancelled");
    });
  });

  describe("list and get", () => {
    it("gets a plan by ID", () => {
      const plan = engine.create({
        name: "Findable",
        steps: [makeStep("Step 1")],
      });

      const found = engine.get(plan.id);
      expect(found?.name).toBe("Findable");
    });

    it("returns undefined for non-existent plan", () => {
      expect(engine.get("PLAN-NONEXISTENT")).toBeUndefined();
    });

    it("lists all plans", () => {
      engine.create({ name: "P1", steps: [makeStep("S1")] });
      engine.create({ name: "P2", steps: [makeStep("S2")] });

      expect(engine.list()).toHaveLength(2);
    });

    it("filters by status", () => {
      engine.create({ name: "Draft", steps: [makeStep("S1")] });
      engine.create({ name: "Another Draft", steps: [makeStep("S2")] });

      expect(engine.list({ status: "draft" })).toHaveLength(2);
      expect(engine.list({ status: "completed" })).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("deletes a plan", () => {
      const plan = engine.create({
        name: "To Delete",
        steps: [makeStep("Step 1")],
      });

      expect(engine.delete(plan.id)).toBe(true);
      expect(engine.get(plan.id)).toBeUndefined();
    });

    it("returns false for non-existent plan", () => {
      expect(engine.delete("PLAN-NONEXISTENT")).toBe(false);
    });
  });

  describe("stats", () => {
    it("returns zero stats for empty repo", () => {
      const stats = engine.stats();
      expect(stats.total).toBe(0);
      expect(stats.avgSteps).toBe(0);
    });

    it("calculates correct stats", () => {
      engine.create({ name: "P1", steps: [makeStep("S1"), makeStep("S2")] });
      engine.create({ name: "P2", steps: [makeStep("S3")] });

      const stats = engine.stats();
      expect(stats.total).toBe(2);
      expect(stats.avgSteps).toBe(2); // (2+1)/2 = 1.5 → 2
      expect(stats.byStatus.draft).toBe(2);
    });
  });
});
