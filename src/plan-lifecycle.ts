/**
 * plan-lifecycle.ts — Plan Lifecycle Management
 *
 * Detects active plans, infers status, validates completion,
 * and archives/removes them after user confirmation.
 *
 * Flow: detect → infer → validate → prompt (A/S/M/R) → execute
 */

import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { analyseProject } from "./analyser.js";
import chalk from "chalk";
import ora from "ora";
import { SHITENNO_DIR_NAME } from "./constants.js";
import { logger } from "./logger.js";
import {
  MarkdownPlanEngine,
  type MarkdownPlan,
} from "./markdown-plan-engine.js";
import {
  InferenceEngine,
  type PlanInference,
} from "./inference-engine.js";
import { output, outputBlank } from "./output.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompletionCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  checks: CompletionCheck[];
}

export interface LifecycleResult {
  active: number;
  archived: number;
  removed: number;
  skipped: number;
}

// ── Detect Active Plans ────────────────────────────────────────────────────

export function detectActivePlans(shitennoDir: string): MarkdownPlan[] {
  const engine = new MarkdownPlanEngine(shitennoDir);
  return engine.list().filter((p) => p.status !== "done");
}

async function runValidationWithProgress(
  _plan: MarkdownPlan,
  projectRoot: string
): Promise<ValidationResult> {
  const checks: CompletionCheck[] = [];

  const buildSpinner = ora({ spinner: "dots" }).start();
  buildSpinner.text = "Build — checking...";
  const buildCheck = checkBuild(projectRoot);
  checks.push(buildCheck);
  buildSpinner[buildCheck.passed ? "succeed" : "fail"](
    `Build — ${buildCheck.message}`
  );

  const testSpinner = ora({ spinner: "dots" }).start();
  testSpinner.text = "Tests — checking...";
  const testCheck = checkTests(projectRoot);
  checks.push(testCheck);
  testSpinner[testCheck.passed ? "succeed" : "fail"](
    `Tests — ${testCheck.message}`
  );

  const lintSpinner = ora({ spinner: "dots" }).start();
  lintSpinner.text = "Lint — checking...";
  const lintCheck = checkLint(projectRoot);
  checks.push(lintCheck);
  lintSpinner[lintCheck.passed ? "succeed" : "fail"](
    `Lint — ${lintCheck.message}`
  );

  const valid = checks.filter((c) => !c.passed).length === 0;
  return { valid, checks };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJsonSafe(projectRoot: string): PackageJson | null {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Detect package-manager runner from project signals.
 * Reuses analyser.ts detection that already runs at `shugo init`.
 */
function resolveRunner(projectRoot: string): { run: (script: string) => string } {
  const analysis = analyseProject(projectRoot);
  const pm = analysis.packageManager === "unknown" ? "npm" : analysis.packageManager;
  return {
    run: (script: string) => {
      if (pm === "npm") return `npm run ${script}`;
      if (pm === "yarn") return `yarn run ${script}`;
      return `${pm} run ${script}`;
    },
  };
}

// ── Completion Checks ────────────────────────────────────────────────────────

export function checkBuild(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.build) {
    return { name: "BUILD", passed: true, message: "No build script — skipped (non-blocking)" };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("build")} 2>/dev/null`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "BUILD", passed: true, message: "Build passed" };
  } catch {
    return { name: "BUILD", passed: false, message: "Build failed" };
  }
}

export function checkTests(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.test) {
    // No test script — blocking. "done" without any runnable test suite defeats the
    // whole purpose of the Bloco F verification gate.
    return { name: "TESTS", passed: false, message: "No 'test' script in package.json — cannot verify" };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("test")} 2>/dev/null`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 180000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "TESTS", passed: true, message: "Tests passed" };
  } catch {
    return { name: "TESTS", passed: false, message: "Tests failed" };
  }
}

