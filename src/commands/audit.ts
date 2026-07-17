import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import { auditHealth, writeHealthReport, type HealthAuditReport, issueFingerprint } from "../health-auditor.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { healthBar, outputJson, banner } from "../formatting.js";
import { output, outputBlank } from "../output.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { getHookBus } from "../plugin-system.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { discoverArtifacts, discoverRelations, analyzeGraph } from "../knowledge-graph.js";
import { appendBacklogSection, issueToBacklogItem, type BacklogItem } from "../backlog-writer.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";
import { generateFixSuggestions, prioritizeSuggestions } from "../audit/suggestion-engine.js";
import { muteLogs } from "../logger.js";
import { loadSuppressions, addSuppression } from "../audit/suppression.js";
import { applyAllFixes, type AutofixReport } from "../audit/autofix-engine.js";
import { getChangedFiles } from "../audit/changed-files.js";
import { checkPolicyGate } from "../decision-core/policy-gate.js";
import { PolicyEngine, FilePolicyRepository } from "../policy-engine.js";
import { dimensionIcon, dimensionLabel, type AuditDimension } from "../audit/dimensions.js";
import { categorizeIssues, groupByType, formatTypeGroup, groupOptimizationsByAction, identifyQuickWins } from "./audit/reporter.js";

// ── Subcommand: audit suppress ───────────────────────────────────────────────

export const auditSuppressCommand = new Command("suppress")
  .description("Suppress a specific audit issue by fingerprint")
  .argument("<fingerprint>", "Issue fingerprint (10-char hex from audit output)")
  .requiredOption("--reason <text>", "Reason for suppression (required)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .action(async (fingerprint: string, options) => {
    const ctx = guardNotInitialized(options, false);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitenDir, false);

    const suppressions = loadSuppressions(ctx.shitenDir);
    const existing = suppressions.find((s) => s.fingerprint === fingerprint);
    if (existing) {
      output(chalk.yellow(`  ⚠ Issue ${fingerprint} is already suppressed.`));
      output(chalk.gray(`    Reason: ${existing.reason}`));
      output(chalk.gray(`    Suppressed at: ${existing.suppressedAt}`));
      return;
    }

    const reportsDir = join(ctx.shitenDir, "reports");
    let foundIssue: { type: string; location: string; description: string } | null = null;
    try {
      const { readdirSync, readFileSync: fsReadFileSync } = await import("node:fs");
      const files = readdirSync(reportsDir)
        .filter((f: string) => f.startsWith("health-") && f.endsWith(".json"))
        .sort()
        .reverse();
      for (const f of files) {
        const reportPath = join(reportsDir, f);
        const reportData: HealthAuditReport = JSON.parse(
          fsReadFileSync(reportPath, "utf-8")
        );
        const match = reportData.issues.find(
          (i) => issueFingerprint(i) === fingerprint
        );
        if (match) {
          foundIssue = match;
          break;
        }
        const suppressedMatch = reportData.suppressedIssues?.find(
          (i) => issueFingerprint(i) === fingerprint
        );
        if (suppressedMatch) {
          foundIssue = suppressedMatch;
          break;
        }
      }
    } catch { /* reports dir may not exist */ }

    if (!foundIssue) {
      output(chalk.red(`  ✘ Issue ${fingerprint} not found in any recent report.`));
      output(chalk.gray("    Run 'shiten audit --json' first to see available fingerprints."));
      return;
    }

    addSuppression(
      ctx.shitenDir,
      foundIssue as import("../audit/types.js").HealthIssue,
      options.reason,
      "user"
    );

    output(chalk.green(`  ✔ Issue ${fingerprint} suppressed successfully.`));
    output(chalk.gray(`    Type: ${foundIssue.type}`));
    output(chalk.gray(`    Location: ${foundIssue.location}`));
    output(chalk.gray(`    Reason: ${options.reason}`));
    output(chalk.gray("    The issue will not appear in future audits."));
    output(chalk.gray("    Use 'shiten audit --show-suppressed' to review suppressed issues."));
  });

