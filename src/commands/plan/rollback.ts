/**
 * plan rollback — Rollback a plan.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { getEngine } from "./helpers.js";

export function registerRollback(cmd: import("commander").Command) {
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
        if (isJson) outputJson({ error: "Plan not found or cannot be rolled back" });
        else console.log(chalk.red(`  Cannot rollback plan: ${id}`));
        return;
      }
      if (isJson) outputJson(plan as unknown as Record<string, unknown>);
      else console.log(chalk.yellow(`  ⚠ Plan rolled back: ${plan.id}`));
    });
}
