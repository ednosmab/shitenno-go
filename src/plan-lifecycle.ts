/**
 * plan-lifecycle.ts — Plan Lifecycle Management
 *
 * Detects active plans, validates completion, and archives them
 * after user confirmation.
 *
 * Flow: detect → validate → prompt review method → confirm → archive
 */

import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import chalk from "chalk";
import {
  MarkdownPlanEngine,
  type MarkdownPlan,
} from "./markdown-plan-engine.js";

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
  skipped: number;
}

// ── Detect Active Plans ────────────────────────────────────────────────────

export function detectActivePlans(nexusDir: string): MarkdownPlan[] {
  const engine = new MarkdownPlanEngine(nexusDir);
  return engine.list().filter((p) => p.status !== "done");
}

// ── Validate Plan Completion ───────────────────────────────────────────────

export function validatePlanCompletion(
  plan: MarkdownPlan,
  projectRoot: string
): ValidationResult {
  const checks: CompletionCheck[] = [];

  // Check 1: Build passes
  checks.push(checkBuild(projectRoot));

  // Check 2: Tests pass
  checks.push(checkTests(projectRoot));

  // Check 3: Lint passes
  checks.push(checkLint(projectRoot));

  // Check 4: Plan file has status markers (not still "andamento")
  checks.push({
    name: "STATUS",
    passed: plan.status === "done",
    message:
      plan.status === "done"
        ? "Plan status is done"
        : `Plan status is "${plan.status}" — will be updated to done`,
  });

  const valid = checks.filter((c) => !c.passed).length === 0;
  return { valid, checks };
}

function checkBuild(projectRoot: string): CompletionCheck {
  try {
    execSync("pnpm run build 2>/dev/null", {
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

function checkTests(projectRoot: string): CompletionCheck {
  try {
    execSync("pnpm run test --recursive --if-present 2>/dev/null", {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "TESTS", passed: true, message: "Tests passed" };
  } catch {
    return { name: "TESTS", passed: false, message: "Tests failed or not found" };
  }
}

function checkLint(projectRoot: string): CompletionCheck {
  try {
    execSync("pnpm run lint 2>/dev/null", {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "LINT", passed: true, message: "Lint passed" };
  } catch {
    return { name: "LINT", passed: false, message: "Lint failed or not configured" };
  }
}

// ── Archive Plan ───────────────────────────────────────────────────────────

export function archivePlan(nexusDir: string, planId: string): void {
  const engine = new MarkdownPlanEngine(nexusDir);
  engine.updateStatus(planId, "done");
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

function printChecks(checks: CompletionCheck[]): void {
  for (const check of checks) {
    const icon = check.passed ? chalk.green("✅") : chalk.red("❌");
    console.log(`     ${icon} ${check.name}: ${check.message}`);
  }
}

// ── Main Lifecycle Flow ────────────────────────────────────────────────────

export async function runLifecycleReview(
  projectRoot: string,
  options: { auto?: boolean; dry?: boolean } = {}
): Promise<LifecycleResult> {
  const nexusDir = join(projectRoot, "nexus-system");
  const result: LifecycleResult = { active: 0, archived: 0, skipped: 0 };

  console.log("");
  console.log(chalk.bold.cyan("🔍 PLAN LIFECYCLE — Checking active plans"));
  console.log("");

  // 1. Detect active plans
  const plans = detectActivePlans(nexusDir);
  result.active = plans.length;

  if (plans.length === 0) {
    console.log(chalk.green("  No active plans found. All archived."));
    console.log("");
    return result;
  }

  console.log(`  Found ${chalk.bold(String(plans.length))} active plan(s):`);
  console.log("");

  for (const plan of plans) {
    console.log(`  📄 ${chalk.bold(plan.id)}`);
    console.log(`     Title: ${plan.title}`);
    console.log(`     Status: ${plan.status}`);
    console.log(`     Path: ${plan.relativePath}`);
    console.log("");
  }

  // 2. For each plan, validate and prompt
  for (const plan of plans) {
    console.log(chalk.bold(`  🔧 Validating: ${plan.id}`));
    const validation = validatePlanCompletion(plan, projectRoot);
    printChecks(validation.checks);
    console.log("");

    if (!validation.valid) {
      console.log(
        chalk.yellow(
          "  ⚠️  Some checks failed. Fix issues before archiving."
        )
      );
      console.log("");
      result.skipped++;
      continue;
    }

    // 3. Prompt review method (unless --auto)
    let reviewMethod = "a";
    if (!options.auto) {
      const answer = await askQuestion(
        "  Review method? [A] Agent validates / [U] I'll review myself: "
      );
      reviewMethod = answer || "a";
    }

    if (reviewMethod === "u" || reviewMethod === "utilizador") {
      // User reviews manually
      const confirm = await askQuestion(
        "  Confirma que o plano está concluído? (y/n): "
      );
      if (confirm !== "y" && confirm !== "s") {
        console.log(chalk.dim("  Skipped."));
        console.log("");
        result.skipped++;
        continue;
      }
    } else {
      // Agent validates automatically
      console.log(
        chalk.green(
          "  🤖 Agent review: All checks passed. Plan is ready to archive."
        )
      );
      console.log("");
    }

    // 4. Archive (unless --dry)
    if (options.dry) {
      console.log(
        chalk.dim(`  [DRY RUN] Would archive: ${plan.id} → done/`)
      );
      console.log("");
      continue;
    }

    try {
      archivePlan(nexusDir, plan.id);
      console.log(
        chalk.green(`  ✓ Plan archived: ${plan.id} → done/`)
      );
      console.log("");
      result.archived++;
    } catch (error) {
      console.log(
        chalk.red(
          `  ✗ Failed to archive: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      console.log("");
      result.skipped++;
    }
  }

  // 5. Summary
  console.log(chalk.bold("  ── Summary ──"));
  console.log(`  Active:   ${result.active}`);
  console.log(`  Archived: ${chalk.green(String(result.archived))}`);
  console.log(`  Skipped:  ${chalk.yellow(String(result.skipped))}`);
  console.log("");

  return result;
}