// ── Main audit command ───────────────────────────────────────────────────────

export const auditCommand = new Command("audit")
  .description("Audit Shitenno-go health (Phase 3)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("-l, --level <level>", "Audit level: quick, standard, code-review, enterprise (default: standard)", "standard")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--auto-backlog", "Auto-detect gaps and add to BACKLOG.md")
  .option("--min-confidence <0..1>", "Filter issues below this confidence threshold", parseFloat)
  .option("--show-suppressed", "Show suppressed issues with reasons")
  .option("--apply", "Apply high-confidence fixes automatically (with verification and rollback)")
  .option("--dry-run", "Simulate --apply without writing changes (use with --apply)")
  .option("--changed [base]", "Audit only files changed since base branch (default: main)")
  .addCommand(auditSuppressCommand)
  .action(async (options) => {
    const isJson = options.json === true;
    if (isJson) muteLogs();

    if (!isJson) {
      const levelLabel = options.level === "enterprise" ? "enterprise" : options.level === "code-review" ? "code-review" : options.level === "quick" ? "quick" : "standard";
      outputBlank();
      banner("shiten audit", "Health Audit");
      output(chalk.gray(`    Level: ${levelLabel}`));
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitenDir, isJson);

    if (!checkLifecycleGate("audit", ctx.projectRoot, ctx.shitenDir, isJson)) return;

    const spinner = isJson ? null : ora("Auditing governance health...").start();

    try {
      const level = ["quick", "standard", "code-review", "enterprise"].includes(options.level) ? options.level : "standard";

      // Handle --changed flag for incremental scanning
      let changedFiles: string[] | undefined;
      if (options.changed) {
        const baseBranch = typeof options.changed === "string" ? options.changed : "main";
        const changedResult = getChangedFiles(ctx.projectRoot, baseBranch);
        
        if (!changedResult.isGitRepo) {
          if (!isJson) {
            output(chalk.yellow("  ⚠ Not a git repository — falling back to full scan."));
            outputBlank();
          }
        } else if (changedResult.fallbackToFull) {
          if (!isJson) {
            output(chalk.yellow(`  ⚠ Base branch '${baseBranch}' not found — falling back to full scan.`));
            outputBlank();
          }
        } else if (changedResult.files.length === 0) {
          if (!isJson) {
            output(chalk.green("  ✔ No changed files detected since " + baseBranch + ". Nothing to audit."));
            outputBlank();
          }
          return;
        } else {
          changedFiles = changedResult.files;
          if (!isJson) {
            output(chalk.gray(`  📁 Scanning ${changedFiles.length} changed file(s) since ${baseBranch}...`));
            outputBlank();
          }
        }
      }

      const growthProfile = loadGrowthProfile(ctx.shitenDir);

      let report: HealthAuditReport;
      let cacheHit = false;
      if (options.cache !== false && level !== "code-review" && level !== "enterprise") {
        const cached = getCached<HealthAuditReport>(ctx.projectRoot, ctx.shitenDir, "health",
          () => computeKeyChecksums(ctx.projectRoot, ctx.shitenDir));
        if (cached) {
          report = cached;
          cacheHit = true;
        } else {
          report = auditHealth(ctx.projectRoot, ctx.shitenDir, level, changedFiles);
          setCache(ctx.projectRoot, ctx.shitenDir, "health", report,
            computeKeyChecksums(ctx.projectRoot, ctx.shitenDir));
        }
      } else {
        report = auditHealth(ctx.projectRoot, ctx.shitenDir, level, changedFiles);
      }

      if (options.minConfidence !== undefined && options.minConfidence >= 0 && options.minConfidence <= 1) {
        report = { ...report, issues: report.issues.filter((i) => (i.confidence ?? 1.0) >= options.minConfidence) };
      }

      const reportFile = writeHealthReport(ctx.shitenDir, report);

      const artifacts = discoverArtifacts(ctx.shitenDir);
      const relations = discoverRelations(artifacts);
      const graphAnalysis = analyzeGraph(artifacts, relations);

      getEventBus().publish("knowledge.analyzed", {
        totalArtifacts: graphAnalysis.totalArtifacts,
        totalRelations: graphAnalysis.totalRelations,
        healthScore: graphAnalysis.healthScore,
      });

      if (spinner) {
        spinner.succeed(`Audit complete — code health: ${report.healthScore}/100`);
      }

      if (!isJson) {
        outputBlank();
        output(chalk.bold("  📏 What Was Measured:"));
        outputBlank();
        output(chalk.gray(`    Duration:         ${report.durationMs}ms`));
        output(chalk.gray(`    Files scanned:    ${report.filesScanned}`));
        output(chalk.gray(`    Detectors run:    ${report.detectorsRun.length}`));
        output(chalk.gray(`    Rules evaluated:  ${report.totalRules}`));
        output(chalk.gray(`    History sessions: ${report.historyEntries}`));
        outputBlank();
        output(chalk.bold("  📊 Health Card:"));
        outputBlank();
        const dimensions: AuditDimension[] = ["security", "reliability", "complexity", "hygiene", "coverage", "governance"];
        for (const dim of dimensions) {
          const score = report.dimensionScores[dim] ?? 100;
          const icon = dimensionIcon(dim);
          const label = dimensionLabel(dim);
          const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
          output(`    ${icon} ${label.padEnd(15)} ${color(`${score}/100`)}`);
        }
        outputBlank();
        outputBlank();
      }

      if (isJson) {
        let autofixReportJson: AutofixReport | undefined;
        if (options.apply && report.issues.length > 0) {
          const suggestions = generateFixSuggestions(report.issues as Parameters<typeof generateFixSuggestions>[0], []);
          const prioritized = prioritizeSuggestions(suggestions);
          if (prioritized.length > 0) {
            const policyEngineJson = new PolicyEngine(new FilePolicyRepository(ctx.shitenDir));
            const policyCheckJson = checkPolicyGate(
              { type: "apply_autofix", params: { suggestionCount: prioritized.length } },
              { trigger: "manual", eventData: {}, projectRoot: ctx.projectRoot, shitenDir: ctx.shitenDir, timestamp: new Date().toISOString() },
              policyEngineJson
            );
            if (policyCheckJson.allowed) {
              autofixReportJson = applyAllFixes(prioritized, ctx.projectRoot, {
                dryRun: options.dryRun === true,
              });
            }
          }
        }
        outputJson({
          projectRoot: ctx.projectRoot,
          level: report.level,
          healthScore: report.healthScore,
          dimensionScores: report.dimensionScores,
          totalRules: report.totalRules,
          historyEntries: report.historyEntries,
          sessionsAnalyzed: report.sessionsAnalyzed,
          filesScanned: report.filesScanned,
          detectorsRun: report.detectorsRun,
          durationMs: report.durationMs,
          issues: report.issues,
          suppressedIssues: report.suppressedIssues,
          autofixReport: autofixReportJson ?? null,
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

      if (cacheHit) {
        output(chalk.gray("  📦 Used cached results"));
      }
      outputBlank();
      output(chalk.bold("  🏥 Health Audit Results:"));
      outputBlank();
      output(chalk.gray(`    Rules:           ${report.totalRules}`));
      output(chalk.gray(`    History entries:  ${report.historyEntries}`));
      output(chalk.gray(`    Issues found:    ${report.issues.length}`));
      output(chalk.gray(`    Optimizations:   ${report.optimizations.length}`));
      const datePlaceholders = report.issues.filter((i) => i.type === "date_placeholder").length;
      const emptyDirs = report.issues.filter((i) => i.type === "empty_dir").length;
      const brokenRefs = report.issues.filter((i) => i.type === "broken_ref").length;
      const missingGitignore = report.issues.filter((i) => i.type === "missing_gitignore").length;
      const maturityIssues = report.issues.filter((i) => i.type === "maturity_inconsistency").length;
      const adrGaps = report.issues.filter((i) => i.type === "adr_coverage_gap").length;
      if (datePlaceholders > 0) output(chalk.gray(`    Date placeholders: ${datePlaceholders}`));
      if (emptyDirs > 0) output(chalk.gray(`    Empty directories: ${emptyDirs}`));
      if (brokenRefs > 0) output(chalk.gray(`    Broken references: ${brokenRefs}`));
      if (missingGitignore > 0) output(chalk.gray(`    Missing .gitignore: ${missingGitignore}`));
      if (maturityIssues > 0) output(chalk.gray(`    Maturity issues:   ${maturityIssues}`));
      if (adrGaps > 0) output(chalk.gray(`    ADR coverage gaps: ${adrGaps}`));
      const testFailures = report.issues.filter((i) => i.type === "test_failure").length;
      const orphanModules = report.issues.filter((i) => i.type === "orphan_module").length;
      const oversizedFiles = report.issues.filter((i) => i.type === "oversized_file").length;
      const lintErrors = report.issues.filter((i) => i.type === "lint_error").length;
      const missingTests = report.issues.filter((i) => i.type === "missing_test").length;
      const anyTypeUsage = report.issues.filter((i) => i.type === "any_type_usage").length;
      const typeErrors = report.issues.filter((i) => i.type === "type_error").length;
      const consoleLogs = report.issues.filter((i) => i.type === "console_log_outside_cmd").length;
      if (testFailures > 0) output(chalk.red(`    Test failures:      ${testFailures}`));
      if (orphanModules > 0) output(chalk.gray(`    Orphan modules:     ${orphanModules}`));
      if (oversizedFiles > 0) output(chalk.gray(`    Oversized files:    ${oversizedFiles}`));
      if (lintErrors > 0) output(chalk.yellow(`    Lint errors:        ${lintErrors}`));
      if (missingTests > 0) output(chalk.gray(`    Missing tests:      ${missingTests}`));
      if (anyTypeUsage > 0) output(chalk.gray(`    Any type usage:     ${anyTypeUsage}`));
      if (typeErrors > 0) output(chalk.yellow(`    Type errors:        ${typeErrors}`));
      if (consoleLogs > 0) output(chalk.gray(`    Console.log:        ${consoleLogs}`));
      const emptyCatchBlocks = report.issues.filter((i) => i.type === "empty_catch").length;
      const circularDeps = report.issues.filter((i) => i.type === "circular_dep").length;
      const highComplexity = report.issues.filter((i) => i.type === "high_complexity").length;
      const unusedExports = report.issues.filter((i) => i.type === "unused_export").length;
      const deadCode = report.issues.filter((i) => i.type === "dead_code").length;
      if (emptyCatchBlocks > 0) output(chalk.yellow(`    Empty catch blocks: ${emptyCatchBlocks}`));
      if (circularDeps > 0) output(chalk.red(`    Circular deps:      ${circularDeps}`));
      if (highComplexity > 0) output(chalk.yellow(`    High complexity:    ${highComplexity}`));
      if (unusedExports > 0) output(chalk.gray(`    Unused exports:     ${unusedExports}`));
      if (deadCode > 0) output(chalk.gray(`    Dead code:          ${deadCode}`));
      const unpinnedVersions = report.issues.filter((i) => i.type === "unpinned_version").length;
      const missingLockFile = report.issues.filter((i) => i.type === "missing_lock_file").length;
      const lockFileDrift = report.issues.filter((i) => i.type === "lock_file_drift").length;
      const phantomDeps = report.issues.filter((i) => i.type === "phantom_dep").length;
      const deprecatedPackages = report.issues.filter((i) => i.type === "deprecated_package").length;
      if (unpinnedVersions > 0) output(chalk.yellow(`    Unpinned versions:  ${unpinnedVersions}`));
      if (missingLockFile > 0) output(chalk.red(`    Missing lock file:  ${missingLockFile}`));
      if (lockFileDrift > 0) output(chalk.yellow(`    Lock file drift:    ${lockFileDrift}`));
      if (phantomDeps > 0) output(chalk.yellow(`    Phantom deps:       ${phantomDeps}`));
      if (deprecatedPackages > 0) output(chalk.yellow(`    Deprecated pkgs:    ${deprecatedPackages}`));
      outputBlank();

      output(chalk.bold("    Code Health:"));
      output(`      ${report.healthScore}/100  ${healthBar(report.healthScore, 100)}`);
      outputBlank();

      output(chalk.bold("  📊 Knowledge Graph:"));
      outputBlank();
      const graphColor = graphAnalysis.healthScore >= 70 ? chalk.green
        : graphAnalysis.healthScore >= 40 ? chalk.yellow : chalk.red;
      output(`    Health:  ${graphColor(graphAnalysis.healthScore + "/100")}  ${healthBar(graphAnalysis.healthScore, 100)}`);
      output(`    Artifacts: ${graphAnalysis.totalArtifacts} | Relations: ${graphAnalysis.totalRelations}`);
      outputBlank();

      if (graphAnalysis.orphanArtifacts.length > 0) {
        output(chalk.yellow(`    ⚠ ${graphAnalysis.orphanArtifacts.length} orphaned artifact(s):`));
        for (const orphan of graphAnalysis.orphanArtifacts.slice(0, 5)) {
          output(chalk.gray(`      - ${orphan.name} (${orphan.type})`));
        }
        outputBlank();
      }

      if (graphAnalysis.hubArtifacts.length > 0) {
        output(chalk.cyan("    🔗 Top Hubs:"));
        for (const hub of graphAnalysis.hubArtifacts.slice(0, 5)) {
          output(chalk.gray(`      - ${hub.artifact.name}: ${hub.connectionCount} connection(s)`));
        }
        outputBlank();
      }

      if (graphAnalysis.suggestions.length > 0) {
        output(chalk.blue("    💡 Suggestions:"));
        for (const suggestion of graphAnalysis.suggestions) {
          output(chalk.gray(`      - ${suggestion}`));
        }
        outputBlank();
      }

      if (report.issues.length === 0) {
        output(chalk.green("  ✔ No issues found. Governance is healthy!"));
        outputBlank();
      } else {
        const categorized = categorizeIssues(report.issues);

        if (categorized.critical.length > 0) {
          output(chalk.bold("  🚨 Critical Issues (require immediate attention):"));
          outputBlank();
          for (const issue of categorized.critical.slice(0, 5)) {
            output(`    🔴 ${chalk.red("[CRITICAL]")} ${issue.description}`);
            output(chalk.gray(`       Location: ${issue.location}`));
            output(chalk.gray(`       Fix: ${issue.recommendation}`));
            outputBlank();
          }
          if (categorized.critical.length > 5) {
            output(chalk.gray(`    ... and ${categorized.critical.length - 5} more critical issues`));
            outputBlank();
          }
        }

        if (categorized.warnings.length > 0) {
          output(chalk.bold("  ⚠️  Warnings (should be addressed):"));
          outputBlank();
          for (const issue of categorized.warnings.slice(0, 5)) {
            output(`    🟡 ${chalk.yellow("[WARNING]")} ${issue.description}`);
            output(chalk.gray(`       Location: ${issue.location}`));
            output(chalk.gray(`       Fix: ${issue.recommendation}`));
            outputBlank();
          }
          if (categorized.warnings.length > 5) {
            output(chalk.gray(`    ... and ${categorized.warnings.length - 5} more warnings`));
            outputBlank();
          }
        }

        if (categorized.info.length > 0) {
          output(chalk.bold("  ℹ️  Info (informational, low priority):"));
          outputBlank();
          const groupedByType = groupByType(categorized.info);
          for (const [type, issues] of Object.entries(groupedByType)) {
            const first = issues[0];
            if (first && issues.length === 1) {
              output(chalk.gray(`    • ${first.description}`));
            } else {
              output(chalk.gray(`    • ${formatTypeGroup(type, issues)}`));
            }
          }
          outputBlank();
        }

        const quickWins = identifyQuickWins(report.issues);
        if (quickWins.length > 0) {
          output(chalk.bold("  ⚡ Quick Wins (low effort, high impact):"));
          outputBlank();
          for (const win of quickWins.slice(0, 5)) {
            output(chalk.green(`    ✔ ${win.description}`));
            output(chalk.gray(`       Effort: ${win.effort} | Impact: ${win.impact}`));
          }
          outputBlank();
        }

        if (report.issues.length > 0) {
          const suggestions = generateFixSuggestions(report.issues as Parameters<typeof generateFixSuggestions>[0], []);
          const prioritized = prioritizeSuggestions(suggestions);
          if (prioritized.length > 0) {
            output(chalk.bold("  🔧 Top Fix Suggestions (auto-generated):"));
            outputBlank();
            for (const s of prioritized.slice(0, 3)) {
              output(chalk.cyan(`    ${s.description}`));
              output(chalk.gray(`       File: ${s.file} | Confidence: ${Math.round(s.confidence * 100)}%`));
            }
            outputBlank();
          }

          if (options.apply && prioritized.length > 0) {
            output(chalk.bold("  🔧 Applying high-confidence fixes..."));
            outputBlank();

            const policyEngine = new PolicyEngine(new FilePolicyRepository(ctx.shitenDir));
            const policyCheck = checkPolicyGate(
              { type: "apply_autofix", params: { suggestionCount: prioritized.length } },
              { trigger: "manual", eventData: {}, projectRoot: ctx.projectRoot, shitenDir: ctx.shitenDir, timestamp: new Date().toISOString() },
              policyEngine
            );
            if (!policyCheck.allowed) {
              output(chalk.red(`  ✘ Blocked by policy: ${policyCheck.reason}`));
              outputBlank();
            } else {
              const autofixReport: AutofixReport = applyAllFixes(prioritized, ctx.projectRoot, {
                dryRun: options.dryRun === true,
              });
              output(chalk.gray(`    Total: ${autofixReport.total} | Applied: ${autofixReport.applied} | Reverted: ${autofixReport.reverted} | Skipped: ${autofixReport.skipped}`));
              outputBlank();
              for (const result of autofixReport.results) {
                const icon = result.status === "applied" ? "✔" : result.status === "reverted" ? "✘" : "⊘";
                const color = result.status === "applied" ? chalk.green : result.status === "reverted" ? chalk.red : chalk.gray;
                output(color(`    ${icon} ${result.suggestion.description} (${result.status})`));
                if (result.reason) {
                  output(chalk.gray(`       Reason: ${result.reason}`));
                }
              }
              outputBlank();
              if (autofixReport.reverted > 0) {
                output(chalk.yellow("  ⚠ Some fixes were reverted due to verification failure."));
                output(chalk.gray("    Files were restored to their original state."));
                outputBlank();
              }
            }
          }
        }

        if (report.optimizations.length > 0) {
          output(chalk.bold("  🔧 Proposed Optimizations:"));
          outputBlank();
          const optByAction = groupOptimizationsByAction(report.optimizations);
          for (const [action, opts] of Object.entries(optByAction)) {
            output(chalk.cyan(`    ${action}: ${opts.length} item(s)`));
          }
          output(chalk.yellow("  ⚠ These are PROPOSALS only. Manual approval required."));
          outputBlank();
        }
      }

      if (reportFile) {
        output(chalk.gray(`  📄 Report saved: shitenno-go/reports/${reportFile}`));
        outputBlank();
      }

      try {
        const { generateDynamicRules } = await import("../dynamic-rules.js");
        const dynamicRules = generateDynamicRules(ctx.projectRoot, ctx.shitenDir);

        if (dynamicRules.length > 0 && !isJson) {
          output(chalk.bold("  🚨 Dynamic Rules (from History):"));
          outputBlank();
          for (const rule of dynamicRules.slice(0, 5)) {
            const severityIcon = rule.severity === "critical" ? "🔴" : rule.severity === "high" ? "🟡" : "ℹ️";
            output(`    ${severityIcon} ${rule.rule}`);
            output(chalk.gray(`      Evidence: ${rule.evidence}`));
            outputBlank();
          }
        }
      } catch {
        // Skip dynamic rules on error
      }

      output(chalk.bold("  📝 Summary:"));
      output(chalk.gray(`    ${report.summary}`));
      outputBlank();

      if (options.showSuppressed && report.suppressedIssues.length > 0) {
        output(chalk.bold("  🚫 Suppressed Issues:"));
        outputBlank();
        for (const issue of report.suppressedIssues) {
          const fp = issueFingerprint(issue);
          output(chalk.gray(`    [${fp}] ${issue.description}`));
          output(chalk.gray(`      Reason: ${issue.suppressionReason}`));
        }
        outputBlank();
      }

      output(formatGrowthProgress(growthProfile));
      outputBlank();

      const auditStatus = report.healthScore >= 70 ? "healthy" : report.healthScore >= 40 ? "degraded" : "critical";
      getEventBus().publish("health.checked", {
        status: auditStatus,
        healthScore: report.healthScore,
          dimensionScores: report.dimensionScores,
        issues: report.issues.map((i) => i.description),
        checksRun: report.totalRules,
      });

      if (options.autoBacklog) {
        const today = new Date().toISOString().slice(0, 10);
        const backlogItems: BacklogItem[] = [];

        report.issues.forEach((issue, idx) => {
          backlogItems.push(issueToBacklogItem(issue, today, "SA", idx + 1));
        });

        if (graphAnalysis.orphanArtifacts.length > 0) {
          backlogItems.push({
            id: `SA${backlogItems.length + 1}`,
            title: `${graphAnalysis.orphanArtifacts.length} artifacts orfaos no knowledge graph`,
            severity: "Alto",
            priority: "P1",
            source: "shiten audit",
            date: today,
            modules: ["shitenno-go/"],
            description: `${graphAnalysis.orphanArtifacts.length} artifacts no knowledge graph sem relacoes conectando-os.`,
            correction: "Adicionar relacoes entre artifacts orfaos e existentes.",
          });
        }

        if (backlogItems.length > 0) {
          const backlogPath = join(ctx.shitenDir, "docs", "BACKLOG.md");
          const result = appendBacklogSection(backlogPath, backlogItems, today);

          if (!isJson) {
            output(chalk.bold("  📋 Auto-backlog:"));
            output(chalk.green(`    ✔ ${result.itemsAdded} item(s) adicionado(s) ao backlog`));
            if (result.itemsSkipped > 0) {
              output(chalk.gray(`    ⊘ ${result.itemsSkipped} item(s) duplicado(s) ignorado(s)`));
            }
            outputBlank();
          }
        }
      }

      const hookBus = getHookBus();
      const customResults = await hookBus.collectHook("custom-check", async (plugin) => {
        if (plugin.hooks?.["custom-check"]) {
          return await plugin.hooks["custom-check"]({
            projectRoot: ctx.projectRoot,
            shitenDir: ctx.shitenDir,
            healthReport: report,
          });
        }
        return null;
      });
      if (customResults.length > 0 && !isJson) {
        output(chalk.bold("  🔌 Custom Checks:"));
        for (const result of customResults) {
          if (result) output(chalk.gray(`    ${result}`));
        }
        outputBlank();
      }

    } catch (error) {
      if (isJson) {
        outputJson({ error: "audit_failed", message: String(error) });
      } else {
        if (spinner) spinner.fail("Health audit failed");
        output(chalk.red(`  Error: ${error}`));
        outputBlank();
      }
    }
  });
