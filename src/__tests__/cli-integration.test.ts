import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldNexusSystem, type ScaffoldResult } from "../scaffolder.js";
import type { UserAnswers } from "../prompts.js";

const execAsync = promisify(exec);

// Path to the built CLI
const CLI_PATH = resolve(import.meta.dirname, "../../dist/nexus.js");

// Helper to run CLI command
async function runNexus(
  args: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd: cwd || process.cwd(),
      timeout: 15000,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.code || 1,
    };
  }
}

// Helper to create a scaffolded nexus project
function scaffoldTestProject(
  name: string,
  level: "junior" | "pleno" | "senior" = "junior"
): { dir: string; result: ScaffoldResult } {
  const dir = join(tmpdir(), `nexus-e2e-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  // Create a basic package.json
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: { react: "^18.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      },
      null,
      2
    )
  );

  // Create a src/ directory so the project has something to analyse
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "index.ts"),
    'console.log("hello");'
  );

  const answers: UserAnswers = {
    principalModel: "opencode/mimo-v2.5-free",
    executorModel: "opencode/deepseek-v4-flash-free",
    stack: ["react", "typescript"],
    database: "PostgreSQL",
    styling: "Tailwind CSS",
    teamLevel: level,
  };

  const result = scaffoldNexusSystem(dir, answers);
  return { dir, result };
}

describe("CLI Integration Tests", () => {
  // ──────────────────────────────────────────────
  // --help and --version
  // ──────────────────────────────────────────────
  describe("nexus --help", () => {
    it("should show all registered commands", async () => {
      const { stdout, exitCode } = await runNexus("--help");

      expect(exitCode).toBe(0);
      expect(stdout).toContain("nexus");
      expect(stdout).toContain("init");
      expect(stdout).toContain("status");
      expect(stdout).toContain("detect");
      expect(stdout).toContain("audit");
      expect(stdout).toContain("upgrade");
      expect(stdout).toContain("validate");
      expect(stdout).toContain("sync");
    });

    it("should show version", async () => {
      const { stdout, exitCode } = await runNexus("--version");

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  // ──────────────────────────────────────────────
  // nexus init — edge cases (not interactive)
  // ──────────────────────────────────────────────
  describe("nexus init", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should detect existing initialization", async () => {
      const dir = join(tmpdir(), `nexus-e2e-init-already-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      writeFileSync(
        join(dir, "opencode.json"),
        JSON.stringify({ model: "test", agent: { planner: {} } })
      );

      const { stdout } = await runNexus("init", dir);
      expect(stdout).toContain("already initialized");
    });

    it("should warn when running inside nexus-cli", async () => {
      const { stdout } = await runNexus("init");
      // Running from the nexus-cli directory triggers the safety guard
      expect(stdout).toMatch(/nexus-system should be created|already initialized|Governance Setup/);
    });
  });

  // ──────────────────────────────────────────────
  // nexus status
  // ──────────────────────────────────────────────
  describe("nexus status", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show 'not initialized' for non-nexus directory", async () => {
      const dir = join(tmpdir(), `nexus-e2e-status-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout } = await runNexus("status", dir);
      expect(stdout).toContain("not initialized");
    });

    it("should show 'opencode.json not found' when only nexus-system exists", async () => {
      const dir = join(tmpdir(), `nexus-e2e-status-partial-${Date.now()}`);
      mkdirSync(join(dir, "nexus-system"), { recursive: true });
      dirs.push(dir);

      const { stdout } = await runNexus("status", dir);
      expect(stdout).toContain("opencode.json not found");
    });

    it("should show health check for a scaffolded junior project", async () => {
      const { dir } = scaffoldTestProject("status-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runNexus("status", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Health Check");
      expect(stdout).toContain("Project root");
      expect(stdout).toContain("Governance Health");
      expect(stdout).toContain("Complexity Analysis");
    });

    it("should show complexity score and area breakdown", async () => {
      const { dir } = scaffoldTestProject("status-complexity", "senior");
      dirs.push(dir);

      const { stdout } = await runNexus("status", dir);
      expect(stdout).toContain("Score Breakdown");
      expect(stdout).toContain("Total score");
    });

    it("should generate a report file when reports/ exists (L3)", async () => {
      const { dir } = scaffoldTestProject("status-report", "senior");
      dirs.push(dir);

      const { stdout } = await runNexus("status", dir);
      expect(stdout).toContain("Report saved");
    });
  });

  // ──────────────────────────────────────────────
  // nexus detect
  // ──────────────────────────────────────────────
  describe("nexus detect", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show 'not initialized' for non-nexus directory", async () => {
      const dir = join(tmpdir(), `nexus-e2e-detect-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout } = await runNexus("detect", dir);
      expect(stdout).toContain("not initialized");
    });

    it("should analyze history and reports for scaffolded project", async () => {
      const { dir } = scaffoldTestProject("detect-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runNexus("detect", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Pattern Detection");
      expect(stdout).toContain("Detection Results");
      expect(stdout).toContain("History entries analyzed");
      expect(stdout).toContain("Patterns detected");
    });

    it("should show no patterns for a fresh project with no history", async () => {
      const { dir } = scaffoldTestProject("detect-fresh", "junior");
      dirs.push(dir);

      const { stdout } = await runNexus("detect", dir);
      expect(stdout).toContain("No significant patterns detected");
    });

    it("should write a pattern report", async () => {
      const { dir } = scaffoldTestProject("detect-report", "junior");
      dirs.push(dir);

      const { stdout } = await runNexus("detect", dir);
      expect(stdout).toMatch(/Report saved|No significant patterns detected/);
    });
  });

  // ──────────────────────────────────────────────
  // nexus audit
  // ──────────────────────────────────────────────
  describe("nexus audit", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show 'not initialized' for non-nexus directory", async () => {
      const dir = join(tmpdir(), `nexus-e2e-audit-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout } = await runNexus("audit", dir);
      expect(stdout).toContain("not initialized");
    });

    it("should run health audit on a scaffolded project", async () => {
      const { dir } = scaffoldTestProject("audit-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runNexus("audit", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Health Audit");
      expect(stdout).toContain("Health Audit Results");
      expect(stdout).toContain("Health Score");
    });

    it("should show health score out of 100", async () => {
      const { dir } = scaffoldTestProject("audit-score", "junior");
      dirs.push(dir);

      const { stdout } = await runNexus("audit", dir);
      expect(stdout).toMatch(/\d+\/100/);
    });

    it("should show rules and history counts", async () => {
      const { dir } = scaffoldTestProject("audit-counts", "pleno");
      dirs.push(dir);

      const { stdout } = await runNexus("audit", dir);
      expect(stdout).toContain("Rules:");
      expect(stdout).toContain("History entries:");
      expect(stdout).toContain("Issues found:");
    });

    it("should write a health report when reports/ exists (L3)", async () => {
      const { dir } = scaffoldTestProject("audit-report", "senior");
      dirs.push(dir);

      const { stdout } = await runNexus("audit", dir);
      expect(stdout).toMatch(/Report saved/);
    });
  });

  // ──────────────────────────────────────────────
  // nexus upgrade
  // ──────────────────────────────────────────────
  describe("nexus upgrade", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show upgrade options for a junior project", async () => {
      const { dir } = scaffoldTestProject("upgrade-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runNexus("upgrade --list", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Available upgrades");
      expect(stdout).toContain("Current level");
    });

    it("should detect current level correctly", async () => {
      const { dir } = scaffoldTestProject("upgrade-level", "junior");
      dirs.push(dir);

      const { stdout } = await runNexus("upgrade --list", dir);
      expect(stdout).toMatch(/Current level:\s*\n\s*(JUNIOR|PLENO)/i);
    });

    it("should show available target levels for a pleno project", async () => {
      const { dir } = scaffoldTestProject("upgrade-pleno", "pleno");
      dirs.push(dir);

      const { stdout } = await runNexus("upgrade --list", dir);
      expect(stdout).toMatch(/Current level:\s*\n\s*PLENO/i);
    });
  });

  // ──────────────────────────────────────────────
  // nexus validate
  // ──────────────────────────────────────────────
  describe("nexus validate", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should validate a scaffolded project", async () => {
      const { dir } = scaffoldTestProject("validate-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runNexus("validate", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Validation");
    });
  });

  // ──────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────
  describe("Error handling", () => {
    it("should handle invalid command gracefully", async () => {
      const { stdout, stderr, exitCode } = await runNexus("invalid-command");
      expect(exitCode).not.toBe(0);
      expect(stdout + stderr).toMatch(/unknown command|error/i);
    });

    it("should handle missing directory gracefully", async () => {
      const { stdout } = await runNexus("status -d /nonexistent/path-12345");
      expect(stdout).toMatch(/not found|not initialized|Warning|opencode.json not found/);
    });
  });
});
