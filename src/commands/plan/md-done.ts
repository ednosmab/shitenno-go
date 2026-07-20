/**
 * plan md done — Mark markdown plan as done.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { runAutoVerification } from "../../plan-lifecycle.js";
import { outputJson } from "../../formatting.js";
import { output } from "../../output.js";

export function registerMdDone(cmd: import("commander").Command) {
  cmd
    .command("done")
    .description("Run verification (build+test+lint) and, if it passes, mark plan as done")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
      try {
        const record = runAutoVerification(shitennoDir, ctx.projectRoot, id);
        if (isJson) {
          outputJson(record as unknown as Record<string, unknown>);
        } else if (record.passed) {
          output(chalk.green(`  ✓ Plan verified and marked as done: ${id}`));
          output(chalk.dim(`    Moved to done/ directory`));
        } else {
          const failed = record.checks.filter((c) => !c.passed).map((c) => c.name).join(", ");
          output(chalk.red(`  ✗ Plan blocked — failed checks: ${failed}`));
        }
      } catch (error) {
        if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
        else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
