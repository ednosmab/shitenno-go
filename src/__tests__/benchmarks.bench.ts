/**
 * benchmarks.test.ts — Performance benchmarks for the nexus scoring engines
 *
 * Creates synthetic fixtures of varying sizes (small/medium/large)
 * and benchmarks: calculateComplexityScore, detectPatterns, auditHealth.
 *
 * Run with: npx vitest bench src/__tests__/benchmarks.bench.ts
 */

import { describe, bench, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldNexusSystem } from "../scaffolder.js";
import { calculateComplexityScore } from "../scorer.js";
import { detectPatterns } from "../pattern-detector.js";
import { auditHealth } from "../health-auditor.js";
import { analyseProject } from "../analyser.js";
import type { UserAnswers } from "../prompts.js";

// ── Fixture Generators ──────────────────────────────────────────────────────

interface Fixture {
  dir: string;
  nexusDir: string;
  label: string;
}

const BASE_ANSWERS: UserAnswers = {
  principalModel: "opencode/mimo-v2.5-free",
  executorModel: "opencode/deepseek-v4-flash-free",
  stack: ["react", "typescript"],
  database: "PostgreSQL",
  styling: "Tailwind CSS",
  teamLevel: "senior",
};

/**
 * Creates a synthetic project fixture with the specified number of
 * source files, history entries, and reports.
 */
