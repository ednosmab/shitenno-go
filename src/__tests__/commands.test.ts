import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── sync.ts exports ─────────────────────────────────────────────────────────
import {
  getFilesToSync,
  shouldPreserveCustomizations,
  mergeJsonFiles,
  mergeMarkdownFiles,
  extractSections,
  mergeWithCustomizations,
} from "../commands/sync.js";

// ── doctor.ts exports ───────────────────────────────────────────────────────
import {
  analyzeRisks,
  analyzeImprovements,
  analyzeTeaching,
  runDoctorAnalysis,
} from "../commands/doctor.js";

// ── report.ts exports ───────────────────────────────────────────────────────
import {
  formatDimensionBar,
  formatInsight,
  formatReport,
} from "../commands/report.js";

// ── Types ───────────────────────────────────────────────────────────────────
import type { NexusState } from "../state-manager.js";
import type { KnowledgeDebtReport } from "../knowledge-debt.js";
import type { DimensionReport, Insight, PerformanceReport } from "../performance-reporter.js";
import type { PerformanceDimension } from "../feedback-loops.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-commands-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// Helper to create a minimal nexus-state matching the actual NexusState type
function makeState(overrides: Partial<NexusState> = {}): NexusState {
  return {
    project: {
      maturity: null,
      installedCapabilities: ["core", "knowledge"],
      recommendedCapabilities: ["governance"],
      knowledgeDebt: null,
      complexity: null,
      projectInfo: {
        name: "test-project",
        stack: [],
        hasGit: false,
        hasCI: false,
        hasTests: false,
        hasTypeScript: false,
        packageCount: 0,
        sourceFileCount: 10,
      },
    },
    knowledge: {
      adrs: [],
      skills: [],
      contracts: [],
      governanceDocs: [],
      scripts: [],
      runbooks: [],
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
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// sync.ts tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("sync.ts — getFilesToSync", () => {
  it("returns empty array when nexus dir has no files", () => {
    const result = getFilesToSync(tempDir, tempDir);
    expect(result).toEqual([]);
  });

  it("returns core files that exist", () => {
    const nexusDir = join(tempDir, "nexus-system");
    mkdirSync(join(nexusDir, "docs"), { recursive: true });
    writeFileSync(join(nexusDir, "docs", "AGENTS.md"), "# Agents");
    writeFileSync(join(nexusDir, "opencode.json"), "{}");

    const result = getFilesToSync(nexusDir, tempDir);
    expect(result).toContain("docs/AGENTS.md");
    expect(result).toContain("opencode.json");
  });

  it("returns skill files", () => {
    const nexusDir = join(tempDir, "nexus-system");
    mkdirSync(join(nexusDir, "docs", "skills"), { recursive: true });
    writeFileSync(join(nexusDir, "docs", "skills", "tdd.md"), "# TDD");
    writeFileSync(join(nexusDir, "docs", "skills", "solid.md"), "# SOLID");

    const result = getFilesToSync(nexusDir, tempDir);
    expect(result).toContain("docs/skills/tdd.md");
    expect(result).toContain("docs/skills/solid.md");
  });

  it("filters out non-md files in skills", () => {
    const nexusDir = join(tempDir, "nexus-system");
    mkdirSync(join(nexusDir, "docs", "skills"), { recursive: true });
    writeFileSync(join(nexusDir, "docs", "skills", "tdd.md"), "# TDD");
    writeFileSync(join(nexusDir, "docs", "skills", "notes.txt"), "notes");

    const result = getFilesToSync(nexusDir, tempDir);
    expect(result).toContain("docs/skills/tdd.md");
    expect(result).not.toContain("docs/skills/notes.txt");
  });
});

describe("sync.ts — shouldPreserveCustomizations", () => {
  it("returns true for AGENTS.md", () => {
    expect(shouldPreserveCustomizations("docs/AGENTS.md")).toBe(true);
  });

  it("returns true for opencode.json", () => {
    expect(shouldPreserveCustomizations("opencode.json")).toBe(true);
  });

  it("returns false for scripts", () => {
    expect(shouldPreserveCustomizations("scripts/validate-session.ts")).toBe(false);
  });

  it("returns false for skills", () => {
    expect(shouldPreserveCustomizations("docs/skills/tdd.md")).toBe(false);
  });
});

describe("sync.ts — mergeJsonFiles", () => {
  it("merges two valid JSON files", () => {
    const nexus = JSON.stringify({ agent: { planner: { model: "new-model" } } });
    const target = JSON.stringify({ agent: { planner: { model: "old-model", permission: "read" } } });

    const result = mergeJsonFiles(nexus, target);
    const parsed = JSON.parse(result);
    expect(parsed.agent.planner.model).toBe("old-model");
    expect(parsed.agent.planner.permission).toBe("read");
  });

  it("preserves target MCP config", () => {
    const nexus = JSON.stringify({ agent: {} });
    const target = JSON.stringify({ mcp: { servers: ["postgres"] } });

    const result = mergeJsonFiles(nexus, target);
    const parsed = JSON.parse(result);
    expect(parsed.mcp).toEqual({ servers: ["postgres"] });
  });

  it("returns nexus content on parse error", () => {
    const nexus = "not json";
    const target = "also not json";
    const result = mergeJsonFiles(nexus, target);
    expect(result).toBe(nexus);
  });
});

describe("sync.ts — mergeMarkdownFiles", () => {
  it("preserves custom sections from target", () => {
    const nexus = "## Standard Section\nNexus content";
    const target = "## Standard Section\nTarget content\n## My Custom Section\nCustom content";

    const result = mergeMarkdownFiles(nexus, target);
    expect(result).toContain("My Custom Section");
    expect(result).toContain("Custom content");
  });

  it("uses nexus content for standard sections with placeholders", () => {
    const nexus = "## Standard Section\nNexus version";
    const target = "## Standard Section\n[PERSONALIZAR: stuff]";

    const result = mergeMarkdownFiles(nexus, target);
    expect(result).toContain("Nexus version");
  });
});

describe("sync.ts — extractSections", () => {
  it("extracts headings and their content", () => {
    const content = "# Title\nLine 1\n## Section A\nContent A\n## Section B\nContent B";
    const sections = extractSections(content);

    expect(sections["Title"]).toContain("Line 1");
    expect(sections["Section A"]).toContain("Content A");
    expect(sections["Section B"]).toContain("Content B");
  });

  it("returns empty object for content without headings", () => {
    const sections = extractSections("Just some text\nNo headings here");
    expect(Object.keys(sections)).toHaveLength(0);
  });

  it("handles multiple heading levels", () => {
    const content = "## Parent\nContent under parent\n### Child\nChild content";
    const sections = extractSections(content);
    expect(sections["Parent"]).toContain("Content under parent");
    // ### Child starts a new section, so Parent should NOT contain it
    expect(sections["Child"]).toContain("Child content");
  });
});

describe("sync.ts — mergeWithCustomizations", () => {
  it("merges JSON files via mergeJsonFiles", () => {
    const nexusDir = join(tempDir, "nexus");
    const targetDir = join(tempDir, "target");
    mkdirSync(nexusDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    writeFileSync(join(nexusDir, "opencode.json"), '{"agent":{}}');
    writeFileSync(join(targetDir, "opencode.json"), '{"mcp":{}}');

    const result = mergeWithCustomizations(
      join(nexusDir, "opencode.json"),
      join(targetDir, "opencode.json")
    );
    const parsed = JSON.parse(result);
    expect(parsed.mcp).toEqual({});
  });

  it("merges markdown files via mergeMarkdownFiles", () => {
    const nexusDir = join(tempDir, "nexus");
    const targetDir = join(tempDir, "target");
    mkdirSync(join(nexusDir, "docs"), { recursive: true });
    mkdirSync(join(targetDir, "docs"), { recursive: true });

    writeFileSync(join(nexusDir, "docs", "AGENTS.md"), "## Standard\nNexus");
    writeFileSync(join(targetDir, "docs", "AGENTS.md"), "## Standard\nTarget\n## Custom\nMy stuff");

    const result = mergeWithCustomizations(
      join(nexusDir, "docs", "AGENTS.md"),
      join(targetDir, "docs", "AGENTS.md")
    );
    expect(result).toContain("Custom");
    expect(result).toContain("My stuff");
  });

  it("returns nexus content for non-json non-md files", () => {
    const nexusDir = join(tempDir, "nexus");
    const targetDir = join(tempDir, "target");
    mkdirSync(join(nexusDir, "scripts"), { recursive: true });
    mkdirSync(join(targetDir, "scripts"), { recursive: true });

    writeFileSync(join(nexusDir, "scripts", "test.ts"), "nexus code");
    writeFileSync(join(targetDir, "scripts", "test.ts"), "target code");

    const result = mergeWithCustomizations(
      join(nexusDir, "scripts", "test.ts"),
      join(targetDir, "scripts", "test.ts")
    );
    expect(result).toBe("nexus code");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// doctor.ts tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("doctor.ts — analyzeRisks", () => {
  it("returns empty array for healthy state", () => {
    const state = makeState();
    const result = analyzeRisks(state, null);
    expect(result).toEqual([]);
  });

  it("detects critical knowledge debt", () => {
    const state = makeState();
    const debtReport: KnowledgeDebtReport = {
      generatedAt: new Date().toISOString(),
      totalGaps: 5,
      gapsBySeverity: { critical: 2, high: 1, medium: 1, low: 1 },
      gapsByType: {} as Record<string, number>,
      gaps: [
        {
          id: "DEBT-001",
          type: "adr_missing",
          severity: "critical",
          description: "Missing auth docs",
          location: "docs/",
          expectedArtifact: "ADR",
          recommendation: "Add ADR",
          detectedAt: new Date().toISOString(),
          addressed: false,
        },
        {
          id: "DEBT-002",
          type: "adr_missing",
          severity: "critical",
          description: "No payment docs",
          location: "docs/",
          expectedArtifact: "ADR",
          recommendation: "Add ADR",
          detectedAt: new Date().toISOString(),
          addressed: false,
        },
      ],
      healthScore: 80,
      summary: "2 critical gaps",
      recommendations: [],
    };
    const result = analyzeRisks(state, debtReport);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((f) => f.title.includes("Knowledge debt"))).toBe(true);
  });

  it("detects low maturity dimensions", () => {
    const state = makeState({
      project: {
        ...makeState().project,
        maturity: {
          overallScore: 20,
          dimensions: { architecture: 10, governance: 5, quality: 0, automation: 0, ai: 0, documentation: 0, observability: 0 },
          computedAt: new Date().toISOString(),
        },
      },
    });
    const result = analyzeRisks(state, null);
    expect(result.some((f) => f.title.includes("maturity"))).toBe(true);
  });

  it("detects active blockers", () => {
    const state = makeState({
      memory: { ...makeState().memory, blockers: ["Build failing"] },
    });
    const result = analyzeRisks(state, null);
    expect(result.some((f) => f.title.includes("blocker"))).toBe(true);
  });

  it("detects no tests risk", () => {
    const state = makeState({
      project: {
        ...makeState().project,
        projectInfo: { ...makeState().project.projectInfo, hasTests: false, sourceFileCount: 50 },
      },
    });
    const result = analyzeRisks(state, null);
    expect(result.some((f) => f.title.includes("No automated tests"))).toBe(true);
  });
});

describe("doctor.ts — analyzeImprovements", () => {
  it("returns empty array for fully configured project", () => {
    const state = makeState({
      project: {
        ...makeState().project,
        projectInfo: { ...makeState().project.projectInfo, hasCI: true },
        installedCapabilities: ["core", "knowledge", "governance", "ai"],
      },
    });
    const nexusDir = join(tempDir, "nexus-system");
    mkdirSync(join(nexusDir, "governance", "knowledge-graph"), { recursive: true });

    const result = analyzeImprovements(state, nexusDir);
    expect(result).toEqual([]);
  });

  it("detects no CI/CD", () => {
    const state = makeState();
    const result = analyzeImprovements(state, join(tempDir, "nexus-system"));
    expect(result.some((f) => f.title.includes("CI/CD"))).toBe(true);
  });

  it("detects few capabilities", () => {
    const state = makeState();
    const result = analyzeImprovements(state, join(tempDir, "nexus-system"));
    expect(result.some((f) => f.title.includes("Few capabilities"))).toBe(true);
  });

  it("detects missing knowledge graph", () => {
    const state = makeState();
    const result = analyzeImprovements(state, join(tempDir, "nexus-system"));
    expect(result.some((f) => f.title.includes("Knowledge graph"))).toBe(true);
  });
});

describe("doctor.ts — analyzeTeaching", () => {
  it("teaches about ADRs when none exist but skills do", () => {
    const state = makeState({
      knowledge: {
        ...makeState().knowledge,
        skills: [{ id: "tdd", name: "TDD", path: "docs/skills/tdd.md" }],
      },
    });
    const { findings, moments } = analyzeTeaching(state);
    expect(findings.some((f) => f.title.includes("ADRs"))).toBe(true);
    expect(moments.length).toBeGreaterThan(0);
  });

  it("teaches about capability system when applicable", () => {
    const state = makeState({
      project: {
        ...makeState().project,
        installedCapabilities: ["core"],
        recommendedCapabilities: ["governance"],
      },
    });
    const { moments } = analyzeTeaching(state);
    expect(moments.some((m) => m.includes("capabilities"))).toBe(true);
  });

  it("teaches about knowledge lifecycle when ADRs exist without skills", () => {
    const state = makeState({
      knowledge: {
        ...makeState().knowledge,
        adrs: [{ id: "ADR-001", title: "Test", status: "accepted", path: "docs/adrs/ADR-001.md" }],
      },
    });
    const { moments } = analyzeTeaching(state);
    expect(moments.some((m) => m.includes("Knowledge Lifecycle"))).toBe(true);
  });
});

describe("doctor.ts — runDoctorAnalysis", () => {
  it("returns a valid DoctorReport", () => {
    const nexusDir = join(tempDir, "nexus-system");
    mkdirSync(nexusDir, { recursive: true });
    mkdirSync(join(nexusDir, "governance", "context"), { recursive: true });
    writeFileSync(
      join(nexusDir, "governance", "context", "context_buffer.yaml"),
      'status: "closed"'
    );

    const report = runDoctorAnalysis(tempDir, nexusDir);
    expect(report).toHaveProperty("findings");
    expect(report).toHaveProperty("overallHealth");
    expect(report).toHaveProperty("healthScore");
    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("teachingMoments");
    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
    expect(["healthy", "attention", "warning", "critical"]).toContain(report.overallHealth);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// report.ts tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("report.ts — formatDimensionBar", () => {
  it("returns a string with the label", () => {
    const dimReport: DimensionReport = {
      score: 75,
      trend: "stable",
      acceptRate: 80,
      evidence: [],
    };
    const result = formatDimensionBar("Architecture", dimReport);
    expect(result).toContain("Architecture");
  });

  it("includes trend arrow for improving", () => {
    const dimReport: DimensionReport = {
      score: 80,
      trend: "improving",
      acceptRate: 90,
      evidence: [],
    };
    const result = formatDimensionBar("Quality", dimReport);
    expect(result).toContain("↑");
  });

  it("includes trend arrow for declining", () => {
    const dimReport: DimensionReport = {
      score: 60,
      trend: "declining",
      acceptRate: 60,
      evidence: [],
    };
    const result = formatDimensionBar("Quality", dimReport);
    expect(result).toContain("↓");
  });

  it("includes trend arrow for stable", () => {
    const dimReport: DimensionReport = {
      score: 70,
      trend: "stable",
      acceptRate: 75,
      evidence: [],
    };
    const result = formatDimensionBar("Quality", dimReport);
    expect(result).toContain("→");
  });
});

describe("report.ts — formatInsight", () => {
  it("formats strength insight", () => {
    const insight: Insight = { type: "strength", dimension: "decision_making" as PerformanceDimension, text: "Good test coverage", evidence: "95% coverage" };
    const result = formatInsight(insight);
    expect(result).toContain("Good test coverage");
  });

  it("formats improvement insight", () => {
    const insight: Insight = { type: "improvement", dimension: "prompt_quality" as PerformanceDimension, text: "Add more tests" };
    const result = formatInsight(insight);
    expect(result).toContain("Add more tests");
  });

  it("formats pattern insight", () => {
    const insight: Insight = { type: "pattern", dimension: "decision_making" as PerformanceDimension, text: "Recurring pattern detected" };
    const result = formatInsight(insight);
    expect(result).toContain("Recurring pattern detected");
  });

  it("formats suggestion insight", () => {
    const insight: Insight = { type: "suggestion", dimension: "sustainable_velocity" as PerformanceDimension, text: "Consider refactoring" };
    const result = formatInsight(insight);
    expect(result).toContain("Consider refactoring");
  });

  it("includes evidence when present", () => {
    const insight: Insight = { type: "strength", dimension: "decision_making" as PerformanceDimension, text: "Good", evidence: "Because X" };
    const result = formatInsight(insight);
    expect(result).toContain("Because X");
  });
});

describe("report.ts — formatReport", () => {
  it("outputs to console without throwing", () => {
    const report: PerformanceReport = {
      period: { days: 30, from: "2024-01-01", to: "2024-01-31" },
      profile: {
        dominantDimension: "decision_making" as PerformanceDimension,
        weakestDimension: "prompt_quality" as PerformanceDimension,
        growthPattern: "balanced",
        growthCapacity: 0.5,
        challengeLevel: 0.4,
      },
      dimensions: {
        decision_making: { score: 70, trend: "stable", acceptRate: 80, evidence: [] },
        prompt_quality: { score: 80, trend: "improving", acceptRate: 90, evidence: [] },
        scope_management: { score: 60, trend: "declining", acceptRate: 60, evidence: [] },
        architectural_vision: { score: 75, trend: "stable", acceptRate: 75, evidence: [] },
        risk_management: { score: 50, trend: "stable", acceptRate: 50, evidence: [] },
        technical_communication: { score: 55, trend: "stable", acceptRate: 55, evidence: [] },
        sustainable_velocity: { score: 65, trend: "improving", acceptRate: 70, evidence: [] },
      } as Record<PerformanceDimension, DimensionReport>,
      debtTrend: { current: 20, previous: 25, delta: -5 },
      maturityTrend: { current: 60, previous: 57, delta: 3 },
      feedback: {
        totalInteractions: 15,
        acceptanceRate: 80,
        challengingRatio: 30,
        patterns: [],
        suppressedCount: 0,
      },
      sessions: {
        total: 5,
        avgDuration: 25,
        mostActiveDay: "2024-01-15",
        commandFrequency: { status: 3, detect: 2 },
      },
      insights: [
        { type: "strength", dimension: "decision_making" as PerformanceDimension, text: "Good coverage", evidence: "95%" },
        { type: "improvement", dimension: "prompt_quality" as PerformanceDimension, text: "Add tests" },
      ],
      nextSteps: ["Run nexus upgrade", "Add more tests"],
      summary: "Project is in good shape.",
    };

    // Should not throw
    expect(() => formatReport(report)).not.toThrow();
  });
});
