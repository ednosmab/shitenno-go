/**
 * assess.ts — Maturity Assessment & Evolution Recommendations
 *
 * Re-avalia a maturidade do projeto e recomenda novas capacidades.
 * Permite evolução contínua — o Shiten cresce conforme o projeto amadurece.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyseProject } from "../analyser.js";
import { detectComplexity } from "../complexity-detector.js";
import { getActiveRules } from "../rule-loader.js";
import { askQuestions } from "../prompts.js";
import {
  calculateMaturityProfile,
  saveMaturityProfile,
  recordMaturitySnapshot,
  loadMaturityProfile,
  readMaturityHistory,
  type MaturityProfile,
} from "../maturity-profile.js";
import { outputJson, healthBar } from "../formatting.js";
import { output, outputBlank } from "../output.js";
import { guardNotInitialized, guardInteractive, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { recordFeedback, recordDimensionFeedback, type PerformanceMetric } from "../feedback-loops.js";

function displayDimensionBar(label: string, value: number, prev?: number): void {
  const barWidth = 20;
  const filled = Math.round((value / 100) * barWidth);
  const empty = barWidth - filled;
  const color = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
  const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));

  let delta = "";
  if (prev !== undefined) {
    const diff = value - prev;
    if (diff > 0) delta = chalk.green(` +${diff}`);
    else if (diff < 0) delta = chalk.red(` ${diff}`);
    else delta = chalk.gray(" =");
  }

  output(`    ${label.padEnd(16)} ${bar} ${chalk.bold(String(value).padStart(3))}%${delta}`);
}

function displayEvolution(history: Array<{ timestamp: string; overallScore: number }>): void {
  if (history.length < 2) {
    output(chalk.gray("    (need more assessments to show evolution)"));
    return;
  }

  output(chalk.bold("  Evolution:"));
  outputBlank();

  const maxScore = Math.max(...history.map((h) => h.overallScore));

  // Simple ASCII sparkline
  const scores = history.map((h) => h.overallScore);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;

  const chars = " ▁▂▃▄▅▆▇█";
  const sparkline = scores.map((s) => {
    const idx = Math.round(((s - minScore) / range) * (chars.length - 1));
    return chars[idx];
  }).join("");

  output(`    ${chalk.cyan(sparkline)} ${chalk.gray(`(${history.length} assessments)`)}`);
  outputBlank();
}

function displayComplexity(projectRoot: string, shitenDir: string, isJson: boolean): void {
  const result = detectComplexity(projectRoot);
  const active = getActiveRules(projectRoot, shitenDir);

  if (isJson) {
    outputJson({
      complexity: result.level,
      score: result.score,
      factors: result.factors,
      capabilities: result.recommendedCapabilities,
      rules: {
        loaded: active.loadedCount,
        total: active.totalCount,
      },
    });
    return;
  }

  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║  shiten assess complexity                 ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
  outputBlank();

  const levelColor = result.level === "simple" ? chalk.green : result.level === "medium" ? chalk.yellow : chalk.red;
  output(chalk.bold("  Project Complexity Analysis"));
  output("  " + "─".repeat(40));
  output(`  Level:     ${levelColor.bold(result.level)}`);
  output(`  Score:     ${result.score}`);
  outputBlank();

  output(chalk.bold("  Factors:"));
  for (const f of result.factors) {
    const icon = f.score >= 3 ? "🔴" : f.score >= 2 ? "🟡" : "🟢";
    output(`    ${icon} ${f.description}`);
  }
  outputBlank();

  output(chalk.bold("  Recommended Capabilities:"));
  for (const cap of result.recommendedCapabilities) {
    output(chalk.green(`    ✅ ${cap}`));
  }
  outputBlank();

  output(chalk.bold("  Rules loaded:"));
  output(`    Complexity: ${result.level}`);
  output(`    Active: ${active.loadedCount}/${active.totalCount} rules`);
  if (result.level === "simple") {
    output(chalk.gray("    ℹ️  Simple project — only core rules active"));
  } else if (result.level === "medium") {
    output(chalk.gray("    ℹ️  Medium project — core + knowledge + governance + quality rules active"));
  } else {
    output(chalk.gray("    ℹ️  Complex project — all rules active"));
  }
  outputBlank();
}

export const assessCommand = new Command("assess")
  .description("Re-evaluate project maturity and recommend new capabilities")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .option("--answers-file <path>", "JSON file with pre-defined answers (skips interactive prompts)")
  .option("--complexity", "Show project complexity analysis and active rules")
  .action(async (options) => {
    const isJson = options.json === true;

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitenDir, isJson);

    // Complexity mode: show project complexity and active rules
    if (options.complexity) {
      displayComplexity(ctx.projectRoot, ctx.shitenDir, isJson);
      return;
    }

    if (!isJson) {
      outputBlank();
      output(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
      output(chalk.bold.cyan("  ║  shiten assess — Maturity Assessment      ║"));
      output(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
      outputBlank();
    }

    if (!checkLifecycleGate("assess", ctx.projectRoot, ctx.shitenDir, isJson)) return;

    // Load previous profile
    const previousProfile = loadMaturityProfile(ctx.shitenDir);

    // Analyse project
    const analyseSpinner = ora("Analysing project...").start();
    const analysis = analyseProject(ctx.projectRoot);
    analyseSpinner.succeed("Project analysis complete");

    let newProfile: MaturityProfile;

    if (isJson) {
      // In JSON mode, if a previous profile exists, re-analyze with existing data
      // If not, use a default questionnaire based on project analysis
      const calcSpinner = ora("Calculating maturity profile...").start();
      if (previousProfile) {
        // Re-analyze: keep previous answers but update from project analysis
        const syntheticAnswers = {
          usedShitenBefore: previousProfile.installedCapabilities.length > 1,
          isFirstProject: false,
          projectAge: "established" as const,
          teamSize: "small" as const,
          hasDedicatedTeam: previousProfile.installedCapabilities.length > 3,
          hasArchitectureDocs: previousProfile.installedCapabilities.includes("architecture"),
          hasADRs: previousProfile.installedCapabilities.includes("architecture"),
          hasTechnicalReviews: previousProfile.installedCapabilities.includes("governance"),
          hasCICD: previousProfile.dimensions.automation > 30,
          hasAutomatedTests: previousProfile.dimensions.quality > 30,
          hasValidationPipeline: previousProfile.dimensions.automation > 50,
          intendsToUseAI: previousProfile.dimensions.ai > 20,
          aiWillImplement: previousProfile.dimensions.ai > 50,
          requiresHumanReview: previousProfile.dimensions.governance > 30,
          hasDefinedPatterns: previousProfile.dimensions.governance > 25,
          hasReviewProcess: previousProfile.dimensions.governance > 40,
          hasDecisionControl: previousProfile.dimensions.governance > 50,
        };
        newProfile = calculateMaturityProfile(syntheticAnswers, analysis, ctx.shitenDir);
      } else {
        // No previous profile — use neutral defaults based on analysis
        const syntheticAnswers = {
          usedShitenBefore: false,
          isFirstProject: false,
          projectAge: "new" as const,
          teamSize: "solo" as const,
          hasDedicatedTeam: false,
          hasArchitectureDocs: false,
          hasADRs: false,
          hasTechnicalReviews: false,
          hasCICD: analysis.hasCI,
          hasAutomatedTests: analysis.hasTests,
          hasValidationPipeline: false,
          intendsToUseAI: true,
          aiWillImplement: true,
          requiresHumanReview: true,
          hasDefinedPatterns: false,
          hasReviewProcess: false,
          hasDecisionControl: false,
        };
        newProfile = calculateMaturityProfile(syntheticAnswers, analysis, ctx.shitenDir);
      }
      calcSpinner.succeed("Maturity profile calculated");
    } else {
      // Interactive mode: run the full questionnaire
      // Guard against non-interactive environments
      if (!guardInteractive(options, isJson)) return;

      output(chalk.bold("  Re-evaluate your maturity profile:"));
      outputBlank();

      let answers: Awaited<ReturnType<typeof askQuestions>>;
      if (options.answersFile) {
        const answersPath = resolve(options.answersFile);
        if (!existsSync(answersPath)) {
          if (isJson) {
            outputJson({ error: "answers_file_not_found", message: `File not found: ${answersPath}` });
          } else {
            output(chalk.red(`  ✘ Answers file not found: ${answersPath}`));
          }
          process.exitCode = 1;
          return;
        }
        const raw = readFileSync(answersPath, "utf-8");
        answers = JSON.parse(raw);
        if (!isJson) {
          output(chalk.gray(`  Loaded answers from ${options.answersFile}`));
        }
      } else {
        answers = await askQuestions(analysis);
      }

      const calcSpinner = ora("Calculating maturity profile...").start();
      newProfile = calculateMaturityProfile(answers.maturity, analysis, ctx.shitenDir);
      calcSpinner.succeed("Maturity profile calculated");
    }

    // Save and record
    saveMaturityProfile(ctx.shitenDir, newProfile);
    recordMaturitySnapshot(ctx.shitenDir, newProfile);

    // Calculate delta
    const scoreDelta = previousProfile
      ? newProfile.overallScore - previousProfile.overallScore
      : undefined;

    // Publish event
    getEventBus().publish("maturity.changed", {
      dimension: "overall",
      previousScore: previousProfile?.overallScore ?? newProfile.overallScore,
      newScore: newProfile.overallScore,
      delta: scoreDelta ?? 0,
    });

    // Record feedback for recommended capabilities
    for (const cap of newProfile.recommendedCapabilities) {
      recordFeedback(ctx.shitenDir, {
        recommendationId: `cap-${cap}`,
        action: "deferred",
        context: {
          maturityScore: newProfile.overallScore,
          installedCapabilities: newProfile.installedCapabilities,
          knowledgeDebt: 0,
        },
      });
    }

    // Record dimension feedback for performance metrics
    const dimensionToMetric: Record<string, PerformanceMetric> = {
      architecture: "architectural_vision",
      governance: "decision_making",
      quality: "technical_communication",
      automation: "sustainable_velocity",
      ai: "prompt_quality",
      documentation: "scope_management",
      observability: "risk_management",
    };
    for (const [dim, score] of Object.entries(newProfile.dimensions)) {
      const metric = dimensionToMetric[dim];
      if (metric) {
        const action = score >= 65 ? "accepted" : score < 35 ? "rejected" : "deferred";
        recordDimensionFeedback(ctx.shitenDir, {
          recommendationId: `maturity-${dim}`,
          action,
          dimension: metric,
          evidence: `Maturity score: ${score}/100`,
          context: {
            maturityScore: newProfile.overallScore,
            installedCapabilities: newProfile.installedCapabilities,
            knowledgeDebt: 0,
          },
        });
      }
    }

    // JSON output
    if (isJson) {
      outputJson({
        projectRoot: ctx.projectRoot,
        previousScore: previousProfile?.overallScore,
        newProfile: {
          dimensions: newProfile.dimensions,
          overallScore: newProfile.overallScore,
          installedCapabilities: newProfile.installedCapabilities,
          recommendedCapabilities: newProfile.recommendedCapabilities,
          futureCapabilities: newProfile.futureCapabilities,
        },
        scoreDelta,
        computedAt: newProfile.computedAt,
      });
      return;
    }

    // Human-readable output
    outputBlank();
    output(chalk.bold.green("  ═══ Maturity Assessment Results ═══"));
    outputBlank();

    if (previousProfile) {
      const color = scoreDelta !== undefined
        ? scoreDelta > 0 ? chalk.green : scoreDelta < 0 ? chalk.red : chalk.gray
        : chalk.gray;

      output(chalk.bold("  Previous Score:"));
      output(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
      outputBlank();

      output(chalk.bold("  New Score:"));
      const deltaStr = scoreDelta !== undefined
        ? ` (${scoreDelta > 0 ? "+" : ""}${scoreDelta})`
        : "";
      output(`    ${newProfile.overallScore}/100 ${healthBar(newProfile.overallScore, 100)}${color(deltaStr)}`);
    } else {
      output(chalk.bold("  Overall Score:"));
      output(`    ${newProfile.overallScore}/100 ${healthBar(newProfile.overallScore, 100)}`);
    }
    outputBlank();

    // Dimensions with delta
    output(chalk.bold("  Dimensions:"));
    outputBlank();
    const dimLabels: Record<string, string> = {
      architecture: "Arquitetura",
      governance: "Governança",
      quality: "Qualidade",
      automation: "Automação",
      ai: "IA",
      documentation: "Documentação",
      observability: "Observabilidade",
    };

    for (const [key, label] of Object.entries(dimLabels)) {
      const prevDim = previousProfile?.dimensions[key as keyof typeof previousProfile.dimensions];
      displayDimensionBar(label, newProfile.dimensions[key as keyof typeof newProfile.dimensions], prevDim);
    }
    outputBlank();

    // Capabilities
    const installed = newProfile.installedCapabilities;
    const recommended = newProfile.recommendedCapabilities;
    const future = newProfile.futureCapabilities;

    output(chalk.bold("  Installed Capabilities:"));
    for (const cap of installed) {
      output(chalk.green(`    ✓ ${cap}`));
    }
    outputBlank();

    if (recommended.length > 0) {
      output(chalk.bold("  🎯 Recommended Capabilities:"));
      for (const cap of recommended) {
        output(chalk.cyan(`    → ${cap} — install with: shiten upgrade --capability ${cap}`));
      }
      outputBlank();
    }

    if (future.length > 0) {
      output(chalk.bold("  Future Capabilities:"));
      for (const cap of future) {
        output(chalk.gray(`    □ ${cap}`));
      }
      outputBlank();
    }

    // Evolution
    const history = readMaturityHistory(ctx.shitenDir);
    displayEvolution(history);

    // Summary
    if (recommended.length > 0) {
      output(chalk.bold("  📝 Summary:"));
      output(chalk.gray(`    ${recommended.length} capability(ies) recommended.`));
      outputBlank();
      output(chalk.bold.cyan("  🎯 Next step:"));
      output(chalk.cyan("    shiten upgrade --accept-recommended"));
      output(chalk.gray("    This will install all recommended capabilities for your maturity level."));
      outputBlank();
      output(chalk.gray("    Or install individually:"));
      for (const cap of recommended) {
        output(chalk.gray(`      shiten upgrade --capability ${cap}`));
      }
    } else {
      output(chalk.green("  ✔ Your project is well-equipped! No new capabilities recommended."));
    }
    outputBlank();
  });
