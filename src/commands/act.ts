/**
 * act.ts — Action Engine CLI Command
 *
 * The `nexus act` command. Execute actions with idempotency guarantees.
 *
 * Usage:
 *   nexus act log-event --event "session.start" --message "Session started"
 *   nexus act notify --message "Build complete" --level info
 *   nexus act reminder --message "Run audit" --priority high
 *   nexus act script --script "nexus audit"
 *   nexus act --list
 *   nexus act --show EXE-abc123
 *   nexus act --stats
 *   nexus act --rollback EXE-abc123
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import {
  ActionEngine,
  FileExecutionRepository,
  type ActionStatus,
  type ActionResult,
} from "../action-engine.js";
import { outputJson } from "../formatting.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): ActionEngine {
  const nexusDir = join(dir, "nexus-system");
  return new ActionEngine(new FileExecutionRepository(nexusDir));
}

const STATUS_COLORS: Record<ActionStatus, (s: string) => string> = {
  pending: (s) => chalk.gray(s),
  running: (s) => chalk.cyan(s),
  completed: (s) => chalk.green(s),
  failed: (s) => chalk.red(s),
  rolled_back: (s) => chalk.yellow(s),
};

const RESULT_COLORS: Record<ActionResult, (s: string) => string> = {
  success: (s) => chalk.green(s),
  failure: (s) => chalk.red(s),
  skipped: (s) => chalk.gray(s),
  rolled_back: (s) => chalk.yellow(s),
};

function formatExecution(r: { executionId: string; request: { type: string; id: string }; status: ActionStatus; result?: ActionResult; duration?: number }): string {
  const status = STATUS_COLORS[r.status](r.status.padEnd(12));
  const result = r.result ? RESULT_COLORS[r.result](r.result.padEnd(10)) : "".padEnd(10);
  const duration = r.duration ? `${r.duration}ms` : "-";
  return `  ${chalk.bold(r.executionId)}  ${status}  ${result}  ${r.request.type.padEnd(16)}  ${duration}`;
}

// ── Command ────────────────────────────────────────────────────────────────

export function actCommand(): Command {
  const cmd = new Command("act")
    .description("Execute actions with idempotency guarantees")
    .option("-d, --dir <path>", "Project directory");

  // ── log-event ───────────────────────────────────────────────────────────
  cmd
    .command("log-event")
    .description("Log an event")
    .option("--event <name>", "Event name", "unknown")
    .option("--message <text>", "Event message", "")
    .option("--action-id <id>", "Custom action ID (for idempotency)")
    .option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({
        id: (opts["action-id"] as string) ?? `act-log-${Date.now().toString(36)}`,
        type: "log_event",
        params: { event: opts.event, message: opts.message },
        correlationId: opts["correlation-id"] as string,
      });

      if (isJson) {
        outputJson(record as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Action executed: ${record.executionId}`));
        console.log(`    ${formatExecution(record)}`);
      }
    });

  // ── notify ──────────────────────────────────────────────────────────────
  cmd
    .command("notify")
    .description("Send a notification")
    .option("--message <text>", "Notification message")
    .option("--level <level>", "Notification level", "info")
    .option("--action-id <id>", "Custom action ID")
    .option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({
        id: (opts["action-id"] as string) ?? `act-notify-${Date.now().toString(36)}`,
        type: "notify",
        params: { message: opts.message, level: opts.level },
        correlationId: opts["correlation-id"] as string,
      });

      if (isJson) {
        outputJson(record as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Notification sent: ${record.executionId}`));
      }
    });

  // ── reminder ────────────────────────────────────────────────────────────
  cmd
    .command("reminder")
    .description("Create a reminder")
    .option("--message <text>", "Reminder message")
    .option("--priority <level>", "Priority level", "medium")
    .option("--action-id <id>", "Custom action ID")
    .option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({
        id: (opts["action-id"] as string) ?? `act-remind-${Date.now().toString(36)}`,
        type: "create_reminder",
        params: { message: opts.message, priority: opts.priority },
        correlationId: opts["correlation-id"] as string,
      });

      if (isJson) {
        outputJson(record as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Reminder created: ${record.executionId}`));
      }
    });

  // ── script ──────────────────────────────────────────────────────────────
  cmd
    .command("script")
    .description("Run a whitelisted script")
    .option("--script <name>", "Script name (e.g., 'nexus audit')")
    .option("--action-id <id>", "Custom action ID")
    .option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({
        id: (opts["action-id"] as string) ?? `act-script-${Date.now().toString(36)}`,
        type: "run_script",
        params: { script: opts.script },
        correlationId: opts["correlation-id"] as string,
      });

      if (isJson) {
        outputJson(record as unknown as Record<string, unknown>);
      } else {
        const icon = record.status === "completed" ? chalk.green("✓") : chalk.red("✗");
        console.log(`${icon} Script executed: ${record.executionId}`);
      }
    });

  // ── list ────────────────────────────────────────────────────────────────
  cmd
    .command("list")
    .description("List action executions")
    .option("--status <status>", "Filter by status")
    .option("--type <type>", "Filter by action type")
    .option("--correlation-id <id>", "Filter by correlation ID")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const records = engine.list({
        status: opts.status as ActionStatus,
        type: opts.type as string,
        correlationId: opts["correlation-id"] as string,
      });

      if (isJson) {
        outputJson(records as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      if (records.length === 0) {
        console.log(chalk.dim("  No executions found."));
      } else {
        console.log(chalk.bold(`  Executions (${records.length})`));
        console.log(chalk.dim("  " + "─".repeat(70)));
        for (const r of records) {
          console.log(formatExecution(r));
        }
      }
      console.log("");
    });

  // ── show ────────────────────────────────────────────────────────────────
  cmd
    .command("show")
    .description("Show execution details")
    .argument("<id>", "Execution ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const record = engine.get(id);

      if (!record) {
        if (isJson) {
          outputJson({ error: "Execution not found" });
        } else {
          console.log(chalk.red(`  Execution not found: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(record as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold(`  ${record.executionId}`));
      console.log(`  Action:     ${record.request.type}`);
      console.log(`  Action ID:  ${record.request.id}`);
      console.log(`  Status:     ${STATUS_COLORS[record.status](record.status)}`);
      if (record.result) console.log(`  Result:     ${RESULT_COLORS[record.result](record.result)}`);
      console.log(`  Hash:       ${record.executionHash}`);
      console.log(`  Started:    ${record.startedAt}`);
      if (record.completedAt) console.log(`  Completed:  ${record.completedAt}`);
      if (record.duration) console.log(`  Duration:   ${record.duration}ms`);
      if (record.error) console.log(`  Error:      ${chalk.red(record.error)}`);
      if (record.output) console.log(`  Output:     ${JSON.stringify(record.output)}`);
      if (record.request.correlationId) console.log(`  Correlation: ${record.request.correlationId}`);
      if (record.rollback) {
        console.log(chalk.bold("  Rollback:"));
        console.log(`    ID:       ${record.rollback.rollbackId}`);
        console.log(`    Status:   ${record.rollback.status}`);
        if (record.rollback.error) console.log(`    Error:    ${record.rollback.error}`);
      }
      console.log("");
    });

  // ── rollback ────────────────────────────────────────────────────────────
  cmd
    .command("rollback")
    .description("Rollback a completed action")
    .argument("<id>", "Execution ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const record = await engine.rollback(id);

      if (!record) {
        if (isJson) {
          outputJson({ error: "Execution not found or not rollbackable" });
        } else {
          console.log(chalk.red(`  Cannot rollback: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(record as unknown as Record<string, unknown>);
      } else {
        if (record.rollback?.status === "completed") {
          console.log(chalk.green(`  ✓ Action rolled back: ${record.executionId}`));
        } else {
          console.log(chalk.red(`  ✗ Rollback failed: ${record.rollback?.error}`));
        }
      }
    });

  // ── stats ───────────────────────────────────────────────────────────────
  cmd
    .command("stats")
    .description("Show execution statistics")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const stats = engine.stats();

      if (isJson) {
        outputJson(stats as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold("  Execution Statistics"));
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log(`  Total:       ${stats.total}`);
      console.log(`  Avg Duration: ${stats.avgDuration}ms`);
      console.log(`  Success Rate: ${stats.successRate}%`);
      console.log("");
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) console.log(`  ${STATUS_COLORS[status as ActionStatus](status)}: ${count}`);
      }
      console.log("");
    });

  return cmd;
}
