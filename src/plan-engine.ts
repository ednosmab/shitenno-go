/**
 * plan-engine.ts — Plan Engine
 *
 * Manages coordinated sequences of actions (plans).
 * Plans have ordered steps with dependencies, rollback support, and observability.
 *
 * Architecture: Plan → PlanStep[] → ActionEngine → Execution Records
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ActionEngine, type ActionRequest, type ExecutionRecord } from "./action-engine.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type PlanStatus = "draft" | "running" | "completed" | "failed" | "rolled_back" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "rolled_back";

export interface PlanStep {
  /** Unique step ID within the plan. */
  id: string;
  /** Human-readable step name. */
  name: string;
  /** Action request to execute. */
  action: ActionRequest;
  /** Step order (0-indexed). */
  order: number;
  /** Step IDs that must complete before this step runs. */
  dependencies: string[];
  /** Whether this step is optional (won't fail the plan if it fails). */
  optional: boolean;
  /** Current status. */
  status: StepStatus;
  /** Execution record ID after execution. */
  executionId?: string;
  /** Error message if failed. */
  error?: string;
}

export interface Plan {
  /** Unique plan ID. */
  id: string;
  /** Human-readable plan name. */
  name: string;
  /** Plan description. */
  description: string;
  /** Current plan status. */
  status: PlanStatus;
  /** Ordered steps. */
  steps: PlanStep[];
  /** Correlation ID linking all actions. */
  correlationId: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** ISO timestamp of completion. */
  completedAt?: string;
  /** Total duration in milliseconds. */
  duration?: number;
}

export interface PlanFilter {
  status?: PlanStatus;
}

// ── Repository ─────────────────────────────────────────────────────────────

export interface PlanRepository {
  save(plan: Plan): void;
  findById(id: string): Plan | undefined;
  findAll(filter?: PlanFilter): Plan[];
  delete(id: string): boolean;
  count(filter?: PlanFilter): number;
}

export class FilePlanRepository implements PlanRepository {
  private dir: string;

  constructor(nexusDir: string) {
    this.dir = join(nexusDir, "governance", "plans");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(plan: Plan): void {
    const filepath = join(this.dir, `${plan.id}.json`);
    writeFileSync(filepath, JSON.stringify(plan, null, 2), "utf-8");
  }

  findById(id: string): Plan | undefined {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      return JSON.parse(readFileSync(filepath, "utf-8")) as Plan;
    } catch {
      return undefined;
    }
  }

