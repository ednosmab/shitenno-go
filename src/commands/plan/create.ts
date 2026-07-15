/**
 * plan create — Create a new plan.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared.js";
import { outputJson } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { getEngine } from "./helpers.js";

export function registerCreate(cmd: import("commander").Command) {
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
            type: (opts["step-type"] as string) ?? "log_event",
            params: { event: "plan_step", message: stepName },
          },
        })),
      });

      if (isJson) {
        outputJson(plan as unknown as Record<string, unknown>);
      } else {
        output(chalk.green(`  ✓ Plan created: ${chalk.bold(plan.id)}`));
        output(`    ${plan.name} (${plan.steps.length} steps)`);
        outputBlank();
        for (const step of plan.steps) {
          output(`    ${chalk.dim(`${step.order + 1}.`)} ${step.name}`);
        }
        outputBlank();
      }
    });
}
