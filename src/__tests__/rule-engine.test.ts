import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import {
  loadRules,
  saveRule,
  executeRules,
  getDefaultRules,
  initializeRules,
  type Rule,
  type RuleContext,
} from "../rule-engine.js";

const TEST_DIR = join(tmpdir(), "nexus-rule-engine-test");
const NEXUS_DIR = join(TEST_DIR, "nexus");

beforeAll(() => {
  mkdirSync(join(NEXUS_DIR, "governance", "rules"), { recursive: true });
  mkdirSync(join(NEXUS_DIR, "governance", "context"), { recursive: true });
  mkdirSync(join(NEXUS_DIR, "docs", "history"), { recursive: true });
  writeFileSync(
    join(NEXUS_DIR, "governance", "context", "context_buffer.yaml"),
    "reminders:\n  - test\n",
  );
});
afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

const baseRule: Rule = {
  id: "TEST-001",
  description: "Test rule",
  trigger: "session_start",
  conditions: [],
  actions: [{ type: "trigger_health_check", params: {} }],
  priority: 1,
  dependencies: [],
  enabled: true,
  tags: ["test"],
};

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    trigger: "session_start",
    eventData: {},
    projectRoot: TEST_DIR,
    nexusDir: NEXUS_DIR,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("loadRules", () => {
  it("returns empty array when no rules dir", () => {
    const emptyDir = join(TEST_DIR, "empty-nexus");
    mkdirSync(emptyDir, { recursive: true });
    expect(loadRules(emptyDir)).toEqual([]);
  });

  it("loads valid rule files", () => {
    writeFileSync(
      join(NEXUS_DIR, "governance", "rules", "TEST-001.json"),
      JSON.stringify(baseRule),
    );
    const rules = loadRules(NEXUS_DIR);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe("TEST-001");
  });

  it("skips invalid rule files", () => {
    writeFileSync(
      join(NEXUS_DIR, "governance", "rules", "bad.json"),
      JSON.stringify({ not: "a rule" }),
    );
    const rules = loadRules(NEXUS_DIR);
    expect(rules.find((r) => r.id === undefined)).toBeUndefined();
  });

  it("skips files starting with underscore", () => {
    writeFileSync(
      join(NEXUS_DIR, "governance", "rules", "_draft.json"),
      JSON.stringify(baseRule),
    );
    const rules = loadRules(NEXUS_DIR);
    expect(rules.find((r) => r.id === "_draft")).toBeUndefined();
  });
});

describe("saveRule", () => {
  it("creates rule file on disk", () => {
    saveRule(NEXUS_DIR, baseRule);
    const path = join(NEXUS_DIR, "governance", "rules", "TEST-001.json");
    expect(existsSync(path)).toBe(true);
    const saved = JSON.parse(readFileSync(path, "utf-8"));
    expect(saved.id).toBe("TEST-001");
  });

  it("rejects invalid rule IDs", () => {
    expect(() =>
      saveRule(NEXUS_DIR, { ...baseRule, id: "invalid id!" }),
    ).toThrow("Invalid rule ID");
  });

  it("accepts valid IDs with hyphens and underscores", () => {
    expect(() =>
      saveRule(NEXUS_DIR, { ...baseRule, id: "VALID-001_test" }),
    ).not.toThrow();
  });
});

