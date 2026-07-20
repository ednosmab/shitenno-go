/**
 * plan md done — Mark markdown plan as done.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { archivePlan } from "../../plan-lifecycle.js";
import { outputJson } from "../../formatting.js";
import { output } from "../../output.js";

export function registerMdDone(cmd: import("commander").Command) {
  cmd
    .command("done")
    .description("Mark markdown plan as done and move to done/")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
      try {
        const success = archivePlan(shitennoDir, id);
        if (isJson) outputJson({ success, planId: id });
        else {
          if (success) {
            output(chalk.green(`  ✓ Plan marked as done: ${id}`));
            output(chalk.dim(`    Moved to done/ directory`));
          } else {
            output(chalk.red(`  Failed to archive plan: ${id}`));
          }
        }
      } catch (error) {
        if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
        else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
