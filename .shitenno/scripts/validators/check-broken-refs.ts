/**
 * Validator: check for broken references.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SHUGO, README, SYSTEM_MAP, DOCS, type ValidatorContext, pass, warn } from "./shared.js";

export function checkBrokenReferences(ctx: ValidatorContext) {
  console.log("\n🔗 Checking for broken references...\n");

  const filesToCheck = [README, SYSTEM_MAP, resolve(DOCS, "AGENTS.md")].filter((f) => existsSync(f));
  let brokenCount = 0;

  for (const filePath of filesToCheck) {
    const content = readFileSync(filePath, "utf-8");
    const pathRefs = content.match(/`([^`]+\.(?:md|ts|json|yaml))`/g) || [];
    const uniquePaths = [...new Set(pathRefs.map((r) => r.replace(/`/g, "")))];

    for (const ref of uniquePaths) {
      if (ref.includes("*") || ref.includes("<") || ref.includes("[")) continue;
      const fullPath = resolve(SHUGO, ref);
      if (!existsSync(fullPath)) {
        const parentRef = ref.split("/").slice(0, -1).join("/");
        const parentPath = resolve(SHUGO, parentRef);
        if (!existsSync(parentPath)) {
          warn(ctx, `Broken reference in ${filePath}: ${ref}`);
          brokenCount++;
        }
      }
    }
  }

  if (brokenCount === 0) pass(ctx, "No broken references found");
}
