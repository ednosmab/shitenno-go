// ── Helper Functions for Issue Categorization & Formatting ───────────────────

export function categorizeIssues(issues: Array<{ severity: number; type: string; description: string; location: string; recommendation: string }>): {
  critical: typeof issues;
  warnings: typeof issues;
  info: typeof issues;
} {
  return {
    critical: issues.filter((i) => i.severity === 3),
    warnings: issues.filter((i) => i.severity === 2),
    info: issues.filter((i) => i.severity === 1),
  };
}

export function groupByType(issues: Array<{ type: string; description: string }>): Record<string, typeof issues> {
  const groups: Record<string, typeof issues> = {};
  for (const issue of issues) {
    const key = issue.type;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(issue);
  }
  return groups;
}

export function formatTypeGroup(type: string, issues: Array<{ description: string; location?: string }>): string {
  const typeLabels: Record<string, string> = {
    unused_export: "Unused exports",
    empty_catch: "Empty catch blocks",
    orphan_module: "Orphan modules",
    console_log_outside_cmd: "Console.log usage",
    high_complexity: "High complexity",
    dead_code: "Dead code",
    oversized_file: "Oversized files",
  };
  const label = typeLabels[type] || type;

  // For unused exports, group by file
  if (type === "unused_export" && issues.length > 3) {
    const byFile: Record<string, number> = {};
    for (const issue of issues) {
      const fileMatch = issue.location?.match(/src\/([^:]+)/);
      const file = fileMatch?.[1] ?? "unknown";
      byFile[file] = (byFile[file] || 0) + 1;
    }
    const fileList = Object.entries(byFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file, count]) => `${file}(${count})`)
      .join(", ");
    return `${label}: ${issues.length} total — top files: ${fileList}`;
  }

  return `${label}: ${issues.length} issue(s)`;
}

export function groupOptimizationsByAction(opts: Array<{ action: string }>): Record<string, typeof opts> {
  const groups: Record<string, typeof opts> = {};
  for (const opt of opts) {
    const key = opt.action;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(opt);
  }
  return groups;
}

export interface QuickWin {
  description: string;
  effort: string;
  impact: string;
}

export function identifyQuickWins(issues: Array<{ type: string; severity: number; description: string; location: string }>): QuickWin[] {
  const quickWins: QuickWin[] = [];

  // Date placeholders - easy to fix
  const datePlaceholders = issues.filter((i) => i.type === "date_placeholder");
  if (datePlaceholders.length > 0) {
    quickWins.push({
      description: `Update ${datePlaceholders.length} date placeholder(s) to real dates`,
      effort: "5 min",
      impact: "Medium",
    });
  }

  // Missing .gitignore
  const missingGitignore = issues.filter((i) => i.type === "missing_gitignore");
  if (missingGitignore.length > 0) {
    quickWins.push({
      description: "Add .gitignore file",
      effort: "2 min",
      impact: "High",
    });
  }

  // Empty directories
  const emptyDirs = issues.filter((i) => i.type === "empty_dir");
  if (emptyDirs.length > 3) {
    quickWins.push({
      description: `Remove ${emptyDirs.length} empty directories`,
      effort: "5 min",
      impact: "Low",
    });
  }

  // Broken references
  const brokenRefs = issues.filter((i) => i.type === "broken_ref");
  if (brokenRefs.length > 0) {
    quickWins.push({
      description: `Fix ${brokenRefs.length} broken file reference(s)`,
      effort: "10 min",
      impact: "Medium",
    });
  }

  // Missing package.json
  const missingPackageJson = issues.filter((i) => i.type === "missing_package_json");
  if (missingPackageJson.length > 0) {
    quickWins.push({
      description: "Add missing package.json",
      effort: "2 min",
      impact: "High",
    });
  }

  return quickWins;
}
