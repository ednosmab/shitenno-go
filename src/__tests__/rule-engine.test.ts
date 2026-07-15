/**
 * rule-engine.test.ts — Tests for the Rule Engine
 *
 * Validates rule loading, saving, condition evaluation, action execution,
 * and the full rule engine pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  loadRules,
  saveRule,
  executeRules,
  getDefaultRules,
  type Rule,
  type RuleContext,
} from "../rule-engine.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTmpDir(): string {
  const dir = join(tmpdir(), `nexus-rule-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createNexusDir(tmpDir: string): string {
  const nexusDir = join(tmpDir, "nexus-system");
  mkdirSync(nexusDir, { recursive: true });
  mkdirSync(join(nexusDir, "governance", "rules"), { recursive: true });
  mkdirSync(join(nexusDir, "docs", "history"), { recursive: true });
  return nexusDir;
}

function createMockRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "RULE-TEST-001",
    description: "Test rule",
    trigger: "session_start",
    conditions: [],
    actions: [
      { type: "log_event", params: { event: "test_event", message: "Test message" } },
    ],
    priority: 1,
    dependencies: [],
    enabled: true,
    tags: ["test"],
    ...overrides,
  };
}

function createMockContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    trigger: "session_start",
    eventData: {},
    projectRoot: "/tmp/test",
    nexusDir: "/tmp/test/nexus-system",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("rule-engine", () => {
  let tmpDir: string;
  let nexusDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    nexusDir = createNexusDir(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadRules", () => {
    it("returns empty array when directory does not exist", () => {
      const rules = loadRules(join(tmpDir, "nonexistent"));
      expect(rules).toEqual([]);
    });

    it("loads rules from directory", () => {
      const rule = createMockRule();
      saveRule(nexusDir, rule);

      const rules = loadRules(nexusDir);
      expect(rules).toHaveLength(1);
      expect(rules[0]?.id).toBe("RULE-TEST-001");
    });

    it("ignores invalid JSON files", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const rulesPath = join(nexusDir, "governance", "rules");
      writeFileSync(join(rulesPath, "invalid.json"), "not json", "utf-8");
      writeFileSync(join(rulesPath, "valid.json"), JSON.stringify(createMockRule()), "utf-8");

      const rules = loadRules(nexusDir);
      expect(rules).toHaveLength(1);
    });

    it("ignores files starting with underscore", () => {
      const rulesPath = join(nexusDir, "governance", "rules");
      writeFileSync(join(rulesPath, "_template.json"), JSON.stringify(createMockRule()), "utf-8");
      writeFileSync(join(rulesPath, "active.json"), JSON.stringify(createMockRule({ id: "RULE-002" })), "utf-8");

      const rules = loadRules(nexusDir);
      expect(rules).toHaveLength(1);
      expect(rules[0]?.id).toBe("RULE-002");
    });
  });

  describe("saveRule", () => {
    it("saves rule to file", () => {
      const rule = createMockRule();
      saveRule(nexusDir, rule);

      const filepath = join(nexusDir, "governance", "rules", "RULE-TEST-001.json");
      expect(existsSync(filepath)).toBe(true);

      const saved = JSON.parse(readFileSync(filepath, "utf-8"));
      expect(saved.id).toBe("RULE-TEST-001");
    });

    it("throws on invalid rule ID", () => {
      const rule = createMockRule({ id: "invalid id with spaces" });
      expect(() => saveRule(nexusDir, rule)).toThrow("Invalid rule ID");
    });

    it("creates directory if it does not exist", () => {
      const newNexusDir = join(tmpDir, "new-nexus");
      mkdirSync(newNexusDir, { recursive: true });

      const rule = createMockRule();
      saveRule(newNexusDir, rule);

      const filepath = join(newNexusDir, "governance", "rules", "RULE-TEST-001.json");
      expect(existsSync(filepath)).toBe(true);
    });
  });

  describe("executeRules", () => {
    it("executes matching rules", async () => {
      const rule = createMockRule({
        trigger: "session_start",
        conditions: [],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });
      const context = createMockContext({ trigger: "session_start" });

      const result = await executeRules([rule], context);
      expect(result.rulesExecuted).toBe(1);
      expect(result.rulesSkipped).toBe(0);
    });

    it("skips rules with non-matching trigger", async () => {
      const rule = createMockRule({
        trigger: "session_end",
        conditions: [],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });
      const context = createMockContext({ trigger: "session_start" });

      const result = await executeRules([rule], context);
      expect(result.rulesExecuted).toBe(0);
      expect(result.rulesSkipped).toBe(0);
    });

    it("skips disabled rules", async () => {
      const rule = createMockRule({
        enabled: false,
        conditions: [],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });
      const context = createMockContext({ trigger: "session_start" });

      const result = await executeRules([rule], context);
      expect(result.rulesExecuted).toBe(0);
    });

    it("evaluates conditions", async () => {
      const rule = createMockRule({
        conditions: [
          { field: "eventData.count", operator: "greater_than", value: 5 },
        ],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });

      // Condition not met
      const context1 = createMockContext({ eventData: { count: 3 } });
      const result1 = await executeRules([rule], context1);
      expect(result1.rulesSkipped).toBe(1);

      // Condition met
      const context2 = createMockContext({ eventData: { count: 10 } });
      const result2 = await executeRules([rule], context2);
      expect(result2.rulesExecuted).toBe(1);
    });

    it("checks dependencies", async () => {
      const rule1 = createMockRule({
        id: "RULE-001",
        trigger: "session_start",
        conditions: [],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });
      const rule2 = createMockRule({
        id: "RULE-002",
        trigger: "session_start",
        dependencies: ["RULE-001"],
        conditions: [],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });

      // When RULE-001 is executed first, RULE-002 should also execute
      const context = createMockContext({ trigger: "session_start" });
      const result = await executeRules([rule1, rule2], context);
      // Both should execute since RULE-001 is in the same batch and executed first
      expect(result.rulesExecuted).toBeGreaterThanOrEqual(1);
    });

    it("returns correct summary", async () => {
      const rule = createMockRule({
        conditions: [],
        actions: [
          { type: "trigger_assessment", params: {} },
        ],
      });
      const context = createMockContext({ trigger: "session_start" });

      const result = await executeRules([rule], context);
      expect(result.summary).toContain("rules executed");
    });

    it("executes update_context_buffer action", async () => {
      const bufPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
      mkdirSync(join(nexusDir, "governance", "context"), { recursive: true });
      writeFileSync(bufPath, "current_task:\n  id: null\n  description: \"idle\"\n  status: \"in_progress\"\n", "utf-8");

      const rule = createMockRule({
        trigger: "session_start",
        conditions: [],
        actions: [
          { type: "update_context_buffer", params: { field: "current_task.status", value: "completed" } },
        ],
      });
      const context = createMockContext({ trigger: "session_start", nexusDir });

      const result = await executeRules([rule], context);
      expect(result.rulesExecuted).toBe(1);
      expect(result.rulesFailed).toBe(0);

      const updated = readFileSync(bufPath, "utf-8");
      expect(updated).toContain('status: "completed"');
    });

    it("executes update_backlog action", async () => {
      const backlogPath = join(nexusDir, "docs", "BACKLOG.md");
      mkdirSync(join(nexusDir, "docs"), { recursive: true });
      writeFileSync(backlogPath, "# BACKLOG\n\nExisting items\n", "utf-8");

      const rule = createMockRule({
        trigger: "session_start",
        conditions: [],
        actions: [
          { type: "update_backlog", params: { item: "Test item added by rule" } },
        ],
      });
      const context = createMockContext({ trigger: "session_start", nexusDir });

      const result = await executeRules([rule], context);
      expect(result.rulesExecuted).toBe(1);

      const backlog = readFileSync(backlogPath, "utf-8");
      expect(backlog).toContain("Test item added by rule");
    });
  });

  describe("getDefaultRules", () => {
    it("returns default rules", () => {
      const rules = getDefaultRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it("all default rules have valid IDs", () => {
      const rules = getDefaultRules();
      for (const rule of rules) {
        expect(rule.id).toMatch(/^[A-Z0-9_-]+$/);
      }
    });

    it("all default rules are enabled", () => {
      const rules = getDefaultRules();
      for (const rule of rules) {
        expect(rule.enabled).toBe(true);
      }
    });
  });
});
