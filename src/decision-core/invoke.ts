/**
 * Decision Core — Invoke (Unified Action Dispatcher)
 *
 * The single entry point for ALL action execution.
 * Replaces direct calls to rule-engine/actions.ts, autofix-engine.ts,
 * and action-engine.ts executors.
 *
 * Gate order (ADR-008 + ADR-009):
 *   1. Policy gate — veto before anything (ADR-009)
 *   2. Precedence gate — tier-based in autonomous mode (ADR-008)
 *   3. Execution + audit trail
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ActionType, RuleAction, RuleContext } from "../domain/rules/rule.js";
import { PolicyEngine, FilePolicyRepository } from "../policy-engine.js";
import { computeExecutionHash, type ExecutionRecord } from "../action-engine.js";
import { checkPolicyGate } from "./policy-gate.js";
import { checkPrecedence, type InvokeMode } from "./precedence.js";
import type { ActionExecutor } from "./executors/types.js";
import {
  RunScriptExecutor,
  RunLocalScriptExecutor,
  RunShitenCommandExecutor,
  CreateReminderExecutor,
  ApplyAutofixExecutor,
  GenericRuleActionExecutor,
} from "./executors/index.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface InvokeActionParams {
  action: RuleAction;
  context: RuleContext;
  mode: InvokeMode;
  ruleAutonomousFlag?: boolean;
  sessionId?: string;
  resourceClaimed?: (id: string) => boolean;
}

export interface InvokeResult {
  success: boolean;
  blocked?: boolean;
  deferred?: boolean;
  message: string;
  executionId?: string;
}

// ── Executor Registry ──────────────────────────────────────────────────────

const EXECUTORS: Record<string, ActionExecutor> = {
  run_script: new RunScriptExecutor(),
  run_local_script: new RunLocalScriptExecutor(),
  run_shiten_command: new RunShitenCommandExecutor(),
  create_reminder: new CreateReminderExecutor(),
  apply_autofix: new ApplyAutofixExecutor(),
};

/** Actions that have dedicated executors above. */
const DEDICATED_EXECUTOR_TYPES = new Set(Object.keys(EXECUTORS));

function getExecutor(actionType: ActionType): ActionExecutor {
  if (DEDICATED_EXECUTOR_TYPES.has(actionType)) {
    return EXECUTORS[actionType]!;
  }
  return new GenericRuleActionExecutor(actionType);
}

// ── Policy Engine Singleton ────────────────────────────────────────────────

let cachedPolicyEngine: PolicyEngine | undefined;

function getPolicyEngine(shitenDir: string): PolicyEngine {
  if (!cachedPolicyEngine) {
    cachedPolicyEngine = new PolicyEngine(new FilePolicyRepository(shitenDir));
  }
  return cachedPolicyEngine;
}

// ── Execution Log ──────────────────────────────────────────────────────────

const EXEC_LOG_PATH = "governance/executions";

function getExecLogDir(shitenDir: string): string {
  const dir = join(shitenDir, EXEC_LOG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Core Invoke Function ───────────────────────────────────────────────────

/**
 * Unified action dispatcher — the single entry point for all action execution.
 *
 * Gate order:
 *   1. Policy gate (ADR-009) — enforce violations veto the action
 *   2. Precedence gate (ADR-008) — tier-based in autonomous mode
 *   3. Execution + audit trail
 */
export async function invokeAction(params: InvokeActionParams): Promise<InvokeResult> {
  const { action, context, mode } = params;
  const executor = getExecutor(action.type);

  // 1. Policy gate — runs FIRST (ADR-009)
  const policyEngine = getPolicyEngine(context.shitenDir);
  const policyResult = checkPolicyGate(action, context, policyEngine);
  if (!policyResult.allowed) {
    return {
      success: false,
      blocked: true,
      message: `Blocked by policy: ${policyResult.reason}`,
    };
  }

  // 2. Precedence gate — only relevant in autonomous mode (ADR-008)
  const precedence = checkPrecedence(action.type, mode, {
    ruleAutonomousFlag: params.ruleAutonomousFlag,
    resourceClaimed: params.resourceClaimed ?? params.context.isResourceClaimed,
    params: action.params as Record<string, unknown>,
  });
  if (!precedence.allowed) {
    return {
      success: false,
      deferred: true,
      message: precedence.reason ?? "Deferred by precedence rules",
    };
  }

  // 3. Execution + audit trail
  const executionId = `EXE-${randomUUID().slice(0, 8).toUpperCase()}`;
  const executionHash = computeExecutionHash(action.type, action.params as Record<string, unknown>);

  const record: ExecutionRecord = {
    executionId,
    request: {
      id: params.sessionId ?? `invoke-${Date.now().toString(36)}`,
      type: action.type,
      params: action.params as Record<string, unknown>,
    },
    executionHash,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  const execDir = getExecLogDir(context.shitenDir);
  const execPath = join(execDir, `${executionId}.json`);
  writeFileSync(execPath, JSON.stringify(record, null, 2), "utf-8");

  try {
    const startTime = Date.now();
    const output = await executor.execute(
      action.params as Record<string, unknown>,
      { projectRoot: context.projectRoot, shitenDir: context.shitenDir }
    );
    const duration = Date.now() - startTime;

    record.status = "completed";
    record.result = "success";
    record.output = output;
    record.completedAt = new Date().toISOString();
    record.duration = duration;

    writeFileSync(execPath, JSON.stringify(record, null, 2), "utf-8");

    return {
      success: true,
      message: `Executed ${action.type}`,
      executionId,
    };
  } catch (error) {
    record.status = "failed";
    record.result = "failure";
    record.error = error instanceof Error ? error.message : String(error);
    record.completedAt = new Date().toISOString();
    record.duration = Date.now() - new Date(record.startedAt).getTime();

    writeFileSync(execPath, JSON.stringify(record, null, 2), "utf-8");

    return {
      success: false,
      message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
      executionId,
    };
  }
}
