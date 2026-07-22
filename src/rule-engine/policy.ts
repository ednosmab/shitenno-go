/**
 * policy-engine.ts — Declarative Policy Engine
 *
 * Policies are JSON files that define rules without code.
 * Each policy has conditions, actions, and a mode (enforce/advisory).
 *
 * Architecture: Policy (JSON) → ConditionEvaluator → PolicyEngine → PolicyResult
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getEventBus } from "../event-bus.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type PolicyMode = "enforce" | "advisory";
export type PolicyEffect = "allow" | "deny" | "require" | "notify";
export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists";

export interface PolicyCondition {
  /** Dot-notation field path (e.g., "eventData.riskLevel"). */
  field: string;
  /** Comparison operator. */
  operator: ComparisonOperator;
  /** Value to compare against (optional for exists/not_exists). */
  value?: unknown;
}

export interface PolicyAction {
  /** Action type to execute when condition matches. */
  type: string;
  /** Parameters for the action. */
  params: Record<string, unknown>;
}

export interface Policy {
  /** Unique policy ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Policy description. */
  description: string;
  /** enforce = block if violated, advisory = warn only. */
  mode: PolicyMode;
  /** Effect when policy matches. */
  effect: PolicyEffect;
  /** Conditions that trigger this policy (ALL must match). */
  conditions: PolicyCondition[];
  /** Actions to execute when policy matches. */
  actions: PolicyAction[];
  /** Optional: categories this policy applies to. */
  categories?: string[];
  /** Optional: tags for filtering. */
  tags?: string[];
  /** Whether this policy is enabled. */
  enabled: boolean;
  /** Priority (lower = higher priority). */
  priority: number;
}

export interface PolicyResult {
  /** Policy that was evaluated. */
  policyId: string;
  /** Policy name. */
  policyName: string;
  /** Whether the policy conditions matched. */
  matched: boolean;
  /** Whether the policy was violated (matched + deny effect). */
  violated: boolean;
  /** Policy mode. */
  mode: PolicyMode;
  /** Human-readable explanation. */
  message: string;
  /** Actions that were triggered. */
  actionsTriggered: string[];
}

export interface PolicyEvaluation {
  /** All policy results. */
  results: PolicyResult[];
  /** Number of policies evaluated. */
  evaluated: number;
  /** Number of policies that matched. */
  matched: number;
  /** Number of policies violated (enforce mode). */
  violations: number;
  /** Number of advisory warnings. */
  warnings: number;
  /** Overall: true if no enforce violations. */
  compliant: boolean;
}

export interface PolicyFilter {
  mode?: PolicyMode;
  enabled?: boolean;
  category?: string;
  tag?: string;
}

// ── Condition Evaluator ────────────────────────────────────────────────────

function evalEquality(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  switch (operator) {
    case "equals": return fieldValue === targetValue;
    case "not_equals": return fieldValue !== targetValue;
    default: return null;
  }
}

function evalComparison(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  switch (operator) {
    case "greater_than": return Number(fieldValue) > Number(targetValue);
    case "less_than": return Number(fieldValue) < Number(targetValue);
    case "greater_or_equal": return Number(fieldValue) >= Number(targetValue);
    case "less_or_equal": return Number(fieldValue) <= Number(targetValue);
    default: return null;
  }
}

function evalStringOps(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  if (typeof fieldValue !== "string") {
    if (Array.isArray(fieldValue)) return null;
    return operator === "not_contains" ? true : null;
  }
  switch (operator) {
    case "contains": return fieldValue.includes(String(targetValue));
    case "not_contains": return !fieldValue.includes(String(targetValue));
    case "starts_with": return fieldValue.startsWith(String(targetValue));
    case "ends_with": return fieldValue.endsWith(String(targetValue));
    default: return null;
  }
}

function evalRegex(fieldValue: unknown, targetValue: unknown): boolean {
  if (typeof fieldValue !== "string") return false;
  try { return new RegExp(String(targetValue)).test(fieldValue); } catch { return false; }
}

function evalMembership(fieldValue: unknown, targetValue: unknown, operator: "in" | "not_in"): boolean {
  if (Array.isArray(targetValue)) {
    return operator === "in"
      ? targetValue.includes(fieldValue)
      : !targetValue.includes(fieldValue);
  }
  return operator === "not_in";
}

function evalExistence(fieldValue: unknown, operator: "exists" | "not_exists"): boolean {
  return operator === "exists"
    ? fieldValue !== undefined && fieldValue !== null
    : fieldValue === undefined || fieldValue === null;
}

function evalCollectionOps(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  switch (operator) {
    case "contains":
      return Array.isArray(fieldValue) ? fieldValue.includes(targetValue) : null;
    case "not_contains":
      return Array.isArray(fieldValue) ? !fieldValue.includes(targetValue) : null;
    case "matches_regex":
      return evalRegex(fieldValue, targetValue);
    case "in":
    case "not_in":
      return evalMembership(fieldValue, targetValue, operator);
    case "exists":
    case "not_exists":
      return evalExistence(fieldValue, operator);
    default:
      return null;
  }
}

/**
 * Evaluates a single condition against a context object.
 * Supports dot-notation field access (e.g., "eventData.count").
 */
export function evaluateCondition(
  condition: PolicyCondition,
  context: Record<string, unknown>
): boolean {
  const fieldValue = getFieldValue(condition.field, context);
  const targetValue = condition.value;
  const op = condition.operator;

  return evalEquality(fieldValue, targetValue, op)
    ?? evalComparison(fieldValue, targetValue, op)
    ?? evalStringOps(fieldValue, targetValue, op)
    ?? evalCollectionOps(fieldValue, targetValue, op)
    ?? false;
}

