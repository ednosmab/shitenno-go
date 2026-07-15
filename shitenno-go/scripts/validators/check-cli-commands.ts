/**
 * Validator: check CLI commands documented vs implemented.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { SRC, README, type ValidatorContext, type FixAction, pass, warn, error, dryLog } from "./shared.js";

function getImplementedCommands(): string[] {
  if (!existsSync(SRC)) return [];
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => f.replace(/\.(ts|tsx)$/, ""));
}

export function checkCLICommands(ctx: ValidatorContext) {
  console.log("\n🔧 Checking CLI commands...\n");

  const implemented = getImplementedCommands();
  if (implemented.length === 0) {
    warn(ctx, "src/commands/ directory not found — skipping CLI check");
    return;
  }

  const guide = existsSync(README) ? readFileSync(README, "utf-8") : "";
  const documented = implemented.filter((cmd) => guide.includes(`shiten ${cmd}`));
  const undocumented = implemented.filter((cmd) => !guide.includes(`shiten ${cmd}`));

  pass(ctx, `${documented.length}/${implemented.length} commands documented in README`);

  for (const cmd of undocumented) {
    warn(ctx, `Command implemented but not documented: shiten ${cmd}`, undefined, false);
  }

  if (existsSync(README)) {
    const content = readFileSync(README, "utf-8");
    const countMatch = content.match(/## All Commands \((\d+)\)/);
    if (countMatch) {
      const readmeCount = parseInt(countMatch[1], 10);
      const actualCount = implemented.length;
      if (readmeCount !== actualCount) {
        ctx.fixActions.push({
          file: "README.md",
          description: `Update command count in README: ${readmeCount} → ${actualCount}`,
          apply: () => {
            const c = readFileSync(README, "utf-8");
            writeFileSync(README, c.replace(/## All Commands \(\d+\)/, `## All Commands (${actualCount})`), "utf-8");
          },
        });
        if (ctx.DRY_RUN) {
          dryLog(ctx, `README command count: ${readmeCount} → ${actualCount}`);
        } else if (ctx.FIX) {
          ctx.fixActions[ctx.fixActions.length - 1].apply();
          pass(ctx, `Fixed: README command count updated to ${actualCount}`);
        } else {
          error(ctx, `README command count mismatch: ${readmeCount} stated, ${actualCount} actual`, "README.md", true);
        }
      } else {
        pass(ctx, `README command count matches: ${readmeCount}`);
      }
    }
  }
}
