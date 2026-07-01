/**
 * policy-engine.test.ts — Tests for Policy Engine
 *
 * Validates condition evaluation, policy lifecycle, and enforcement/advisory modes.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  PolicyEngine,
  FilePolicyRepository,
  evaluateCondition,
  type Policy,
  type PolicyRepository,
  type PolicyFilter,
} from "../policy-engine.js";

// ── In-Memory Repository ───────────────────────────────────────────────────

class InMemoryPolicyRepository implements PolicyRepository {
  private policies = new Map<string, Policy>();

  save(policy: Policy): void {
    this.policies.set(policy.id, { ...policy });
  }

  findById(id: string): Policy | undefined {
    const p = this.policies.get(id);
    return p ? { ...p } : undefined;
  }

  findAll(filter?: PolicyFilter): Policy[] {
    let policies = Array.from(this.policies.values());
    if (filter) {
      policies = policies.filter((p) => {
        if (filter.mode && p.mode !== filter.mode) return false;
        if (filter.enabled !== undefined && p.enabled !== filter.enabled) return false;
        if (filter.category && !p.categories?.includes(filter.category)) return false;
        if (filter.tag && !p.tags?.includes(filter.tag)) return false;
        return true;
      });
    }
    return policies;
  }

  delete(id: string): boolean {
    return this.policies.delete(id);
  }

  count(filter?: PolicyFilter): number {
    return this.findAll(filter).length;
  }
}

// ── File Repository Tests ──────────────────────────────────────────────────

describe("FilePolicyRepository", () => {
  let tmpDir: string;
  let repo: FilePolicyRepository;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `nexus-policy-repo-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    repo = new FilePolicyRepository(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a policy", () => {
    const policy: Policy = {
      id: "POL-TEST-001",
      name: "Test Policy",
      description: "A test policy",
      mode: "enforce",
      effect: "deny",
      conditions: [{ field: "riskLevel", operator: "equals", value: "critical" }],
      actions: [{ type: "block", params: {} }],
      enabled: true,
      priority: 1,
    };

    repo.save(policy);
    const loaded = repo.findById("POL-TEST-001");
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe("Test Policy");
  });

  it("returns undefined for non-existent policy", () => {
    expect(repo.findById("POL-NONEXISTENT")).toBeUndefined();
  });

  it("lists all policies", () => {
    const p1: Policy = {
      id: "POL-001", name: "P1", description: "", mode: "enforce", effect: "deny",
      conditions: [], actions: [], enabled: true, priority: 1,
    };
    const p2: Policy = {
      id: "POL-002", name: "P2", description: "", mode: "advisory", effect: "notify",
      conditions: [], actions: [], enabled: true, priority: 2,
    };

    repo.save(p1);
    repo.save(p2);
    expect(repo.findAll()).toHaveLength(2);
  });

  it("filters by mode", () => {
    const p1: Policy = {
      id: "POL-001", name: "P1", description: "", mode: "enforce", effect: "deny",
      conditions: [], actions: [], enabled: true, priority: 1,
    };
    const p2: Policy = {
      id: "POL-002", name: "P2", description: "", mode: "advisory", effect: "notify",
      conditions: [], actions: [], enabled: true, priority: 2,
    };

    repo.save(p1);
    repo.save(p2);
    expect(repo.findAll({ mode: "enforce" })).toHaveLength(1);
    expect(repo.findAll({ mode: "advisory" })).toHaveLength(1);
  });

  it("deletes a policy", () => {
    const policy: Policy = {
      id: "POL-DEL", name: "Delete Me", description: "", mode: "enforce", effect: "deny",
      conditions: [], actions: [], enabled: true, priority: 1,
    };

    repo.save(policy);
    expect(repo.delete("POL-DEL")).toBe(true);
    expect(repo.findById("POL-DEL")).toBeUndefined();
  });
});

// ── Condition Evaluator Tests ──────────────────────────────────────────────

describe("evaluateCondition", () => {
  const ctx = {
    name: "test",
    count: 42,
    tags: ["a", "b"],
    nested: { value: "deep" },
    missing: undefined,
  };

  it("equals", () => {
    expect(evaluateCondition({ field: "name", operator: "equals", value: "test" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "equals", value: "other" }, ctx)).toBe(false);
  });

  it("not_equals", () => {
    expect(evaluateCondition({ field: "name", operator: "not_equals", value: "other" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "not_equals", value: "test" }, ctx)).toBe(false);
  });

  it("greater_than", () => {
    expect(evaluateCondition({ field: "count", operator: "greater_than", value: 30 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "count", operator: "greater_than", value: 50 }, ctx)).toBe(false);
  });

  it("less_than", () => {
    expect(evaluateCondition({ field: "count", operator: "less_than", value: 50 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "count", operator: "less_than", value: 30 }, ctx)).toBe(false);
  });

  it("greater_or_equal", () => {
    expect(evaluateCondition({ field: "count", operator: "greater_or_equal", value: 42 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "count", operator: "greater_or_equal", value: 43 }, ctx)).toBe(false);
  });

  it("less_or_equal", () => {
    expect(evaluateCondition({ field: "count", operator: "less_or_equal", value: 42 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "count", operator: "less_or_equal", value: 41 }, ctx)).toBe(false);
  });

  it("contains (array)", () => {
    expect(evaluateCondition({ field: "tags", operator: "contains", value: "a" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "tags", operator: "contains", value: "c" }, ctx)).toBe(false);
  });

  it("contains (string)", () => {
    expect(evaluateCondition({ field: "name", operator: "contains", value: "tes" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "contains", value: "xyz" }, ctx)).toBe(false);
  });

  it("not_contains", () => {
    expect(evaluateCondition({ field: "tags", operator: "not_contains", value: "c" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "tags", operator: "not_contains", value: "a" }, ctx)).toBe(false);
  });

  it("starts_with", () => {
    expect(evaluateCondition({ field: "name", operator: "starts_with", value: "tes" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "starts_with", value: "xyz" }, ctx)).toBe(false);
  });

  it("ends_with", () => {
    expect(evaluateCondition({ field: "name", operator: "ends_with", value: "est" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "ends_with", value: "xyz" }, ctx)).toBe(false);
  });

  it("matches_regex", () => {
    expect(evaluateCondition({ field: "name", operator: "matches_regex", value: "^test$" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "matches_regex", value: "^xyz" }, ctx)).toBe(false);
  });

  it("in", () => {
    expect(evaluateCondition({ field: "name", operator: "in", value: ["test", "other"] }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "in", value: ["xyz", "abc"] }, ctx)).toBe(false);
  });

  it("not_in", () => {
    expect(evaluateCondition({ field: "name", operator: "not_in", value: ["xyz", "abc"] }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "not_in", value: ["test", "other"] }, ctx)).toBe(false);
  });

  it("exists", () => {
    expect(evaluateCondition({ field: "name", operator: "exists" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "missing", operator: "exists" }, ctx)).toBe(false);
  });

  it("not_exists", () => {
    expect(evaluateCondition({ field: "missing", operator: "not_exists" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "name", operator: "not_exists" }, ctx)).toBe(false);
  });

  it("nested field access", () => {
    expect(evaluateCondition({ field: "nested.value", operator: "equals", value: "deep" }, ctx)).toBe(true);
    expect(evaluateCondition({ field: "nested.value", operator: "equals", value: "shallow" }, ctx)).toBe(false);
  });
});

// ── PolicyEngine Tests ─────────────────────────────────────────────────────

describe("PolicyEngine", () => {
  let repo: InMemoryPolicyRepository;
  let engine: PolicyEngine;

  beforeEach(() => {
    repo = new InMemoryPolicyRepository();
    engine = new PolicyEngine(repo);
  });

  describe("create", () => {
    it("creates a policy with defaults", () => {
      const policy = engine.create({ name: "Test Policy" });
      expect(policy.id).toMatch(/^POL-[A-Z0-9]+$/);
      expect(policy.name).toBe("Test Policy");
      expect(policy.mode).toBe("advisory");
      expect(policy.effect).toBe("notify");
      expect(policy.enabled).toBe(true);
    });

    it("creates a policy with custom fields", () => {
      const policy = engine.create({
        name: "Enforce Policy",
        mode: "enforce",
        effect: "deny",
        conditions: [{ field: "risk", operator: "equals", value: "high" }],
        actions: [{ type: "block", params: {} }],
        priority: 1,
      });
      expect(policy.mode).toBe("enforce");
      expect(policy.effect).toBe("deny");
      expect(policy.conditions).toHaveLength(1);
    });
  });

  describe("evaluate", () => {
    it("returns empty evaluation when no policies", () => {
      const evaluation = engine.evaluate({});
      expect(evaluation.evaluated).toBe(0);
      expect(evaluation.compliant).toBe(true);
    });

    it("evaluates matching enforce policy as violation", () => {
      engine.create({
        name: "No critical risk",
        mode: "enforce",
        effect: "deny",
        conditions: [{ field: "riskLevel", operator: "equals", value: "critical" }],
      });

      const evaluation = engine.evaluate({ riskLevel: "critical" });
      expect(evaluation.matched).toBe(1);
      expect(evaluation.violations).toBe(1);
      expect(evaluation.compliant).toBe(false);
    });

    it("evaluates matching advisory policy as warning", () => {
      engine.create({
        name: "High risk warning",
        mode: "advisory",
        effect: "deny",
        conditions: [{ field: "riskLevel", operator: "equals", value: "high" }],
      });

      const evaluation = engine.evaluate({ riskLevel: "high" });
      expect(evaluation.matched).toBe(1);
      expect(evaluation.warnings).toBe(1);
      expect(evaluation.compliant).toBe(true);
    });

    it("does not match when conditions not met", () => {
      engine.create({
        name: "No critical risk",
        mode: "enforce",
        effect: "deny",
        conditions: [{ field: "riskLevel", operator: "equals", value: "critical" }],
      });

      const evaluation = engine.evaluate({ riskLevel: "low" });
      expect(evaluation.matched).toBe(0);
      expect(evaluation.violations).toBe(0);
      expect(evaluation.compliant).toBe(true);
    });

    it("requires all conditions to match (AND logic)", () => {
      engine.create({
        name: "Complex policy",
        mode: "enforce",
        effect: "deny",
        conditions: [
          { field: "riskLevel", operator: "equals", value: "high" },
          { field: "impact", operator: "equals", value: "critical" },
        ],
      });

      // Only one condition met
      const eval1 = engine.evaluate({ riskLevel: "high", impact: "low" });
      expect(eval1.matched).toBe(0);

      // Both conditions met
      const eval2 = engine.evaluate({ riskLevel: "high", impact: "critical" });
      expect(eval2.matched).toBe(1);
    });

    it("skips disabled policies", () => {
      const policy = engine.create({
        name: "Disabled policy",
        mode: "enforce",
        effect: "deny",
        conditions: [{ field: "x", operator: "equals", value: 1 }],
      });
      engine.disable(policy.id);

      const evaluation = engine.evaluate({ x: 1 });
      expect(evaluation.evaluated).toBe(0);
    });

    it("filters by mode", () => {
      engine.create({ name: "Enforce", mode: "enforce", effect: "deny", conditions: [] });
      engine.create({ name: "Advisory", mode: "advisory", effect: "notify", conditions: [] });

      const enforceOnly = engine.evaluate({}, { mode: "enforce" });
      expect(enforceOnly.evaluated).toBe(1);
    });
  });

  describe("enable/disable", () => {
    it("enables a policy", () => {
      const policy = engine.create({ name: "Test" });
      engine.disable(policy.id);
      const reenabled = engine.enable(policy.id);
      expect(reenabled?.enabled).toBe(true);
    });

    it("disables a policy", () => {
      const policy = engine.create({ name: "Test" });
      const disabled = engine.disable(policy.id);
      expect(disabled?.enabled).toBe(false);
    });

    it("returns undefined for non-existent policy", () => {
      expect(engine.enable("POL-NONEXISTENT")).toBeUndefined();
      expect(engine.disable("POL-NONEXISTENT")).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("deletes a policy", () => {
      const policy = engine.create({ name: "To Delete" });
      expect(engine.delete(policy.id)).toBe(true);
      expect(engine.get(policy.id)).toBeUndefined();
    });

    it("returns false for non-existent policy", () => {
      expect(engine.delete("POL-NONEXISTENT")).toBe(false);
    });
  });

  describe("list and get", () => {
    it("gets a policy by ID", () => {
      const policy = engine.create({ name: "Findable" });
      const found = engine.get(policy.id);
      expect(found?.name).toBe("Findable");
    });

    it("lists all policies", () => {
      engine.create({ name: "P1" });
      engine.create({ name: "P2" });
      expect(engine.list()).toHaveLength(2);
    });
  });

  describe("stats", () => {
    it("returns zero stats for empty repo", () => {
      expect(engine.count()).toBe(0);
    });

    it("counts correctly", () => {
      engine.create({ name: "Enforce", mode: "enforce" });
      engine.create({ name: "Advisory", mode: "advisory" });
      engine.create({ name: "Disabled", mode: "enforce" });
      const all = engine.list();
      const toDisable = all.find((p) => p.name === "Disabled");
      if (toDisable) engine.disable(toDisable.id);

      expect(engine.count()).toBe(3);
      expect(engine.list({ mode: "enforce" })).toHaveLength(2);
      expect(engine.list({ enabled: true })).toHaveLength(2);
    });
  });
});
