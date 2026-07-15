/**
 * goal.ts — Goal Management CLI Command
 *
 * The `nexus goal` command. CRUD operations for governance goals.
 *
 * Usage:
 *   nexus goal create "Achieve 80% test coverage" --priority high --target quality
 *   nexus goal list
 *   nexus goal list --status active
 *   nexus goal show GOAL-abc123
 *   nexus goal update GOAL-abc123 --progress 50
 *   nexus goal complete GOAL-abc123
 *   nexus goal abandon GOAL-abc123
 *   nexus goal stats
 *   nexus goal delete GOAL-abc123
 */

import { Command } from "commander";
import chalk from "chalk";

import { guardNotInitialized } from "../shared.js";
import { GoalEngine, type GoalStatus, type GoalPriority, FileGoalRepository } from "../goal-engine.js";
import { outputJson } from "../formatting.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputSection, outputSuccess, outputError, outputWarning } from "../output.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): GoalEngine {
  const nexusDir = join(dir, NEXUS_DIR_NAME);
  return new GoalEngine(new FileGoalRepository(nexusDir));
}

function join(...paths: string[]): string {
  return paths.reduce((a, b) => {
    const sep = a.endsWith("/") || a.endsWith("\\") ? "" : "/";
    return a + sep + b;
  });
}

const STATUS_COLORS: Record<GoalStatus, (s: string) => string> = {
  draft: (s) => chalk.gray(s),
  active: (s) => chalk.cyan(s),
  completed: (s) => chalk.green(s),
  abandoned: (s) => chalk.red(s),
};

const PRIORITY_COLORS: Record<GoalPriority, (s: string) => string> = {
  low: (s) => chalk.gray(s),
  medium: (s) => chalk.yellow(s),
  high: (s) => chalk.hex("#FF8800")(s),
  critical: (s) => chalk.red.bold(s),
};

function formatGoal(goal: { id: string; title: string; status: GoalStatus; priority: GoalPriority; progress: number; targets: string[]; description?: string }): string {
  const status = STATUS_COLORS[goal.status](goal.status.padEnd(10));
  const priority = PRIORITY_COLORS[goal.priority](goal.priority.padEnd(8));
  const bar = progressBar(goal.progress);
  const targets = goal.targets.length > 0 ? chalk.dim(` [${goal.targets.join(", ")}]`) : "";
  return `  ${chalk.bold(goal.id)}  ${status}  ${priority}  ${bar}  ${goal.title}${targets}`;
}

function progressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(empty)) + ` ${pct}%`;
}

// ── Command ────────────────────────────────────────────────────────────────

