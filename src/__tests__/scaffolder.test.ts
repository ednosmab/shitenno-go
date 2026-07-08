import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldNexusSystem, } from "../scaffolder.js";
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

    it("does NOT create governance-only files for core only", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      // context_buffer.yaml IS now in core (always created)
      expect(result.filesCreated).toContain(
        "nexus-system/governance/context/context_buffer.yaml"
      );
      // WORKFLOW.md is governance-only
      expect(result.filesCreated).not.toContain(
        "nexus-system/governance/WORKFLOW.md"
      );
    });

    it("creates .gitignore with feedback pattern", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      const content = readFileSync(
        join(tempDir, ".gitignore"),
        "utf-8"
      );
      expect(content).toContain("nexus-system/docs/feedback");
    });

    it("creates capabilities.md with customization", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), coreCaps);
      expect(existsSync(join(tempDir, "nexus-system", "docs", "capabilities.md"))).toBe(true);
      const content = readFileSync(
        join(tempDir, "nexus-system", "docs", "capabilities.md"),
        "utf-8"
      );
      expect(content).toContain("CAPABILITIES");
      expect(content).toContain("capacidade");
    });

    it("AGENTS.md excludes governance section when governance not installed", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "docs", "AGENTS.md"),
        "utf-8"
      );
      // The governance section should be removed
      expect(content).not.toContain("ALGORITMO DE GESTÃO DE CONTEXTO");
      // Non-capability sections should remain
      expect(content).toContain("AGENTS.md");
    });

    it("AGENTS.md includes governance section when governance installed", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core", "governance"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "docs", "AGENTS.md"),
        "utf-8"
      );
      expect(content).toContain("ALGORITMO DE GESTÃO DE CONTEXTO");
    });

    it("AGENTS.md includes knowledge section when knowledge installed", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core", "knowledge"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "docs", "AGENTS.md"),
        "utf-8"
      );
      expect(content).toContain("GOVERNANÇA DO DESIGN SYSTEM");
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
        "nexus-system/governance/plans/TEMPLATE.md"
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

  // ── SYSTEM_MAP.md Capability Status ──────────────────────────────────────

  describe("SYSTEM_MAP.md capability status indicators", () => {
    it("shows ✅ for installed capabilities and 📋 for uninstalled", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core", "governance"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "governance", "SYSTEM_MAP.md"),
        "utf-8"
      );
      // core and governance should be installed
      expect(content).toContain("✅");
      // Other capabilities should be available
      expect(content).toContain("📋");
      // Should not contain 🔮 (future) since all 9 capabilities are defined
      // with either ✅ or 📋
    });

    it("shows all ✅ when all capabilities installed", () => {
      const allCaps: Capability[] = ["core", "knowledge", "architecture", "governance", "ai", "quality", "metrics", "operations", "compliance"];
      scaffoldNexusSystem(tempDir, makeAnswers(), allCaps);
      const content = readFileSync(
        join(tempDir, "nexus-system", "governance", "SYSTEM_MAP.md"),
        "utf-8"
      );
      // core should be ✅
      expect(content).toContain("✅");
      // All 9 capabilities should appear as ✅ installed
      const statusLines = content.split("\n").filter((line) => line.match(/^\| `\w+` \| [✅📋🔮]/));
      expect(statusLines.length).toBe(9);
      // All status lines should have ✅
      for (const line of statusLines) {
        expect(line).toContain("✅");
        expect(line).toContain("instalado");
      }
    });

    it("core is always ✅ even with only core installed", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "governance", "SYSTEM_MAP.md"),
        "utf-8"
      );
      // core should be ✅
      expect(content).toContain("✅");
      // capabilities.md reference should be present
      expect(content).toContain("capabilities.md");
      // Legend should be present
      expect(content).toContain("Legenda de Estados");
    });

    it("preserves non-capability sections of SYSTEM_MAP.md", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "governance", "SYSTEM_MAP.md"),
        "utf-8"
      );
      // Core sections should remain
      expect(content).toContain("Regras de Leitura");
      expect(content).toContain("Hierarquia P0-P4");
      expect(content).toContain("Mapa de Scripts");
      expect(content).toContain("Diagnóstico de Capacidades");
    });
  });

  // ── capabilities.md Scaffolding ──────────────────────────────────────────

  describe("capabilities.md scaffolding", () => {
    it("creates capabilities.md during scaffold", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      expect(existsSync(join(tempDir, "nexus-system", "docs", "capabilities.md"))).toBe(true);
    });

    it("capabilities.md contains all capability definitions", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "docs", "capabilities.md"),
        "utf-8"
      );
      expect(content).toContain("core");
      expect(content).toContain("knowledge");
      expect(content).toContain("governance");
      expect(content).toContain("architecture");
      expect(content).toContain("ai");
      expect(content).toContain("quality");
      expect(content).toContain("metrics");
      expect(content).toContain("operations");
      expect(content).toContain("compliance");
    });

    it("capabilities.md is not duplicated when same capability set", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core", "knowledge"]);
      // Run again with same capabilities - should not fail
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core", "knowledge"]);
      expect(existsSync(join(tempDir, "nexus-system", "docs", "capabilities.md"))).toBe(true);
    });

    it("capabilities.md references SYSTEM_MAP.md", () => {
      scaffoldNexusSystem(tempDir, makeAnswers(), ["core"]);
      const content = readFileSync(
        join(tempDir, "nexus-system", "docs", "capabilities.md"),
        "utf-8"
      );
      expect(content).toContain("SYSTEM_MAP.md");
    });
  });
});
