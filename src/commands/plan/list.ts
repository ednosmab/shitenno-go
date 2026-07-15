/**
 * plan list — List plans.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { getEngine, formatPlan } from "./helpers.js";

export function registerList(cmd: import("commander").Command) {
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
      const plans = engine.list({ status: opts.status as import("../../plan-engine.js").PlanStatus });

      if (isJson) {
        outputJson(plans as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      if (plans.length === 0) {
        output(chalk.dim("  No plans found."));
      } else {
        output(chalk.bold(`  Plans (${plans.length})`));
        output(chalk.dim("  " + "─".repeat(70)));
        for (const p of plans) output(formatPlan(p));
      }
      outputBlank();
    });
}
