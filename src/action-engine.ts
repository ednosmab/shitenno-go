/**
 * action-engine.ts — Idempotent Action Engine
 *
 * Executes actions with idempotency guarantees via Action ID + Correlation ID + Execution Hash.
 * Supports rollback, status tracking, and action executors.
 *
 * Architecture: Action (request) → Executor → Execution Record → Rollback
 */

import { randomUUID, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";
import { safeJsonParseValidated } from "./validation.js";
import { checkPolicyGate } from "./decision-core/policy-gate.js";
import { getResourceId } from "./decision-core/precedence.js";
import { claimResource, releaseResource } from "./resource-claims.js";
import { PolicyEngine, FilePolicyRepository } from "./rule-engine/index.js";
import type { RuleAction, RuleContext } from "./domain/rules/rule.js";
import { RunScriptExecutor, CreateReminderExecutor } from "./decision-core/executors/index.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type ActionStatus = "pending" | "running" | "completed" | "failed" | "rolled_back";
export type ActionResult = "success" | "failure" | "skipped" | "rolled_back";

export interface ActionRequest {
  /** Unique action ID (for idempotency). */
  id: string;
  /** Action type (maps to an executor). */
  type: string;
  /** Parameters for the executor. */
  params: Record<string, unknown>;
  /** Correlation ID linking related actions. */
  correlationId?: string;
  /** Optional: parent action ID for dependency chains. */
  parentId?: string;
  /** Timeout in milliseconds (default: 30000). */
  timeout?: number;
}

export interface ExecutionRecord {
  /** Unique execution ID. */
  executionId: string;
  /** Original action request. */
  request: ActionRequest;
  /** Execution hash (SHA-256 of type + params) for idempotency check. */
  executionHash: string;
  /** Current status. */
  status: ActionStatus;
  /** Result when completed. */
  result?: ActionResult;
  /** Output data from executor. */
  output?: Record<string, unknown>;
  /** Error message if failed. */
  error?: string;
  /** ISO timestamp of execution start. */
  startedAt: string;
  /** ISO timestamp of completion. */
  completedAt?: string;
  /** Duration in milliseconds. */
  duration?: number;
  /** Rollback record if rolled back. */
  rollback?: RollbackRecord;
}

export interface RollbackRecord {
  /** Rollback execution ID. */
  rollbackId: string;
  /** Status of rollback. */
  status: ActionStatus;
  /** Error if rollback failed. */
  error?: string;
  /** ISO timestamp. */
  timestamp: string;
}

export interface ActionFilter {
  status?: ActionStatus;
  type?: string;
  correlationId?: string;
}

// ── Executor Interface ─────────────────────────────────────────────────────

export interface ActionExecutor {
  /** Executor name (matches action type). */
  name: string;
  /** Execute the action. Returns output data. */
  execute(
    params: Record<string, unknown>,
    context: { projectRoot: string; shitennoDir: string }
  ): Promise<Record<string, unknown>>;
  /** Rollback the action (optional). */
  rollback?(params: Record<string, unknown>, output: Record<string, unknown>): Promise<void>;
}

// ── Built-in Executors ─────────────────────────────────────────────────────

/**
 * LogEventExecutor — Logs an event to history.
 */
export class LogEventExecutor implements ActionExecutor {
  name = "log_event";

  async execute(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const event = params.event as string ?? "unknown";
    const message = params.message as string ?? "";
    logger.info("action-engine", `[Event] ${event}: ${message}`);
    return { logged: true, event, message };
  }
}

/**
 * NotifyExecutor — Sends a notification (console output for now).
 */
export class NotifyExecutor implements ActionExecutor {
  name = "notify";

  async execute(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const message = params.message as string ?? "Notification";
    const level = params.level as string ?? "info";
    logger.info("action-engine", `[${level.toUpperCase()}] ${message}`);
    return { notified: true, message, level };
  }
}

// ── Hash Utility ───────────────────────────────────────────────────────────

/**
 * Compute execution hash for idempotency check.
 * SHA-256 of action type + params (sorted keys for consistency).
 */
export function computeExecutionHash(type: string, params: Record<string, unknown>): string {
  const sortedParams: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    sortedParams[key] = params[key];
  }
  const payload = JSON.stringify({ type, params: sortedParams });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ── Repository ─────────────────────────────────────────────────────────────

export interface ExecutionRepository {
  save(record: ExecutionRecord): void;
  findById(executionId: string): ExecutionRecord | undefined;
  findByActionId(actionId: string): ExecutionRecord | undefined;
  findByHash(hash: string): ExecutionRecord | undefined;
  findAll(filter?: ActionFilter): ExecutionRecord[];
  count(filter?: ActionFilter): number;
}

export class FileExecutionRepository implements ExecutionRepository {
  private dir: string;

  constructor(shitennoDir: string) {
    this.dir = join(shitennoDir, "governance", "executions");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(record: ExecutionRecord): void {
    const filepath = join(this.dir, `${record.executionId}.json`);
    writeFileSync(filepath, JSON.stringify(record, null, 2), "utf-8");
  }

  findById(executionId: string): ExecutionRecord | undefined {
    const filepath = join(this.dir, `${executionId}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      const raw = readFileSync(filepath, "utf-8");
      return safeJsonParseValidated(
        raw,
        (v: unknown): v is ExecutionRecord => typeof v === "object" && v !== null && "executionId" in v && "request" in v && "status" in v,
        "action-engine:findById"
      ) ?? undefined;
    } catch {
      return undefined;
    }
  }

  findByActionId(actionId: string): ExecutionRecord | undefined {
    const all = this.findAll();
    return all.find((r) => r.request.id === actionId);
  }

  findByHash(hash: string): ExecutionRecord | undefined {
    const all = this.findAll();
    return all.find((r) => r.executionHash === hash);
  }

  findAll(filter?: ActionFilter): ExecutionRecord[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const records: ExecutionRecord[] = [];

    for (const file of files) {
      try {
        const raw = readFileSync(join(this.dir, file), "utf-8");
        const record = safeJsonParseValidated(
          raw,
          (v: unknown): v is ExecutionRecord => typeof v === "object" && v !== null && "executionId" in v && "request" in v && "status" in v,
          `action-engine:findAll:${file}`
        );
        if (record && this.matchesFilter(record, filter)) {
          records.push(record);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return records;
  }

  count(filter?: ActionFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(record: ExecutionRecord, filter?: ActionFilter): boolean {
    if (!filter) return true;
    if (filter.status && record.status !== filter.status) return false;
    if (filter.type && record.request.type !== filter.type) return false;
    if (filter.correlationId && record.request.correlationId !== filter.correlationId) return false;
    return true;
  }
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class ActionEngine {
  private executors = new Map<string, ActionExecutor>();
  private shitennoDir: string;

  constructor(private repo: ExecutionRepository, shitennoDir?: string) {
    this.shitennoDir = shitennoDir ?? "";
    // Register built-in executors (real implementations from decision-core)
    this.registerExecutor(new LogEventExecutor());
    this.registerExecutor(new NotifyExecutor());
    this.registerExecutor(new CreateReminderExecutor());
    this.registerExecutor(new RunScriptExecutor());
  }

  /** Register an action executor. */
  registerExecutor(executor: ActionExecutor): void {
    this.executors.set(executor.name, executor);
  }

  private findIdempotentMatch(request: ActionRequest, executionHash: string): ExecutionRecord | undefined {
    const existing = this.repo.findByActionId(request.id);
    if (existing && existing.status === "completed") {
      return existing;
    }
    const hashMatch = this.repo.findByHash(executionHash);
    if (hashMatch && hashMatch.status === "completed") {
      return hashMatch;
    }
    return undefined;
  }

  private createFailedRecord(request: ActionRequest, executionHash: string, error: string): ExecutionRecord {
    return {
      executionId: `EXE-${randomUUID().slice(0, 8).toUpperCase()}`,
      request,
      executionHash,
      status: "failed",
      result: "failure",
      error,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 0,
    };
  }

  private evaluatePolicyGate(request: ActionRequest, executionHash: string): ExecutionRecord | undefined {
    if (!this.shitennoDir) return undefined;
    const policyEngine = new PolicyEngine(new FilePolicyRepository(this.shitennoDir));
    const action: RuleAction = { type: request.type as RuleAction["type"], params: request.params as RuleAction["params"] };
    const context: RuleContext = {
      trigger: "manual",
      eventData: {},
      projectRoot: "",
      shitennoDir: this.shitennoDir,
      timestamp: new Date().toISOString(),
    };
    const policyResult = checkPolicyGate(action, context, policyEngine);
    if (!policyResult.allowed) {
      const record = this.createFailedRecord(request, executionHash, `Blocked by policy: ${policyResult.reason}`);
      this.repo.save(record);
      return record;
    }
    return undefined;
  }

  private async runWithResources(executor: ActionExecutor, request: ActionRequest, record: ExecutionRecord): Promise<void> {
    const resourceId = getResourceId(request.type as RuleAction["type"], request.params);
    const claimType: "plan" | "task" | undefined = resourceId?.startsWith("plan:")
      ? "plan"
      : resourceId?.startsWith("task:")
      ? "task"
      : undefined;
    const claimSessionId = resourceId && claimType ? claimResource(resourceId, claimType) : undefined;

    try {
      const startTime = Date.now();
      const output = await executor.execute(request.params, {
        projectRoot: "",
        shitennoDir: this.shitennoDir,
      });
      const duration = Date.now() - startTime;

      record.status = "completed";
      record.result = "success";
      record.output = output;
      record.completedAt = new Date().toISOString();
      record.duration = duration;
    } catch (error) {
      record.status = "failed";
      record.result = "failure";
      record.error = error instanceof Error ? error.message : String(error);
      record.completedAt = new Date().toISOString();
      record.duration = Date.now() - new Date(record.startedAt).getTime();
    } finally {
      if (resourceId && claimSessionId) {
        releaseResource(resourceId, claimSessionId);
      }
    }
  }

  /** Execute an action with idempotency guarantees. */
  async execute(request: ActionRequest): Promise<ExecutionRecord> {
    const executionHash = computeExecutionHash(request.type, request.params);

    const idempotentMatch = this.findIdempotentMatch(request, executionHash);
    if (idempotentMatch) return idempotentMatch;

    const policyBlock = this.evaluatePolicyGate(request, executionHash);
    if (policyBlock) return policyBlock;

    const executor = this.executors.get(request.type);
    if (!executor) {
      const record = this.createFailedRecord(request, executionHash, `No executor registered for type: ${request.type}`);
      this.repo.save(record);
      return record;
    }

    const record: ExecutionRecord = {
      executionId: `EXE-${randomUUID().slice(0, 8).toUpperCase()}`,
      request,
      executionHash,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.repo.save(record);

    await this.runWithResources(executor, request, record);

    this.repo.save(record);
    return record;
  }

  /** Rollback a completed action. */
  async rollback(executionId: string): Promise<ExecutionRecord | undefined> {
    const record = this.repo.findById(executionId);
    if (!record) return undefined;
    if (record.status !== "completed") return undefined;

    const executor = this.executors.get(record.request.type);
    if (!executor || !executor.rollback) {
      record.status = "failed";
      record.error = "No rollback executor available";
      this.repo.save(record);
      return record;
    }

    try {
      await executor.rollback(record.request.params, record.output ?? {});
      record.status = "rolled_back";
      record.result = "rolled_back";
      record.rollback = {
        rollbackId: `RBK-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: "completed",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      record.rollback = {
        rollbackId: `RBK-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }

    this.repo.save(record);
    return record;
  }

  /** Get an execution record by ID. */
  get(executionId: string): ExecutionRecord | undefined {
    return this.repo.findById(executionId);
  }

  /** Get execution by action ID (idempotency lookup). */
  getByActionId(actionId: string): ExecutionRecord | undefined {
    return this.repo.findByActionId(actionId);
  }

  /** List executions. */
  list(filter?: ActionFilter): ExecutionRecord[] {
    return this.repo.findAll(filter);
  }

  /** Count executions. */
  count(filter?: ActionFilter): number {
    return this.repo.count(filter);
  }

  /** Get execution statistics. */
  stats(): {
    total: number;
    byStatus: Record<ActionStatus, number>;
    avgDuration: number;
    successRate: number;
  } {
    const all = this.repo.findAll();
    const byStatus: Record<ActionStatus, number> = {
      pending: 0, running: 0, completed: 0, failed: 0, rolled_back: 0,
    };
    let totalDuration = 0;
    let successCount = 0;

    for (const r of all) {
      byStatus[r.status]++;
      if (r.duration) totalDuration += r.duration;
      if (r.result === "success") successCount++;
    }

    return {
      total: all.length,
      byStatus,
      avgDuration: all.length > 0 ? Math.round(totalDuration / all.length) : 0,
      successRate: all.length > 0 ? Math.round((successCount / all.length) * 100) : 100,
    };
  }
}
