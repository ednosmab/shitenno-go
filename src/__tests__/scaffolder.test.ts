import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldNexusSystem, type ScaffoldResult } from "../scaffolder.js";
import type { UserAnswers } from "../prompts.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-scaffold-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeAnswers(overrides: Partial<UserAnswers> = {}): UserAnswers {
  return {
    principalModel: "opencode/mimo-v2.5-free",
    executorModel: "opencode/deepseek-v4-flash-free",
    stack: ["react", "nextjs"],
    database: "PostgreSQL",
    styling: "Tailwind CSS",
    teamLevel: "junior",
    ...overrides,
  };
}

// ── scaffoldNexusSystem ──────────────────────────────────────────────────────

describe("scaffoldNexusSystem", () => {
  describe("junior level", () => {
    it("creates base directories", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers());
      expect(result.level).toBe("junior");
      expect(result.directoriesCreated).toContain("nexus-system");
      expect(result.directoriesCreated).toContain("nexus-system/docs");
      expect(result.directoriesCreated).toContain("nexus-system/scripts");
      expect(result.directoriesCreated).toContain("nexus-system/docs/skills");
    });

    it("creates base files", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers());
      expect(result.filesCreated).toContain("nexus-system/docs/AGENTS.md");
      expect(result.filesCreated).toContain("nexus-system/docs/FORBIDDEN_OPERATIONS.md");
      expect(result.filesCreated).toContain("nexus-system/docs/DESDO.md");
      expect(result.filesCreated).toContain("nexus-system/governance/WORKFLOW.md");
      expect(result.filesCreated).toContain("nexus-system/governance/SYSTEM_MAP.md");
      expect(result.filesCreated).toContain("opencode.json");
    });

    it("copies 11 skills for junior", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers());
      const skills = result.filesCreated.filter((f) =>
        f.includes("nexus-system/docs/skills/")
      );
      expect(skills.length).toBe(11);
    });

    it("generates opencode.json at project root", () => {
      scaffoldNexusSystem(tempDir, makeAnswers());
      expect(existsSync(join(tempDir, "opencode.json"))).toBe(true);
    });

    it("customizes AGENTS.md with stack info", () => {
      scaffoldNexusSystem(tempDir, makeAnswers({ stack: ["react", "nextjs"] }));
      const content = require("node:fs").readFileSync(
        join(tempDir, "nexus-system", "docs", "AGENTS.md"),
        "utf-8"
      );
      expect(content).toContain("react");
      expect(content).toContain("nextjs");
      expect(content).not.toContain("[PERSONALIZAR:");
    });

    it("does NOT create governance files for junior", () => {
      const result = scaffoldNexusSystem(tempDir, makeAnswers());
      expect(result.filesCreated).not.toContain(
        "nexus-system/governance/context/context_buffer.yaml"
      );
    });

    it("creates .gitignore with feedback pattern", () => {
      scaffoldNexusSystem(tempDir, makeAnswers());
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
        makeAnswers({ teamLevel: "pleno" })
      );
      expect(result.level).toBe("pleno");
      expect(result.filesCreated).toContain(
        "nexus-system/governance/context/context_buffer.yaml"
      );
    });

    it("copies 18 skills for pleno", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers({ teamLevel: "pleno" })
      );
      const skills = result.filesCreated.filter((f) =>
        f.includes("nexus-system/docs/skills/")
      );
      expect(skills.length).toBe(18);
    });
  });

  describe("senior level", () => {
    it("adds cognition and all governance templates", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers({ teamLevel: "senior" })
      );
      expect(result.level).toBe("senior");
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

    it("copies 21 skills for senior", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers({ teamLevel: "senior" })
      );
      const skills = result.filesCreated.filter((f) =>
        f.includes("nexus-system/docs/skills/")
      );
      expect(skills.length).toBe(21);
    });

    it("creates reports/ directory", () => {
      const result = scaffoldNexusSystem(
        tempDir,
        makeAnswers({ teamLevel: "senior" })
      );
      expect(result.directoriesCreated).toContain("nexus-system/reports");
    });
  });
});
