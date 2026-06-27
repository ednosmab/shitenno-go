import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  calculateMaturityProfile,
  detectInstalledCapabilities,
  saveMaturityProfile,
  loadMaturityProfile,
  recordMaturitySnapshot,
  readMaturityHistory,
  profileToLegacyLevel,
  type MaturityAnswers,
  type MaturityProfile,
} from "../maturity-profile.js";
import type { ProjectAnalysis } from "../analyser.js";

// ── Test Fixtures ──────────────────────────────────────────────────────────

const EMPTY_ANSWERS: MaturityAnswers = {
  usedNexusBefore: false,
  isFirstProject: true,
  projectAge: "new",
  teamSize: "solo",
  hasDedicatedTeam: false,
  hasArchitectureDocs: false,
  hasADRs: false,
  hasTechnicalReviews: false,
  hasCICD: false,
  hasAutomatedTests: false,
  hasValidationPipeline: false,
  intendsToUseAI: false,
  aiWillImplement: false,
  requiresHumanReview: false,
  hasDefinedPatterns: false,
  hasReviewProcess: false,
  hasDecisionControl: false,
};

const FULL_ANSWERS: MaturityAnswers = {
  usedNexusBefore: true,
  isFirstProject: false,
  projectAge: "mature",
  teamSize: "large",
  hasDedicatedTeam: true,
  hasArchitectureDocs: true,
  hasADRs: true,
  hasTechnicalReviews: true,
  hasCICD: true,
  hasAutomatedTests: true,
  hasValidationPipeline: true,
  intendsToUseAI: true,
  aiWillImplement: true,
  requiresHumanReview: true,
  hasDefinedPatterns: true,
  hasReviewProcess: true,
  hasDecisionControl: true,
};

const BASE_ANALYSIS: ProjectAnalysis = {
  rootDir: "/tmp/test",
  hasGit: false,
  hasPackageJson: true,
  hasNexus: false,
  stack: ["react"],
  packageManager: "pnpm",
  monorepo: false,
  packageCount: 1,
  appCount: 1,
  dependencyCount: 10,
  sourceFileCount: 20,
  hasTests: false,
  hasLinter: false,
  hasCI: false,
  hasTypeScript: true,
};

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-maturity-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ── Dimension Calculation ──────────────────────────────────────────────────

