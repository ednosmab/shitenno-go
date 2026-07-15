/**
 * plan cancel — Cancel a plan.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { getEngine } from "./helpers.js";

export function registerCancel(cmd: import("commander").Command) {
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
        if (isJson) outputJson({ error: "Plan not found or cannot be cancelled" });
        else console.log(chalk.red(`  Cannot cancel plan: ${id}`));
        return;
      }
      if (isJson) outputJson(plan as unknown as Record<string, unknown>);
      else console.log(chalk.yellow(`  ⚠ Plan cancelled: ${plan.id}`));
    });
}
