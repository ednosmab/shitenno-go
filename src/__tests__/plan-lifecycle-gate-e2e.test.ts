/**
 * plan-lifecycle-gate-e2e.test.ts — Gate verification e2e tests
 *
 * Tests the 3 core scenarios:
 * 1. Positive: all checks pass → plan moves to done/ with verification.json
 * 2. Negative: one check fails → plan blocked, stays in plans/
 * 3. Invalidation: code changes after verification → diffHash mismatch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Capture the REAL execSync BEFORE mocking the module
const { execSync: realExecSync } = await import("node:child_process");

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const realFn = actual.execSync;
  return {
    ...actual,
    execSync: vi.fn((cmd: string, opts?: any) => {
      // Only intercept the vitest gate self-test (checkGateIntegrity)
      // Let everything else (build, test, lint, git) pass through to real impl
      if (cmd.includes("vitest run src/__tests__/plan-lifecycle-gate-e2e")) {
        return "ok";
      }
      return realFn(cmd, opts);
    }),
  };
});

import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { runAutoVerification } from "../plan-lifecycle.js";

describe("Bloco F — gate de done, caso positivo, negativo e invalidação por diffHash", () => {
  let dir: string;
  let shitennoDir: string;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    dir = join(tmpdir(), `shugo-gate-e2e-${Date.now()}`);
    shitennoDir = join(dir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });

    // Create a package.json with scripts that succeed by default
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "echo ok", lint: "echo ok" } },
        null,
        2
      )
    );

    realExecSync("git init -q", { cwd: dir });
    realExecSync("git config user.email 'test@test.com'", { cwd: dir });
    realExecSync("git config user.name 'Test'", { cwd: dir });
    writeFileSync(join(dir, "app.ts"), "export const version = 1;\n");
    realExecSync("git add -A && git commit -q -m init", { cwd: dir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("caso positivo: build+test+lint passam → done/ com sidecar e diffHash consistente", () => {
    writeFileSync(join(dir, "app.ts"), "export const version = 2;\n");

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create({ title: "Plano de teste — caso positivo" });
    engine.updateStatus(plan.id, "check");

    const record = runAutoVerification(shitennoDir, dir, plan.id);
    const expectedDiff = realExecSync(
      `git diff HEAD -- . ':!.shitenno/governance/plans'`,
      { cwd: dir, encoding: "utf-8" }
    );
    const expectedHash = createHash("sha256").update(expectedDiff).digest("hex");

    const doneMd = join(
      shitennoDir,
      "governance",
      "plans",
      "done",
      `${plan.id}.md`
    );
    const doneJson = join(
      shitennoDir,
      "governance",
      "plans",
      "done",
      `${plan.id}.verification.json`
    );
    expect(existsSync(doneMd)).toBe(true);
    expect(existsSync(doneJson)).toBe(true);
    expect(record.checks.map((c) => c.name)).toEqual(
      expect.arrayContaining(["BUILD", "TESTS", "LINT", "GATE_SELF_TEST"])
    );
    expect(record.passed).toBe(true);
    expect(record.diffHash).toBe(expectedHash);
  });

  it("caso negativo: um check falha → refused, NÃO vai para done/", () => {
    // Override test script to fail — real execSync will run it and it will exit 1
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "exit 1", lint: "echo ok" } },
        null,
        2
      )
    );

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create({ title: "Plano de teste — caso negativo" });
    engine.updateStatus(plan.id, "check");

    const record = runAutoVerification(shitennoDir, dir, plan.id);

    expect(record.passed).toBe(false);
    expect(engine.getById(plan.id)!.status).toBe("refused");
    expect(
      existsSync(
        join(shitennoDir, "governance", "plans", "done", `${plan.id}.md`)
      )
    ).toBe(false);
    expect(
      existsSync(
        join(
          shitennoDir,
          "governance",
          "plans",
          "done",
          `${plan.id}.verification.json`
        )
      )
    ).toBe(false);
  });

  it("caso de invalidação: código muda depois da verificação → diffHash não bate", () => {
    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create({
      title: "Plano de teste — invalidação por diffHash",
    });
    engine.updateStatus(plan.id, "check");
    writeFileSync(join(dir, "app.ts"), "export const version = 2;\n");

    const record = runAutoVerification(shitennoDir, dir, plan.id);

    writeFileSync(join(dir, "app.ts"), "export const version = 3;\n");
    realExecSync("git add -A", { cwd: dir });
    const stagedDiff = realExecSync(
      `git diff --cached HEAD -- . ':!.shitenno/governance/plans'`,
      { cwd: dir, encoding: "utf-8" }
    );
    const stagedHash = createHash("sha256")
      .update(stagedDiff)
      .digest("hex");

    expect(stagedHash).not.toBe(record.diffHash);
  });
});