function createFixture(
  label: string,
  opts: {
    sourceFileCount: number;
    historyEntries: number;
    reportCount: number;
    areas: number;
  }
): Fixture {
  const dir = join(tmpdir(), `nexus-bench-${label}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  // Create package.json
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `bench-${label}`,
        version: "1.0.0",
        dependencies: { react: "^18.0.0", next: "^14.0.0", zod: "^3.22.0" },
        devDependencies: { typescript: "^5.0.0", vitest: "^1.0.0" },
      },
      null,
      2
    )
  );

  // Create source files across areas
  const areas = Array.from({ length: opts.areas }, (_, i) => `src/area-${i}`);
  const filesPerArea = Math.ceil(opts.sourceFileCount / opts.areas);

  for (const area of areas) {
    const areaDir = join(dir, area);
    mkdirSync(areaDir, { recursive: true });
    for (let f = 0; f < filesPerArea; f++) {
      // Vary content to exercise keyword matching
      const hasAuth = f % 5 === 0;
      const hasBug = f % 7 === 0;
      const lines = Array.from(
        { length: 20 + (f % 30) },
        (_, i) =>
          `import { something } from "../${areas[(i + 1) % areas.length]}/helper";\n` +
          `// Line ${i}: ${hasAuth ? "auth payment session security" : "normal code"}\n` +
          `export function func_${f}_${i}() { return ${hasBug ? '"erro bug fix"' : i}; }`
      );
      writeFileSync(join(areaDir, `file-${f}.ts`), lines.join("\n"));
    }
  }

  // Scaffold nexus-system
  const result = scaffoldNexusSystem(dir, BASE_ANSWERS);
  const nexusDir = join(dir, "nexus-system");

  // Create history entries
  if (opts.historyEntries > 0) {
    const historyDir = join(nexusDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    for (let i = 0; i < opts.historyEntries; i++) {
      const date = new Date(2026, 0, 1 + i);
      const dateStr = date.toISOString().slice(0, 10);
      const hasViolation = i % 3 === 0;
      const hasRevert = i % 10 === 0;
      const areaIdx = i % opts.areas;
      const content = [
        `# Sessão ${i + 1} — ${dateStr}`,
        ``,
        `## Áreas trabalhadas`,
        `- src/area-${areaIdx}`,
        ``,
        `## Actividade`,
        hasViolation
          ? `Encontrei erro no módulo area-${areaIdx}. Bug detectado e corrigido.`
          : `Trabalho concluído sem problemas.`,
        hasRevert
          ? `Revert da decisão anterior — rollback necessário.`
          : ``,
        `## Notas`,
        `Sessão ${i + 1} do projecto.`,
      ]
        .filter(Boolean)
        .join("\n");
      writeFileSync(join(historyDir, `${dateStr}-sessao-${String(i + 1).padStart(2, "0")}.md`), content);
    }
  }

  // Create reports
  if (opts.reportCount > 0) {
    const reportsDir = join(nexusDir, "reports");
    mkdirSync(reportsDir, { recursive: true });
    for (let i = 0; i < opts.reportCount; i++) {
      const areaScores = Array.from({ length: opts.areas }, (_, j) => ({
        area: `src/area-${j}`,
        score: 2 + (j % 8),
        violations: j % 3,
        churn: j % 5,
      }));
      writeFileSync(
        join(reportsDir, `complexity-bench-${label}-2026-01-${String(i + 1).padStart(2, "0")}-session1.json`),
        JSON.stringify({
          projectName: `bench-${label}`,
          score: 5 + (i % 10),
          level: "pleno",
          areaScores,
        })
      );
    }
  }

  return { dir, nexusDir, label };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

let small: Fixture;
let medium: Fixture;
let large: Fixture;

beforeAll(() => {
  small = createFixture("small", {
    sourceFileCount: 20,
    historyEntries: 5,
    reportCount: 3,
    areas: 3,
  });

  medium = createFixture("medium", {
    sourceFileCount: 100,
    historyEntries: 30,
    reportCount: 10,
    areas: 8,
  });

  large = createFixture("large", {
    sourceFileCount: 500,
    historyEntries: 100,
    reportCount: 50,
    areas: 20,
  });
});

afterAll(() => {
  for (const f of [small, medium, large]) {
    try {
      rmSync(f.dir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  }
});

// ── Benchmarks: calculateComplexityScore ─────────────────────────────────────

describe("calculateComplexityScore", () => {
  bench("small project (20 files, 3 areas)", async () => {
    const analysis = analyseProject(small.dir);
    await calculateComplexityScore(small.dir, small.nexusDir, analysis);
  });

  bench("medium project (100 files, 8 areas)", async () => {
    const analysis = analyseProject(medium.dir);
    await calculateComplexityScore(medium.dir, medium.nexusDir, analysis);
  });

  bench("large project (500 files, 20 areas)", async () => {
    const analysis = analyseProject(large.dir);
    await calculateComplexityScore(large.dir, large.nexusDir, analysis);
  });

  bench("analyseProject alone (small)", () => {
    analyseProject(small.dir);
  });

  bench("analyseProject alone (large)", () => {
    analyseProject(large.dir);
  });
});

// ── Benchmarks: detectPatterns ───────────────────────────────────────────────

describe("detectPatterns", () => {
  bench("small (5 history, 3 reports)", () => {
    detectPatterns(small.dir, small.nexusDir);
  });

  bench("medium (30 history, 10 reports)", () => {
    detectPatterns(medium.dir, medium.nexusDir);
  });

  bench("large (100 history, 50 reports)", () => {
    detectPatterns(large.dir, large.nexusDir);
  });
});

// ── Benchmarks: auditHealth ──────────────────────────────────────────────────

describe("auditHealth", () => {
  bench("small (5 history, 38 rules)", () => {
    auditHealth(small.dir, small.nexusDir);
  });

  bench("medium (30 history, 38 rules)", () => {
    auditHealth(medium.dir, medium.nexusDir);
  });

  bench("large (100 history, 38 rules)", () => {
    auditHealth(large.dir, large.nexusDir);
  });
});

// ── Benchmarks: Full Pipeline (status command simulation) ────────────────────

describe("Full Pipeline (status command)", () => {
  bench("small — analyse + score + write report", async () => {
    const analysis = analyseProject(small.dir);
    const report = await calculateComplexityScore(small.dir, small.nexusDir, analysis);
    JSON.stringify(report);
  });

  bench("medium — analyse + score + write report", async () => {
    const analysis = analyseProject(medium.dir);
    const report = await calculateComplexityScore(medium.dir, medium.nexusDir, analysis);
    JSON.stringify(report);
  });

  bench("large — analyse + score + write report", async () => {
    const analysis = analyseProject(large.dir);
    const report = await calculateComplexityScore(large.dir, large.nexusDir, analysis);
    JSON.stringify(report);
  });
});

// ── Benchmarks: All three engines together ───────────────────────────────────

describe("All Engines (audit command simulation)", () => {
  bench("small — score + detect + audit", async () => {
    const analysis = analyseProject(small.dir);
    await calculateComplexityScore(small.dir, small.nexusDir, analysis);
    detectPatterns(small.dir, small.nexusDir);
    auditHealth(small.dir, small.nexusDir);
  });

  bench("medium — score + detect + audit", async () => {
    const analysis = analyseProject(medium.dir);
    await calculateComplexityScore(medium.dir, medium.nexusDir, analysis);
    detectPatterns(medium.dir, medium.nexusDir);
    auditHealth(medium.dir, medium.nexusDir);
  });

  bench("large — score + detect + audit", async () => {
    const analysis = analyseProject(large.dir);
    await calculateComplexityScore(large.dir, large.nexusDir, analysis);
    detectPatterns(large.dir, large.nexusDir);
    auditHealth(large.dir, large.nexusDir);
  });
});

// ── Benchmarks: Scaling characteristics ──────────────────────────────────────

describe("Scaling: source files (fixed 5 history, 3 areas)", () => {
  const scalingFixtures: Array<{ label: string; fixture: Fixture }> = [];

  beforeAll(() => {
    for (const count of [10, 50, 100, 250, 500]) {
      scalingFixtures.push({
        label: `${count} files`,
        fixture: createFixture(`scale-${count}`, {
          sourceFileCount: count,
          historyEntries: 5,
          reportCount: 3,
          areas: 3,
        }),
      });
    }
  });

  afterAll(() => {
    for (const { fixture } of scalingFixtures) {
      try {
        rmSync(fixture.dir, { recursive: true, force: true });
      } catch {}
    }
  });

  for (const { label, fixture } of scalingFixtures) {
    bench(`score with ${label}`, async () => {
      const analysis = analyseProject(fixture.dir);
      await calculateComplexityScore(fixture.dir, fixture.nexusDir, analysis);
    });
  }
});

describe("Scaling: history entries (fixed 100 files, 3 areas)", () => {
  const scalingFixtures: Array<{ label: string; fixture: Fixture }> = [];

  beforeAll(() => {
    for (const count of [5, 20, 50, 100, 200]) {
      scalingFixtures.push({
        label: `${count} entries`,
        fixture: createFixture(`hist-${count}`, {
          sourceFileCount: 100,
          historyEntries: count,
          reportCount: 5,
          areas: 3,
        }),
      });
    }
  });

  afterAll(() => {
    for (const { fixture } of scalingFixtures) {
      try {
        rmSync(fixture.dir, { recursive: true, force: true });
      } catch {}
    }
  });

  for (const { label, fixture } of scalingFixtures) {
    bench(`detect with ${label}`, () => {
      detectPatterns(fixture.dir, fixture.nexusDir);
    });

    bench(`audit with ${label}`, () => {
      auditHealth(fixture.dir, fixture.nexusDir);
    });
  }
});
