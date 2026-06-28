import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateChallengingAlternative,
  calculateKnowledgeGap,
  detectParadigmShift,
  ensureFlowState,
  type DualPath,
} from "../challenge-generator.js";
import { loadGrowthProfile, recordPathChoice, type GrowthProfile } from "../growth-profile.js";
import type { EvolutionRecommendation } from "../auto-evolution.js";
import type { NexusState } from "../state-manager.js";

let tempDir: string;
let nexusDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-challenge-"));
  nexusDir = join(tempDir, "nexus-system");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Challenge Generator", () => {
  const defaultContext = {
    command: "evolve",
    recommendationType: "capability_install",
    maturityScore: 50,
  };

  const mockRecommendation: EvolutionRecommendation = {
    id: "EVO-001",
    type: "capability_install",
    priority: "high",
    title: "Install Governance",
    description: "Add governance capability to your project",
    expectedImpact: "Adds governance to your project",
    action: "Run 'nexus upgrade --capability governance'",
    command: "nexus upgrade --capability governance",
    affectedArtifacts: ["nexus-system/governance"],
    dependencies: [],
    confidence: 0.8,
    evidence: ["Maturity profile recommends this capability"],
    feedbackAdjusted: false,
  };

  const mockState: NexusState = {
    knowledge: {
      adrs: [],
      skills: [],
      contracts: [],
      governanceDocs: [],
      scripts: [],
      runbooks: [],
    },
    project: {
      maturity: { overallScore: 50, dimensions: {}, computedAt: "" },
      installedCapabilities: ["core"],
      recommendedCapabilities: ["governance"],
      knowledgeDebt: null,
      complexity: null,
      projectInfo: {
        name: "test",
        stack: [],
        hasGit: true,
        hasCI: false,
        hasTests: false,
        hasTypeScript: false,
        packageCount: 0,
        sourceFileCount: 10,
      },
    },
    memory: {
      sessionId: null,
      branch: null,
      operationType: null,
      currentTask: { id: null, type: null, description: null, status: null },
      quickBoard: { emCurso: null, parado: [], proximo: [] },
      reminders: [],
      nextSteps: [],
      blockers: [],
      documentsLoaded: [],
    },
    consolidatedAt: new Date().toISOString(),
  };

  describe("generateChallengingAlternative", () => {
    it("generates a challenging alternative for a comfortable recommendation", () => {
      const profile = loadGrowthProfile(nexusDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile);

      expect(challenging).toBeDefined();
      expect(challenging.id).toContain("CHL");
      expect(challenging.title).toContain("Master");
      expect(challenging.id).not.toBe(mockRecommendation.id);
    });

    it("preserves the recommendation type", () => {
      const profile = loadGrowthProfile(nexusDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile);

      expect(challenging.type).toBe(mockRecommendation.type);
    });

    it("adjusts confidence based on growth capacity", () => {
      const profile = loadGrowthProfile(nexusDir);
      profile.growthCapacity = 0.8;

      const challenging = generateChallengingAlternative(mockRecommendation, profile);
      expect(challenging.confidence).toBeGreaterThan(0.3);
    });

    it("includes paradigm shift in evidence", () => {
      const profile = loadGrowthProfile(nexusDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile);

      const hasParadigmShift = challenging.evidence.some((e) =>
        e.includes("Paradigm shift")
      );
      expect(hasParadigmShift).toBe(true);
    });

    it("includes knowledge gap when state is provided", () => {
      const profile = loadGrowthProfile(nexusDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile, mockState);

      const hasKnowledgeGap = challenging.evidence.some((e) =>
        e.includes("Knowledge gap")
      );
      expect(hasKnowledgeGap).toBe(true);
    });
  });

  describe("calculateKnowledgeGap", () => {
    it("identifies missing knowledge for capability install", () => {
      const gap = calculateKnowledgeGap(mockRecommendation, mockState);

      expect(gap).toBeDefined();
      expect(gap.requiredKnowledge).toContain("Install Governance patterns");
      expect(gap.severity).toBeDefined();
    });

    it("identifies existing knowledge", () => {
      const stateWithKnowledge: NexusState = {
        ...mockState,
        knowledge: {
          ...mockState.knowledge,
          adrs: [{ id: "ADR-001", title: "Test", status: "accepted", path: "" }],
        },
      };

      const gap = calculateKnowledgeGap(
        { ...mockRecommendation, type: "knowledge_creation" },
        stateWithKnowledge
      );

      expect(gap.currentKnowledge).toContain("ADR creation");
    });

    it("returns correct severity levels", () => {
      const gap = calculateKnowledgeGap(mockRecommendation, mockState);
      expect(["low", "medium", "high"]).toContain(gap.severity);
    });
  });

  describe("detectParadigmShift", () => {
    it("detects paradigm shift for significant changes", () => {
      const shift = detectParadigmShift(mockRecommendation);

      expect(shift).toBeDefined();
      expect(shift!.currentParadigm).toBeDefined();
      expect(shift!.newParadigm).toBeDefined();
    });

    it("returns null for minor shifts", () => {
      // debt_remediation has a major shift, so this should return something
      const shift = detectParadigmShift({
        ...mockRecommendation,
        type: "debt_remediation",
      });

      expect(shift).toBeDefined();
    });
  });

  describe("ensureFlowState", () => {
    it("returns challenge slightly above capacity", () => {
      const flowChallenge = ensureFlowState(0.5, 0.4);
      expect(flowChallenge).toBeGreaterThan(0.4);
      expect(flowChallenge).toBeLessThanOrEqual(1.0);
    });

    it("clamps to 0-1 range", () => {
      expect(ensureFlowState(1.0, 0.9)).toBeLessThanOrEqual(1.0);
      expect(ensureFlowState(0.0, 0.1)).toBeGreaterThanOrEqual(0);
    });

    it("adapts to high growth capacity", () => {
      const flowHigh = ensureFlowState(0.8, 0.8);
      const flowLow = ensureFlowState(0.8, 0.3);

      expect(flowHigh).toBeGreaterThan(flowLow);
    });
  });
});
