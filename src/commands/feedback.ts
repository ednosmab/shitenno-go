/**
 * feedback.ts — Context Pipeline: Feedback CLI Command
 *
 * The `nexus feedback` command. Lets AI agents report session outcomes
 * after completing work, closing the feedback loop.
 *
 * Usage:
 *   nexus feedback --outcome success
 *   nexus feedback --outcome failure --notes "Type error in auth module"
 *   nexus feedback --outcome partial --areas src/auth,src/payments
 *   nexus feedback --json
 *   nexus feedback --summary
 *   nexus feedback --personalized
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { recordOutcome, createFileStorage, getFeedbackRecords, computeFeedbackSummary } from "../session-feedback.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";
import { readCache } from "../briefing-cache.js";
import {
  loadUserProfile,
  generatePersonalizedFeedback,
  formatFeedbackAsMarkdown,
  updateProfileFromSession,
  saveUserProfile,
} from "../feedback-engine.js";

// ── Command ────────────────────────────────────────────────────────────────

export function feedbackCommand(): Command {
  const cmd = new Command("feedback")
    .description("Report session outcome for the Context Pipeline feedback loop")
    .option("-d, --dir <path>", "Project directory")
    .option("--outcome <type>", "Session outcome: success, failure, or partial")
    .option("--areas <list>", "Comma-separated list of modified areas (e.g. src/auth,src/payments)")
    .option("--notes <text>", "Optional notes about the session")
    .option("--duration <minutes>", "Session duration in minutes")
    .option("--session-id <id>", "Link feedback to a session-tracker session")
    .option("--json", "Output as JSON")
    .option("--summary", "Show feedback summary statistics")
    .option("--personalized", "Generate personalized feedback based on user profile")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("feedback", ctx.projectRoot, ctx.nexusDir, isJson)) {
        return;
      }

      // ── Personalized mode ────────────────────────────────────────
      if (options.personalized) {
        const records = getFeedbackRecords(ctx.nexusDir);
        const latestRecord = records.at(-1);

        if (!latestRecord) {
          if (isJson) {
            outputJson({
              error: "no_feedback",
              message: "No feedback records found. Run 'nexus feedback --outcome <type>' first.",
            });
          } else {
            console.log(chalk.red("  ✘ No feedback records found."));
            console.log(chalk.gray("    Run 'nexus feedback --outcome <type>' first."));
          }
          return;
        }

        const profile = loadUserProfile(ctx.nexusDir);
        const feedback = generatePersonalizedFeedback(latestRecord, profile);
        const markdown = formatFeedbackAsMarkdown(feedback);

        if (isJson) {
          outputJson({ type: "personalized_feedback", ...feedback });
        } else {
          console.log("");
          console.log(markdown);
          console.log("");
        }

        // Save to feedback directory
        const { existsSync, mkdirSync } = await import("node:fs");
        const feedbackDir = join(ctx.nexusDir, "docs", "feedback");
        if (!existsSync(feedbackDir)) {
          mkdirSync(feedbackDir, { recursive: true });
        }

        const feedbackPath = join(feedbackDir, `${feedback.date}.md`);
        const { writeFileSync, appendFileSync } = await import("node:fs");

        if (existsSync(feedbackPath)) {
          appendFileSync(feedbackPath, "\n\n" + markdown + "\n", "utf-8");
        } else {
          writeFileSync(feedbackPath, markdown + "\n", "utf-8");
        }

        return;
      }

      // ── Summary mode ─────────────────────────────────────────────
      if (options.summary) {
        const records = getFeedbackRecords(ctx.nexusDir);
        const summary = computeFeedbackSummary(records);

        if (isJson) {
          outputJson({ type: "summary", ...summary });
          return;
        }

        console.log("");
        console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
        console.log(chalk.bold.cyan("  ║   nexus feedback — Session Summary   ║"));
        console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
        console.log("");
        console.log(chalk.bold("  📊 Statistics"));
        console.log(`     Total sessions: ${chalk.cyan(String(summary.totalSessions))}`);
        console.log(`     Success rate:   ${chalk.cyan(`${Math.round(summary.successRate * 100)}%`)}`);
        console.log(`     Success:        ${chalk.green(String(summary.byOutcome.success))}`);
        console.log(`     Failure:        ${chalk.red(String(summary.byOutcome.failure))}`);
        console.log(`     Partial:        ${chalk.yellow(String(summary.byOutcome.partial))}`);

        if (summary.avgSuccessDuration !== null) {
          console.log(`     Avg duration:   ${chalk.cyan(`${summary.avgSuccessDuration}min`)}`);
        }

        if (summary.failureHotspots.length > 0) {
          console.log("");
          console.log(chalk.bold("  🔥 Failure Hotspots"));
          for (const area of summary.failureHotspots) {
            console.log(chalk.red(`     • ${area}`));
          }
        }

        console.log("");
        return;
      }

      // ── Record feedback ──────────────────────────────────────────
      const outcome = options.outcome as string | undefined;

      if (!outcome || !["success", "failure", "partial"].includes(outcome)) {
        if (isJson) {
          outputJson({
            error: "invalid_outcome",
            message: "Provide --outcome with one of: success, failure, partial",
          });
        } else {
          console.log(chalk.red("  ✘ Provide --outcome with one of: success, failure, partial"));
          console.log(chalk.gray("    Example: nexus feedback --outcome success"));
          console.log(chalk.gray("    Example: nexus feedback --outcome failure --notes 'Build broke'"));
        }
        return;
      }

      const modifiedAreas = options.areas
        ? String(options.areas).split(",").map((a: string) => a.trim()).filter(Boolean)
        : undefined;

      const durationMinutes = options.duration
        ? parseInt(String(options.duration), 10)
        : undefined;

      // Read current briefing hash from cache
      const cache = readCache(ctx.nexusDir);
      const briefingHash = cache?.entry?.inputHash ?? "";
      const briefingTimestamp = cache?.entry?.computedAt ?? "";

      const storage = createFileStorage(ctx.nexusDir);
      const record = recordOutcome(storage, {
        outcome: outcome as "success" | "failure" | "partial",
        briefingHash,
        briefingTimestamp,
        modifiedAreas,
        notes: options.notes ? String(options.notes) : undefined,
        durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
        sessionId: options["session-id"] ? String(options["session-id"]) : undefined,
      });

      // Update user profile based on session outcome
      const updatedProfile = updateProfileFromSession(
        ctx.nexusDir,
        record.outcome,
        true, // followedRecommendations (default assumption)
        record.durationMinutes
      );
      saveUserProfile(ctx.nexusDir, updatedProfile);

      if (isJson) {
        outputJson({
          type: "feedback_recorded",
          id: record.id,
          outcome: record.outcome,
          timestamp: record.timestamp,
        });
        return;
      }

      const icon = outcome === "success" ? "✅" : outcome === "failure" ? "❌" : "⚠️";
      const color = outcome === "success" ? chalk.green : outcome === "failure" ? chalk.red : chalk.yellow;

      console.log("");
      console.log(`${icon} ${color(`Session outcome: ${outcome}`)}`);
      if (modifiedAreas && modifiedAreas.length > 0) {
        console.log(chalk.gray(`   Areas: ${modifiedAreas.join(", ")}`));
      }
      if (options.notes) {
        console.log(chalk.gray(`   Notes: ${options.notes}`));
      }
      console.log(chalk.gray(`   Recorded: ${record.id}`));
      console.log("");

      // ── Event ────────────────────────────────────────────────────
      getEventBus().publish("analysis.complete", {
        type: "session_feedback",
        outcome,
        areas: modifiedAreas,
      });
    });

  return cmd;
}
