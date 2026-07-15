/**
 * digest.ts — Daily Digest Command
 *
 * Generates a concise daily digest of project health, recent changes,
 * and recommended actions. Designed for quick morning check-ins.
 *
 * PRINCIPLE: Start each day with a clear picture of project state.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { output, outputBlank, outputError } from "../output.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DigestData {
  generatedAt: string;
  project: {
    name: string;
    maturityScore: number | null;
    maturityLevel: string;
  };
  health: {
    overall: string;
    issues: string[];
  };
  recentChanges: {
    filesModified: number;
    linesAdded: number;
    linesRemoved: number;
    topFiles: string[];
  };
  knowledgeDebt: {
    current: number;
    trend: string;
  };
  recommendations: string[];
}

// ── Digest Generation ──────────────────────────────────────────────────────

function getMaturityLevel(score: number | null): string {
  if (score === null) return "Unknown";
  if (score < 25) return "Starting";
  if (score < 50) return "Developing";
  if (score < 75) return "Mature";
  return "Advanced";
}

function analyzeRecentChanges(projectRoot: string): DigestData["recentChanges"] {
  try {
    const output = execSync(
      `git log --since="1 day ago" --shortstat --format="" 2>/dev/null`,
      { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }
    );

    let filesModified = 0;
    let linesAdded = 0;
    let linesRemoved = 0;

    const lines = output.split("\n").filter(Boolean);
    for (const line of lines) {
      const filesMatch = line.match(/(\d+) files? changed/);
      const addedMatch = line.match(/(\d+) insertions?/);
      const removedMatch = line.match(/(\d+) deletions?/);

      if (filesMatch?.[1]) filesModified += parseInt(filesMatch[1], 10);
      if (addedMatch?.[1]) linesAdded += parseInt(addedMatch[1], 10);
      if (removedMatch?.[1]) linesRemoved += parseInt(removedMatch[1], 10);
    }

    // Get top changed files
    const fileOutput = execSync(
      `git log --since="1 day ago" --name-only --format="" 2>/dev/null | sort | uniq -c | sort -rn | head -5`,
      { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }
    );

    const topFiles = fileOutput
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        const parts = line.trim().split(/\s+/);
        return parts[1] || "";
      })
      .filter(Boolean);

    return { filesModified, linesAdded, linesRemoved, topFiles };
  } catch {
    return { filesModified: 0, linesAdded: 0, linesRemoved: 0, topFiles: [] };
  }
}

export function generateDigest(projectRoot: string, nexusDir: string): DigestData {
  // Read maturity profile
  let maturityScore: number | null = null;
  const profilePath = join(nexusDir, "maturity-profile.json");
  if (existsSync(profilePath)) {
    try {
      const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
      maturityScore = profile.overallScore ?? null;
    } catch (error) {
      logger.debug("digest", "Suppressed error", { error });
    }
  }

  // Read knowledge debt
  let knowledgeDebt = 0;
  const debtPath = join(nexusDir, "knowledge-debt.json");
  if (existsSync(debtPath)) {
    try {
      const debt = JSON.parse(readFileSync(debtPath, "utf-8"));
      knowledgeDebt = debt.total ?? 0;
    } catch (error) {
      logger.debug("digest", "Suppressed error", { error });
    }
  }

  // Analyze recent changes
  const recentChanges = analyzeRecentChanges(projectRoot);

  // Determine health
  const issues: string[] = [];
  if (knowledgeDebt > 50) issues.push("High knowledge debt");
  if (recentChanges.filesModified > 20) issues.push("Many files changed today");
  const healthOverall = issues.length === 0 ? "good" : issues.length === 1 ? "fair" : "needs attention";

  // Generate recommendations
  const recommendations: string[] = [];
  if (knowledgeDebt > 30) recommendations.push("Run `nexus audit` to reduce knowledge debt");
  if (recentChanges.filesModified === 0) recommendations.push("No changes detected today — consider running `nexus assess`");
  if (maturityScore !== null && maturityScore < 50) recommendations.push("Project is in early maturity — focus on foundation practices");
  if (recommendations.length === 0) recommendations.push("Project is healthy — continue current practices");

  return {
    generatedAt: new Date().toISOString(),
    project: {
      name: projectRoot.split("/").pop() || "unknown",
      maturityScore,
      maturityLevel: getMaturityLevel(maturityScore),
    },
    health: {
      overall: healthOverall,
      issues,
    },
    recentChanges,
    knowledgeDebt: {
      current: knowledgeDebt,
      trend: knowledgeDebt > 30 ? "increasing" : "stable",
    },
    recommendations,
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────

function formatDigest(digest: DigestData): void {
  output(`\n${chalk.bold.cyan("╔══╗")}  ${chalk.bold("DAILY DIGEST")}`);
  output(`${chalk.bold.cyan("╚══╝")}  ${new Date(digest.generatedAt).toLocaleDateString()}\n`);

  // Project
  output(chalk.bold("📁 Project"));
  output(`   Name: ${chalk.cyan(digest.project.name)}`);
  output(`   Maturity: ${chalk.cyan(digest.project.maturityLevel)}${digest.project.maturityScore !== null ? ` (${digest.project.maturityScore}%)` : ""}`);
  outputBlank();

  // Health
  const healthColor = digest.health.overall === "good" ? chalk.green :
                      digest.health.overall === "fair" ? chalk.yellow : chalk.red;
  output(chalk.bold("🏥 Health"));
  output(`   Overall: ${healthColor(digest.health.overall)}`);
  if (digest.health.issues.length > 0) {
    for (const issue of digest.health.issues) {
      output(chalk.yellow(`   ⚠ ${issue}`));
    }
  }
  outputBlank();

  // Recent Changes
  if (digest.recentChanges.filesModified > 0) {
    output(chalk.bold("📝 Recent Changes (last 24h)"));
    output(`   Files: ${digest.recentChanges.filesModified} | +${digest.recentChanges.linesAdded} / -${digest.recentChanges.linesRemoved}`);
    if (digest.recentChanges.topFiles.length > 0) {
      output(`   Top files: ${digest.recentChanges.topFiles.join(", ")}`);
    }
    outputBlank();
  }

  // Knowledge Debt
  const debtColor = digest.knowledgeDebt.current > 50 ? chalk.red :
                    digest.knowledgeDebt.current > 20 ? chalk.yellow : chalk.green;
  output(chalk.bold("📊 Knowledge Debt"));
  output(`   Current: ${debtColor(String(digest.knowledgeDebt.current))} | Trend: ${digest.knowledgeDebt.trend}`);
  outputBlank();

  // Recommendations
  output(chalk.bold("💡 Recommendations"));
  for (const rec of digest.recommendations) {
    output(chalk.cyan(`   → ${rec}`));
  }
  outputBlank();
}

// ── Command ──────────────────────────────────────────────────────────────────

export function digestCommand(): Command {
  const cmd = new Command("digest")
    .description("Daily digest of project health and recent changes")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;

      if (!isJson) {
        output(`\n${chalk.bold.cyan("╔══╗")}  ${chalk.bold("DAILY DIGEST")}`);
        output(`${chalk.bold.cyan("╚══╝")}  Generating...\n`);
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("digest", ctx.projectRoot, ctx.nexusDir, isJson)) {
        return;
      }

      const spinner = ora({ spinner: "dots" }).start(isJson ? "Generating" : "Generating digest...");

      try {
        const digest = generateDigest(ctx.projectRoot, ctx.nexusDir);

        spinner.stop();

        if (isJson) {
          outputJson(digest as unknown as Record<string, unknown>);
        } else {
          formatDigest(digest);
        }

        getEventBus().publish("analysis.complete", {
          type: "daily_digest",
          health: digest.health.overall,
          debt: digest.knowledgeDebt.current,
        });

      } catch (error) {
        spinner.fail("Failed to generate digest");
        if (isJson) {
          outputJson({ error: "digest_failed", message: String(error) });
        } else {
          outputError(chalk.red(`  Error: ${error}`));
        }
      }
    });

  return cmd;
}
