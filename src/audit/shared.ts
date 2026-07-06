/**
 * Audit module — Shared utility functions
 *
 * Common utilities used across governance and engineering detectors.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_SKIP_PATTERNS } from "./constants.js";
import type { SourceFileInfo, HistoryEntry, HealthIssue } from "./types.js";

/**
 * Collect all .ts source files from the project's src/ directory.
 */
export function collectSourceFiles(projectRoot: string): SourceFileInfo[] {
  const srcDir = join(projectRoot, "src");
  if (!existsSync(srcDir)) return [];

  const result: SourceFileInfo[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !SOURCE_SKIP_PATTERNS.some((p) => p.test(entry.name))) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const lineCount = content.split("\n").length;
          result.push({
            fullPath,
            relPath: fullPath.replace(projectRoot + "/", ""),
            basename: entry.name.replace(/\.ts$/, ""),
            content,
            lineCount,
          });
        } catch { /* skip unreadable files */ }
      }
    }
  };
  walk(srcDir);
  return result;
}

/**
 * Read history entries from nexus-system/docs/history/*.md.
 */
export function readHistory(nexusDir: string): HistoryEntry[] {
  const historyDir = join(nexusDir, "docs", "history");
  if (!existsSync(historyDir)) return [];

  return readdirSync(historyDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .map((file) => {
      const content = readFileSync(join(historyDir, file), "utf-8");
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      return { filename: file, date: dateMatch?.[1] ?? "unknown", content: content.toLowerCase() };
    });
}

/**
 * Read rule names from AGENTS.md.
 */
export function readRules(nexusDir: string): string[] {
  const agentsPath = join(nexusDir, "docs", "AGENTS.md");
  if (!existsSync(agentsPath)) return [];

  const content = readFileSync(agentsPath, "utf-8");
  const rules: string[] = [];
  // Match numbered rules: "1. **RULE NAME**: description"
  const numberedRegex = /^\d+\.\s+\*\*([^*]+)\*\*/gm;
  let match;
  while ((match = numberedRegex.exec(content)) !== null) {
    const rule = match[1];
    if (rule) rules.push(rule.trim());
  }
  return [...new Set(rules)];
}

/**
 * Remove issues duplicadas por (type, description, location).
 */
export function deduplicateIssues(issues: HealthIssue[]): HealthIssue[] {
  const seen = new Map<string, HealthIssue>();
  for (const issue of issues) {
    const key = `${issue.type}|${issue.description}|${issue.location}`;
    if (!seen.has(key)) {
      seen.set(key, issue);
    }
  }
  return Array.from(seen.values());
}
