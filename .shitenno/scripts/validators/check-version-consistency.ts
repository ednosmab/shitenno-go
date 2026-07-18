/**
 * Validator: check version consistency.
 */

import { existsSync, readFileSync } from "node:fs";
import { PACKAGE_JSON, CHANGELOG, type ValidatorContext, pass, warn } from "./shared.js";

export function checkVersionConsistency(ctx: ValidatorContext) {
  console.log("\n🏷️  Checking version consistency...\n");

  if (!existsSync(PACKAGE_JSON) || !existsSync(CHANGELOG)) {
    warn(ctx, "package.json or CHANGELOG.md not found — skipping");
    return;
  }

  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
  const pkgVersion = pkg.version;
  const changelogContent = readFileSync(CHANGELOG, "utf-8");
  const changelogMatch = changelogContent.match(/## \[(\d+\.\d+\.\d+)\]/);
  const changelogVersion = changelogMatch ? changelogMatch[1] : null;

  if (changelogVersion && changelogVersion !== pkgVersion) {
    warn(ctx, `Version mismatch: CHANGELOG says ${changelogVersion}, package.json says ${pkgVersion}`, "CHANGELOG.md", false);
  } else if (changelogVersion) {
    pass(ctx, `Version consistent: ${pkgVersion}`);
  } else {
    warn(ctx, "Could not parse version from CHANGELOG.md");
  }
}
