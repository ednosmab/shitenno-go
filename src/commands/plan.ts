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
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { guardNotInitialized } from "../shared.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import {
  PlanEngine,
  FilePlanRepository,
  type PlanStatus,
} from "../plan-engine.js";
import { MarkdownPlanEngine, type MarkdownPlanStatus } from "../markdown-plan-engine.js";
import { ActionEngine, FileExecutionRepository } from "../action-engine.js";
import { outputJson, banner } from "../formatting.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): PlanEngine {
  const nexusDir = join(dir, NEXUS_DIR_NAME);
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

  // ── md subcommand (markdown plans) ───────────────────────────────────────
  const mdCmd = cmd
    .command("md")
    .description("Manage markdown execution plans");

  // ── md list ──────────────────────────────────────────────────────────────
  mdCmd
    .command("list")
    .description("List active markdown plans")
    .option("--done", "Include done plans")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, NEXUS_DIR_NAME));
      let plans = engine.list();

      if (opts.done) {
        plans = [...plans, ...engine.listDone()];
      }

      if (isJson) {
        outputJson(plans as unknown as Record<string, unknown>);
        return;
      }

      if (plans.length === 0) {
        console.log(chalk.dim("  No markdown plans found."));
        return;
      }

      console.log("");
      console.log(chalk.bold(`  Markdown Plans (${plans.length})`));
      console.log(chalk.dim("  " + "─".repeat(50)));
      for (const plan of plans) {
        const status = plan.status === "done" ? chalk.green("done") :
                       plan.status === "parado" ? chalk.yellow("parado") :
                       chalk.cyan("andamento");
        console.log(`  ${chalk.bold(plan.id)}  ${status.padEnd(12)}  ${plan.title}`);
      }
      console.log("");
    });

  // ── md show ──────────────────────────────────────────────────────────────
  mdCmd
    .command("show")
    .description("Show markdown plan details")
    .argument("<id>", "Plan ID (filename without .md)")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, NEXUS_DIR_NAME));
      const plan = engine.getById(id);

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
      console.log(chalk.bold(`  Plan: ${plan.title}`));
      console.log(chalk.dim("  " + "─".repeat(50)));
      console.log(`  ID:       ${plan.id}`);
      console.log(`  Status:   ${plan.status}`);
      console.log(`  Created:  ${plan.createdAt || "N/A"}`);
      console.log(`  Updated:  ${plan.updatedAt || "N/A"}`);
      console.log(`  Path:     ${plan.relativePath}`);
      console.log("");
    });

  // ── md status ────────────────────────────────────────────────────────────
  mdCmd
    .command("status")
    .description("Update markdown plan status")
    .argument("<id>", "Plan ID")
    .argument("<status>", "New status: andamento, parado, done")
    .option("--json", "Output as JSON")
    .action((id: string, status: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const validStatuses: MarkdownPlanStatus[] = ["andamento", "parado", "done"];
      if (!validStatuses.includes(status as MarkdownPlanStatus)) {
        if (isJson) {
          outputJson({ error: `Invalid status. Must be: ${validStatuses.join(", ")}` });
        } else {
          console.log(chalk.red(`  Invalid status: ${status}. Must be: ${validStatuses.join(", ")}`));
        }
        return;
      }

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, NEXUS_DIR_NAME));
      try {
        const updated = engine.updateStatus(id, status as MarkdownPlanStatus);

        if (isJson) {
          outputJson(updated as unknown as Record<string, unknown>);
        } else {
          console.log(chalk.green(`  ✓ Plan status updated: ${id} → ${status}`));
          if (status === "done") {
            console.log(chalk.dim(`    Moved to done/ directory`));
          }
        }
      } catch (error) {
        if (isJson) {
          outputJson({ error: error instanceof Error ? error.message : String(error) });
        } else {
          console.log(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    });

  // ── md done ──────────────────────────────────────────────────────────────
  mdCmd
    .command("done")
    .description("Mark markdown plan as done and move to done/")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, NEXUS_DIR_NAME));
      try {
        const updated = engine.updateStatus(id, "done");

        if (isJson) {
          outputJson(updated as unknown as Record<string, unknown>);
        } else {
          console.log(chalk.green(`  ✓ Plan marked as done: ${id}`));
          console.log(chalk.dim(`    Moved to done/ directory`));
        }
      } catch (error) {
        if (isJson) {
          outputJson({ error: error instanceof Error ? error.message : String(error) });
        } else {
          console.log(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    });

  // ── md create ────────────────────────────────────────────────────────────
  mdCmd
    .command("create")
    .description("Create a new markdown plan")
    .argument("<title>", "Plan title")
    .option("--description <text>", "Plan description")
    .option("--priority <level>", "Priority (P0, P1, P2)", "P1")
    .option("--time <estimate>", "Estimated time")
    .option("--owner <name>", "Plan owner", "AI Agent")
    .option("--json", "Output as JSON")
    .action((title: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, NEXUS_DIR_NAME));
      const plan = engine.create({
        title,
        description: opts.description as string,
        priority: opts.priority as string,
        estimatedTime: opts.time as string,
        owner: opts.owner as string,
      });

      if (isJson) {
        outputJson(plan as unknown as Record<string, unknown>);
      } else {
        console.log(chalk.green(`  ✓ Plan created: ${chalk.bold(plan.id)}`));
        console.log(`    ${plan.title}`);
        console.log(`    Path: ${plan.relativePath}`);
        console.log("");
      }
    });

  // ── md prepare ──────────────────────────────────────────────────────────
  mdCmd
    .command("prepare")
    .description("Prepare a plan: format header, extract checklist, sync backlog, notify")
    .argument("<id>", "Plan ID (filename without .md)")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const nexusDir = join(ctx.projectRoot, NEXUS_DIR_NAME);
      const engine = new MarkdownPlanEngine(nexusDir);
      const plan = engine.getById(id);

      if (!plan) {
        if (isJson) {
          outputJson({ error: "not_found", message: `Plan not found: ${id}` });
        } else {
          console.log(chalk.red(`  ✘ Plan not found: ${id}`));
        }
        return;
      }

      if (!isJson) {
        console.log("");
        banner("nexus plan prepare", "Plan Preparation");
        console.log("");
        console.log(chalk.gray(`  Plan: ${plan.title}`));
        console.log(chalk.gray(`  Path: ${plan.relativePath}`));
        console.log("");
      }

      const results: { step: string; status: string; detail: string }[] = [];

      // Step 1: Format header to nexus standard
      try {
        let content = readFileSync(plan.filePath, "utf-8");
        let updated = false;

        // Ensure **Status:** field exists
        if (!content.match(/\*\*Status:\*\*/)) {
          const titleLine = content.split("\n").findIndex((l) => l.startsWith("# "));
          if (titleLine !== -1) {
            const lines = content.split("\n");
            lines.splice(titleLine + 2, 0, "", "**Status:** Pending");
            content = lines.join("\n");
            updated = true;
          }
        }

        // Ensure **Date:** field exists
        if (!content.match(/\*\*Date:\*\*/)) {
          const statusLine = content.split("\n").findIndex((l) => l.match(/\*\*Status:\*\*/));
          if (statusLine !== -1) {
            const lines = content.split("\n");
            lines.splice(statusLine + 1, 0, `**Date:** ${new Date().toISOString().slice(0, 10)}`);
            content = lines.join("\n");
            updated = true;
          }
        }

        // Ensure **Updated_at:** field exists
        if (!content.match(/\*\*Updated_at:\*\*/)) {
          const lastField = content.split("\n").findIndex((l) => l.match(/^\*\*[A-Z]/));
          if (lastField !== -1) {
            const lines = content.split("\n");
            lines.splice(lastField + 1, 0, `**Updated_at:** ${new Date().toISOString()}`);
            content = lines.join("\n");
            updated = true;
          }
        }

        if (updated) {
          writeFileSync(plan.filePath, content, "utf-8");
          results.push({ step: "format_header", status: "done", detail: "Header formatted to nexus standard" });
        } else {
          results.push({ step: "format_header", status: "skip", detail: "Header already conformant" });
        }
      } catch (error) {
        results.push({ step: "format_header", status: "error", detail: String(error) });
      }

      // Step 2: Check for existing checklist in plan
      try {
        const content = readFileSync(plan.filePath, "utf-8");
        const hasChecklist = content.includes("## 3.1 Checklists") || content.includes("| # |") || content.match(/\[[ x]\]/);
        if (hasChecklist) {
          results.push({ step: "checklist", status: "skip", detail: "Checklist already exists in plan" });
        } else {
          results.push({ step: "checklist", status: "skip", detail: "No checklist section found — add manually or via pipeline template" });
        }
      } catch (error) {
        results.push({ step: "checklist", status: "error", detail: String(error) });
      }

      // Step 3: Sync to BACKLOG.md
      try {
        const backlogPath = join(ctx.projectRoot, "docs", "BACKLOG.md");
        if (existsSync(backlogPath)) {
          const backlog = readFileSync(backlogPath, "utf-8");
          const planIdUpper = id.toUpperCase().replace(/-/g, "_");

          if (backlog.includes(planIdUpper)) {
            results.push({ step: "backlog_sync", status: "skip", detail: `Item ${planIdUpper} already in BACKLOG.md` });
          } else {
            results.push({ step: "backlog_sync", status: "pending", detail: `Item ${planIdUpper} needs to be added to BACKLOG.md manually` });
          }
        } else {
          results.push({ step: "backlog_sync", status: "skip", detail: "BACKLOG.md not found" });
        }
      } catch (error) {
        results.push({ step: "backlog_sync", status: "error", detail: String(error) });
      }

      // Step 4: Send desktop notification
      try {
        const { execSync } = await import("node:child_process");
        execSync(`notify-send "Nexus Plan" "Plan prepared: ${plan.title}" --urgency=normal`, {
          stdio: "pipe",
          timeout: 2000,
        });
        results.push({ step: "notify", status: "done", detail: "Desktop notification sent" });
      } catch {
        results.push({ step: "notify", status: "skip", detail: "notify-send not available or failed" });
      }

      // Output results
      if (isJson) {
        outputJson({ planId: id, title: plan.title, results });
      } else {
        console.log(chalk.bold("  Results:"));
        console.log("");
        for (const r of results) {
          const icon = r.status === "done" ? "✅" : r.status === "skip" ? "⏭" : r.status === "error" ? "❌" : "⏳";
          console.log(`    ${icon} ${r.step}: ${r.detail}`);
        }
        console.log("");
        console.log(chalk.green(`  ✓ Plan "${plan.title}" prepared`));
        console.log("");
      }
    });

  // ── md lifecycle ─────────────────────────────────────────────────────────
  mdCmd
    .command("lifecycle")
    .description("Detect, review and archive completed plans")
    .option("--auto", "Archive without prompts (CI/CD)")
    .option("--dry", "Dry run — show what would happen")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const { runLifecycleReview } = await import("../plan-lifecycle.js");
      try {
        const result = await runLifecycleReview(ctx.projectRoot, {
          auto: opts.auto === true,
          dry: opts.dry === true,
        });

        if (isJson) {
          outputJson(result as unknown as Record<string, unknown>);
        }
      } catch (error) {
        if (isJson) {
          outputJson({ error: error instanceof Error ? error.message : String(error) });
        } else {
          console.log(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    });

  return cmd;
}
