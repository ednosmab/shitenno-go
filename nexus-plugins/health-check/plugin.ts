/**
 * health-check Plugin — Demo Plugin for Nexus CLI
 *
 * Provides extra health checks during `nexus audit`.
 * Demonstrates the plugin system with custom-check and custom-recommendation hooks.
 *
 * PRINCIPLE: Plugins extend Nexus without modifying core.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface PluginContext {
  projectRoot: string;
  nexusDir: string;
  healthReport: unknown;
}

interface PluginRecommendation {
  type: string;
  title: string;
  description: string;
  command?: string;
}

const plugin = {
  name: "health-check",
  version: "1.0.0",
  description: "Extra health checks for Nexus projects",

  hooks: {
    /**
     * Custom check hook — runs during `nexus audit`.
     * Adds extra issues to the health report.
     */
    "custom-check": async (context: PluginContext): Promise<string | null> => {
      const { projectRoot, nexusDir } = context;
      const issues: string[] = [];

      // Check 1: ADRs older than 90 days
      const adrDir = join(nexusDir, "docs", "adrs");
      if (existsSync(adrDir)) {
        const adrFiles = readdirSync(adrDir).filter(
          (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
        );

        for (const file of adrFiles) {
          const filepath = join(adrDir, file);
          try {
            const stat = require("node:fs").statSync(filepath);
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

      // Check 2: No tests directory
      const testsDir = join(projectRoot, "tests");
      const testFiles = existsSync(testsDir)
        ? readdirSync(testsDir).filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.js"))
        : [];
      if (testFiles.length === 0) {
        issues.push("No test files found — consider adding tests");
      }

      // Check 3: No WORKFLOW.md
      const workflowPath = join(nexusDir, "governance", "WORKFLOW.md");
      if (!existsSync(workflowPath)) {
        issues.push("No WORKFLOW.md — governance workflow not documented");
      }

      // Check 4: No rules defined
      const rulesDir = join(nexusDir, "governance", "rules");
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
     * Custom recommendation hook — runs during `nexus evolve`.
     * Suggests creating an ADR if none exist.
     */
    "custom-recommendation": async (nexusDir: string): Promise<PluginRecommendation | null> => {
      const adrDir = join(nexusDir, "docs", "adrs");
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
          command: "nexus init",
        };
      }

      return null;
    },
  },
};

export default plugin;
