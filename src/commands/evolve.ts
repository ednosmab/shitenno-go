/**
 * evolve.ts — Evolution Recommendations Command
 *
 * Shows evolution recommendations and allows accept/feedback.
 * Integrates with auto-evolution, feedback-loops, and event bus.
 *
 * PRINCIPLE: The system recommends, the human decides.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { analyzeEvolution, writeEvolutionReport, type EvolutionRecommendation } from "../auto-evolution.js";
import { recordFeedback, detectFeedbackPatterns, getAllFeedbackSummaries } from "../feedback-loops.js";
import { getEventBus } from "../event-bus.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, typeof chalk.green> = {
  urgent: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray,
};

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔴",
  high: "🟡",
  medium: "🔵",
  low: "⚪",
};

function formatConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return chalk.green(`${pct}%`);
  if (pct >= 50) return chalk.yellow(`${pct}%`);
  return chalk.red(`${pct}%`);
}

function formatRecommendation(rec: EvolutionRecommendation, index: number): string {
  const color = PRIORITY_COLORS[rec.priority] || chalk.gray;
  const icon = PRIORITY_ICONS[rec.priority] || "⚪";
  const lines: string[] = [];

  lines.push(`  ${icon} ${chalk.bold(`[${rec.id}]`)} ${color(rec.priority.toUpperCase())} — ${chalk.bold(rec.title)}`);
  lines.push(`     ${chalk.gray(rec.description)}`);
  lines.push(`     Impact: ${chalk.cyan(rec.expectedImpact)}`);
  lines.push(`     Confidence: ${formatConfidence(rec.confidence)}`);

  if (rec.command) {
    lines.push(`     Command: ${chalk.white(rec.command)}`);
  }

  if (rec.evidence.length > 0) {
    lines.push(`     Evidence: ${chalk.gray(rec.evidence[0])}`);
  }

  return lines.join("\n");
}

// ── Command ──────────────────────────────────────────────────────────────────

export const evolveCommand = new Command("evolve")
  .description("Show evolution recommendations and manage feedback")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .option("--accept <id>", "Accept a recommendation (record feedback)")
  .option("--reject <id>", "Reject a recommendation (record feedback)")
  .option("--reason <text>", "Reason for accept/reject")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║    nexus evolve — Recommendations    ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    // Handle accept/reject feedback
    if (options.accept || options.reject) {
      const recId = options.accept || options.reject;
      const action = options.accept ? "accepted" : "rejected";
      const reason = options.reason || undefined;

      const record = recordFeedback(ctx.nexusDir, {
        recommendationId: recId,
        action,
        reason,
        context: {
          maturityScore: 0,
          installedCapabilities: [],
          knowledgeDebt: 0,
        },
      });

      if (isJson) {
        outputJson({ feedback: record });
      } else {
        const icon = action === "accepted" ? chalk.green("✔") : chalk.red("✘");
        console.log(`  ${icon} Recommendation ${recId} ${action}`);
        if (reason) console.log(`    Reason: ${chalk.gray(reason)}`);
        console.log("");
      }
      return;
    }

    // Generate recommendations
    const spinner = isJson ? null : ora("Analyzing evolution recommendations...").start();

    try {
      const report = analyzeEvolution(ctx.projectRoot, ctx.nexusDir);
      writeEvolutionReport(ctx.nexusDir, report);

      // Load feedback patterns
      const patterns = detectFeedbackPatterns(ctx.nexusDir);
      const summaries = getAllFeedbackSummaries(ctx.nexusDir);
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
      console.log(chalk.bold("  Current State:"));
      console.log(`    Maturity: ${report.currentState.maturityScore}/100`);
      console.log(`    Knowledge Debt: ${report.currentState.knowledgeDebtScore}/100`);
      console.log(`    Capabilities: ${report.currentState.installedCapabilities.length} installed`);
      console.log("");

      // Feedback summary
      if (totalFeedback > 0) {
        console.log(chalk.bold("  Feedback History:"));
        console.log(`    Total interactions: ${totalFeedback}`);
        for (const p of patterns) {
          console.log(chalk.gray(`    ⚠ ${p.description}`));
        }
        console.log("");
      }

      // Recommendations by priority
      const grouped: Record<string, EvolutionRecommendation[]> = {};
      for (const rec of report.recommendations) {
        if (!grouped[rec.priority]) grouped[rec.priority] = [];
        grouped[rec.priority].push(rec);
      }

      console.log(chalk.bold("  Recommendations:"));
      console.log("");

      let index = 1;
      for (const priority of ["urgent", "high", "medium", "low"]) {
        const recs = grouped[priority];
        if (!recs || recs.length === 0) continue;

        const color = PRIORITY_COLORS[priority] || chalk.gray;
        console.log(chalk.bold(`  ${color(priority.toUpperCase())} (${recs.length}):`));
        console.log("");

        for (const rec of recs) {
          console.log(formatRecommendation(rec, index));
          console.log("");
          index++;
        }
      }

      // Top next steps
      if (report.topNextSteps.length > 0) {
        console.log(chalk.bold("  Top Next Steps:"));
        for (const step of report.topNextSteps) {
          console.log(`    → ${step}`);
        }
        console.log("");
      }

      // Usage hint
      console.log(chalk.gray("  Usage:"));
      console.log(chalk.gray("    nexus evolve --accept EVO-001    # Accept a recommendation"));
      console.log(chalk.gray("    nexus evolve --reject EVO-001 --reason \"Not now\""));
      console.log("");

    } catch (error) {
      if (spinner) spinner.fail("Evolution analysis failed");
      if (isJson) {
        outputJson({ error: "evolution_failed", message: String(error) });
      } else {
        console.error(chalk.red(`  Error: ${error}`));
      }
      console.log("");
    }
  });
