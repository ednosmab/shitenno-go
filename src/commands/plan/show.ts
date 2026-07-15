/**
 * plan show — Show plan details.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { getEngine, STATUS_COLORS } from "./helpers.js";

export function registerShow(cmd: import("commander").Command) {
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
        if (isJson) outputJson({ error: "Plan not found" });
        else output(chalk.red(`  Plan not found: ${id}`));
        return;
      }

      if (isJson) { outputJson(plan as unknown as Record<string, unknown>); return; }

      outputBlank();
      output(chalk.bold(`  ${plan.id}`));
      output(`  ${plan.name}`);
      if (plan.description) output(`  ${chalk.dim(plan.description)}`);
      outputBlank();
      output(`  Status:     ${STATUS_COLORS[plan.status](plan.status)}`);
      output(`  Correlation: ${plan.correlationId}`);
      output(`  Created:    ${plan.createdAt}`);
      if (plan.completedAt) output(`  Completed:  ${plan.completedAt}`);
      if (plan.duration) output(`  Duration:   ${plan.duration}ms`);
      outputBlank();
      output(chalk.bold("  Steps:"));
      for (const step of plan.steps) {
        const stepIcon = step.status === "completed" ? chalk.green("✓") :
          step.status === "failed" ? chalk.red("✗") :
          step.status === "skipped" ? chalk.yellow("○") :
          step.status === "running" ? chalk.cyan("⟳") : chalk.dim("○");
        const deps = step.dependencies.length > 0 ? chalk.dim(` [deps: ${step.dependencies.join(", ")}]`) : "";
        const optional = step.optional ? chalk.dim(" (optional)") : "";
        output(`    ${stepIcon} ${step.name}${deps}${optional}`);
        if (step.error) output(chalk.red(`      ${step.error}`));
      }
      outputBlank();
    });
}
