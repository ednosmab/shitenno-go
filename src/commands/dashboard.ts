/**
 * dashboard.ts — Context Pipeline: Token Economy Dashboard
 *
 * Visualizes token economy metrics over time:
 * - Total tokens saved
 * - Cache hit rate
 * - Success/failure trends
 * - Monthly projections
 *
 * Usage:
 *   nexus dashboard                # Full dashboard
 *   nexus dashboard --json         # JSON output
 *   nexus dashboard --period <d>   # Period in days (default: 30)
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getFeedbackRecords, computeFeedbackSummary } from "../session-feedback.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";

// ── Display Helpers ────────────────────────────────────────────────────────

function healthBar(value: number, max: number, width = 20): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  const color = value >= max * 0.7 ? chalk.green : value >= max * 0.4 ? chalk.yellow : chalk.red;
  return color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

// ── Dashboard Display ──────────────────────────────────────────────────────

function displayDashboard(
  summary: ReturnType<typeof computeFeedbackSummary>,
  periodDays: number
): void {
  console.log("");
  console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("  ║  nexus dashboard — Token Economy     ║"));
  console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  console.log("");

  // ── Session Overview ────────────────────────────────────────────
  console.log(chalk.bold("  📊 Session Overview (last " + periodDays + " days)"));
  console.log(`     Total sessions: ${chalk.cyan(String(summary.totalSessions))}`);
  console.log(`     Success rate:   ${chalk.cyan(Math.round(summary.successRate * 100) + "%")}`);
  console.log(`     ${chalk.green("✓ Success:")} ${summary.byOutcome.success}  ${chalk.red("✗ Failure:")} ${summary.byOutcome.failure}  ${chalk.yellow("⚠ Partial:")} ${summary.byOutcome.partial}`);
  console.log("");

  // ── Token Economy ──────────────────────────────────────────────
  console.log(chalk.bold("  💰 Token Economy"));
  console.log(`     Total saved:    ${chalk.green("~" + summary.tokenEconomy.totalTokensSaved.toLocaleString() + " tokens")}`);
  console.log(`     Avg per session: ${chalk.green("~" + summary.tokenEconomy.avgTokensSaved.toLocaleString() + " tokens")}`);
  console.log(`     Cache hits:     ${chalk.cyan(String(summary.tokenEconomy.cacheHits))} / ${summary.totalSessions}`);
  console.log(`     Cache hit rate: ${healthBar(summary.tokenEconomy.cacheHitRate * 100, 100)} ${Math.round(summary.tokenEconomy.cacheHitRate * 100)}%`);
  console.log("");

  // ── Monthly Projection ─────────────────────────────────────────
  console.log(chalk.bold("  📈 Monthly Projection (10 sessions)"));
  console.log(`     Tokens saved:   ${chalk.green("~" + summary.tokenEconomy.monthlyProjection.toLocaleString())}`);
  const monthlyCost = (summary.tokenEconomy.monthlyProjection / 1_000_000) * 5;
  console.log(`     Cost saved:     ${chalk.green("~$" + monthlyCost.toFixed(2) + "/month")}`);
  console.log("");

  // ── Failure Hotspots ───────────────────────────────────────────
  if (summary.failureHotspots.length > 0) {
    console.log(chalk.bold("  🔥 Failure Hotspots"));
    for (const area of summary.failureHotspots) {
      console.log(chalk.red(`     • ${area}`));
    }
    console.log("");
  }

  // ── Duration ───────────────────────────────────────────────────
  if (summary.avgSuccessDuration !== null) {
    console.log(chalk.bold("  ⏱ Session Duration"));
    console.log(`     Avg (success):  ${chalk.cyan(summary.avgSuccessDuration + " min")}`);
    console.log("");
  }

  // ── Health Score ───────────────────────────────────────────────
  const healthScore = Math.round(
    (summary.successRate * 40) +
    (summary.tokenEconomy.cacheHitRate * 30) +
    (summary.totalSessions > 0 ? 30 : 0)
  );
  console.log(chalk.bold("  🏥 Health Score"));
  console.log(`     Score: ${healthBar(healthScore, 100)} ${healthScore}/100`);
  console.log("");

  // ── Recommendations ────────────────────────────────────────────
  console.log(chalk.bold("  💡 Recommendations"));
  if (summary.tokenEconomy.cacheHitRate < 0.5) {
    console.log(chalk.cyan("     → Use `nexus briefing` more often to improve cache hit rate"));
  }
  if (summary.byOutcome.failure > summary.byOutcome.success) {
    console.log(chalk.cyan("     → Review failure hotspots and add test coverage"));
  }
  if (summary.totalSessions < 5) {
    console.log(chalk.cyan("     → More sessions = more data = better recommendations"));
  }
  if (summary.tokenEconomy.cacheHitRate >= 0.8 && summary.successRate >= 0.8) {
    console.log(chalk.green("     ✓ Excellent! Token economy is optimized"));
  }
  console.log("");
}

// ── Command ────────────────────────────────────────────────────────────────

export function dashboardCommand(): Command {
  const cmd = new Command("dashboard")
    .description("Token economy dashboard with session metrics")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--period <days>", "Period in days", "30")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;
      const periodDays = parseInt(String(options.period || "30"), 10);

      if (!isJson) {
        console.log("");
        console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
        console.log(chalk.bold.cyan("  ║  nexus dashboard — Token Economy     ║"));
        console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
        console.log("");
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("dashboard", ctx.projectRoot, ctx.nexusDir, isJson)) {
        return;
      }

      const records = getFeedbackRecords(ctx.nexusDir);
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
      const filteredRecords = records.filter((r) => r.timestamp >= since);
      const summary = computeFeedbackSummary(filteredRecords);

      if (isJson) {
        outputJson({
          periodDays,
          totalRecords: records.length,
          filteredRecords: filteredRecords.length,
          ...summary,
        });
        return;
      }

      displayDashboard(summary, periodDays);

      getEventBus().publish("analysis.complete", {
        type: "dashboard",
        sessions: summary.totalSessions,
        tokensSaved: summary.tokenEconomy.totalTokensSaved,
        cacheHitRate: summary.tokenEconomy.cacheHitRate,
      });
    });

  return cmd;
}
