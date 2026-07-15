/**
 * plan delete — Delete a plan.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { output } from "../../output.js";
import { getEngine } from "./helpers.js";

export function registerDelete(cmd: import("commander").Command) {
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
        if (isJson) outputJson({ error: "Plan not found" });
        else output(chalk.red(`  Plan not found: ${id}`));
        return;
      }
      if (isJson) outputJson({ deleted: true, id });
      else output(chalk.green(`  ✓ Plan deleted: ${id}`));
    });
}
