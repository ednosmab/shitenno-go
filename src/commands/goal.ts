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
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { guardNotInitialized } from "../shared.js";
import { GoalEngine, type GoalStatus, type GoalPriority, FileGoalRepository } from "../goal-engine.js";
import { outputJson } from "../formatting.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): GoalEngine {
  const nexusDir = join(dir, "nexus-system");
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
        console.log("");
        console.log(chalk.green(`  ✓ Goal created: ${chalk.bold(goal.id)}`));
        console.log(`    ${goal.title}`);
        console.log("");
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

      console.log("");
      if (goals.length === 0) {
        console.log(chalk.dim("  No goals found. Create one with: nexus goal create \"<title>\""));
      } else {
        console.log(chalk.bold(`  Goals (${goals.length})`));
        console.log(chalk.dim("  " + "─".repeat(70)));
        for (const goal of goals) {
          console.log(formatGoal(goal));
        }
      }
      console.log("");
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
          console.log(chalk.red(`  Goal not found: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold(`  ${goal.id}`));
      console.log(`  ${goal.title}`);
      if (goal.description) console.log(`  ${chalk.dim(goal.description)}`);
      console.log("");
      console.log(`  Status:     ${STATUS_COLORS[goal.status](goal.status)}`);
      console.log(`  Priority:   ${PRIORITY_COLORS[goal.priority](goal.priority)}`);
      console.log(`  Progress:   ${progressBar(goal.progress)}`);
      if (goal.targets.length > 0) console.log(`  Targets:    ${goal.targets.join(", ")}`);
      if (goal.criteria.length > 0) console.log(`  Criteria:   ${goal.criteria.join(", ")}`);
      if (goal.tags.length > 0) console.log(`  Tags:       ${goal.tags.join(", ")}`);
      if (goal.parentId) console.log(`  Parent:     ${goal.parentId}`);
      console.log(`  Created:    ${goal.createdAt}`);
      console.log(`  Updated:    ${goal.updatedAt}`);
      if (goal.completedAt) console.log(`  Completed:  ${goal.completedAt}`);
      console.log("");
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
          console.log(chalk.red(`  Goal not found: ${id}`));
        }
        return;
      }

      if (opts.progress !== undefined) {
        const pct = parseInt(opts.progress as string, 10);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          console.log(chalk.red("  Progress must be between 0 and 100"));
          return;
        }
        goal = engine.updateProgress(id, pct);
      }

      if (opts.title) {
        goal!.title = opts.title as string;
        goal!.updatedAt = new Date().toISOString();
        const engine2 = getEngine(ctx.projectRoot);
        // Re-save via repo
        const repo = new (require("../goal-engine.js").FileGoalRepository)(join(ctx.projectRoot, "nexus-system"));
        repo.save(goal!);
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else if (goal) {
        console.log(chalk.green(`  ✓ Goal updated: ${goal.id}`));
        console.log(`    ${formatGoal(goal)}`);
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
          console.log(chalk.red(`  Cannot activate goal: ${id} (not found or not in draft status)`));
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Goal activated: ${goal.id}`));
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
          console.log(chalk.red(`  Cannot complete goal: ${id} (not found or not active)`));
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Goal completed: ${goal.id}`));
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
          console.log(chalk.red(`  Cannot abandon goal: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(goal as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.yellow(`  ⚠ Goal abandoned: ${goal.id}`));
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

      console.log("");
      console.log(chalk.bold("  Goal Statistics"));
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log(`  Total:     ${stats.total}`);
      console.log(`  Avg Progress: ${stats.avgProgress}%`);
      console.log("");
      console.log(chalk.bold("  By Status:"));
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) console.log(`    ${STATUS_COLORS[status as GoalStatus](status)}: ${count}`);
      }
      console.log("");
      console.log(chalk.bold("  By Priority:"));
      for (const [priority, count] of Object.entries(stats.byPriority)) {
        if (count > 0) console.log(`    ${PRIORITY_COLORS[priority as GoalPriority](priority)}: ${count}`);
      }
      console.log("");
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
          console.log(chalk.red(`  Goal not found: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson({ deleted: true, id });
      } else {
        console.log(chalk.green(`  ✓ Goal deleted: ${id}`));
      }
    });

  return cmd;
}
