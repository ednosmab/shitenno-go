/**
 * evolve.ts — Evolution Recommendations Command
 *
 * Shows evolution recommendations and allows accept/feedback.
 * Integrates with auto-evolution, feedback-loops, and event bus.
 * Displays dual paths (comfortable + challenging) for each recommendation.
 *
 * PRINCIPLE: The system shows two paths and trusts the user's intention to choose.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { output, outputBlank } from "../output.js";
import { logger } from "../logger.js";
import { analyzeEvolution, writeEvolutionReport } from "../auto-evolution.js";
import { recordFeedback, detectFeedbackPatterns, getAllFeedbackSummaries, recordDimensionFeedback, type PerformanceMetric } from "../feedback-loops.js";
import { getEventBus } from "../event-bus.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { formatDualPath, formatDualPathJson, formatGrowthProgress } from "../dual-path-presenter.js";
import { recordPathChoice } from "../growth-profile.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
// Semantic layer imports
import { runSemanticAnalysis, createSemanticDualPath, formatSemanticDualPath, formatSemanticDualPathJson } from "../semantic/index.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FeedbackRecordInput {
  recId: string;
  action: "accepted" | "rejected";
  reason: string | undefined;
  pathChoice: "comfortable" | "challenging" | undefined;
}

function recordFeedbackData(
  ctx: { shitennoDir: string },
  input: FeedbackRecordInput,
): void {
  const { recId, action, reason, pathChoice } = input;
  recordFeedback(ctx.shitennoDir, {
    recommendationId: recId,
    action,
    reason,
    context: {
      maturityScore: 0,
      installedCapabilities: [],
      knowledgeDebt: 0,
    },
    pathChoice,
  });

  const recTypeToMetric: Record<string, PerformanceMetric> = {
    capability: "scope_management",
    knowledge: "architectural_vision",
    governance: "decision_making",
    automation: "sustainable_velocity",
  };
  const metric = recTypeToMetric[recId.split("-")[0] ?? ""] ?? "decision_making";
  recordDimensionFeedback(ctx.shitennoDir, {
    recommendationId: recId,
    action,
    reason,
    dimension: metric,
    evidence: `User ${action} recommendation: ${recId}`,
    context: {
      maturityScore: 0,
      installedCapabilities: [],
      knowledgeDebt: 0,
    },
    pathChoice,
  });

  if (pathChoice) {
    recordPathChoice(ctx.shitennoDir, {
      pathChosen: pathChoice,
      context: {
        command: "evolve",
        recommendationType: "evolution_recommendation",
        maturityScore: 0,
      },
    });
  }
}

function handleFeedback(ctx: { shitennoDir: string }, options: { accept?: string; reject?: string; reason?: string; comfortable?: boolean; challenging?: boolean }, isJson: boolean): void {
  const recId = options.accept || options.reject || "";
  const action = options.accept ? "accepted" : "rejected";
  const reason = options.reason || undefined;

  let pathChoice: "comfortable" | "challenging" | undefined;
  if (options.comfortable) {
    pathChoice = "comfortable";
  } else if (options.challenging) {
    pathChoice = "challenging";
  }

  recordFeedbackData(ctx, { recId, action, reason, pathChoice });

  if (isJson) {
    outputJson({ feedback: { recommendationId: recId, action, reason, pathChoice } });
  } else {
    const icon = action === "accepted" ? chalk.green("✔") : chalk.red("✘");
    output(`  ${icon} Recommendation ${recId} ${action}`);
    if (pathChoice) {
      output(`    Path: ${pathChoice === "comfortable" ? chalk.green("Comfortable") : chalk.yellow("Challenging")}`);
    }
    if (reason) output(`    Reason: ${chalk.gray(reason)}`);
    outputBlank();
  }
}

function buildSemanticReport(ctx: { projectRoot: string; shitennoDir: string }): Record<string, unknown> {
  try {
    const { profile, patterns, insights, correlations } = runSemanticAnalysis(ctx.shitennoDir, ctx.projectRoot);
    return {
      patterns: patterns.map((p) => ({ id: p.id, type: p.type, domain: p.domain, confidence: p.confidence, description: p.description })),
      insights: insights.map((i) => ({ id: i.id, type: i.type, priority: i.priority, description: i.description, domains: i.domains })),
      correlations: correlations.map((c) => ({ id: c.id, type: c.type, strength: c.strength, description: c.description, confidence: c.confidence })),
      dualPaths: patterns.slice(0, 3).map((p) => formatSemanticDualPathJson(createSemanticDualPath(p, profile))),
      growthProfile: { growthCapacity: profile.growthCapacity, challengeLevel: profile.challengeLevel, domainChallengeLevels: profile.domainChallengeLevels },
    };
  } catch (err) {
    logger.warn("evolve", `Semantic analysis failed for JSON: ${err}`);
    return {};
  }
}

function outputReportJson(
  ctx: { projectRoot: string; shitennoDir: string },
  report: ReturnType<typeof analyzeEvolution>,
  totalFeedback: number,
  patterns: ReturnType<typeof detectFeedbackPatterns>,
): void {
  outputJson({
    projectRoot: ctx.projectRoot,
    analyzedAt: report.analyzedAt,
    currentState: report.currentState,
    totalRecommendations: report.totalRecommendations,
    byType: report.byType,
    byPriority: report.byPriority,
    recommendations: report.recommendations,
    dualPaths: report.dualPaths.map((dp) => formatDualPathJson(dp.comfortable, dp.challenging, report.growthProfile)),
    growthProfile: { growthCapacity: report.growthProfile.growthCapacity, challengeLevel: report.growthProfile.challengeLevel, pattern: report.growthProfile.patterns[0]?.type || "balanced" },
    topNextSteps: report.topNextSteps,
    summary: report.summary,
    feedback: { totalInteractions: totalFeedback, patterns },
    semantic: buildSemanticReport(ctx),
  });
}

function displaySemanticPatterns(profile: ReturnType<typeof runSemanticAnalysis>["profile"], patterns: ReturnType<typeof runSemanticAnalysis>["patterns"]): void {
  output(chalk.bold.cyan(`    📊 Semantic Patterns (${patterns.length})`));
  outputBlank();
  for (const pattern of patterns.slice(0, 3)) {
    output(chalk.gray(`    • ${pattern.description}`));
    output(chalk.gray(`      Domain: ${pattern.domain} | Confidence: ${Math.round(pattern.confidence * 100)}%`));
    output(formatSemanticDualPath(createSemanticDualPath(pattern, profile)));
  }
}

function displaySemanticInsightsEvolve(insights: ReturnType<typeof runSemanticAnalysis>["insights"]): void {
  output(chalk.bold.magenta(`    🧠 Semantic Insights (${insights.length})`));
  outputBlank();
  for (const insight of insights.slice(0, 3)) {
    const icon = insight.priority === "urgent" ? "🚨" : insight.priority === "high" ? "⚠️" : "💡";
    output(`    ${icon} ${chalk.bold(insight.description)}`);
    output(chalk.gray(`      Priority: ${insight.priority} | Domains: ${insight.domains.join(", ")}`));
    for (const action of insight.suggestedActions.slice(0, 2)) output(chalk.gray(`        → ${action}`));
    outputBlank();
  }
}

function displaySemanticCorrelationsEvolve(correlations: ReturnType<typeof runSemanticAnalysis>["correlations"]): void {
  output(chalk.bold.yellow(`    🔗 Cross-System Correlations (${correlations.length})`));
  outputBlank();
  for (const corr of correlations.slice(0, 3)) {
    const icon = corr.strength === "strong" ? "🔴" : corr.strength === "moderate" ? "🟡" : "🟢";
    output(`    ${icon} ${chalk.bold(corr.description)}`);
    output(chalk.gray(`      Type: ${corr.type} | Confidence: ${Math.round(corr.confidence * 100)}%`));
    outputBlank();
  }
}

function displaySemanticEvolution(projectRoot: string, shitennoDir: string): void {
  try {
    const { profile, patterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
    if (patterns.length === 0 && insights.length === 0 && correlations.length === 0) return;
    output(chalk.bold.magenta("  ╔══════════════════════════════════════════════════╗"));
    output(chalk.bold.magenta("  ║         SEMANTIC EVOLUTION — Deep Analysis       ║"));
    output(chalk.bold.magenta("  ╚══════════════════════════════════════════════════╝"));
    outputBlank();
    if (patterns.length > 0) displaySemanticPatterns(profile, patterns);
    if (insights.length > 0) displaySemanticInsightsEvolve(insights);
    if (correlations.length > 0) displaySemanticCorrelationsEvolve(correlations);
  } catch (err) {
    logger.warn("evolve", `Semantic analysis failed: ${err}`);
  }
}

interface EvolveReportOutput {
  report: ReturnType<typeof analyzeEvolution>;
  totalFeedback: number;
  patterns: ReturnType<typeof detectFeedbackPatterns>;
  projectRoot?: string;
  shitennoDir?: string;
}

function outputReportHuman({ report, totalFeedback, patterns, projectRoot, shitennoDir }: EvolveReportOutput): void {
  output(chalk.bold("  Current State:"));
  output(`    Maturity: ${report.currentState.maturityScore}/100`);
  output(`    Knowledge Debt: ${report.currentState.knowledgeDebtScore}/100`);
  output(`    Capabilities: ${report.currentState.installedCapabilities.length} installed`);
  outputBlank();

  output(formatGrowthProgress(report.growthProfile));
  outputBlank();

  if (totalFeedback > 0) {
    output(chalk.bold("  Feedback History:"));
    output(`    Total interactions: ${totalFeedback}`);
    for (const p of patterns) output(chalk.gray(`    ⚠ ${p.description}`));
    outputBlank();
  }

  output(chalk.bold.cyan("  ╔══════════════════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║           DUAL PATH — Choose Your Way           ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════════════════╝"));
  outputBlank();

  for (const dualPath of report.dualPaths) {
    output(formatDualPath(dualPath.comfortable, dualPath.challenging, report.growthProfile));
  }

  if (report.topNextSteps.length > 0) {
    output(chalk.bold("  Top Next Steps:"));
    for (const step of report.topNextSteps) output(`    → ${step}`);
    outputBlank();
  }

  if (projectRoot && shitennoDir) displaySemanticEvolution(projectRoot, shitennoDir);

  output(chalk.gray("  Usage:"));
  output(chalk.gray("    shugo evolve --accept EVO-001 --comfortable   # Choose comfortable path"));
  output(chalk.gray("    shugo evolve --accept CHL-001 --challenging   # Choose challenging path"));
  output(chalk.gray("    shugo evolve --reject EVO-001 --reason \"Not now\""));
  outputBlank();
}

function printBanner(): void {
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║    shugo evolve — Recommendations    ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

function initializeCommand(options: { json?: boolean; dir?: string }) {
  const isJson = options.json === true;
  if (!isJson) printBanner();
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return null;
  void printDaemonBanner(ctx.shitennoDir, isJson);
  if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.shitennoDir, isJson)) return null;
  return { ctx, isJson };
}

// ── Command ──────────────────────────────────────────────────────────────────

export const evolveCommand = new Command("evolve")
  .description("Show evolution recommendations and manage feedback")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .option("--accept <id>", "Accept a recommendation (record feedback)")
  .option("--reject <id>", "Reject a recommendation (record feedback)")
  .option("--reason <text>", "Reason for accept/reject")
  .option("--comfortable", "Choose the comfortable path (within current thinking)")
  .option("--challenging", "Choose the challenging path (beyond current thinking)")
  .action(async (options) => {
    const result = initializeCommand(options);
    if (!result) return;
    const { ctx, isJson } = result;

    if (options.accept || options.reject) {
      handleFeedback(ctx, options, isJson);
      return;
    }

    const spinner = isJson ? null : ora("Analyzing evolution recommendations...").start();

    try {
      const report = analyzeEvolution(ctx.projectRoot, ctx.shitennoDir);
      writeEvolutionReport(ctx.shitennoDir, report);

      const patterns = detectFeedbackPatterns(ctx.shitennoDir);
      const summaries = getAllFeedbackSummaries(ctx.shitennoDir);
      const totalFeedback = Object.values(summaries).reduce((acc, s) => acc + s.totalInteractions, 0);

      const bus = getEventBus();
      bus.publish("evolution.recommended", {
        totalRecommendations: report.totalRecommendations,
        byPriority: report.byPriority,
      });

      if (spinner) spinner.succeed(`Found ${report.totalRecommendations} recommendation(s)`);

      if (isJson) {
        outputReportJson(ctx, report, totalFeedback, patterns);
        return;
      }

      outputReportHuman({ report, totalFeedback, patterns, projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir });
    } catch (error) {
      if (spinner) spinner.fail("Evolution analysis failed");
      if (isJson) {
        outputJson({ error: "evolution_failed", message: String(error) });
      } else {
        logger.error("evolve", `Evolution analysis failed: ${error}`);
      }
      outputBlank();
    }
  });
