/**
 * Validator: check skills count.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOCS, README, type ValidatorContext, pass, warn } from "./shared.js";

export function checkSkillsCount(ctx: ValidatorContext) {
  console.log("\n📚 Checking skills...\n");

  const skillsDir = resolve(DOCS, "skills");
  if (!existsSync(skillsDir)) {
    warn(ctx, "docs/skills/ directory not found");
    return;
  }

  const skills = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  const readmeContent = existsSync(README) ? readFileSync(README, "utf-8") : "";
  const countMatch = readmeContent.match(/(\d+)\s*Competências\s*de\s*Engenharia/);
  const documentedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  if (documentedCount > 0) {
    if (skills.length === documentedCount) {
      pass(ctx, `Skills count matches: ${skills.length}`);
    } else {
      warn(ctx, `Skills count mismatch: ${skills.length} exist, ${documentedCount} documented`);
    }
  } else {
    pass(ctx, `Skills found: ${skills.length} (no count in README to compare)`);
  }
}