export function checkLint(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.lint) {
    // No lint script — skip. Third-party projects without a linter should not be
    // blocked forever by the auto-verification gate.
    return { name: "LINT", passed: true, message: "No lint script — skipped (non-blocking)" };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("lint")} 2>/dev/null`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "LINT", passed: true, message: "Lint passed" };
  } catch {
    return { name: "LINT", passed: false, message: "Lint failed" };
  }
}

// ── Verification Record ────────────────────────────────────────────────────

export interface VerificationRecord {
  planId: string;
  commitHash: string;
  checks: CompletionCheck[];
  passed: boolean;
  timestamp: string;
}

export function runAutoVerification(
  shitennoDir: string,
  projectRoot: string,
  planId: string
): VerificationRecord {
  const checks = [checkBuild(projectRoot), checkTests(projectRoot), checkLint(projectRoot)];
  const passed = checks.every((c) => c.passed);
  let commitHash = "unknown";
  try {
    commitHash = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }).trim();
  } catch { /* not in a git repo or git unavailable */ }

  const record: VerificationRecord = {
    planId,
    commitHash,
    checks,
    passed,
    timestamp: new Date().toISOString(),
  };

  const engine = new MarkdownPlanEngine(shitennoDir);
  const plansDir = join(shitennoDir, "governance", "plans");

  if (passed) {
    // Grava o sidecar ANTES de mudar o status.
    // updateStatus(id, "done") move o .md sincronamente dentro dela mesma
    // (markdown-plan-engine.ts) — se o .verification.json for escrito
    // depois dessa chamada, o .md já não está mais em plansDir, e o sidecar
    // fica órfão, nunca migra para done/.
    writeFileSync(
      join(plansDir, `${planId}.verification.json`),
      JSON.stringify(record, null, 2),
      "utf-8"
    );
    engine.updateStatus(planId, "done"); // moveToDone() arrasta o sidecar junto
  } else {
    engine.updateStatus(planId, "blocked");
    const failedNames = checks.filter((c) => !c.passed).map((c) => c.name).join(", ");
    logger.warn("plan-lifecycle", `Plan ${planId} blocked — failed: ${failedNames}`);
  }

  return record;
}

// ── Archive / Remove Plan ──────────────────────────────────────────────────

export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  try {
    const engine = new MarkdownPlanEngine(shitennoDir);

    if (validation) {
      const plansDir = join(shitennoDir, "governance", "plans");
      let commitHash = "unknown";
      try {
        commitHash = execSync("git rev-parse HEAD", { cwd: shitennoDir, encoding: "utf-8", timeout: 5000 }).trim();
      } catch { /* not a git repo */ }

      writeFileSync(
        join(plansDir, `${planId}.verification.json`),
        JSON.stringify(
          { planId, commitHash, checks: validation.checks, passed: validation.valid, timestamp: new Date().toISOString() },
          null, 2
        ),
        "utf-8"
      );
    }

    engine.updateStatus(planId, "done");
    return true;
  } catch {
    return false;
  }
}

export function removePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  return archivePlan(shitennoDir, planId, validation);
}

// ── Interactive Review ─────────────────────────────────────────────────────

function askQuestion(query: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function printInference(inf: PlanInference): void {
  const icon =
    inf.inferredStatus === "done" ? "✅" :
    inf.inferredStatus === "obsolete" ? "🗄️" :
    inf.inferredStatus === "inconsistent" ? "⚠️" :
    inf.inferredStatus === "paused" ? "⏸️" : "🔄";

  output(`  ${icon} ${chalk.bold(inf.id)}`);
  output(`     Title: ${inf.title}`);
  output(`     Status: ${inf.rawStatus} → inferred: ${chalk.bold(inf.inferredStatus)}`);

  if (inf.checkboxes.total > 0) {
    output(`     Checkboxes: ${inf.checkboxes.closed}/${inf.checkboxes.total} (${inf.checkboxes.percentage}%)`);
  } else {
    output(`     Checkboxes: none (design document)`);
  }

  output(`     Age: ${inf.ageInDays} day(s)`);
  if (inf.estado) {
    output(`     Estado: ${inf.estado}`);
  }
  output(`     🤖 Recommendation: ${chalk.bold(inf.recommendation)} — ${inf.reason}`);
  outputBlank();
}

// ── Main Lifecycle Flow ────────────────────────────────────────────────────

export async function runLifecycleReview(
  projectRoot: string,
  options: { auto?: boolean; dry?: boolean } = {}
): Promise<LifecycleResult> {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  const result: LifecycleResult = { active: 0, archived: 0, removed: 0, skipped: 0 };

  outputBlank();
  output(chalk.bold.cyan("🔍 PLAN LIFECYCLE — Checking active plans"));
  outputBlank();

  // 1. Run inference
  const inferenceEngine = new InferenceEngine(shitennoDir);
  const summary = inferenceEngine.generateSummary();

  if (summary.totalPlans === 0) {
    output(chalk.green("  No active plans found. All archived."));
    outputBlank();
    return result;
  }

  result.active = summary.totalPlans;

  // 2. Show inference summary
  output(`  ${chalk.bold(String(summary.totalPlans))} active plan(s):`);
  outputBlank();

  for (const inf of summary.plans) {
    printInference(inf);
  }

  // 3. For each plan, validate and prompt
  for (const inf of summary.plans) {
    const plan = detectActivePlans(shitennoDir).find((p) => p.id === inf.id);
    if (!plan) continue;

    // Technical validation
    output(chalk.bold(`  🔧 Validating: ${inf.id}`));
    const validation = await runValidationWithProgress(plan, projectRoot);
    outputBlank();

    if (!validation.valid) {
      output(
        chalk.yellow("  ⚠️  Technical checks failed. Skipping.")
      );
      outputBlank();
      result.skipped++;
      continue;
    }

    // Auto mode: use recommendation
    if (options.auto) {
      const action = inf.recommendation;
      if (action === "archive" || action === "remove") {
        if (options.dry) {
          output(chalk.dim(`  [DRY RUN] Would ${action}: ${inf.id} → done/`));
          outputBlank();
          continue;
        }
        try {
          archivePlan(shitennoDir, inf.id, validation);
          output(chalk.green(`  ✓ Plan ${action}d: ${inf.id} → done/`));
          outputBlank();
          if (action === "archive") result.archived++;
          else result.removed++;
        } catch (error) {
          output(chalk.red(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`));
          outputBlank();
          result.skipped++;
        }
      } else {
        output(chalk.dim(`  Kept: ${inf.id} (${inf.reason})`));
        outputBlank();
        result.skipped++;
      }
      continue;
    }

    // Interactive mode: 4-option prompt
    const answer = await askQuestion(
      `  [A] Archive as done / [S] Skip / [M] Keep active / [R] Remove: `
    );

    switch (answer) {
      case "a": {
        if (options.dry) {
          output(chalk.dim(`  [DRY RUN] Would archive: ${inf.id} → done/`));
          break;
        }
        try {
          archivePlan(shitennoDir, inf.id, validation);
          output(chalk.green(`  ✓ Plan archived: ${inf.id} → done/`));
          result.archived++;
        } catch (error) {
          output(chalk.red(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`));
          result.skipped++;
        }
        break;
      }
      case "r": {
        if (options.dry) {
          output(chalk.dim(`  [DRY RUN] Would remove: ${inf.id} → done/`));
          break;
        }
        try {
          removePlan(shitennoDir, inf.id, validation);
          output(chalk.green(`  ✓ Plan removed: ${inf.id} → done/`));
          result.removed++;
        } catch (error) {
          output(chalk.red(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`));
          result.skipped++;
        }
        break;
      }
      case "m": {
        output(chalk.dim(`  Kept: ${inf.id}`));
        result.skipped++;
        break;
      }
      default: {
        output(chalk.dim(`  Skipped: ${inf.id}`));
        result.skipped++;
        break;
      }
    }
    outputBlank();
  }

  // 4. Summary
  output(chalk.bold("  ── Summary ──"));
  output(`  Active:   ${result.active}`);
  output(`  Archived: ${chalk.green(String(result.archived))}`);
  output(`  Removed:  ${chalk.red(String(result.removed))}`);
  output(`  Skipped:  ${chalk.yellow(String(result.skipped))}`);
  outputBlank();

  return result;
}

// ── Lightweight Archive (for git hooks) ───────────────────────────────────

/**
 * Lightweight check: scan all active plans and archive any with Status: Done.
 * No user interaction, no validation — just file move + event publish.
 * Used by: shugo detect --auto (post-commit hook).
 *
 * This function is idempotent: plans already in done/ are skipped.
 */
export function checkAndArchiveDonePlans(shitennoDir: string): { checked: number; archived: number; archivedIds: string[] } {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const archivedIds: string[] = [];
  let checked = 0;
  let archived = 0;

  for (const plan of engine.listAll()) {
    if (!plan.isActive) continue;
    checked++;
    try {
      if (engine.archiveIfDone(plan.id)) {
        archived++;
        archivedIds.push(plan.id);
      }
    } catch {
      logger.debug("plan-lifecycle", `Skipping plan ${plan.id} that failed archival check`);
    }
  }

  return { checked, archived, archivedIds };
}
