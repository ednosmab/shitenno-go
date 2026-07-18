#!/usr/bin/env node
/**
 * generate-changelog.ts — Auto-generate CHANGELOG.md from git commit messages.
 *
 * Reads git log, categorizes commits by type (feat, fix, chore, docs, etc.),
 * and generates a structured CHANGELOG.md.
 *
 * Usage: node dist/shitenno/scripts/generate-changelog.js [--since <date>] [--output <path>]
 */

import { execSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface ChangelogEntry {
  hash: string;
  type: string;
  scope: string;
  description: string;
  breaking: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  feat: "🚀 Features",
  fix: "🐛 Bug Fixes",
  docs: "📚 Documentation",
  chore: "🔧 Chores",
  refactor: "♻️ Refactoring",
  test: "🧪 Tests",
  perf: "⚡ Performance",
  ci: "👷 CI/CD",
  build: "📦 Build",
  style: "💄 Style",
  revert: "⏪ Reverts",
};

function getGitLog(since?: string): string {
  const sinceArg = since ? `--since="${since}"` : "";
  try {
    return execSync(
      `git log --oneline --no-merges ${sinceArg} --format="%H|%s"`,
      { encoding: "utf-8", timeout: 10000 }
    ).trim();
  } catch {
    return "";
  }
}

function parseCommit(line: string): ChangelogEntry | null {
  const [hash, ...rest] = line.split("|");
  const message = rest.join("|");
  if (!hash || !message) return null;

  const match = message.match(
    /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/
  );
  if (!match) {
    return {
      hash: hash.slice(0, 7),
      type: "other",
      scope: "",
      description: message,
      breaking: false,
    };
  }

  return {
    hash: hash.slice(0, 7),
    type: match[1],
    scope: match[2] || "",
    description: match[4],
    breaking: !!match[3],
  };
}

function generateChangelog(entries: ChangelogEntry[]): string {
  const lines: string[] = [];
  lines.push("# Changelog\n");
  lines.push(
    "> Auto-generated from git commit messages. Last updated: " +
      new Date().toISOString().slice(0, 10)
  );
  lines.push("");

  // Group by type
  const groups: Record<string, ChangelogEntry[]> = {};
  for (const entry of entries) {
    const key = entry.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  // Breaking changes first
  const breaking = entries.filter((e) => e.breaking);
  if (breaking.length > 0) {
    lines.push("## ⚠️ Breaking Changes\n");
    for (const e of breaking) {
      const scope = e.scope ? `**${e.scope}:** ` : "";
      lines.push(`- ${scope}${e.description} (\`${e.hash}\`)`);
    }
    lines.push("");
  }

  // Ordered by type priority
  const typeOrder = ["feat", "fix", "perf", "refactor", "test", "docs", "chore", "ci", "build", "style", "revert", "other"];
  for (const type of typeOrder) {
    const group = groups[type];
    if (!group || group.length === 0) continue;

    const label = TYPE_LABELS[type] || `📝 ${type}`;
    lines.push(`## ${label}\n`);
    for (const e of group) {
      const scope = e.scope ? `**${e.scope}:** ` : "";
      lines.push(`- ${scope}${e.description} (\`${e.hash}\`)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let since: string | undefined;
let outputPath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--since" && args[i + 1]) {
    since = args[i + 1];
    i++;
  } else if (args[i] === "--output" && args[i + 1]) {
    outputPath = args[i + 1];
    i++;
  }
}

const rawLog = getGitLog(since);
if (!rawLog) {
  console.log("No commits found.");
  process.exit(0);
}

const lines = rawLog.split("\n").filter(Boolean);
const entries = lines.map(parseCommit).filter((e): e is ChangelogEntry => e !== null);

const changelog = generateChangelog(entries);

if (outputPath) {
  writeFileSync(outputPath, changelog, "utf-8");
  console.log(`Changelog written to ${outputPath} (${entries.length} commits)`);
} else {
  console.log(changelog);
}
