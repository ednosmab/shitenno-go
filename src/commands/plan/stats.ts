/**
 * plan stats — Show plan statistics.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { getEngine, STATUS_COLORS } from "./helpers.js";

export function registerStats(cmd: import("commander").Command) {
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

      if (isJson) { outputJson(stats as unknown as Record<string, unknown>); return; }

      outputBlank();
      output(chalk.bold("  Plan Statistics"));
      output(chalk.dim("  " + "─".repeat(40)));
      output(`  Total:       ${stats.total}`);
      output(`  Avg Steps:   ${stats.avgSteps}`);
      output(`  Avg Duration: ${stats.avgDuration}ms`);
      outputBlank();
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) output(`  ${STATUS_COLORS[status as import("../../plan-engine.js").PlanStatus](status)}: ${count}`);
      }
      outputBlank();
    });
}
