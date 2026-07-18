/**
 * Validator: check README statistics.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SRC, SRC_TS, README, type ValidatorContext, type FixAction, pass, warn, error, dryLog } from "./shared.js";

function getImplementedCommands(): string[] {
  if (!existsSync(SRC)) return [];
  return readdirSync(SRC).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx")).map((f) => f.replace(/\.(ts|tsx)$/, ""));
}

export function checkREADMEStatistics(ctx: ValidatorContext) {
  console.log("\n📊 Checking README statistics...\n");

  if (!existsSync(README)) {
    warn(ctx, "README.md not found — skipping statistics check");
    return;
  }

  const readmeContent = readFileSync(README, "utf-8");
  const srcFiles = readdirSync(SRC_TS, { recursive: true }).filter(
    (f) => typeof f === "string" && (f.endsWith(".ts") || f.endsWith(".tsx"))
  ).length;

  const testDir = resolve(SRC_TS, "__tests__");
  const testFiles = existsSync(testDir)
    ? readdirSync(testDir, { recursive: true }).filter(
        (f) => typeof f === "string" && f.endsWith(".test.ts")
      ).length
    : 0;

  const statsMatch = readmeContent.match(
    /\| CLI Commands \| (\d+) \|[\s\S]*?\| Test Files \| (\d+) \|/
  );
  if (!statsMatch) return;

  const [, oldCmdCount, oldTestCount] = statsMatch;
  const actualCmdCount = getImplementedCommands().length;
  const actualTestCount = testFiles;
  let needsFix = false;
  let newContent = readmeContent;

  if (parseInt(oldCmdCount, 10) !== actualCmdCount) {
    needsFix = true;
    newContent = newContent.replace(/\| CLI Commands \| (\d+) \|/, `| CLI Commands | ${actualCmdCount} |`);
  }
  if (parseInt(oldTestCount, 10) !== actualTestCount) {
    needsFix = true;
    newContent = newContent.replace(/\| Test Files \| (\d+) \|/, `| Test Files | ${actualTestCount} |`);
  }

  if (needsFix) {
    ctx.fixActions.push({
      file: "README.md",
      description: `Update Key Statistics: commands ${oldCmdCount}→${actualCmdCount}, tests ${oldTestCount}→${actualTestCount}`,
      apply: () => { writeFileSync(README, newContent, "utf-8"); },
    });
    if (ctx.DRY_RUN) {
      dryLog(ctx, `README Key Statistics: commands ${oldCmdCount}→${actualCmdCount}, tests ${oldTestCount}→${actualTestCount}`);
    } else if (ctx.FIX) {
      ctx.fixActions[ctx.fixActions.length - 1].apply();
      pass(ctx, "Fixed: README statistics updated");
    } else {
      error(ctx, `README statistics outdated: commands ${oldCmdCount}→${actualCmdCount}, tests ${oldTestCount}→${actualTestCount}`, "README.md", true);
    }
  } else {
    pass(ctx, "README statistics are up to date");
  }
}
