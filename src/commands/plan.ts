/**
 * plan.ts — Plan Engine CLI Command
 *
 * The `nexus plan` command. Manage coordinated action sequences.
 *
 * Usage:
 *   nexus plan create "Deploy changes" --step "Run audit" --step-type log_event --step-param event=audit
 *   nexus plan execute PLAN-abc123
 *   nexus plan rollback PLAN-abc123
 *   nexus plan cancel PLAN-abc123
 *   nexus plan list
 *   nexus plan show PLAN-abc123
 *   nexus plan stats
 *   nexus plan delete PLAN-abc123
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import {
  PlanEngine,
  FilePlanRepository,
  type PlanStatus,
} from "../plan-engine.js";
import { ActionEngine, FileExecutionRepository } from "../action-engine.js";
import { outputJson } from "../formatting.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): PlanEngine {
  const nexusDir = join(dir, "nexus-system");
  const actionEngine = new ActionEngine(new FileExecutionRepository(nexusDir));
  return new PlanEngine(new FilePlanRepository(nexusDir), actionEngine);
}

const STATUS_COLORS: Record<PlanStatus, (s: string) => string> = {
  draft: (s) => chalk.gray(s),
  running: (s) => chalk.cyan(s),
  completed: (s) => chalk.green(s),
  failed: (s) => chalk.red(s),
  rolled_back: (s) => chalk.yellow(s),
  cancelled: (s) => chalk.dim(s),
};

function formatPlan(p: { id: string; name: string; status: PlanStatus; steps: Array<{ status: string }>; duration?: number }): string {
  const status = STATUS_COLORS[p.status](p.status.padEnd(12));
  const steps = `${p.steps.length} steps`;
  const duration = p.duration ? `${p.duration}ms` : "-";
  const completed = p.steps.filter((s) => s.status === "completed").length;
  return `  ${chalk.bold(p.id)}  ${status}  ${steps.padEnd(10)}  ${completed}/${p.steps.length} done  ${duration}`;
}

// ── Command ────────────────────────────────────────────────────────────────

export function planCommand(): Command {
  const cmd = new Command("plan")
    .description("Manage coordinated action sequences (plans)")
    .option("-d, --dir <path>", "Project directory");

  // ── create ──────────────────────────────────────────────────────────────
  cmd
    .command("create")
    .description("Create a new plan")
    .argument("<name>", "Plan name")
    .option("--description <text>", "Plan description")
    .option("--step <names>", "Comma-separated step names")
    .option("--step-type <type>", "Action type for all steps", "log_event")
    .option("--json", "Output as JSON")
    .action((name: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const stepNames = opts.step ? (opts.step as string).split(",").map((s) => s.trim()) : ["default-step"];

      const plan = engine.create({
        name,
        description: opts.description as string,
        steps: stepNames.map((stepName) => ({
          name: stepName,
          action: {
            id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: opts["step-type"] as string ?? "log_event",
            params: { event: "plan_step", message: stepName },
          },
        })),
      });

      if (isJson) {
        outputJson(plan as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Plan created: ${chalk.bold(plan.id)}`));
        console.log(`    ${plan.name} (${plan.steps.length} steps)`);
        console.log("");
        for (const step of plan.steps) {
          console.log(`    ${chalk.dim(`${step.order + 1}.`)} ${step.name}`);
        }
        console.log("");
      }
    });

  // ── execute ─────────────────────────────────────────────────────────────
  cmd
    .command("execute")
    .description("Execute a plan")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);

      try {
        const plan = await engine.execute(id);

        if (isJson) {
          outputJson(plan as unknown as Record<string, unknown>);
        } else {
          console.log("");
          const icon = plan.status === "completed" ? chalk.green("✓") : chalk.red("✗");
          console.log(`${icon} Plan ${plan.id}: ${plan.status}`);
          console.log(`  Duration: ${plan.duration}ms`);
          console.log("");
          for (const step of plan.steps) {
            const stepIcon = step.status === "completed" ? chalk.green("✓") :
              step.status === "failed" ? chalk.red("✗") :
              step.status === "skipped" ? chalk.yellow("○") : chalk.dim("○");
            console.log(`    ${stepIcon} ${step.name} — ${step.status}`);
            if (step.error) console.log(chalk.red(`      ${step.error}`));
          }
          console.log("");
        }
      } catch (error) {
        if (isJson) {
          outputJson({ error: error instanceof Error ? error.message : String(error) });
        } else {
          console.log(chalk.red(`  ✗ ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    });

  // ── rollback ────────────────────────────────────────────────────────────
  cmd
    .command("rollback")
    .description("Rollback a plan")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const plan = await engine.rollback(id);

      if (!plan) {
        if (isJson) {
          outputJson({ error: "Plan not found or cannot be rolled back" });
        } else {
          console.log(chalk.red(`  Cannot rollback plan: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(plan as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.yellow(`  ⚠ Plan rolled back: ${plan.id}`));
      }
    });

  // ── cancel ──────────────────────────────────────────────────────────────
  cmd
    .command("cancel")
    .description("Cancel a plan")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const plan = engine.cancel(id);

      if (!plan) {
        if (isJson) {
          outputJson({ error: "Plan not found or cannot be cancelled" });
        } else {
          console.log(chalk.red(`  Cannot cancel plan: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(plan as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.yellow(`  ⚠ Plan cancelled: ${plan.id}`));
      }
    });

  // ── list ────────────────────────────────────────────────────────────────
  cmd
    .command("list")
    .description("List plans")
    .option("--status <status>", "Filter by status")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const plans = engine.list({ status: opts.status as PlanStatus });

      if (isJson) {
        outputJson(plans as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      if (plans.length === 0) {
        console.log(chalk.dim("  No plans found."));
      } else {
        console.log(chalk.bold(`  Plans (${plans.length})`));
        console.log(chalk.dim("  " + "─".repeat(70)));
        for (const p of plans) {
          console.log(formatPlan(p));
        }
      }
      console.log("");
    });

  // ── show ────────────────────────────────────────────────────────────────
  cmd
    .command("show")
    .description("Show plan details")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const plan = engine.get(id);

      if (!plan) {
        if (isJson) {
          outputJson({ error: "Plan not found" });
        } else {
          console.log(chalk.red(`  Plan not found: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(plan as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold(`  ${plan.id}`));
      console.log(`  ${plan.name}`);
      if (plan.description) console.log(`  ${chalk.dim(plan.description)}`);
      console.log("");
      console.log(`  Status:     ${STATUS_COLORS[plan.status](plan.status)}`);
      console.log(`  Correlation: ${plan.correlationId}`);
      console.log(`  Created:    ${plan.createdAt}`);
      if (plan.completedAt) console.log(`  Completed:  ${plan.completedAt}`);
      if (plan.duration) console.log(`  Duration:   ${plan.duration}ms`);
      console.log("");
      console.log(chalk.bold("  Steps:"));
      for (const step of plan.steps) {
        const stepIcon = step.status === "completed" ? chalk.green("✓") :
          step.status === "failed" ? chalk.red("✗") :
          step.status === "skipped" ? chalk.yellow("○") :
          step.status === "running" ? chalk.cyan("⟳") : chalk.dim("○");
        const deps = step.dependencies.length > 0 ? chalk.dim(` [deps: ${step.dependencies.join(", ")}]`) : "";
        const optional = step.optional ? chalk.dim(" (optional)") : "";
        console.log(`    ${stepIcon} ${step.name}${deps}${optional}`);
        if (step.error) console.log(chalk.red(`      ${step.error}`));
      }
      console.log("");
    });

  // ── stats ───────────────────────────────────────────────────────────────
  cmd
    .command("stats")
    .description("Show plan statistics")
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
      console.log(chalk.bold("  Plan Statistics"));
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log(`  Total:       ${stats.total}`);
      console.log(`  Avg Steps:   ${stats.avgSteps}`);
      console.log(`  Avg Duration: ${stats.avgDuration}ms`);
      console.log("");
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) console.log(`  ${STATUS_COLORS[status as PlanStatus](status)}: ${count}`);
      }
      console.log("");
    });

  // ── delete ──────────────────────────────────────────────────────────────
  cmd
    .command("delete")
    .description("Delete a plan")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const deleted = engine.delete(id);

      if (!deleted) {
        if (isJson) {
          outputJson({ error: "Plan not found" });
        } else {
          console.log(chalk.red(`  Plan not found: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson({ deleted: true, id });
      } else {
        console.log(chalk.green(`  ✓ Plan deleted: ${id}`));
      }
    });

  return cmd;
}