describe("executeRules", () => {
  it("returns empty result when no rules match", () => {
    const rules = [baseRule];
    const context = makeContext({ trigger: "session_end" });
    const result = executeRules(rules, context);
    expect(result.rulesEvaluated).toBe(0);
    expect(result.rulesExecuted).toBe(0);
  });

  it("executes matching rules", () => {
    const rules = [baseRule];
    const context = makeContext();
    const result = executeRules(rules, context);
    expect(result.rulesExecuted).toBe(1);
    expect(result.results[0]!.success).toBe(true);
  });

  it("skips disabled rules", () => {
    const rules = [{ ...baseRule, enabled: false }];
    const result = executeRules(rules, makeContext());
    expect(result.rulesEvaluated).toBe(0);
  });

  it("evaluates conditions correctly", () => {
    const ruleWithCondition: Rule = {
      ...baseRule,
      conditions: [
        { field: "eventData.score", operator: "greater_than", value: 50 },
      ],
    };

    // Condition met
    const result1 = executeRules([ruleWithCondition], makeContext({
      eventData: { score: 80 },
    }));
    expect(result1.rulesExecuted).toBe(1);

    // Condition not met
    const result2 = executeRules([ruleWithCondition], makeContext({
      eventData: { score: 30 },
    }));
    expect(result2.rulesSkipped).toBe(1);
  });

  it("respects priority ordering", () => {
    const low: Rule = {
      ...baseRule,
      id: "LOW",
      priority: 10,
    };
    const high: Rule = {
      ...baseRule,
      id: "HIGH",
      priority: 1,
    };
    const result = executeRules([low, high], makeContext());
    expect(result.results[0]!.ruleId).toBe("HIGH");
    expect(result.results[1]!.ruleId).toBe("LOW");
  });

  it("handles dependencies — satisfied", () => {
    const dep: Rule = {
      ...baseRule,
      id: "DEP",
      priority: 1,
    };
    const main: Rule = {
      ...baseRule,
      id: "MAIN",
      priority: 2,
      dependencies: ["DEP"],
    };

    const result = executeRules([dep, main], makeContext());
    expect(result.rulesExecuted).toBe(2);
  });

  it("handles dependencies — unsatisfied", () => {
    const main: Rule = {
      ...baseRule,
      id: "MAIN",
      dependencies: ["NONEXISTENT"],
    };
    const result = executeRules([main], makeContext());
    expect(result.rulesSkipped).toBe(1);
    expect(result.results[0]!.message).toBe("Dependencies not met");
  });

  it("equals operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.x", operator: "equals", value: "a" }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: { x: "a" } }));
    expect(r1.rulesExecuted).toBe(1);
    const r2 = executeRules([rule], makeContext({ eventData: { x: "b" } }));
    expect(r2.rulesSkipped).toBe(1);
  });

  it("contains operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.name", operator: "contains", value: "hello" }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: { name: "say hello world" } }));
    expect(r1.rulesExecuted).toBe(1);
    const r2 = executeRules([rule], makeContext({ eventData: { name: "goodbye" } }));
    expect(r2.rulesSkipped).toBe(1);
  });

  it("greater_than operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.n", operator: "greater_than", value: 10 }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: { n: 20 } }));
    expect(r1.rulesExecuted).toBe(1);
    const r2 = executeRules([rule], makeContext({ eventData: { n: 5 } }));
    expect(r2.rulesSkipped).toBe(1);
  });

  it("less_than operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.n", operator: "less_than", value: 10 }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: { n: 5 } }));
    expect(r1.rulesExecuted).toBe(1);
  });

  it("exists operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.x", operator: "exists", value: "" }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: { x: "val" } }));
    expect(r1.rulesExecuted).toBe(1);
    const r2 = executeRules([rule], makeContext({ eventData: {} }));
    expect(r2.rulesSkipped).toBe(1);
  });

  it("not_exists operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.x", operator: "not_exists", value: "" }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: {} }));
    expect(r1.rulesExecuted).toBe(1);
  });

  it("matches_regex operator", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [{ field: "eventData.name", operator: "matches_regex", value: "^test" }],
    };
    const r1 = executeRules([rule], makeContext({ eventData: { name: "test123" } }));
    expect(r1.rulesExecuted).toBe(1);
    const r2 = executeRules([rule], makeContext({ eventData: { name: "abc" } }));
    expect(r2.rulesSkipped).toBe(1);
  });

  it("regex rejects overly long patterns", () => {
    const rule: Rule = {
      ...baseRule,
      conditions: [
        { field: "eventData.name", operator: "matches_regex", value: "a".repeat(201) },
      ],
    };
    const result = executeRules([rule], makeContext({ eventData: { name: "test" } }));
    expect(result.rulesSkipped).toBe(1);
  });
});

describe("getDefaultRules", () => {
  it("returns at least 5 rules", () => {
    const rules = getDefaultRules();
    expect(rules.length).toBeGreaterThanOrEqual(5);
  });

  it("all rules have valid structure", () => {
    const rules = getDefaultRules();
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(typeof rule.trigger).toBe("string");
      expect(Array.isArray(rule.conditions)).toBe(true);
      expect(Array.isArray(rule.actions)).toBe(true);
      expect(typeof rule.priority).toBe("number");
    }
  });

  it("all rules have unique IDs", () => {
    const rules = getDefaultRules();
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("initializeRules", () => {
  it("creates default rules when directory is empty", () => {
    const emptyNexus = join(TEST_DIR, "empty-init");
    mkdirSync(join(emptyNexus, "governance", "rules"), { recursive: true });
    initializeRules(emptyNexus);
    const rules = loadRules(emptyNexus);
    expect(rules.length).toBeGreaterThanOrEqual(5);
  });

  it("does not overwrite existing rules", () => {
    const nexus = join(TEST_DIR, "existing-init");
    mkdirSync(join(nexus, "governance", "rules"), { recursive: true });
    const customRule: Rule = {
      id: "CUSTOM-001",
      description: "Custom rule",
      trigger: "session_start",
      conditions: [],
      actions: [{ type: "trigger_health_check", params: {} }],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["custom"],
    };
    writeFileSync(
      join(nexus, "governance", "rules", "CUSTOM-001.json"),
      JSON.stringify(customRule),
    );
    initializeRules(nexus);
    const rules = loadRules(nexus);
    expect(rules.find((r) => r.id === "CUSTOM-001")).toBeTruthy();
  });
});
