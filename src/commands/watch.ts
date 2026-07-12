/**
 * watch.ts — Real-Time System Log / Event Watcher
 *
 * Keeps the process alive and logs ALL events from the event bus.
 * Serves as a live system log for governance artifact changes.
 *
 * PRINCIPLE: When the channel is open, everything is visible.
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized } from "../shared.js";
import { startWatching } from "../file-watcher.js";
import { getEventBus, type NexusEventType } from "../event-bus.js";
import { initPlanBacklogSync } from "../plan-backlog-sync.js";

// ── Event Formatting ────────────────────────────────────────────────────────

const ALL_EVENTS: NexusEventType[] = [
  "session.start",
  "session.end",
  "analysis.complete",
  "command.completed",
  "score.calculated",
  "pattern.detected",
  "health.checked",
  "debt.detected",
  "capability.installed",
  "capability.unlocked",
  "maturity.changed",
  "rule.triggered",
  "evolution.recommended",
  "adr.created",
  "skill.created",
  "validation.completed",
  "task.completed",
  "pipeline.stage.start",
  "pipeline.stage.complete",
  "pipeline.started",
  "pipeline.complete",
  "lifecycle.state_changed",
  "knowledge.analyzed",
  "engineering_state.updated",
  "engineering_state.consolidated",
  "knowledge_debt.detected",
  "recommendation.accepted",
  "recommendation.rejected",
  "governance.policy_applied",
  "asset.created",
  "asset.updated",
  "asset.archived",
  "entropy.calculated",
  "docs.sync.triggered",
  "doc.lifecycle.audited",
  "plan.archived",
  "plan.created",
  "plan.file_changed",
  "plan.status_changed",
  "plan.format_warning",
  "backlog.updated",
  "system.updated",
  "challenge.generated",
  "state.mutated",
];

/** Color mapping for event categories. */
function colorize(eventType: NexusEventType): (s: string) => string {
  if (eventType.startsWith("plan.")) return chalk.cyan;
  if (eventType.startsWith("pipeline.")) return chalk.magenta;
  if (eventType.startsWith("session.")) return chalk.yellow;
  if (eventType.startsWith("asset.")) return chalk.green;
  if (eventType.startsWith("docs.")) return chalk.blue;
  if (eventType.startsWith("engineering_state.")) return chalk.gray;
  if (eventType.startsWith("knowledge")) return chalk.gray;
  if (eventType.startsWith("capability.")) return chalk.yellow;
  if (eventType.startsWith("recommendation.")) return chalk.blue;
  if (eventType === "backlog.updated") return chalk.red;
  if (eventType === "plan.format_warning") return chalk.yellow;
  if (eventType === "rule.triggered") return chalk.magenta;
  return chalk.white;
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function extractLabel(payload: Record<string, unknown>): string {
  const p = payload as Record<string, string>;
  return (
    p.planId ||
    p.adrId ||
    p.skillName ||
    p.ruleId ||
    p.command ||
    p.path ||
    p.relativePath ||
    p.dimension ||
    p.sessionId ||
    p.capabilityId ||
    p.recommendationId ||
    p.policyName ||
    p.source ||
    p.assetId ||
    ""
  );
}

// ── Command ────────────────────────────────────────────────────────────────

export function watchCommand(): Command {
  return new Command("watch")
    .description("Watch governance artifacts — live system log")
    .option("-d, --dir <path>", "Project root directory")
    .option("--events <types>", "Comma-separated event types to watch (default: all)")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      // Banner
      console.log("");
      console.log(chalk.bold.cyan("  🔭 Nexus Watcher — Live System Log"));
      console.log(chalk.gray(`  Watching: ${ctx.nexusDir}`));
      console.log(chalk.gray("  Press Ctrl+C to stop."));
      console.log("");

      // Init plan-backlog sync subscribers BEFORE starting watcher (prevents race condition)
      initPlanBacklogSync(ctx.projectRoot, ctx.nexusDir);

      // Start file watcher
      const stopWatcher = startWatching(ctx.nexusDir);

      // Subscribe to ALL events
      const bus = getEventBus();
      let eventCount = 0;

      // Filter events if --events flag provided
      const filterTypes = opts.events
        ? (opts.events as string).split(",").map((s) => s.trim()) as NexusEventType[]
        : null;

      const subscribeTo = filterTypes ?? ALL_EVENTS;

      for (const eventType of subscribeTo) {
        bus.subscribe(eventType, (payload: Record<string, unknown>) => {
          eventCount++;
          const color = colorize(eventType);
          const ts = timestamp();
          const label = extractLabel(payload);
          const padded = eventType.padEnd(28);
          console.log(`  ${chalk.gray(ts)} ${color(padded)} ${chalk.bold(label)}`);
        });
      }

      // Status line every 30 seconds
      const statusInterval = setInterval(() => {
        const ts = timestamp();
        console.log(
          chalk.gray(`  ${ts} — watcher alive — ${eventCount} events logged`)
        );
      }, 30_000);

      // Keep alive until SIGINT
      await new Promise<void>((resolve) => {
        process.on("SIGINT", () => {
          clearInterval(statusInterval);
          stopWatcher();
          bus.removeAllListeners();
          console.log(chalk.yellow(`\n  — ${eventCount} events logged. Stopped. Bye.`));
          resolve();
        });
        process.on("SIGTERM", () => {
          clearInterval(statusInterval);
          stopWatcher();
          bus.removeAllListeners();
          resolve();
        });
      });
    });
}
