/**
 * Validator: check undocumented directories exist.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SHUGO, type ValidatorContext, pass, warn } from "./shared.js";

const DOCUMENTED_IN_GUIDE = [
  "cognition", "core", "docs", "feedback", "governance",
  "reports", "scripts", "session-feedback", "telemetry",
];

export function checkUndocumentedDirectories(ctx: ValidatorContext) {
  console.log("\n🔍 Checking for undocumented directories...\n");

  const shitennoDirs = readdirSync(SHUGO).filter((f) => {
    try { return statSync(join(SHUGO, f)).isDirectory(); }
    catch { return false; }
  });

  for (const dir of shitennoDirs) {
    if (!DOCUMENTED_IN_GUIDE.includes(dir)) {
      warn(ctx, `Directory exists but not documented in GUIDE: ${dir}/`);
    }
  }
}
