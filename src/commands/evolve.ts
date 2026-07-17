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
    const isJson = options.json === true;

    if (!isJson) {
      outputBlank();
      output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      output(chalk.bold.cyan("  ║    shiten evolve — Recommendations    ║"));
      output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitenDir, isJson);

    if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.shitenDir, isJson)) return;

    // Handle accept/reject feedback
    if (options.accept || options.reject) {
      const recId = options.accept || options.reject;
      const action = options.accept ? "accepted" : "rejected";
      const reason = options.reason || undefined;

      // Determine path choice
      let pathChoice: "comfortable" | "challenging" | undefined;
      if (options.comfortable) {
        pathChoice = "comfortable";
      } else if (options.challenging) {
        pathChoice = "challenging";
      }

      const record = recordFeedback(ctx.shitenDir, {
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

      // Record dimension feedback based on recommendation type
      const recTypeToMetric: Record<string, PerformanceMetric> = {
        capability: "scope_management",
        knowledge: "architectural_vision",
        governance: "decision_making",
        automation: "sustainable_velocity",
      };
      const metric = recTypeToMetric[recId.split("-")[0]] || "decision_making";
      recordDimensionFeedback(ctx.shitenDir, {
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

      // Record path choice in growth profile
      if (pathChoice) {
        recordPathChoice(ctx.shitenDir, {
          pathChosen: pathChoice,
          context: {
            command: "evolve",
            recommendationType: "evolution_recommendation",
            maturityScore: 0,
          },
        });
      }

      if (isJson) {
        outputJson({ feedback: record });
      } else {
        const icon = action === "accepted" ? chalk.green("✔") : chalk.red("✘");
        output(`  ${icon} Recommendation ${recId} ${action}`);
        if (pathChoice) {
          output(`    Path: ${pathChoice === "comfortable" ? chalk.green("Comfortable") : chalk.yellow("Challenging")}`);
        }
        if (reason) output(`    Reason: ${chalk.gray(reason)}`);
        outputBlank();
      }
      return;
    }

    // Generate recommendations
    const spinner = isJson ? null : ora("Analyzing evolution recommendations...").start();

    try {
      const report = analyzeEvolution(ctx.projectRoot, ctx.shitenDir);
      writeEvolutionReport(ctx.shitenDir, report);

      // Load feedback patterns
      const patterns = detectFeedbackPatterns(ctx.shitenDir);
      const summaries = getAllFeedbackSummaries(ctx.shitenDir);
      const totalFeedback = Object.values(summaries).reduce((acc, s) => acc + s.totalInteractions, 0);

      // Publish event
      const bus = getEventBus();
      bus.publish("evolution.recommended", {
        totalRecommendations: report.totalRecommendations,
        byPriority: report.byPriority,
      });

      if (spinner) spinner.succeed(`Found ${report.totalRecommendations} recommendation(s)`);

      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          analyzedAt: report.analyzedAt,
          currentState: report.currentState,
          totalRecommendations: report.totalRecommendations,
          byType: report.byType,
          byPriority: report.byPriority,
          recommendations: report.recommendations,
          dualPaths: report.dualPaths.map((dp) =>
            formatDualPathJson(dp.comfortable, dp.challenging, report.growthProfile)
          ),
          growthProfile: {
            growthCapacity: report.growthProfile.growthCapacity,
            challengeLevel: report.growthProfile.challengeLevel,
            pattern: report.growthProfile.patterns[0]?.type || "balanced",
          },
          topNextSteps: report.topNextSteps,
          summary: report.summary,
          feedback: {
            totalInteractions: totalFeedback,
            patterns: patterns,
          },
        });
        return;
      }

      // Human-readable output
      output(chalk.bold("  Current State:"));
      output(`    Maturity: ${report.currentState.maturityScore}/100`);
      output(`    Knowledge Debt: ${report.currentState.knowledgeDebtScore}/100`);
      output(`    Capabilities: ${report.currentState.installedCapabilities.length} installed`);
      outputBlank();

      // Growth profile
      output(formatGrowthProgress(report.growthProfile));
      outputBlank();

      // Feedback summary
      if (totalFeedback > 0) {
        output(chalk.bold("  Feedback History:"));
        output(`    Total interactions: ${totalFeedback}`);
        for (const p of patterns) {
          output(chalk.gray(`    ⚠ ${p.description}`));
        }
        outputBlank();
      }

      // Dual paths
      output(chalk.bold.cyan("  ╔══════════════════════════════════════════════════╗"));
      output(chalk.bold.cyan("  ║           DUAL PATH — Choose Your Way           ║"));
      output(chalk.bold.cyan("  ╚══════════════════════════════════════════════════╝"));
      outputBlank();

      for (const dualPath of report.dualPaths) {
        output(formatDualPath(dualPath.comfortable, dualPath.challenging, report.growthProfile));
      }

      // Top next steps
      if (report.topNextSteps.length > 0) {
        output(chalk.bold("  Top Next Steps:"));
        for (const step of report.topNextSteps) {
          output(`    → ${step}`);
        }
        outputBlank();
      }

      // Usage hint
      output(chalk.gray("  Usage:"));
      output(chalk.gray("    shiten evolve --accept EVO-001 --comfortable   # Choose comfortable path"));
      output(chalk.gray("    shiten evolve --accept CHL-001 --challenging   # Choose challenging path"));
      output(chalk.gray("    shiten evolve --reject EVO-001 --reason \"Not now\""));
      outputBlank();

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
