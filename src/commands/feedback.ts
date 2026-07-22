/**
 * feedback.ts — Context Pipeline: Feedback CLI Command
 *
 * The `shugo feedback` command. Lets AI agents report session outcomes
 * after completing work, closing the feedback loop.
 *
 * Usage:
 *   shugo feedback --outcome success
 *   shugo feedback --outcome failure --notes "Type error in auth module"
 *   shugo feedback --outcome partial --areas src/auth,src/payments
 *   shugo feedback --outcome success --user-rating 4 --user-comment "Great session"
 *   shugo feedback --json
 *   shugo feedback --summary
 *   shugo feedback --personalized
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { resolveWithinRoot } from "../path-safety.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { recordOutcome, createFileStorage, getFeedbackRecords, computeFeedbackSummary, type SessionOutcome } from "../session-feedback.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { trackFeedback } from "../session-tracker.js";
import { getSessionId } from "../session-context.js";
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
import { parseUserRating, parseUserTags } from "../feedback-utils.js";
import { output, outputBlank, outputSection, outputError, outputWarning } from "../output.js";

type Options = Record<string, unknown>;

type Ctx = {
  projectRoot: string;
  shitennoDir: string;
};

async function handlePersonalizedMode(ctx: Ctx, isJson: boolean): Promise<void> {
  const records = getFeedbackRecords(ctx.shitennoDir);
  const latestRecord = records.at(-1);

  if (!latestRecord) {
    if (isJson) {
      outputJson({
        error: "no_feedback",
        message: "No feedback records found. Run 'shugo feedback --outcome <type>' first.",
      });
    } else {
      outputError("No feedback records found.");
      output(chalk.gray("    Run 'shugo feedback --outcome <type>' first."));
    }
    return;
  }

  const profile = loadUserProfile(ctx.shitennoDir);
  const feedback = generatePersonalizedFeedback(latestRecord, profile);
  const markdown = formatFeedbackAsMarkdown(feedback);

  if (isJson) {
    outputJson({ type: "personalized_feedback", ...feedback });
  } else {
    output("");
    output(markdown);
    outputBlank();
  }

  const { existsSync, mkdirSync } = await import("node:fs");
  const feedbackDir = join(ctx.shitennoDir, "docs", "feedback");
  if (!existsSync(feedbackDir)) {
    mkdirSync(feedbackDir, { recursive: true });
  }

  let feedbackPath: string;
  try {
    feedbackPath = resolveWithinRoot(feedbackDir, `${feedback.date}.md`);
  } catch {
    feedbackPath = join(feedbackDir, `${feedback.date}.md`);
  }
  const { writeFileSync, appendFileSync } = await import("node:fs");

  if (existsSync(feedbackPath)) {
    appendFileSync(feedbackPath, "\n\n" + markdown + "\n", "utf-8");
  } else {
    writeFileSync(feedbackPath, markdown + "\n", "utf-8");
  }
}

function handleListMode(ctx: Ctx, isJson: boolean): void {
  const records = getFeedbackRecords(ctx.shitennoDir);

  if (records.length === 0) {
    if (isJson) {
      outputJson({ type: "feedback_list", records: [] });
    } else {
      outputWarning("No feedback records found.");
      output(chalk.gray("  Run 'shugo feedback --outcome <type>' to record feedback."));
    }
    return;
  }

  if (isJson) {
    outputJson({ type: "feedback_list", records });
    return;
  }

  output("");
  outputSection("shugo feedback — Session History");
  outputBlank();

  for (const record of records.slice(-20)) {
    const icon = record.outcome === "success" ? "✅" : record.outcome === "failure" ? "❌" : "⚠️";
    const color = record.outcome === "success" ? chalk.green : record.outcome === "failure" ? chalk.red : chalk.yellow;
    const date = new Date(record.timestamp).toLocaleDateString();
    const time = new Date(record.timestamp).toLocaleTimeString();

    output(`  ${icon} ${color(record.outcome.padEnd(8))} ${chalk.gray(`${date} ${time}`)}`);
    if (record.notes) output(chalk.gray(`     Notes: ${record.notes}`));
    if (record.modifiedAreas?.length) output(chalk.gray(`     Areas: ${record.modifiedAreas.join(", ")}`));
    if (record.userRating) output(chalk.gray(`     Rating: ${record.userRating}/5`));
  }

  outputBlank();
  output(chalk.gray(`  Showing last ${Math.min(records.length, 20)} of ${records.length} records`));
  outputBlank();
}

function handleSummaryMode(ctx: Ctx, isJson: boolean): void {
  const records = getFeedbackRecords(ctx.shitennoDir);
  const summary = computeFeedbackSummary(records);

  if (isJson) {
    outputJson({ type: "summary", ...summary });
    return;
  }

  output("");
  outputSection("shugo feedback — Session Summary");
  outputBlank();
  outputSection("Statistics");
  output(`     Total sessions: ${chalk.cyan(String(summary.totalSessions))}`);
  output(`     Success rate:   ${chalk.cyan(`${Math.round(summary.successRate * 100)}%`)}`);
  output(`     Success:        ${chalk.green(String(summary.byOutcome.success))}`);
  output(`     Failure:        ${chalk.red(String(summary.byOutcome.failure))}`);
  output(`     Partial:        ${chalk.yellow(String(summary.byOutcome.partial))}`);

  if (summary.avgSuccessDuration !== null) {
    output(`     Avg duration:   ${chalk.cyan(`${summary.avgSuccessDuration}min`)}`);
  }

  if (summary.avgUserRating !== null) {
    output(`     Avg rating:     ${chalk.cyan(`${summary.avgUserRating}/5`)} (${summary.ratedSessions} rated)`);
  }

  if (summary.failureHotspots.length > 0) {
    outputBlank();
    outputSection("Failure Hotspots");
    for (const area of summary.failureHotspots) {
      output(chalk.red(`     • ${area}`));
    }
  }

  outputBlank();
}

function validateOutcome(outcome: string | undefined, isJson: boolean): boolean {
  if (outcome && ["success", "failure", "partial", "session-start", "session-end"].includes(outcome)) {
    return true;
  }
  if (isJson) {
    outputJson({
      error: "invalid_outcome",
      message: "Provide --outcome with one of: success, failure, partial, session-start, session-end",
    });
  } else {
    outputError("Provide --outcome with one of: success, failure, partial, session-start, session-end");
    output(chalk.gray("    Example: shugo feedback --outcome success"));
    output(chalk.gray("    Example: shugo feedback --outcome failure --notes 'Build broke'"));
  }
  return false;
}

function showFailureHotspots(shitennoDir: string): void {
  try {
    const records = getFeedbackRecords(shitennoDir);
    if (records.length <= 1) return;
    const summary = computeFeedbackSummary(records);
    if (summary.failureHotspots.length === 0) return;
    outputBlank();
    outputSection("Failure hotspots from past sessions:");
    for (const area of summary.failureHotspots.slice(0, 5)) {
      output(chalk.red(`     • ${area}`));
    }
    output(chalk.gray("     Tip: use --areas to specify which areas were affected."));
  } catch {
    // Non-blocking: ignore if feedback data unavailable
  }
}

function outputRecordedFeedback(
  outcome: string,
  shitennoDir: string,
  data: { recordId: string; notes?: unknown; modifiedAreas?: string[]; userRating?: number; userComment?: string; userTags?: string[] }
): void {
  const icon = outcome === "success" ? "✅" : outcome === "failure" ? "❌" : "⚠️";
  const color = outcome === "success" ? chalk.green : outcome === "failure" ? chalk.red : chalk.yellow;

  output("");
  output(`${icon} ${color(`Session outcome: ${outcome}`)}`);
  if (data.userRating) output(chalk.gray(`   Rating: ${data.userRating}/5`));
  if (data.userComment) output(chalk.gray(`   Comment: ${data.userComment}`));
  if (data.userTags && data.userTags.length > 0) output(chalk.gray(`   Tags: ${data.userTags.join(", ")}`));
  if (data.modifiedAreas && data.modifiedAreas.length > 0) output(chalk.gray(`   Areas: ${data.modifiedAreas.join(", ")}`));
  if (data.notes) output(chalk.gray(`   Notes: ${data.notes}`));
  output(chalk.gray(`   Recorded: ${data.recordId}`));

  if (outcome === "failure" && (!data.modifiedAreas || data.modifiedAreas.length === 0)) {
    showFailureHotspots(shitennoDir);
  }
  outputBlank();
}

function parseOptions(options: Options) {
  const modifiedAreas = options.areas
    ? String(options.areas).split(",").map((a: string) => a.trim()).filter(Boolean)
    : undefined;

  const durationMinutes = options.duration ? parseInt(String(options.duration), 10) : undefined;

  return {
    modifiedAreas,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
    userTags: parseUserTags(options["user-tags"] as string | undefined),
    userRating: parseUserRating(options["user-rating"] as string | undefined),
    userComment: options["user-comment"] ? String(options["user-comment"]) : undefined,
    sessionId: options["session-id"] ? String(options["session-id"]) : undefined,
    notes: options.notes ? String(options.notes) : undefined,
    briefingProfile: options.profile ? String(options.profile) : undefined,
  };
}

function recordFeedback(ctx: Ctx, options: Options, isJson: boolean): void {
  const outcome = options.outcome as string | undefined;
  if (!validateOutcome(outcome, isJson)) return;

  const { modifiedAreas, durationMinutes, userTags, userRating, userComment, sessionId, notes, briefingProfile } = parseOptions(options);

  const cache = readCache(ctx.shitennoDir);
  const storage = createFileStorage(ctx.shitennoDir);
  const record = recordOutcome(storage, {
    outcome: outcome as SessionOutcome,
    briefingHash: cache?.entry?.inputHash ?? "",
    briefingTimestamp: cache?.entry?.computedAt ?? "",
    modifiedAreas,
    notes,
    durationMinutes,
    sessionId,
    userRating: userRating as 1 | 2 | 3 | 4 | 5 | undefined,
    userComment,
    userTags,
    briefingProfile,
  });

  const updatedProfile = updateProfileFromSession(ctx.shitennoDir, record.outcome, true, record.durationMinutes);
  saveUserProfile(ctx.shitennoDir, updatedProfile);

  if (isJson) {
    outputJson({ type: "feedback_recorded", id: record.id, outcome: record.outcome, timestamp: record.timestamp });
    return;
  }

  outputRecordedFeedback(outcome!, ctx.shitennoDir, {
    recordId: record.id,
    notes,
    modifiedAreas,
    userRating: userRating as number | undefined,
    userComment,
    userTags,
  });

  const finalSessionId = sessionId || getSessionId();
  if (finalSessionId) {
    trackFeedback(ctx.shitennoDir, finalSessionId, outcome as "accepted" | "rejected" | "deferred");
  }

  const eventType = outcome === "success" ? "recommendation.accepted" : "recommendation.rejected";
  getEventBus().publish(eventType, { type: "session_feedback", outcome, areas: modifiedAreas, sessionId: finalSessionId });
}

// ── Command ────────────────────────────────────────────────────────────────

export function feedbackCommand(): Command {
  const cmd = new Command("feedback")
    .description("Report session outcome for the Context Pipeline feedback loop")
    .option("-d, --dir <path>", "Project directory")
    .option("--outcome <type>", "Session outcome: success, failure, partial, session-start, session-end")
    .option("--areas <list>", "Comma-separated list of modified areas (e.g. src/auth,src/payments)")
    .option("--notes <text>", "Optional notes about the session")
    .option("--duration <minutes>", "Session duration in minutes")
    .option("--session-id <id>", "Link feedback to a session-tracker session")
    .option("--user-rating <1-5>", "User rating for the session (1-5)")
    .option("--user-comment <text>", "User comment about the session")
    .option("--user-tags <list>", "Comma-separated user tags for categorization")
    .option("--profile <depth>", "Briefing depth profile used (minimal/standard/full)")
    .option("--json", "Output as JSON")
    .option("--summary", "Show feedback summary statistics")
    .option("--list", "List all feedback records")
    .option("--personalized", "Generate personalized feedback based on user profile")
    .action(async function (this: Command, options: Options) {
      const isJson = options.json === true;
      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      void printDaemonBanner(ctx.shitennoDir, isJson);
      if (!checkLifecycleGate("feedback", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

      if (options.personalized) await handlePersonalizedMode(ctx, isJson);
      else if (options.list) handleListMode(ctx, isJson);
      else if (options.summary) handleSummaryMode(ctx, isJson);
      else recordFeedback(ctx, options, isJson);
    });

  return cmd;
}