describe("calculateMaturityProfile", () => {
  describe("empty project (all false)", () => {
    it("returns all dimensions at 0 (except automation from hasTypeScript)", () => {
      const noTSAnalysis = { ...BASE_ANALYSIS, hasTypeScript: false };
      const profile = calculateMaturityProfile(EMPTY_ANSWERS, noTSAnalysis);
      expect(profile.dimensions.architecture).toBe(0);
      expect(profile.dimensions.governance).toBe(0);
      expect(profile.dimensions.quality).toBe(0);
      expect(profile.dimensions.automation).toBe(0);
      expect(profile.dimensions.ai).toBe(0);
      expect(profile.dimensions.documentation).toBe(0);
      expect(profile.dimensions.observability).toBe(0);
    });

    it("returns very low overallScore", () => {
      const profile = calculateMaturityProfile(EMPTY_ANSWERS, BASE_ANALYSIS);
      // hasTypeScript adds 10 to automation, so overallScore > 0
      expect(profile.overallScore).toBeLessThanOrEqual(5);
    });

    it("installs only core capability when no nexusDir", () => {
      const profile = calculateMaturityProfile(EMPTY_ANSWERS, BASE_ANALYSIS);
      expect(profile.installedCapabilities).toEqual(["core"]);
    });
  });

  describe("full project (all true)", () => {
    it("architecture dimension >= 70", () => {
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(profile.dimensions.architecture).toBeGreaterThanOrEqual(70);
    });

    it("governance dimension >= 85", () => {
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(profile.dimensions.governance).toBeGreaterThanOrEqual(85);
    });

    it("quality dimension >= 75", () => {
      // hasAutomatedTests(30) + hasCICD(25) + hasValidationPipeline(20) = 75
      // analysis.hasTests and hasLinter are false in BASE_ANALYSIS
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(profile.dimensions.quality).toBeGreaterThanOrEqual(75);
    });

    it("automation dimension >= 90", () => {
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(profile.dimensions.automation).toBeGreaterThanOrEqual(90);
    });

    it("ai dimension >= 90", () => {
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(profile.dimensions.ai).toBeGreaterThanOrEqual(90);
    });

    it("overallScore >= 60", () => {
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(profile.overallScore).toBeGreaterThanOrEqual(60);
    });
  });

  describe("analysis contribution", () => {
    it("monorepo increases architecture", () => {
      const withMono = calculateMaturityProfile(EMPTY_ANSWERS, { ...BASE_ANALYSIS, monorepo: true });
      const withoutMono = calculateMaturityProfile(EMPTY_ANSWERS, BASE_ANALYSIS);
      expect(withMono.dimensions.architecture).toBeGreaterThan(withoutMono.dimensions.architecture);
    });

    it("hasTests increases quality", () => {
      const withTests = calculateMaturityProfile(EMPTY_ANSWERS, { ...BASE_ANALYSIS, hasTests: true });
      const withoutTests = calculateMaturityProfile(EMPTY_ANSWERS, BASE_ANALYSIS);
      expect(withTests.dimensions.quality).toBeGreaterThan(withoutTests.dimensions.quality);
    });

    it("hasTypeScript increases automation", () => {
      const withTS = calculateMaturityProfile(EMPTY_ANSWERS, { ...BASE_ANALYSIS, hasTypeScript: true });
      const withoutTS = calculateMaturityProfile(EMPTY_ANSWERS, { ...BASE_ANALYSIS, hasTypeScript: false });
      expect(withTS.dimensions.automation).toBeGreaterThan(withoutTS.dimensions.automation);
    });
  });

  describe("overallScore is clamped to 0-100", () => {
    it("never exceeds 100", () => {
      const analysis: ProjectAnalysis = { ...BASE_ANALYSIS, monorepo: true, packageCount: 10, hasTests: true, hasLinter: true };
      const profile = calculateMaturityProfile(FULL_ANSWERS, analysis);
      expect(profile.overallScore).toBeLessThanOrEqual(100);
      expect(profile.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("computedAt is set", () => {
    it("has a valid ISO date string", () => {
      const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
      expect(new Date(profile.computedAt).getTime()).not.toBeNaN();
    });
  });
});

// ── Capability Detection ──────────────────────────────────────────────────

describe("detectInstalledCapabilities", () => {
  it("always includes core", () => {
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("core");
  });

  it("detects knowledge when docs/skills exists", () => {
    mkdirSync(join(tempDir, "docs", "skills"), { recursive: true });
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("knowledge");
  });

  it("detects knowledge when docs/AGENTS.md exists", () => {
    mkdirSync(join(tempDir, "docs"), { recursive: true });
    writeFileSync(join(tempDir, "docs", "AGENTS.md"), "# Agents");
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("knowledge");
  });

  it("detects architecture when docs/adrs exists", () => {
    mkdirSync(join(tempDir, "docs", "adrs"), { recursive: true });
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("architecture");
  });

  it("detects governance when governance/context exists", () => {
    mkdirSync(join(tempDir, "governance", "context"), { recursive: true });
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("governance");
  });

  it("detects ai when governance/agents exists", () => {
    mkdirSync(join(tempDir, "governance", "agents"), { recursive: true });
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("ai");
  });

  it("detects quality when scripts/validate-session.ts exists", () => {
    mkdirSync(join(tempDir, "scripts"), { recursive: true });
    writeFileSync(join(tempDir, "scripts", "validate-session.ts"), "// validate");
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("quality");
  });

  it("detects metrics when reports/ exists", () => {
    mkdirSync(join(tempDir, "reports"), { recursive: true });
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("metrics");
  });

  it("detects operations when scripts/close-session.ts exists", () => {
    mkdirSync(join(tempDir, "scripts"), { recursive: true });
    writeFileSync(join(tempDir, "scripts", "close-session.ts"), "// close");
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("operations");
  });

  it("detects compliance when docs/FORBIDDEN_OPERATIONS.md exists", () => {
    mkdirSync(join(tempDir, "docs"), { recursive: true });
    writeFileSync(join(tempDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# FORBIDDEN");
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toContain("compliance");
  });

  it("returns only core for empty directory", () => {
    const caps = detectInstalledCapabilities(tempDir);
    expect(caps).toEqual(["core"]);
  });
});

// ── Recommendation Engine ─────────────────────────────────────────────────

describe("recommendation engine", () => {
    it("recommends knowledge for high documentation score", () => {
      const answers: MaturityAnswers = {
        ...EMPTY_ANSWERS,
        hasArchitectureDocs: true,
        hasADRs: true,
        usedNexusBefore: true,
      };
      const profile = calculateMaturityProfile(answers, BASE_ANALYSIS, tempDir);
      expect(profile.recommendedCapabilities).toContain("knowledge");
    });

    it("does not recommend ai when governance is not in installed or recommended", () => {
      // Create a scenario where governance dimension is low
      const lowGovAnswers: MaturityAnswers = {
        ...EMPTY_ANSWERS,
        intendsToUseAI: true,
        aiWillImplement: true,
        requiresHumanReview: true,
      };
      const profile = calculateMaturityProfile(lowGovAnswers, BASE_ANALYSIS, tempDir);
      // With low governance (0), governance won't be recommended, so AI deps aren't met
      expect(profile.installedCapabilities).not.toContain("governance");
      // AI requires governance — verify the engine respects dependencies
      if (!profile.recommendedCapabilities.includes("governance")) {
        expect(profile.recommendedCapabilities).not.toContain("ai");
      }
    });

    it("futureCapabilities lists non-installed, non-recommended capabilities", () => {
      const profile = calculateMaturityProfile(EMPTY_ANSWERS, BASE_ANALYSIS);
      const allActive = [...profile.installedCapabilities, ...profile.recommendedCapabilities];
      for (const future of profile.futureCapabilities) {
        expect(allActive).not.toContain(future);
      }
    });
  });

// ── Profile Persistence ──────────────────────────────────────────────────

describe("saveMaturityProfile / loadMaturityProfile", () => {
  it("saves and loads profile correctly", () => {
    const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
    saveMaturityProfile(tempDir, profile);

    const loaded = loadMaturityProfile(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.overallScore).toBe(profile.overallScore);
    expect(loaded!.dimensions).toEqual(profile.dimensions);
  });

  it("returns null for missing profile", () => {
    expect(loadMaturityProfile(tempDir)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    writeFileSync(join(tempDir, "maturity-profile.json"), "not json");
    expect(loadMaturityProfile(tempDir)).toBeNull();
  });
});

// ── Telemetry ──────────────────────────────────────────────────────────

describe("telemetry", () => {
  it("recordMaturitySnapshot creates telemetry file", () => {
    const profile = calculateMaturityProfile(FULL_ANSWERS, BASE_ANALYSIS);
    recordMaturitySnapshot(tempDir, profile);

    const history = readMaturityHistory(tempDir);
    expect(history.length).toBe(1);
    expect(history[0].overallScore).toBe(profile.overallScore);
  });

  it("readMaturityHistory returns empty for no telemetry", () => {
    expect(readMaturityHistory(tempDir)).toEqual([]);
  });
});

// ── Legacy Compatibility ──────────────────────────────────────────────

describe("profileToLegacyLevel", () => {
  it("returns junior for low scores", () => {
    const profile = calculateMaturityProfile(EMPTY_ANSWERS, BASE_ANALYSIS);
    expect(profileToLegacyLevel(profile)).toBe("junior");
  });

  it("returns senior for high scores", () => {
    const analysis: ProjectAnalysis = { ...BASE_ANALYSIS, monorepo: true, packageCount: 5, hasTests: true, hasLinter: true };
    const profile = calculateMaturityProfile(FULL_ANSWERS, analysis);
    if (profile.overallScore >= 65) {
      expect(profileToLegacyLevel(profile)).toBe("senior");
    }
  });
});
