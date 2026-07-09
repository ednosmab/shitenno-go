import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import { auditHealth, writeHealthReport, type HealthAuditReport } from "../health-auditor.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { healthBar, outputJson, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { getHookBus } from "../plugin-system.js";
import { discoverArtifacts, discoverRelations, analyzeGraph } from "../knowledge-graph.js";
import { appendBacklogSection, issueToBacklogItem, type BacklogItem } from "../backlog-writer.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";

// ── Helper Functions for Issue Categorization ──────────────────────────────

function categorizeIssues(issues: Array<{ severity: number; type: string; description: string; location: string; recommendation: string }>): {
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

function groupByType(issues: Array<{ type: string; description: string }>): Record<string, typeof issues> {
  const groups: Record<string, typeof issues> = {};
  for (const issue of issues) {
    const key = issue.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(issue);
  }
  return groups;
}

function formatTypeGroup(type: string, issues: Array<{ description: string; location?: string }>): string {
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

function groupOptimizationsByAction(opts: Array<{ action: string }>): Record<string, typeof opts> {
  const groups: Record<string, typeof opts> = {};
  for (const opt of opts) {
    const key = opt.action;
    if (!groups[key]) groups[key] = [];
    groups[key].push(opt);
  }
  return groups;
}

interface QuickWin {
  description: string;
  effort: string;
  impact: string;
}

function identifyQuickWins(issues: Array<{ type: string; severity: number; description: string; location: string }>): QuickWin[] {
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

export const auditCommand = new Command("audit")
  .description("Audit Nexus System health (Phase 3)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("-l, --level <level>", "Audit level: quick, standard, code-review, enterprise (default: standard)", "standard")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--auto-backlog", "Auto-detect gaps and add to BACKLOG.md")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      const levelLabel = options.level === "enterprise" ? "enterprise" : options.level === "code-review" ? "code-review" : options.level === "quick" ? "quick" : "standard";
      console.log("");
      banner("nexus audit", "Health Audit");
      console.log(chalk.gray(`    Level: ${levelLabel}`));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("audit", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const spinner = isJson ? null : ora("Auditing governance health...").start();

    try {
      // Validate level
      const level = ["quick", "standard", "code-review", "enterprise"].includes(options.level) ? options.level : "standard";

      // Load growth profile (needed for both JSON and human output)
      const growthProfile = loadGrowthProfile(ctx.nexusDir);

      // Check cache first (skip cache for code-review and enterprise to get fresh results)
      let report: HealthAuditReport;
      let cacheHit = false;
      if (options.cache !== false && level !== "code-review" && level !== "enterprise") {
        const cached = getCached<HealthAuditReport>(ctx.projectRoot, ctx.nexusDir, "health",
          () => computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));
        if (cached) {
          report = cached;
          cacheHit = true;
        } else {
          report = auditHealth(ctx.projectRoot, ctx.nexusDir, level);
          setCache(ctx.projectRoot, ctx.nexusDir, "health", report,
            computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));
        }
      } else {
        report = auditHealth(ctx.projectRoot, ctx.nexusDir, level);
      }

      // Write report (always, even with 0 issues)
      const reportFile = writeHealthReport(ctx.nexusDir, report);

      // Knowledge graph analysis
      const artifacts = discoverArtifacts(ctx.nexusDir);
      const relations = discoverRelations(artifacts);
      const graphAnalysis = analyzeGraph(artifacts, relations);

      // Publish knowledge graph event
      getEventBus().publish("knowledge.analyzed", {
        totalArtifacts: graphAnalysis.totalArtifacts,
        totalRelations: graphAnalysis.totalRelations,
        healthScore: graphAnalysis.healthScore,
      });

      if (spinner) {
        spinner.succeed(`Audit complete — code health: ${report.healthScore}/100`);
      }

      // What was measured section
      if (!isJson) {
        console.log("");
        console.log(chalk.bold("  📏 What Was Measured:"));
        console.log("");
        console.log(chalk.gray(`    Duration:         ${report.durationMs}ms`));
        console.log(chalk.gray(`    Files scanned:    ${report.filesScanned}`));
        console.log(chalk.gray(`    Detectors run:    ${report.detectorsRun.length}`));
        console.log(chalk.gray(`    Rules evaluated:  ${report.totalRules}`));
        console.log(chalk.gray(`    History sessions: ${report.historyEntries}`));
        console.log("");
      }

      // JSON output
      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          level: report.level,
          healthScore: report.healthScore,
          totalRules: report.totalRules,
          historyEntries: report.historyEntries,
          sessionsAnalyzed: report.sessionsAnalyzed,
          issues: report.issues,
          issueCounts: {
            total: report.issues.length,
            critical: report.issues.filter((i) => i.severity === 3).length,
            warning: report.issues.filter((i) => i.severity === 2).length,
            info: report.issues.filter((i) => i.severity === 1).length,
            datePlaceholders: report.issues.filter((i) => i.type === "date_placeholder").length,
            emptyDirs: report.issues.filter((i) => i.type === "empty_dir").length,
            brokenRefs: report.issues.filter((i) => i.type === "broken_ref").length,
            missingGitignore: report.issues.filter((i) => i.type === "missing_gitignore").length,
            maturityInconsistency: report.issues.filter((i) => i.type === "maturity_inconsistency").length,
            adrCoverageGap: report.issues.filter((i) => i.type === "adr_coverage_gap").length,
            // Engineering audit dimensions
            testFailures: report.issues.filter((i) => i.type === "test_failure").length,
            orphanModules: report.issues.filter((i) => i.type === "orphan_module").length,
            oversizedFiles: report.issues.filter((i) => i.type === "oversized_file").length,
            lintErrors: report.issues.filter((i) => i.type === "lint_error").length,
            missingTests: report.issues.filter((i) => i.type === "missing_test").length,
            anyTypeUsage: report.issues.filter((i) => i.type === "any_type_usage").length,
            typeErrors: report.issues.filter((i) => i.type === "type_error").length,
            consoleLogs: report.issues.filter((i) => i.type === "console_log_outside_cmd").length,
            emptyCatchBlocks: report.issues.filter((i) => i.type === "empty_catch").length,
            circularDeps: report.issues.filter((i) => i.type === "circular_dep").length,
            highComplexity: report.issues.filter((i) => i.type === "high_complexity").length,
            unusedExports: report.issues.filter((i) => i.type === "unused_export").length,
            deadCode: report.issues.filter((i) => i.type === "dead_code").length,
            // Supply chain
            unpinnedVersions: report.issues.filter((i) => i.type === "unpinned_version").length,
            missingLockFile: report.issues.filter((i) => i.type === "missing_lock_file").length,
            lockFileDrift: report.issues.filter((i) => i.type === "lock_file_drift").length,
            phantomDeps: report.issues.filter((i) => i.type === "phantom_dep").length,
            deprecatedPackages: report.issues.filter((i) => i.type === "deprecated_package").length,
          },
          optimizations: report.optimizations,
          summary: report.summary,
          knowledgeGraph: {
            totalArtifacts: graphAnalysis.totalArtifacts,
            totalRelations: graphAnalysis.totalRelations,
            healthScore: graphAnalysis.healthScore,
            orphanCount: graphAnalysis.orphanArtifacts.length,
            hubCount: graphAnalysis.hubArtifacts.length,
            suggestions: graphAnalysis.suggestions,
          },
          cacheHit,
          reportFile: reportFile || null,
          auditedAt: report.auditedAt,
          growthProfile: {
            growthCapacity: growthProfile.growthCapacity,
            challengeLevel: growthProfile.challengeLevel,
            pattern: growthProfile.patterns[0]?.type || "balanced",
            totalChoices: growthProfile.pathHistory.length,
          },
        });
        return;
      }

      // Human-readable output
      if (cacheHit) {
        console.log(chalk.gray("  📦 Used cached results"));
      }
      console.log("");
      console.log(chalk.bold("  🏥 Health Audit Results:"));
      console.log("");
      console.log(chalk.gray(`    Rules:           ${report.totalRules}`));
      console.log(chalk.gray(`    History entries:  ${report.historyEntries}`));
      console.log(chalk.gray(`    Issues found:    ${report.issues.length}`));
      console.log(chalk.gray(`    Optimizations:   ${report.optimizations.length}`));
      // New issue type counts
      const datePlaceholders = report.issues.filter((i) => i.type === "date_placeholder").length;
      const emptyDirs = report.issues.filter((i) => i.type === "empty_dir").length;
      const brokenRefs = report.issues.filter((i) => i.type === "broken_ref").length;
      const missingGitignore = report.issues.filter((i) => i.type === "missing_gitignore").length;
      const maturityIssues = report.issues.filter((i) => i.type === "maturity_inconsistency").length;
      const adrGaps = report.issues.filter((i) => i.type === "adr_coverage_gap").length;
      if (datePlaceholders > 0) console.log(chalk.gray(`    Date placeholders: ${datePlaceholders}`));
      if (emptyDirs > 0) console.log(chalk.gray(`    Empty directories: ${emptyDirs}`));
      if (brokenRefs > 0) console.log(chalk.gray(`    Broken references: ${brokenRefs}`));
      if (missingGitignore > 0) console.log(chalk.gray(`    Missing .gitignore: ${missingGitignore}`));
      if (maturityIssues > 0) console.log(chalk.gray(`    Maturity issues:   ${maturityIssues}`));
      if (adrGaps > 0) console.log(chalk.gray(`    ADR coverage gaps: ${adrGaps}`));
      // Engineering audit dimensions
      const testFailures = report.issues.filter((i) => i.type === "test_failure").length;
      const orphanModules = report.issues.filter((i) => i.type === "orphan_module").length;
      const oversizedFiles = report.issues.filter((i) => i.type === "oversized_file").length;
      const lintErrors = report.issues.filter((i) => i.type === "lint_error").length;
      const missingTests = report.issues.filter((i) => i.type === "missing_test").length;
      const anyTypeUsage = report.issues.filter((i) => i.type === "any_type_usage").length;
      const typeErrors = report.issues.filter((i) => i.type === "type_error").length;
      const consoleLogs = report.issues.filter((i) => i.type === "console_log_outside_cmd").length;
      if (testFailures > 0) console.log(chalk.red(`    Test failures:      ${testFailures}`));
      if (orphanModules > 0) console.log(chalk.gray(`    Orphan modules:     ${orphanModules}`));
      if (oversizedFiles > 0) console.log(chalk.gray(`    Oversized files:    ${oversizedFiles}`));
      if (lintErrors > 0) console.log(chalk.yellow(`    Lint errors:        ${lintErrors}`));
      if (missingTests > 0) console.log(chalk.gray(`    Missing tests:      ${missingTests}`));
      if (anyTypeUsage > 0) console.log(chalk.gray(`    Any type usage:     ${anyTypeUsage}`));
      if (typeErrors > 0) console.log(chalk.yellow(`    Type errors:        ${typeErrors}`));
      if (consoleLogs > 0) console.log(chalk.gray(`    Console.log:        ${consoleLogs}`));
      // Code quality issues
      const emptyCatchBlocks = report.issues.filter((i) => i.type === "empty_catch").length;
      const circularDeps = report.issues.filter((i) => i.type === "circular_dep").length;
      const highComplexity = report.issues.filter((i) => i.type === "high_complexity").length;
      const unusedExports = report.issues.filter((i) => i.type === "unused_export").length;
      const deadCode = report.issues.filter((i) => i.type === "dead_code").length;
      if (emptyCatchBlocks > 0) console.log(chalk.yellow(`    Empty catch blocks: ${emptyCatchBlocks}`));
      if (circularDeps > 0) console.log(chalk.red(`    Circular deps:      ${circularDeps}`));
      if (highComplexity > 0) console.log(chalk.yellow(`    High complexity:    ${highComplexity}`));
      if (unusedExports > 0) console.log(chalk.gray(`    Unused exports:     ${unusedExports}`));
      if (deadCode > 0) console.log(chalk.gray(`    Dead code:          ${deadCode}`));
      // Supply chain issues
      const unpinnedVersions = report.issues.filter((i) => i.type === "unpinned_version").length;
      const missingLockFile = report.issues.filter((i) => i.type === "missing_lock_file").length;
      const lockFileDrift = report.issues.filter((i) => i.type === "lock_file_drift").length;
      const phantomDeps = report.issues.filter((i) => i.type === "phantom_dep").length;
      const deprecatedPackages = report.issues.filter((i) => i.type === "deprecated_package").length;
      if (unpinnedVersions > 0) console.log(chalk.yellow(`    Unpinned versions:  ${unpinnedVersions}`));
      if (missingLockFile > 0) console.log(chalk.red(`    Missing lock file:  ${missingLockFile}`));
      if (lockFileDrift > 0) console.log(chalk.yellow(`    Lock file drift:    ${lockFileDrift}`));
      if (phantomDeps > 0) console.log(chalk.yellow(`    Phantom deps:       ${phantomDeps}`));
      if (deprecatedPackages > 0) console.log(chalk.yellow(`    Deprecated pkgs:    ${deprecatedPackages}`));
      console.log("");

      // Health score with bar
      console.log(chalk.bold("    Code Health:"));
      console.log(`      ${report.healthScore}/100  ${healthBar(report.healthScore, 100)}`);
      console.log("");

      // Knowledge Graph section
      console.log(chalk.bold("  📊 Knowledge Graph:"));
      console.log("");
      const graphColor = graphAnalysis.healthScore >= 70 ? chalk.green
        : graphAnalysis.healthScore >= 40 ? chalk.yellow : chalk.red;
      console.log(`    Health:  ${graphColor(graphAnalysis.healthScore + "/100")}  ${healthBar(graphAnalysis.healthScore, 100)}`);
      console.log(`    Artifacts: ${graphAnalysis.totalArtifacts} | Relations: ${graphAnalysis.totalRelations}`);
      console.log("");

      if (graphAnalysis.orphanArtifacts.length > 0) {
        console.log(chalk.yellow(`    ⚠ ${graphAnalysis.orphanArtifacts.length} orphaned artifact(s):`));
        for (const orphan of graphAnalysis.orphanArtifacts.slice(0, 5)) {
          console.log(chalk.gray(`      - ${orphan.name} (${orphan.type})`));
        }
        console.log("");
      }

      if (graphAnalysis.hubArtifacts.length > 0) {
        console.log(chalk.cyan("    🔗 Top Hubs:"));
        for (const hub of graphAnalysis.hubArtifacts.slice(0, 5)) {
          console.log(chalk.gray(`      - ${hub.artifact.name}: ${hub.connectionCount} connection(s)`));
        }
        console.log("");
      }

      if (graphAnalysis.suggestions.length > 0) {
        console.log(chalk.blue("    💡 Suggestions:"));
        for (const suggestion of graphAnalysis.suggestions) {
          console.log(chalk.gray(`      - ${suggestion}`));
        }
        console.log("");
      }

      if (report.issues.length === 0) {
        console.log(chalk.green("  ✔ No issues found. Governance is healthy!"));
        console.log("");
      } else {
        // Group issues by category and severity
        const categorized = categorizeIssues(report.issues);

        // Display critical issues first (top 5)
        if (categorized.critical.length > 0) {
          console.log(chalk.bold("  🚨 Critical Issues (require immediate attention):"));
          console.log("");
          for (const issue of categorized.critical.slice(0, 5)) {
            console.log(`    🔴 ${chalk.red("[CRITICAL]")} ${issue.description}`);
            console.log(chalk.gray(`       Location: ${issue.location}`));
            console.log(chalk.gray(`       Fix: ${issue.recommendation}`));
            console.log("");
          }
          if (categorized.critical.length > 5) {
            console.log(chalk.gray(`    ... and ${categorized.critical.length - 5} more critical issues`));
            console.log("");
          }
        }

        // Display warnings (top 5)
        if (categorized.warnings.length > 0) {
          console.log(chalk.bold("  ⚠️  Warnings (should be addressed):"));
          console.log("");
          for (const issue of categorized.warnings.slice(0, 5)) {
            console.log(`    🟡 ${chalk.yellow("[WARNING]")} ${issue.description}`);
            console.log(chalk.gray(`       Location: ${issue.location}`));
            console.log(chalk.gray(`       Fix: ${issue.recommendation}`));
            console.log("");
          }
          if (categorized.warnings.length > 5) {
            console.log(chalk.gray(`    ... and ${categorized.warnings.length - 5} more warnings`));
            console.log("");
          }
        }

        // Display info issues grouped by type (condensed)
        if (categorized.info.length > 0) {
          console.log(chalk.bold("  ℹ️  Info (informational, low priority):"));
          console.log("");
          const groupedByType = groupByType(categorized.info);
          for (const [type, issues] of Object.entries(groupedByType)) {
            const first = issues[0];
            if (first && issues.length === 1) {
              console.log(chalk.gray(`    • ${first.description}`));
            } else {
              console.log(chalk.gray(`    • ${formatTypeGroup(type, issues)}`));
            }
          }
          console.log("");
        }

        // Quick Wins section
        const quickWins = identifyQuickWins(report.issues);
        if (quickWins.length > 0) {
          console.log(chalk.bold("  ⚡ Quick Wins (low effort, high impact):"));
          console.log("");
          for (const win of quickWins.slice(0, 5)) {
            console.log(chalk.green(`    ✔ ${win.description}`));
            console.log(chalk.gray(`       Effort: ${win.effort} | Impact: ${win.impact}`));
          }
          console.log("");
        }

        // Display optimizations (condensed)
        if (report.optimizations.length > 0) {
          console.log(chalk.bold("  🔧 Proposed Optimizations:"));
          console.log("");
          const optByAction = groupOptimizationsByAction(report.optimizations);
          for (const [action, opts] of Object.entries(optByAction)) {
            console.log(chalk.cyan(`    ${action}: ${opts.length} item(s)`));
          }
          console.log(chalk.yellow("  ⚠ These are PROPOSALS only. Manual approval required."));
          console.log("");
        }
      }

      if (reportFile) {
        console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
        console.log("");
      }

      // Generate and display dynamic rules
      try {
        const { generateDynamicRules } = await import("../dynamic-rules.js");
        const dynamicRules = generateDynamicRules(ctx.projectRoot, ctx.nexusDir);

        if (dynamicRules.length > 0 && !isJson) {
          console.log(chalk.bold("  🚨 Dynamic Rules (from History):"));
          console.log("");
          for (const rule of dynamicRules.slice(0, 5)) {
            const severityIcon = rule.severity === "critical" ? "🔴" : rule.severity === "high" ? "🟡" : "ℹ️";
            console.log(`    ${severityIcon} ${rule.rule}`);
            console.log(chalk.gray(`      Evidence: ${rule.evidence}`));
            console.log("");
          }
        }
      } catch {
        // Skip dynamic rules on error
      }

      // Summary
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

      // Growth profile
      console.log(formatGrowthProgress(growthProfile));
      console.log("");

      // Publish event
      const auditStatus = report.healthScore >= 70 ? "healthy" : report.healthScore >= 40 ? "degraded" : "critical";
      getEventBus().publish("health.checked", {
        status: auditStatus,
        healthScore: report.healthScore,
        issues: report.issues.map((i) => i.description),
        checksRun: report.totalRules,
      });

      // Auto-backlog: convert audit issues to backlog items
      if (options.autoBacklog) {
        const today = new Date().toISOString().slice(0, 10);
        const backlogItems: BacklogItem[] = [];

        // Convert audit issues to backlog items
        report.issues.forEach((issue, idx) => {
          backlogItems.push(issueToBacklogItem(issue, today, "SA", idx + 1));
        });

        // Convert knowledge graph suggestions
        if (graphAnalysis.orphanArtifacts.length > 0) {
          backlogItems.push({
            id: `SA${backlogItems.length + 1}`,
            title: `${graphAnalysis.orphanArtifacts.length} artifacts orfaos no knowledge graph`,
            severity: "Alto",
            priority: "P1",
            source: "nexus audit",
            date: today,
            modules: ["nexus-system/"],
            description: `${graphAnalysis.orphanArtifacts.length} artifacts no knowledge graph sem relacoes conectando-os.`,
            correction: "Adicionar relacoes entre artifacts orfaos e existentes.",
          });
        }

        if (backlogItems.length > 0) {
          const backlogPath = join(ctx.nexusDir, "docs", "BACKLOG.md");
          const result = appendBacklogSection(backlogPath, backlogItems, today);

          if (!isJson) {
            console.log(chalk.bold("  📋 Auto-backlog:"));
            console.log(chalk.green(`    ✔ ${result.itemsAdded} item(s) adicionado(s) ao backlog`));
            if (result.itemsSkipped > 0) {
              console.log(chalk.gray(`    ⊘ ${result.itemsSkipped} item(s) duplicado(s) ignorado(s)`));
            }
            console.log("");
          }
        }
      }

      // Execute custom check hooks from plugins
      const hookBus = getHookBus();
      const customResults = await hookBus.collectHook("custom-check", async (plugin) => {
        if (plugin.hooks?.["custom-check"]) {
          return await plugin.hooks["custom-check"]({
            projectRoot: ctx.projectRoot,
            nexusDir: ctx.nexusDir,
            healthReport: report,
          });
        }
        return null;
      });
      if (customResults.length > 0 && !isJson) {
        console.log(chalk.bold("  🔌 Custom Checks:"));
        for (const result of customResults) {
          if (result) console.log(chalk.gray(`    ${result}`));
        }
        console.log("");
      }

    } catch (error) {
      if (isJson) {
        outputJson({ error: "audit_failed", message: String(error) });
      } else {
        if (spinner) spinner.fail("Health audit failed");
        console.log(chalk.red(`  Error: ${error}`));
        console.log("");
      }
    }
  });
