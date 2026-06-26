import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { calculateComplexityScore, writeComplexityReport } from "../scorer.js";
import type { ProjectAnalysis } from "../analyser.js";

let tempDir: string;
let nexusDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-scorer-"));
  nexusDir = join(tempDir, "nexus-system");
  mkdirSync(nexusDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    rootDir: tempDir,
    hasGit: false,
    hasPackageJson: false,
    hasNexus: false,
    stack: [],
    packageManager: "unknown",
    monorepo: false,
    packageCount: 0,
    appCount: 0,
    dependencyCount: 0,
    sourceFileCount: 0,
    hasTests: false,
    hasLinter: false,
    hasCI: false,
    hasTypeScript: false,
    ...overrides,
  };
}

// ── calculateComplexityScore ─────────────────────────────────────────────────

describe("calculateComplexityScore", () => {
  it("returns junior level for empty project", () => {
    const report = calculateComplexityScore(tempDir, nexusDir, makeAnalysis());
    expect(report.level).toBe("junior");
    expect(report.score).toBe(0);
    expect(report.staticMetrics.length).toBeGreaterThan(0);
    expect(report.behavioralMetrics).toHaveLength(0);
    expect(report.areaScores).toHaveLength(0);
  });

  it("returns pleno level for medium complexity", () => {
    const analysis = makeAnalysis({
      packageCount: 4,
      appCount: 2,
      sourceFileCount: 200,
      dependencyCount: 80,
    });
    const report = calculateComplexityScore(tempDir, nexusDir, analysis);
    expect(report.score).toBeGreaterThanOrEqual(5);
    expect(report.level).toBe("pleno");
  });

  it("returns senior level for high complexity", () => {
    mkdirSync(join(nexusDir, "docs", "adrs"), { recursive: true });
    mkdirSync(join(nexusDir, "docs", "history"), { recursive: true });
    writeFileSync(join(nexusDir, "docs", "adrs", "ADR-001.md"), "# ADR-001");
    writeFileSync(join(nexusDir, "docs", "adrs", "ADR-002.md"), "# ADR-002");
    writeFileSync(join(nexusDir, "docs", "adrs", "ADR-003.md"), "# ADR-003");

    const analysis = makeAnalysis({
      packageCount: 6,
      appCount: 3,
      sourceFileCount: 400,
      dependencyCount: 120,
      monorepo: true,
    });
    const report = calculateComplexityScore(tempDir, nexusDir, analysis);
    expect(report.score).toBeGreaterThanOrEqual(10);
    expect(report.level).toBe("senior");
  });

  it("includes computedAt timestamp", () => {
    const report = calculateComplexityScore(tempDir, nexusDir, makeAnalysis());
    expect(report.computedAt).toBeTruthy();
    expect(new Date(report.computedAt).getTime()).toBeGreaterThan(0);
  });

  it("populates staticMetrics with evidence", () => {
    const report = calculateComplexityScore(
      tempDir,
      nexusDir,
      makeAnalysis({ packageCount: 1 })
    );
    expect(report.staticMetrics.length).toBeGreaterThan(0);
    for (const m of report.staticMetrics) {
      expect(m.evidence).toBeTruthy();
    }
  });
});

// ── writeComplexityReport ────────────────────────────────────────────────────

describe("writeComplexityReport", () => {
  it("returns null when reports/ doesn't exist", () => {
    const report = calculateComplexityScore(tempDir, nexusDir, makeAnalysis());
    const result = writeComplexityReport(tempDir, nexusDir, report);
    expect(result).toBeNull();
  });

  it("writes JSON report when reports/ exists", () => {
    mkdirSync(join(nexusDir, "reports"), { recursive: true });
    const report = calculateComplexityScore(tempDir, nexusDir, makeAnalysis());
    const filename = writeComplexityReport(tempDir, nexusDir, report);

    expect(filename).toBeTruthy();
    expect(filename).toMatch(/^complexity-.*\.json$/);

    // Verify the file was written
    const reports = readdirSync(join(nexusDir, "reports")).filter((f: string) =>
      f.startsWith("complexity-")
    );
    expect(reports.length).toBe(1);
  });

  it("increments session number on multiple writes", () => {
    mkdirSync(join(nexusDir, "reports"), { recursive: true });
    const report = calculateComplexityScore(tempDir, nexusDir, makeAnalysis());

    const f1 = writeComplexityReport(tempDir, nexusDir, report);
    const f2 = writeComplexityReport(tempDir, nexusDir, report);

    expect(f1).toContain("session1");
    expect(f2).toContain("session2");
  });
});
