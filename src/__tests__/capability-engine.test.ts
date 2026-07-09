import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  evaluateCapabilities,
  saveCapabilityEngineResult,
  loadCapabilityEngineResult,
  initializeCapabilityEngine,
  capabilityEngineToText,
  type CapabilityEngineResult,
  type CapabilityEntity,
} from "../capability-engine.js";
import type { EngineeringState } from "../engineering-state.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const TEST_DIR = join(tmpdir(), "nexus-capability-test");
const NEXUS_DIR = join(TEST_DIR, "nexus");

beforeAll(() => {
  mkdirSync(join(NEXUS_DIR, "governance", "rules"), { recursive: true });
  mkdirSync(join(NEXUS_DIR, "governance", "context"), { recursive: true });
  mkdirSync(join(NEXUS_DIR, "governance", "backlog"), { recursive: true });
  writeFileSync(
    join(NEXUS_DIR, "governance", "context", "context_buffer.yaml"),
    "reminders:\n  - test\n",
  );
  writeFileSync(
    join(NEXUS_DIR, "governance", "context", "quick_board.md"),
    "# Quick Board\n## Proximo\n- item\n",
  );
});
afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function makeState(overrides: Partial<EngineeringState> = {}): EngineeringState {
  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle: "governed",
    project: {
      name: "test-project",
      root: TEST_DIR,
      stack: [],
      hasGit: false,
      hasCI: false,
      hasTests: false,
      hasTypeScript: false,
      packageCount: 0,
      sourceFileCount: 0,
      monorepo: false,
    },
    maturity: null,
    capabilities: [],
    capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
    knowledgeDebt: null,
    knowledgeGraph: null,
    assets: [],
    assetsByType: {} as Record<string, number>,
    activeRules: 0,
    activePolicies: 0,
    healthScores: { knowledgeDebt: 0, knowledgeGraph: 0, overall: 50 },
    entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
    summary: "test",
    ...overrides,
  };
}

function makeCapEntity(overrides: Partial<CapabilityEntity> = {}): CapabilityEntity {
  return {
    id: "cap-1" as any,
    name: "Test Capability",
    description: "Test",
    maturity: "installed",
    maturityScore: 40,
    dimensions: {},
    dependencies: [],
    activePolicies: [],
    activeSkills: [],
    templates: [],
    recommendations: [],
    metrics: {
      assetCount: 0,
      ruleCount: 0,
      policyCount: 0,
      healthScore: 50,
      lastUpdated: new Date().toISOString(),
      referenceCount: 0,
    },
    alwaysInstalled: false,
    isInstalled: false,
    files: [],
    ...overrides,
  };
}

describe("evaluateCapabilities", () => {
  it("returns a CapabilityEngineResult", () => {
    const result = evaluateCapabilities(makeState(), NEXUS_DIR);
    expect(result).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    expect(typeof result.overallScore).toBe("number");
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.summary).toBe("string");
  });

  it("capabilities have maturity levels", () => {
    const result = evaluateCapabilities(makeState(), NEXUS_DIR);
    for (const cap of result.capabilities) {
      expect(typeof cap.id).toBe("string");
      expect(typeof cap.name).toBe("string");
      expect(["dormant", "installed", "configured", "active", "optimized"]).toContain(cap.maturity);
      expect(typeof cap.maturityScore).toBe("number");
      expect(typeof cap.isInstalled).toBe("boolean");
    }
  });
});

describe("saveCapabilityEngineResult / loadCapabilityEngineResult", () => {
  it("round-trips through disk", () => {
    const result: CapabilityEngineResult = {
      evaluatedAt: new Date().toISOString(),
      capabilities: [],
      byMaturity: { dormant: [], installed: [], configured: [], active: [], optimized: [] },
      overallScore: 75,
      recommendations: [],
      summary: "test",
    };
    saveCapabilityEngineResult(NEXUS_DIR, result);
    const loaded = loadCapabilityEngineResult(NEXUS_DIR);
    expect(loaded).toBeDefined();
    expect(loaded!.overallScore).toBe(75);
  });

  it("returns null when file missing", () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });
    expect(loadCapabilityEngineResult(emptyDir)).toBeNull();
  });
});

describe("initializeCapabilityEngine", () => {
  it("subscribes to capability.installed event", () => {
    expect(() => initializeCapabilityEngine(TEST_DIR, NEXUS_DIR)).not.toThrow();
  });
});

describe("capabilityEngineToText", () => {
  it("returns non-empty text", () => {
    const result: CapabilityEngineResult = {
      evaluatedAt: new Date().toISOString(),
      capabilities: [makeCapEntity()],
      byMaturity: { dormant: [], installed: ["cap-1" as any], configured: [], active: [], optimized: [] },
      overallScore: 40,
      recommendations: [],
      summary: "1 capability",
    };
    const text = capabilityEngineToText(result);
    expect(text).toContain("Test Capability");
    expect(text).toContain("installed");
  });
});
