/**
 * plan execute — Execute a plan.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { getEngine } from "./helpers.js";

export function registerExecute(cmd: import("commander").Command) {
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
          outputBlank();
          const icon = plan.status === "completed" ? chalk.green("✓") : chalk.red("✗");
          output(`${icon} Plan ${plan.id}: ${plan.status}`);
          output(`  Duration: ${plan.duration}ms`);
          outputBlank();
          for (const step of plan.steps) {
            const stepIcon = step.status === "completed" ? chalk.green("✓") :
              step.status === "failed" ? chalk.red("✗") :
              step.status === "skipped" ? chalk.yellow("○") : chalk.dim("○");
            output(`    ${stepIcon} ${step.name} — ${step.status}`);
            if (step.error) output(chalk.red(`      ${step.error}`));
          }
          outputBlank();
        }
      } catch (error) {
        if (isJson) {
          outputJson({ error: error instanceof Error ? error.message : String(error) });
        } else {
          output(chalk.red(`  ✗ ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    });
}