  findAll(filter?: PlanFilter): Plan[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const plans: Plan[] = [];

    for (const file of files) {
      try {
        const plan = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as Plan;
        if (!filter || plan.status === filter.status) {
          plans.push(plan);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return plans;
  }

  delete(id: string): boolean {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return false;
    try {
      const { unlinkSync } = require("node:fs");
      unlinkSync(filepath);
      return true;
    } catch {
      return false;
    }
  }

  count(filter?: PlanFilter): number {
    return this.findAll(filter).length;
  }
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class PlanEngine {
  constructor(
    private repo: PlanRepository,
    private actionEngine: ActionEngine
  ) {}

  /** Create a new plan. */
  create(input: {
    name: string;
    description?: string;
    steps: Array<{
      name: string;
      action: ActionRequest;
      dependencies?: string[];
      optional?: boolean;
    }>;
  }): Plan {
    const correlationId = `plan-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const steps: PlanStep[] = input.steps.map((s, i) => ({
      id: `STEP-${randomUUID().slice(0, 6).toUpperCase()}`,
      name: s.name,
      action: { ...s.action, correlationId },
      order: i,
      dependencies: s.dependencies ?? [],
      optional: s.optional ?? false,
      status: "pending" as StepStatus,
    }));

    const plan: Plan = {
      id: `PLAN-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: input.name,
      description: input.description ?? "",
      status: "draft",
      steps,
      correlationId,
      createdAt: now,
      updatedAt: now,
    };

    this.repo.save(plan);
    return plan;
  }

  /** Execute a plan sequentially (respecting dependencies). */
  async execute(planId: string): Promise<Plan> {
    const plan = this.repo.findById(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);
    if (plan.status !== "draft" && plan.status !== "failed") {
      throw new Error(`Plan cannot be executed in status: ${plan.status}`);
    }

    plan.status = "running";
    plan.updatedAt = new Date().toISOString();
    this.repo.save(plan);

    const startTime = Date.now();

    // Sort steps by order
    const sortedSteps = [...plan.steps].sort((a, b) => a.order - b.order);

    for (const step of sortedSteps) {
      // Check dependencies
      const depsMet = step.dependencies.every((depId) => {
        const depStep = plan.steps.find((s) => s.id === depId);
        return depStep?.status === "completed";
      });

      if (!depsMet) {
        step.status = step.optional ? "skipped" : "failed";
        step.error = "Dependencies not met";
        if (!step.optional) {
          plan.status = "failed";
          plan.completedAt = new Date().toISOString();
          plan.duration = Date.now() - startTime;
          plan.updatedAt = new Date().toISOString();
          this.repo.save(plan);
          return plan;
        }
        continue;
      }

      step.status = "running";
      plan.updatedAt = new Date().toISOString();
      this.repo.save(plan);

      try {
        const execution = await this.actionEngine.execute(step.action);
        step.executionId = execution.executionId;

        if (execution.status === "completed") {
          step.status = "completed";
        } else {
          step.status = "failed";
          step.error = execution.error ?? "Execution failed";
          if (!step.optional) {
            plan.status = "failed";
            plan.completedAt = new Date().toISOString();
            plan.duration = Date.now() - startTime;
            plan.updatedAt = new Date().toISOString();
            this.repo.save(plan);
            return plan;
          }
        }
      } catch (error) {
        step.status = "failed";
        step.error = error instanceof Error ? error.message : String(error);
        if (!step.optional) {
          plan.status = "failed";
          plan.completedAt = new Date().toISOString();
          plan.duration = Date.now() - startTime;
          plan.updatedAt = new Date().toISOString();
          this.repo.save(plan);
          return plan;
        }
      }

      plan.updatedAt = new Date().toISOString();
      this.repo.save(plan);
    }

    plan.status = "completed";
    plan.completedAt = new Date().toISOString();
    plan.duration = Date.now() - startTime;
    plan.updatedAt = new Date().toISOString();
    this.repo.save(plan);

    return plan;
  }

  /** Rollback a plan (rollback completed steps in reverse order). */
  async rollback(planId: string): Promise<Plan | undefined> {
    const plan = this.repo.findById(planId);
    if (!plan) return undefined;
    if (plan.status !== "completed" && plan.status !== "failed") return undefined;

    plan.status = "rolling_back" as PlanStatus;
    plan.updatedAt = new Date().toISOString();
    this.repo.save(plan);

    // Rollback completed steps in reverse order
    const completedSteps = plan.steps
      .filter((s) => s.status === "completed" && s.executionId)
      .sort((a, b) => b.order - a.order);

    for (const step of completedSteps) {
      try {
        await this.actionEngine.rollback(step.executionId!);
        step.status = "rolled_back";
      } catch {
        // Continue rollback even if one step fails
      }
    }

    plan.status = "rolled_back";
    plan.updatedAt = new Date().toISOString();
    this.repo.save(plan);

    return plan;
  }

  /** Cancel a plan. */
  cancel(planId: string): Plan | undefined {
    const plan = this.repo.findById(planId);
    if (!plan) return undefined;
    if (plan.status === "completed" || plan.status === "rolled_back") return undefined;

    plan.status = "cancelled";
    plan.updatedAt = new Date().toISOString();
    this.repo.save(plan);

    return plan;
  }

  /** Get a plan by ID. */
  get(id: string): Plan | undefined {
    return this.repo.findById(id);
  }

  /** List plans. */
  list(filter?: PlanFilter): Plan[] {
    return this.repo.findAll(filter);
  }

  /** Delete a plan. */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /** Get plan statistics. */
  stats(): {
    total: number;
    byStatus: Record<PlanStatus, number>;
    avgSteps: number;
    avgDuration: number;
  } {
    const all = this.repo.findAll();
    const byStatus: Record<PlanStatus, number> = {
      draft: 0, running: 0, completed: 0, failed: 0, rolled_back: 0, cancelled: 0,
    };
    let totalSteps = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const p of all) {
      byStatus[p.status]++;
      totalSteps += p.steps.length;
      if (p.duration) {
        totalDuration += p.duration;
        durationCount++;
      }
    }

    return {
      total: all.length,
      byStatus,
      avgSteps: all.length > 0 ? Math.round(totalSteps / all.length) : 0,
      avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    };
  }
}
