/**
 * goal-engine.test.ts — Tests for Goal Engine
 *
 * Validates goal CRUD operations, lifecycle transitions, filtering,
 * and statistics.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  GoalEngine,
  FileGoalRepository,
  type Goal,
  type GoalRepository,
  type GoalFilter,
} from "../prioritization/goals.js";

// ── In-Memory Repository (for fast unit tests) ─────────────────────────────

class InMemoryGoalRepository implements GoalRepository {
  private goals = new Map<string, Goal>();

  save(goal: Goal): void {
    this.goals.set(goal.id, { ...goal });
  }

  findById(id: string): Goal | undefined {
    const goal = this.goals.get(id);
    return goal ? { ...goal } : undefined;
  }

  findAll(filter?: GoalFilter): Goal[] {
    let goals = Array.from(this.goals.values());
    if (filter) {
      goals = goals.filter((g) => {
        if (filter.status && g.status !== filter.status) return false;
        if (filter.priority && g.priority !== filter.priority) return false;
        if (filter.target && !g.targets.includes(filter.target)) return false;
        if (filter.tag && !g.tags.includes(filter.tag)) return false;
        return true;
      });
    }
    return goals;
  }

  delete(id: string): boolean {
    return this.goals.delete(id);
  }

  count(filter?: GoalFilter): number {
    return this.findAll(filter).length;
  }
}

// ── File Repository Tests ──────────────────────────────────────────────────

describe("FileGoalRepository", () => {
  let tmpDir: string;
  let shitennoDir: string;
  let repo: FileGoalRepository;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-goal-repo-test-${Date.now()}`);
    shitennoDir = join(tmpDir, "shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    repo = new FileGoalRepository(shitennoDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a goal", () => {
    const goal: Goal = {
      id: "GOAL-TEST-001",
      title: "Test Goal",
      description: "A test goal",
      status: "draft",
      priority: "medium",
      targets: [],
      criteria: [],
      progress: 0,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repo.save(goal);
    const loaded = repo.findById("GOAL-TEST-001");
    expect(loaded).toBeDefined();
    expect(loaded?.title).toBe("Test Goal");
  });

  it("returns undefined for non-existent goal", () => {
    expect(repo.findById("GOAL-NONEXISTENT")).toBeUndefined();
  });

  it("lists all goals", () => {
    const goal1: Goal = {
      id: "GOAL-001", title: "Goal 1", description: "", status: "draft",
      priority: "low", targets: [], criteria: [], progress: 0, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const goal2: Goal = {
      id: "GOAL-002", title: "Goal 2", description: "", status: "active",
      priority: "high", targets: [], criteria: [], progress: 50, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    repo.save(goal1);
    repo.save(goal2);
    expect(repo.findAll()).toHaveLength(2);
  });

  it("filters by status", () => {
    const goal1: Goal = {
      id: "GOAL-001", title: "Goal 1", description: "", status: "draft",
      priority: "low", targets: [], criteria: [], progress: 0, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const goal2: Goal = {
      id: "GOAL-002", title: "Goal 2", description: "", status: "active",
      priority: "high", targets: [], criteria: [], progress: 50, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    repo.save(goal1);
    repo.save(goal2);

    const drafts = repo.findAll({ status: "draft" });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.id).toBe("GOAL-001");
  });

  it("deletes a goal", () => {
    const goal: Goal = {
      id: "GOAL-DEL", title: "Delete Me", description: "", status: "draft",
      priority: "low", targets: [], criteria: [], progress: 0, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    repo.save(goal);
    expect(repo.findById("GOAL-DEL")).toBeDefined();
    expect(repo.delete("GOAL-DEL")).toBe(true);
    expect(repo.findById("GOAL-DEL")).toBeUndefined();
  });

  it("returns false when deleting non-existent goal", () => {
    expect(repo.delete("GOAL-NONEXISTENT")).toBe(false);
  });
});

// ── GoalEngine Tests ───────────────────────────────────────────────────────

describe("GoalEngine", () => {
  let repo: InMemoryGoalRepository;
  let engine: GoalEngine;

  beforeEach(() => {
    repo = new InMemoryGoalRepository();
    engine = new GoalEngine(repo);
  });

  describe("create", () => {
    it("creates a goal with defaults", () => {
      const goal = engine.create({ title: "My Goal" });
      expect(goal.id).toMatch(/^GOAL-[A-Z0-9]+$/);
      expect(goal.title).toBe("My Goal");
      expect(goal.status).toBe("draft");
      expect(goal.priority).toBe("medium");
      expect(goal.progress).toBe(0);
      expect(goal.targets).toEqual([]);
      expect(goal.criteria).toEqual([]);
    });

    it("creates a goal with custom fields", () => {
      const goal = engine.create({
        title: "Critical Goal",
        description: "Very important",
        priority: "critical",
        targets: ["quality", "security"],
        criteria: ["90% coverage", "0 critical vulns"],
        tags: ["urgent"],
      });
      expect(goal.priority).toBe("critical");
      expect(goal.targets).toEqual(["quality", "security"]);
      expect(goal.criteria).toEqual(["90% coverage", "0 critical vulns"]);
      expect(goal.tags).toEqual(["urgent"]);
    });

    it("persists to repository", () => {
      const goal = engine.create({ title: "Persisted" });
      const loaded = repo.findById(goal.id);
      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe("Persisted");
    });
  });

  describe("activate", () => {
    it("activates a draft goal", () => {
      const goal = engine.create({ title: "To Activate" });
      const activated = engine.activate(goal.id);
      expect(activated?.status).toBe("active");
    });

    it("rejects activation of non-draft goal", () => {
      const goal = engine.create({ title: "Active Goal" });
      engine.activate(goal.id);
      const result = engine.activate(goal.id);
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-existent goal", () => {
      expect(engine.activate("GOAL-NONEXISTENT")).toBeUndefined();
    });
  });

  describe("updateProgress", () => {
    it("updates progress", () => {
      const goal = engine.create({ title: "Progress Goal" });
      engine.activate(goal.id);
      const updated = engine.updateProgress(goal.id, 50);
      expect(updated?.progress).toBe(50);
    });

    it("clamps progress to 0-100", () => {
      const goal = engine.create({ title: "Clamp Goal" });
      engine.activate(goal.id);
      expect(engine.updateProgress(goal.id, -10)?.progress).toBe(0);
      expect(engine.updateProgress(goal.id, 150)?.progress).toBe(100);
    });

    it("auto-completes at 100%", () => {
      const goal = engine.create({ title: "Auto Complete" });
      engine.activate(goal.id);
      const completed = engine.updateProgress(goal.id, 100);
      expect(completed?.status).toBe("completed");
      expect(completed?.completedAt).toBeDefined();
    });

    it("returns undefined for non-existent goal", () => {
      expect(engine.updateProgress("GOAL-NONEXISTENT", 50)).toBeUndefined();
    });
  });

  describe("complete", () => {
    it("completes an active goal", () => {
      const goal = engine.create({ title: "To Complete" });
      engine.activate(goal.id);
      const completed = engine.complete(goal.id);
      expect(completed?.status).toBe("completed");
      expect(completed?.progress).toBe(100);
      expect(completed?.completedAt).toBeDefined();
    });

    it("rejects completion of non-active goal", () => {
      const goal = engine.create({ title: "Draft Goal" });
      const result = engine.complete(goal.id);
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-existent goal", () => {
      expect(engine.complete("GOAL-NONEXISTENT")).toBeUndefined();
    });
  });

  describe("abandon", () => {
    it("abandons a draft goal", () => {
      const goal = engine.create({ title: "To Abandon" });
      const abandoned = engine.abandon(goal.id);
      expect(abandoned?.status).toBe("abandoned");
    });

    it("abandons an active goal", () => {
      const goal = engine.create({ title: "Active to Abandon" });
      engine.activate(goal.id);
      const abandoned = engine.abandon(goal.id);
      expect(abandoned?.status).toBe("abandoned");
    });

    it("rejects abandonment of completed goal", () => {
      const goal = engine.create({ title: "Completed" });
      engine.activate(goal.id);
      engine.complete(goal.id);
      const result = engine.abandon(goal.id);
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-existent goal", () => {
      expect(engine.abandon("GOAL-NONEXISTENT")).toBeUndefined();
    });
  });

  describe("list and get", () => {
    it("gets a goal by ID", () => {
      const goal = engine.create({ title: "Findable" });
      const found = engine.get(goal.id);
      expect(found?.title).toBe("Findable");
    });

    it("returns undefined for non-existent goal", () => {
      expect(engine.get("GOAL-NONEXISTENT")).toBeUndefined();
    });

    it("lists all goals", () => {
      engine.create({ title: "Goal 1" });
      engine.create({ title: "Goal 2" });
      expect(engine.list()).toHaveLength(2);
    });

    it("filters by status", () => {

      engine.create({ title: "Another Draft" });
      const g2 = engine.create({ title: "To Activate" });
      engine.activate(g2.id);

      const drafts = engine.list({ status: "draft" });
      expect(drafts).toHaveLength(1);
      const actives = engine.list({ status: "active" });
      expect(actives).toHaveLength(1);
    });

    it("filters by priority", () => {
      engine.create({ title: "Low", priority: "low" });
      engine.create({ title: "High", priority: "high" });

      expect(engine.list({ priority: "low" })).toHaveLength(1);
      expect(engine.list({ priority: "high" })).toHaveLength(1);
      expect(engine.list({ priority: "critical" })).toHaveLength(0);
    });

    it("filters by target", () => {
      engine.create({ title: "Quality", targets: ["quality"] });
      engine.create({ title: "Security", targets: ["security"] });

      expect(engine.list({ target: "quality" })).toHaveLength(1);
      expect(engine.list({ target: "security" })).toHaveLength(1);
    });

    it("filters by tag", () => {
      engine.create({ title: "Urgent", tags: ["urgent"] });
      engine.create({ title: "Later", tags: ["later"] });

      expect(engine.list({ tag: "urgent" })).toHaveLength(1);
      expect(engine.list({ tag: "later" })).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("deletes a goal", () => {
      const goal = engine.create({ title: "To Delete" });
      expect(engine.delete(goal.id)).toBe(true);
      expect(engine.get(goal.id)).toBeUndefined();
    });

    it("returns false for non-existent goal", () => {
      expect(engine.delete("GOAL-NONEXISTENT")).toBe(false);
    });
  });

  describe("stats", () => {
    it("returns zero stats for empty repo", () => {
      const stats = engine.stats();
      expect(stats.total).toBe(0);
      expect(stats.avgProgress).toBe(0);
    });

    it("calculates correct stats", () => {
      engine.create({ title: "Draft", priority: "low" });
      const g2 = engine.create({ title: "Active", priority: "high" });
      engine.activate(g2.id);
      engine.updateProgress(g2.id, 60);
      const g3 = engine.create({ title: "Done", priority: "critical" });
      engine.activate(g3.id);
      engine.complete(g3.id);

      const stats = engine.stats();
      expect(stats.total).toBe(3);
      expect(stats.byStatus.draft).toBe(1);
      expect(stats.byStatus.active).toBe(1);
      expect(stats.byStatus.completed).toBe(1);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.critical).toBe(1);
      expect(stats.avgProgress).toBeGreaterThan(0);
    });
  });
});
