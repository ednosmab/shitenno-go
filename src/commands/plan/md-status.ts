/**
 * plan md status — Update markdown plan status.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared.js";
import { SHITEN_DIR_NAME } from "../../constants.js";
import { MarkdownPlanEngine, type MarkdownPlanStatus } from "../../markdown-plan-engine.js";
import { outputJson } from "../../formatting.js";
import { output } from "../../output.js";

export function registerMdStatus(cmd: import("commander").Command) {
  cmd
    .command("status")
    .description("Update markdown plan status")
    .argument("<id>", "Plan ID")
    .argument("<status>", "New status: andamento, parado, done")
    .option("--json", "Output as JSON")
    .action((id: string, status: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const validStatuses: MarkdownPlanStatus[] = ["andamento", "parado", "done"];
      if (!validStatuses.includes(status as MarkdownPlanStatus)) {
        if (isJson) outputJson({ error: `Invalid status. Must be: ${validStatuses.join(", ")}` });
        else output(chalk.red(`  Invalid status: ${status}. Must be: ${validStatuses.join(", ")}`));
        return;
      }

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, SHITEN_DIR_NAME));
      try {
        const updated = engine.updateStatus(id, status as MarkdownPlanStatus);
        if (isJson) outputJson(updated as unknown as Record<string, unknown>);
        else {
          output(chalk.green(`  ✓ Plan status updated: ${id} → ${status}`));
          if (status === "done") output(chalk.dim(`    Moved to done/ directory`));
        }
      } catch (error) {
        if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
        else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