/** Get a value from a nested object using dot notation. */
function getFieldValue(path: string, obj: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ── Repository ─────────────────────────────────────────────────────────────

export interface PolicyRepository {
  save(policy: Policy): void;
  findById(id: string): Policy | undefined;
  findAll(filter?: PolicyFilter): Policy[];
  delete(id: string): boolean;
  count(filter?: PolicyFilter): number;
}

export class FilePolicyRepository implements PolicyRepository {
  private dir: string;

  constructor(shitennoDir: string) {
    this.dir = join(shitennoDir, "governance", "policies");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(policy: Policy): void {
    const filepath = join(this.dir, `${policy.id}.json`);
    writeFileSync(filepath, JSON.stringify(policy, null, 2), "utf-8");
  }

  findById(id: string): Policy | undefined {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      return JSON.parse(readFileSync(filepath, "utf-8")) as Policy;
    } catch {
      return undefined;
    }
  }

  findAll(filter?: PolicyFilter): Policy[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const policies: Policy[] = [];

    for (const file of files) {
      try {
        const policy = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as Policy;
        if (this.matchesFilter(policy, filter)) {
          policies.push(policy);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return policies;
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

  count(filter?: PolicyFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(policy: Policy, filter?: PolicyFilter): boolean {
    if (!filter) return true;
    if (filter.mode && policy.mode !== filter.mode) return false;
    if (filter.enabled !== undefined && policy.enabled !== filter.enabled) return false;
    if (filter.category && !policy.categories?.includes(filter.category)) return false;
    if (filter.tag && !policy.tags?.includes(filter.tag)) return false;
    return true;
  }
}

// ── Engine ─────────────────────────────────────────────────────────────────

function evaluateSinglePolicy(policy: Policy, context: Record<string, unknown>): PolicyResult {
  const allConditionsMet = policy.conditions.every((cond) => evaluateCondition(cond, context));

  if (!allConditionsMet) {
    return {
      policyId: policy.id, policyName: policy.name,
      matched: false, violated: false, mode: policy.mode,
      message: "Conditions not met", actionsTriggered: [],
    };
  }

  const violated = policy.effect === "deny";
  const actionsTriggered = policy.actions.map((a) => a.type);
  const action = violated && policy.mode === "enforce" ? "violated" : violated ? "advisory" : "enforced";

  getEventBus().publish("governance.policy_applied", {
    policyId: policy.id, policyName: policy.name, action,
    details: violated ? policy.description : undefined,
    timestamp: new Date().toISOString(),
  });

  return {
    policyId: policy.id, policyName: policy.name,
    matched: true, violated, mode: policy.mode,
    message: violated ? `Policy violated: ${policy.description}` : `Policy matched: ${policy.description}`,
    actionsTriggered,
  };
}

function updateCounters(policy: Policy, result: PolicyResult, counters: { matched: number; violations: number; warnings: number }): void {
  counters.matched++;
  if (result.violated && policy.mode === "enforce") counters.violations++;
  else if (result.violated && policy.mode === "advisory") counters.warnings++;
  else if (policy.effect === "require") counters.warnings++;
}

export class PolicyEngine {
  constructor(private repo: PolicyRepository) {}

  /** Evaluate all enabled policies against a context. */
  evaluate(
    context: Record<string, unknown>,
    filter?: PolicyFilter
  ): PolicyEvaluation {
    const policies = this.repo.findAll({ ...filter, enabled: true });
    const results: PolicyResult[] = [];
    const counters = { matched: 0, violations: 0, warnings: 0 };

    for (const policy of policies) {
      const result = evaluateSinglePolicy(policy, context);
      results.push(result);
      if (result.matched) updateCounters(policy, result, counters);
    }

    return {
      results, evaluated: policies.length,
      matched: counters.matched, violations: counters.violations,
      warnings: counters.warnings, compliant: counters.violations === 0,
    };
  }

  /** Create a new policy. */
  create(input: {
    name: string;
    description?: string;
    mode?: PolicyMode;
    effect?: PolicyEffect;
    conditions?: PolicyCondition[];
    actions?: PolicyAction[];
    categories?: string[];
    tags?: string[];
    priority?: number;
  }): Policy {
    const policy: Policy = {
      id: `POL-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: input.name,
      description: input.description ?? "",
      mode: input.mode ?? "advisory",
      effect: input.effect ?? "notify",
      conditions: input.conditions ?? [],
      actions: input.actions ?? [],
      categories: input.categories,
      tags: input.tags,
      enabled: true,
      priority: input.priority ?? 100,
    };

    this.repo.save(policy);
    return policy;
  }

  /** Enable a policy. */
  enable(id: string): Policy | undefined {
    const policy = this.repo.findById(id);
    if (!policy) return undefined;
    policy.enabled = true;
    this.repo.save(policy);
    return policy;
  }

  /** Disable a policy. */
  disable(id: string): Policy | undefined {
    const policy = this.repo.findById(id);
    if (!policy) return undefined;
    policy.enabled = false;
    this.repo.save(policy);
    return policy;
  }

  /** Delete a policy. */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /** Get a policy by ID. */
  get(id: string): Policy | undefined {
    return this.repo.findById(id);
  }

  /** List policies. */
  list(filter?: PolicyFilter): Policy[] {
    return this.repo.findAll(filter);
  }

  /** Count policies. */
  count(filter?: PolicyFilter): number {
    return this.repo.count(filter);
  }
}
