import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldNexusSystem, type ScaffoldResult } from "../scaffolder.js";
import type { UserAnswers } from "../prompts.js";
import type { Capability } from "../maturity-profile.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-scaffold-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const DEFAULT_MATURITY = {
  usedNexusBefore: false,
  isFirstProject: false,
  projectAge: "new" as const,
  teamSize: "solo" as const,
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

function makeAnswers(overrides: Partial<UserAnswers> = {}): UserAnswers {
  return {
    principalModel: "opencode/mimo-v2.5-free",
    executorModel: "opencode/deepseek-v4-flash-free",
    stack: ["react", "nextjs"],
    database: "PostgreSQL",
    styling: "Tailwind CSS",
    maturity: { ...DEFAULT_MATURITY },
    ...overrides,
  };
}

// ── scaffoldNexusSystem ──────────────────────────────────────────────────────

describe("scaffoldNexusSystem", () => {
  describe("junior level", () => {
    const coreCaps: Capability[] = ["core", "knowledge"];

    it("creates base directories", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      expect(result.capabilities).toContain("core");
      expect(result.directoriesCreated).toContain("nexus-system");
      expect(result.directoriesCreated).toContain("nexus-system/docs");
      expect(result.directoriesCreated).toContain("nexus-system/scripts");
      expect(result.directoriesCreated).toContain("nexus-system/docs/skills");
    });

    it("creates base files", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      expect(result.filesCreated).toContain("nexus-system/docs/AGENTS.md");
      expect(result.filesCreated).toContain("nexus-system/docs/FORBIDDEN_OPERATIONS.md");
      expect(result.filesCreated).toContain("nexus-system/docs/DESDO.md");
      expect(result.filesCreated).toContain("nexus-system/governance/SYSTEM_MAP.md");
      expect(result.filesCreated).toContain("opencode.json");
    });

    it("copies core skills", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      const skills = result.filesCreated.filter((f) =>
        f.includes("nexus-system/docs/skills/")
      );
      expect(skills.length).toBeGreaterThanOrEqual(11);
    });

    it("generates opencode.json at project root", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      expect(existsSync(join(tempDir, "opencode.json"))).toBe(true);
    });

    it("customizes AGENTS.md with stack info", () => {
      scaffoldNexusSystem(tempDir, makeAnswers({ stack: ["react", "nextjs"] }), coreCaps);
      const content = require("node:fs").readFileSync(
        join(tempDir, "nexus-system", "docs", "AGENTS.md"),
        "utf-8"
      );
      expect(content).toContain("react");
      expect(content).toContain("nextjs");
      expect(content).not.toContain("[PERSONALIZAR:");
    });

    it("does NOT create governance files for core only", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      expect(result.filesCreated).not.toContain(
        "nexus-system/governance/context/context_buffer.yaml"
      );
    });

    it("creates .gitignore with feedback pattern", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      const content = require("node:fs").readFileSync(
        join(tempDir, ".gitignore"),
        "utf-8"
      );
      expect(content).toContain("nexus-system/docs/feedback");
    });
  });

  describe("pleno level", () => {
    it("adds context_buffer.yaml", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers(),
        ["core", "knowledge", "governance"]
      );
      expect(result.capabilities).toContain("governance");
      expect(result.filesCreated).toContain(
        "nexus-system/governance/context/context_buffer.yaml"
      );
    });

    it("copies knowledge + governance skills", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers(),
        ["core", "knowledge", "governance"]
      );
      const skills = result.filesCreated.filter((f) =>
        f.includes("nexus-system/docs/skills/")
      );
      expect(skills.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe("senior level", () => {
    const seniorCaps: Capability[] = ["core", "knowledge", "architecture", "governance", "ai", "quality", "metrics", "operations", "compliance"];

    it("adds cognition and all governance templates", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers(),
        seniorCaps
      );
      expect(result.capabilities).toContain("ai");
      expect(result.filesCreated).toContain(
        "nexus-system/cognition/context/CONTEXT_HIERARCHY.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/governance/contracts/CONTRACTS_INDEX.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/governance/handoffs/TEMPLATE.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/governance/premortem/PREMORTEM.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/governance/reviews/SESSION_REVIEW.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/docs/adrs/ADR-TEMPLATE.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/docs/sdr/SDR-TEMPLATE.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/docs/plans/TEMPLATE.md"
      );
      expect(result.filesCreated).toContain(
        "nexus-system/docs/session-template.md"
      );
    });

    it("copies all skills for senior", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers(),
        seniorCaps
      );
      const skills = result.filesCreated.filter((f) =>
        f.includes("nexus-system/docs/skills/")
      );
      expect(skills.length).toBeGreaterThanOrEqual(11);
    });

    it("creates reports/ directory", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers(),
        seniorCaps
      );
      expect(result.directoriesCreated).toContain("nexus-system/reports");
    });
  });
});
