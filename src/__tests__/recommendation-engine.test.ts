import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runRecommendationEngine,
  saveRecommendationResult,
  loadRecommendationResult,
  recommendationEngineToText,
  type RecommendationEngineResult,
} from "../recommendation-engine.js";
import type { EngineeringState } from "../engineering-state.js";
import type { CapabilityEngineResult } from "../capability-engine.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const TEST_DIR = join(tmpdir(), "nexus-rec-engine-test");
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
    lifecycle: { phase: "active", since: new Date().toISOString() },
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

function makeCapResult(overrides: Partial<CapabilityEngineResult> = {}): CapabilityEngineResult {
  return {
    evaluatedAt: new Date().toISOString(),
    capabilities: [],
    byMaturity: { dormant: [], installed: [], configured: [], active: [], optimized: [] },
    overallScore: 50,
    recommendations: [],
    summary: "test",
    ...overrides,
  };
}

describe("runRecommendationEngine", () => {
  it("returns a RecommendationEngineResult", () => {
    const result = runRecommendationEngine(makeState(), makeCapResult(), NEXUS_DIR);
    expect(result).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.generatedAt).toBe("string");
    expect(typeof result.totalRecommendations).toBe("number");
    expect(typeof result.engineeringCapacityScore).toBe("number");
  });

  it("recommendations have required fields", () => {
    const result = runRecommendationEngine(makeState(), makeCapResult(), NEXUS_DIR);
    for (const rec of result.recommendations) {
      expect(typeof rec.id).toBe("string");
      expect(typeof rec.title).toBe("string");
      expect(typeof rec.description).toBe("string");
      expect(["urgent", "high", "medium", "low"]).toContain(rec.priority);
      expect(typeof rec.confidence).toBe("number");
      expect(typeof rec.source).toBe("string");
    }
  });

  it("bySource and byPriority are populated", () => {
    const result = runRecommendationEngine(makeState(), makeCapResult(), NEXUS_DIR);
    expect(result.bySource).toBeDefined();
    expect(result.byPriority).toBeDefined();
  });
});

describe("saveRecommendationResult / loadRecommendationResult", () => {
  it("round-trips through disk", () => {
    const result: RecommendationEngineResult = {
      generatedAt: new Date().toISOString(),
      totalRecommendations: 0,
      bySource: { capability_engine: 0, knowledge_debt: 0, pattern_detection: 0, entropy: 0, ai_readiness: 0, asset_management: 0 },
      byPriority: {},
      recommendations: [],
      topNextSteps: [],
      engineeringCapacityScore: 80,
      summary: "test",
    };
    saveRecommendationResult(NEXUS_DIR, result);
    const loaded = loadRecommendationResult(NEXUS_DIR);
    expect(loaded).toBeDefined();
    expect(loaded!.engineeringCapacityScore).toBe(80);
  });

  it("returns null when file missing", () => {
    const emptyDir = join(TEST_DIR, "empty-rec");
    mkdirSync(emptyDir, { recursive: true });
    expect(loadRecommendationResult(emptyDir)).toBeNull();
  });
});

describe("recommendationEngineToText", () => {
  it("returns non-empty text", () => {
    const result: RecommendationEngineResult = {
      generatedAt: new Date().toISOString(),
      totalRecommendations: 1,
      bySource: { capability_engine: 1, knowledge_debt: 0, pattern_detection: 0, entropy: 0, ai_readiness: 0, asset_management: 0 },
      byPriority: { high: 1 },
      recommendations: [
        {
          id: "rec-1",
          source: "capability_engine",
          type: "activate",
          priority: "high",
          title: "Test Recommendation",
          description: "Do something",
          expectedImpact: "Improved governance",
          action: "Run nexus assess",
          command: "nexus assess",
          affectedArtifacts: [],
          dependencies: [],
          confidence: 0.9,
          evidence: ["Because"],
          generatedAt: new Date().toISOString(),
        },
      ],
      topNextSteps: ["Run nexus assess"],
      engineeringCapacityScore: 80,
      summary: "test",
    };
    const text = recommendationEngineToText(result);
    expect(text).toContain("Test Recommendation");
    expect(text).toContain("Run nexus assess");
  });
});
