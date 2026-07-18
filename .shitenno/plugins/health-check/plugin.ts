/**
 * health-check Plugin — Demo Plugin for Shugo CLI
 *
 * Provides extra health checks during `shugo audit`.
 * Demonstrates the plugin system with custom-check and custom-recommendation hooks.
 *
 * PRINCIPLE: Plugins extend Shugo without modifying core.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface PluginContext {
  projectRoot: string;
  shitennoDir: string;
  healthReport: unknown;
}

interface PluginRecommendation {
  type: string;
  title: string;
  description: string;
  command?: string;
}

/** Recursively find test files in a directory. */
function findTestFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  let results: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      results = results.concat(findTestFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.js") ||
       entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.js"))
    ) {
      results.push(full);
    }
  }
  return results;
}

const plugin = {
  name: "health-check",
  version: "1.0.0",
  description: "Extra health checks for Shugo projects",

  hooks: {
    /**
     * Custom check hook — runs during `shugo audit`.
     * Adds extra issues to the health report.
     */
    "custom-check": async (context: PluginContext): Promise<string | null> => {
      const { projectRoot, shitennoDir } = context;
      const issues: string[] = [];

      // Check 1: ADRs older than 90 days
      const adrDir = join(shitennoDir, "docs", "adrs");
      if (existsSync(adrDir)) {
        const adrFiles = readdirSync(adrDir).filter(
          (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
        );

        for (const file of adrFiles) {
          const filepath = join(adrDir, file);
          try {
            const stat = statSync(filepath);
            const ageDays = Math.floor(
              (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
            );
            if (ageDays > 90) {
              issues.push(`ADR "${file.replace(".md", "")}" is ${ageDays} days old — consider reviewing`);
            }
          } catch {
            // skip
          }
        }
      }

      // Check 2: No test files found across common directories
      const candidateDirs = ["tests", "test", "src/__tests__", "src"];
      const testFiles = candidateDirs.flatMap((d) => findTestFiles(join(projectRoot, d)));
      if (testFiles.length === 0) {
        issues.push("No test files found — consider adding tests");
      }

      // Check 3: No WORKFLOW.md
      const workflowPath = join(shitennoDir, "governance", "WORKFLOW.md");
      if (!existsSync(workflowPath)) {
        issues.push("No WORKFLOW.md — governance workflow not documented");
      }

      // Check 4: No rules defined
      const rulesDir = join(shitennoDir, "governance", "rules");
      if (existsSync(rulesDir)) {
        const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
        if (ruleFiles.length === 0) {
          issues.push("No rules defined in governance/rules/");
        }
      }

      if (issues.length > 0) {
        return `[health-check] ${issues.length} issue(s):\n${issues.map((i) => `  - ${i}`).join("\n")}`;
      }

      return null;
    },

    /**
     * Custom recommendation hook — runs during `shugo evolve`.
     * Suggests creating an ADR if none exist.
     */
    "custom-recommendation": async (shitennoDir: string): Promise<PluginRecommendation | null> => {
      const adrDir = join(shitennoDir, "docs", "adrs");
      const hasAdrs =
        existsSync(adrDir) &&
        readdirSync(adrDir).filter(
          (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
        ).length > 0;

      if (!hasAdrs) {
        return {
          type: "knowledge_creation",
          title: "Create first ADR (from health-check plugin)",
          description:
            "No Architecture Decision Records found. ADRs document important decisions.",
          command: "shugo init",
        };
      }

      return null;
    },
  },
};

export default plugin;
