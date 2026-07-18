/**
 * Validator: check documented directories exist.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SHUGO, type ValidatorContext, pass, warn } from "./shared.js";

const DOCUMENTED_DIRS = [
  "governance/agents/", "governance/context/", "governance/contracts/",
  "governance/handoffs/", "governance/knowledge-graph/", "governance/policies/",
  "governance/premortem/", "governance/reviews/", "governance/rules/",
  "cognition/context/", "cognition/memory/", "cognition/prompts/",
  "core/complexity/", "docs/adrs/", "docs/feedback/", "docs/history/",
  "docs/runbooks/", "docs/skills/", "feedback/records/", "reports/",
  "scripts/", "telemetry/",
];

export function checkDocumentedDirectories(ctx: ValidatorContext) {
  log(ctx, "\n📁 Checking documented directories...\n");
  for (const dir of DOCUMENTED_DIRS) {
    if (existsSync(resolve(SHUGO, dir))) {
      pass(ctx, `Directory exists: ${dir}`);
    } else {
      warn(ctx, `Directory documented but missing: ${dir}`);
    }
  }
}

function log(ctx: ValidatorContext, message: string) {
  if (!ctx.QUIET) console.log(message);
}