export function goalCommand(): Command {
  const cmd = new Command("goal")
    .description("Manage governance goals")
    .option("-d, --dir <path>", "Project directory");

  // ── create ──────────────────────────────────────────────────────────────
  cmd
    .command("create")
    .description("Create a new goal")
    .argument("<title>", "Goal title")
    .option("--description <text>", "Goal description")
    .option("--priority <level>", "Priority: low, medium, high, critical", "medium")
    .option("--target <targets>", "Comma-separated capability targets")
    .option("--criteria <criteria>", "Comma-separated success criteria")
    .option("--tag <tags>", "Comma-separated tags")
    .option("--parent <id>", "Parent goal ID")
    .option("--json", "Output as JSON")
    .action((title: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const goal = engine.create({
        title,
        description: opts.description as string,
        priority: (opts.priority as GoalPriority) ?? "medium",
        targets: opts.target ? (opts.target as string).split(",").map((s) => s.trim()) : [],
        criteria: opts.criteria ? (opts.criteria as string).split(",").map((s) => s.trim()) : [],
        tags: opts.tag ? (opts.tag as string).split(",").map((s) => s.trim()) : [],
        parentId: opts.parent as string,
      });

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        outputBlank();
        outputSuccess(`Goal created: ${chalk.bold(goal.id)}`);
        output(`    ${goal.title}`);
        outputBlank();
      }
    });

  // ── list ────────────────────────────────────────────────────────────────
  cmd
    .command("list")
    .description("List goals")
    .option("--status <status>", "Filter by status")
    .option("--priority <priority>", "Filter by priority")
    .option("--target <target>", "Filter by target capability")
    .option("--tag <tag>", "Filter by tag")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const goals = engine.list({
        status: opts.status as GoalStatus,
        priority: opts.priority as GoalPriority,
        target: opts.target as string,
        tag: opts.tag as string,
      });

      if (isJson) {
        outputJson(goals as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      if (goals.length === 0) {
        output(chalk.dim("  No goals found. Create one with: nexus goal create \"<title>\""));
      } else {
        outputSection(`Goals (${goals.length})`);
        output(chalk.dim("  " + "─".repeat(70)));
        for (const goal of goals) {
          output(formatGoal(goal));
        }
      }
      outputBlank();
    });

  // ── show ────────────────────────────────────────────────────────────────
  cmd
    .command("show")
    .description("Show goal details")
    .argument("<id>", "Goal ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const goal = engine.get(id);

      if (!goal) {
        if (isJson) {
          outputJson({ error: "Goal not found" });
        } else {
          outputError(`Goal not found: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      output(chalk.bold(`  ${goal.id}`));
      output(`  ${goal.title}`);
      if (goal.description) output(`  ${chalk.dim(goal.description)}`);
      outputBlank();
      output(`  Status:     ${STATUS_COLORS[goal.status](goal.status)}`);
      output(`  Priority:   ${PRIORITY_COLORS[goal.priority](goal.priority)}`);
      output(`  Progress:   ${progressBar(goal.progress)}`);
      if (goal.targets.length > 0) output(`  Targets:    ${goal.targets.join(", ")}`);
      if (goal.criteria.length > 0) output(`  Criteria:   ${goal.criteria.join(", ")}`);
      if (goal.tags.length > 0) output(`  Tags:       ${goal.tags.join(", ")}`);
      if (goal.parentId) output(`  Parent:     ${goal.parentId}`);
      output(`  Created:    ${goal.createdAt}`);
      output(`  Updated:    ${goal.updatedAt}`);
      if (goal.completedAt) output(`  Completed:  ${goal.completedAt}`);
      outputBlank();
    });

  // ── update ──────────────────────────────────────────────────────────────
  cmd
    .command("update")
    .description("Update goal progress")
    .argument("<id>", "Goal ID")
    .option("--progress <pct>", "Progress percentage (0-100)")
    .option("--title <title>", "Update title")
    .option("--description <text>", "Update description")
    .option("--priority <level>", "Update priority")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      let goal = engine.get(id);

      if (!goal) {
        if (isJson) {
          outputJson({ error: "Goal not found" });
        } else {
          outputError(`Goal not found: ${id}`);
        }
        return;
      }

      if (opts.progress !== undefined) {
        const pct = parseInt(opts.progress as string, 10);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          outputError("Progress must be between 0 and 100");
          return;
        }
        goal = engine.updateProgress(id, pct);
      }

      if (opts.title) {
        goal!.title = opts.title as string;
        goal!.updatedAt = new Date().toISOString();
        // Re-save via repo
        const repo = new FileGoalRepository(join(ctx.projectRoot, NEXUS_DIR_NAME));
        repo.save(goal!);
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else if (goal) {
        outputSuccess(`Goal updated: ${goal.id}`);
        output(`    ${formatGoal(goal)}`);
      }
    });

  // ── activate ────────────────────────────────────────────────────────────
  cmd
    .command("activate")
    .description("Activate a goal (draft → active)")
    .argument("<id>", "Goal ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const goal = engine.activate(id);

      if (!goal) {
        if (isJson) {
          outputJson({ error: "Goal not found or not in draft status" });
        } else {
          outputError(`Cannot activate goal: ${id} (not found or not in draft status)`);
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        outputSuccess(`Goal activated: ${goal.id}`);
      }
    });

  // ── complete ────────────────────────────────────────────────────────────
  cmd
    .command("complete")
    .description("Complete a goal (active → completed)")
    .argument("<id>", "Goal ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const goal = engine.complete(id);

      if (!goal) {
        if (isJson) {
          outputJson({ error: "Goal not found or not active" });
        } else {
          outputError(`Cannot complete goal: ${id} (not found or not active)`);
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        outputSuccess(`Goal completed: ${goal.id}`);
      }
    });

  // ── abandon ─────────────────────────────────────────────────────────────
  cmd
    .command("abandon")
    .description("Abandon a goal")
    .argument("<id>", "Goal ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const goal = engine.abandon(id);

      if (!goal) {
        if (isJson) {
          outputJson({ error: "Goal not found or already completed" });
        } else {
          outputError(`Cannot abandon goal: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        outputWarning(`Goal abandoned: ${goal.id}`);
      }
    });

  // ── stats ───────────────────────────────────────────────────────────────
  cmd
    .command("stats")
    .description("Show goal statistics")
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

      outputBlank();
      outputSection("Goal Statistics");
      output(chalk.dim("  " + "─".repeat(40)));
      output(`  Total:     ${stats.total}`);
      output(`  Avg Progress: ${stats.avgProgress}%`);
      outputBlank();
      outputSection("By Status:");
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) output(`    ${STATUS_COLORS[status as GoalStatus](status)}: ${count}`);
      }
      outputBlank();
      outputSection("By Priority:");
      for (const [priority, count] of Object.entries(stats.byPriority)) {
        if (count > 0) output(`    ${PRIORITY_COLORS[priority as GoalPriority](priority)}: ${count}`);
      }
      outputBlank();
    });

  // ── delete ──────────────────────────────────────────────────────────────
  cmd
    .command("delete")
    .description("Delete a goal")
    .argument("<id>", "Goal ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const deleted = engine.delete(id);

      if (!deleted) {
        if (isJson) {
          outputJson({ error: "Goal not found" });
        } else {
          outputError(`Goal not found: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson({ deleted: true, id });
      } else {
        outputSuccess(`Goal deleted: ${id}`);
      }
    });

  return cmd;
}
