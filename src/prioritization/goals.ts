/**
 * goal-engine.ts — Goal Repository + Engine
 *
 * Provides persistence and business logic for governance goals.
 * Goals represent target states the project should achieve.
 *
 * Architecture: GoalRepository (interface) → FileGoalRepository (JSON) → GoalEngine (logic)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export type GoalStatus = "draft" | "active" | "completed" | "abandoned";
export type GoalPriority = "low" | "medium" | "high" | "critical";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  /** Capabilities this goal targets. */
  targets: string[];
  /** Measurement criteria — how to know the goal is achieved. */
  criteria: string[];
  /** Progress percentage (0-100). */
  progress: number;
  /** Optional: parent goal ID for hierarchical goals. */
  parentId?: string;
  /** Tags for filtering. */
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp of completion (if completed). */
  completedAt?: string;
}

export interface GoalFilter {
  status?: GoalStatus;
  priority?: GoalPriority;
  target?: string;
  tag?: string;
}

// ── Repository Interface ───────────────────────────────────────────────────

export interface GoalRepository {
  /** Save a goal (create or update). */
  save(goal: Goal): void;
  /** Find a goal by ID. */
  findById(id: string): Goal | undefined;
  /** List all goals, optionally filtered. */
  findAll(filter?: GoalFilter): Goal[];
  /** Delete a goal by ID. */
  delete(id: string): boolean;
  /** Count goals matching a filter. */
  count(filter?: GoalFilter): number;
}

// ── File Repository ────────────────────────────────────────────────────────

const GOALS_DIR = "governance/goals";

export class FileGoalRepository implements GoalRepository {
  private dir: string;

  constructor(shitennoDir: string) {
    this.dir = join(shitennoDir, GOALS_DIR);
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(goal: Goal): void {
    const filepath = join(this.dir, `${goal.id}.json`);
    writeFileSync(filepath, JSON.stringify(goal, null, 2), "utf-8");
  }

  findById(id: string): Goal | undefined {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      return JSON.parse(readFileSync(filepath, "utf-8")) as Goal;
    } catch {
      return undefined;
    }
  }

  findAll(filter?: GoalFilter): Goal[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const goals: Goal[] = [];

    for (const file of files) {
      try {
        const goal = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as Goal;
        if (this.matchesFilter(goal, filter)) {
          goals.push(goal);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return goals;
  }

  delete(id: string): boolean {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return false;
    try {
      unlinkSync(filepath);
      return true;
    } catch {
      return false;
    }
  }

  count(filter?: GoalFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(goal: Goal, filter?: GoalFilter): boolean {
    if (!filter) return true;
    if (filter.status && goal.status !== filter.status) return false;
    if (filter.priority && goal.priority !== filter.priority) return false;
    if (filter.target && !goal.targets.includes(filter.target)) return false;
    if (filter.tag && !goal.tags.includes(filter.tag)) return false;
    return true;
  }
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class GoalEngine {
  constructor(private repo: GoalRepository) {}

  /** Create a new goal. */
  create(input: {
    title: string;
    description?: string;
    priority?: GoalPriority;
    targets?: string[];
    criteria?: string[];
    tags?: string[];
    parentId?: string;
  }): Goal {
    const now = new Date().toISOString();
    const goal: Goal = {
      id: `GOAL-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: input.title,
      description: input.description ?? "",
      status: "draft",
      priority: input.priority ?? "medium",
      targets: input.targets ?? [],
      criteria: input.criteria ?? [],
      progress: 0,
      parentId: input.parentId,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.repo.save(goal);
    return goal;
  }

  /** Activate a goal (draft → active). */
  activate(id: string): Goal | undefined {
    const goal = this.repo.findById(id);
    if (!goal) return undefined;
    if (goal.status !== "draft") return undefined;

    goal.status = "active";
    goal.updatedAt = new Date().toISOString();
    this.repo.save(goal);
    return goal;
  }

  /** Update goal progress (0-100). */
  updateProgress(id: string, progress: number): Goal | undefined {
    const goal = this.repo.findById(id);
    if (!goal) return undefined;

    goal.progress = Math.max(0, Math.min(100, progress));
    goal.updatedAt = new Date().toISOString();

    if (goal.progress === 100 && goal.status === "active") {
      goal.status = "completed";
      goal.completedAt = new Date().toISOString();
    }

    this.repo.save(goal);
    return goal;
  }

  /** Complete a goal (active → completed). */
  complete(id: string): Goal | undefined {
    const goal = this.repo.findById(id);
    if (!goal) return undefined;
    if (goal.status !== "active") return undefined;

    goal.status = "completed";
    goal.progress = 100;
    goal.completedAt = new Date().toISOString();
    goal.updatedAt = new Date().toISOString();
    this.repo.save(goal);
    return goal;
  }

  /** Abandon a goal. */
  abandon(id: string): Goal | undefined {
    const goal = this.repo.findById(id);
    if (!goal) return undefined;
    if (goal.status === "completed") return undefined;

    goal.status = "abandoned";
    goal.updatedAt = new Date().toISOString();
    this.repo.save(goal);
    return goal;
  }

  /** Get a goal by ID. */
  get(id: string): Goal | undefined {
    return this.repo.findById(id);
  }

  /** List goals with optional filter. */
  list(filter?: GoalFilter): Goal[] {
    return this.repo.findAll(filter);
  }

  /** Delete a goal. */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /** Get summary statistics. */
  stats(): {
    total: number;
    byStatus: Record<GoalStatus, number>;
    byPriority: Record<GoalPriority, number>;
    avgProgress: number;
  } {
    const all = this.repo.findAll();
    const byStatus: Record<GoalStatus, number> = { draft: 0, active: 0, completed: 0, abandoned: 0 };
    const byPriority: Record<GoalPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    let totalProgress = 0;

    for (const g of all) {
      byStatus[g.status]++;
      byPriority[g.priority]++;
      totalProgress += g.progress;
    }

    return {
      total: all.length,
      byStatus,
      byPriority,
      avgProgress: all.length > 0 ? Math.round(totalProgress / all.length) : 0,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let defaultEngine: GoalEngine | null = null;

export function getGoalEngine(shitennoDir: string): GoalEngine {
  if (!defaultEngine) {
    defaultEngine = new GoalEngine(new FileGoalRepository(shitennoDir));
  }
  return defaultEngine;
}

export function resetGoalEngine(): void {
  defaultEngine = null;
}
