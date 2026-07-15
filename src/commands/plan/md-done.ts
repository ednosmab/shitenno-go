/**
 * plan md done — Mark markdown plan as done.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared.js";
import { SHITEN_DIR_NAME } from "../../constants.js";
import { MarkdownPlanEngine } from "../../markdown-plan-engine.js";
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

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, SHITEN_DIR_NAME));
      try {
        const updated = engine.updateStatus(id, "done");
        if (isJson) outputJson(updated as unknown as Record<string, unknown>);
        else {
          output(chalk.green(`  ✓ Plan marked as done: ${id}`));
          output(chalk.dim(`    Moved to done/ directory`));
        }
      } catch (error) {
        if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
        else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
