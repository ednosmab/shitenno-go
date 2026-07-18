/**
 * Validator: check script references in WORKFLOW.md.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SHUGO, PACKAGE_JSON, type ValidatorContext, pass, warn } from "./shared.js";

export function checkScriptReferences(ctx: ValidatorContext) {
  console.log("\n📜 Checking script references in WORKFLOW.md...\n");

  const workflowPath = resolve(SHUGO, "governance", "WORKFLOW.md");
  if (!existsSync(workflowPath)) {
    warn(ctx, "WORKFLOW.md not found — skipping");
    return;
  }
  if (!existsSync(PACKAGE_JSON)) {
    warn(ctx, "package.json not found — skipping");
    return;
  }

  const workflowContent = readFileSync(workflowPath, "utf-8");
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
  const registeredScripts = Object.keys(pkg.scripts || {});
  const scriptRefs = workflowContent.match(/`pnpm run (\S+?)`/g) || [];
  const uniqueScripts = [...new Set(scriptRefs)].map((r) => r.replace(/`?pnpm run /, "").replace(/`$/, ""));
  let brokenCount = 0;

  for (const script of uniqueScripts) {
    if (script.startsWith("shugo ")) continue;
    const scriptName = script.split(" ")[0];
    if (!registeredScripts.includes(scriptName)) {
      warn(ctx, `Script referenced in WORKFLOW.md but not in package.json: ${scriptName}`, "governance/WORKFLOW.md", false);
      brokenCount++;
    }
  }

  if (brokenCount === 0) {
    pass(ctx, `All ${uniqueScripts.length} script references in WORKFLOW.md are registered`);
  }
}
