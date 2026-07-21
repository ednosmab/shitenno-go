import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { detectPatterns, writePatternReport, type PatternDetectionReport } from "../pattern-detector.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { outputJson, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";
import { checkAndArchiveDonePlans } from "../plan-lifecycle.js";
import { output, outputBlank, outputSection, outputSuccess, outputError } from "../output.js";
import { logger, muteLogs } from "../logger.js";

export const detectCommand = new Command("detect")
  .description("Detect patterns in history and propose candidate rules (Phase 2)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--format <type>", "Output format: text, json, or markdown (default: text)")
  .option("--approve <ruleId>", "Approve a candidate rule by ID")
  .option("--reject <ruleId>", "Reject a candidate rule by ID")
  .option("--auto", "Non-interactive mode for git hooks (suppresses banner and spinner)")
  .action(async (options) => {
    const isJson = options.json === true;
    if (isJson) muteLogs();
    const isAuto = options.auto === true;
    const format = isJson ? "json" : (String(options.format || "text"));

    if (!isJson && !isAuto) {
      output("");
      banner("shugo detect", "Pattern Detection");
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("detect", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    // ── Approve/Reject mode ────────────────────────────────────────
    if (options.approve || options.reject) {
      const ruleId = options.approve || options.reject;
      const action = options.approve ? "approve" : "reject";

      // Read existing report
      const cached = getCached<PatternDetectionReport>(ctx.projectRoot, ctx.shitennoDir, "patterns",
        () => computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir));

      if (!cached) {
        if (isJson) {
        outputJson({ error: "no_report", message: "No detection report found. Run 'shugo detect' first." });
        } else {
        outputError("No detection report found.");
        output(chalk.gray("    Run 'shugo detect' first."));
        }
        return;
      }

      const rule = cached.candidateRules.find((r) => r.id === ruleId);
      if (!rule) {
        if (isJson) {
        outputJson({ error: "rule_not_found", message: `Rule '${ruleId}' not found in candidate rules.` });
        } else {
        outputError(`Rule '${ruleId}' not found.`);
        output(chalk.gray("    Available rules:"));
        for (const r of cached.candidateRules) {
        output(chalk.gray(`      • ${r.id}: ${r.title}`));
        }
        }
        return;
      }

      // Record the decision
      recordFeedback(ctx.shitennoDir, {
        recommendationId: `rule-${ruleId}`,
        action: action === "approve" ? "accepted" : "rejected",
        context: { maturityScore: 0, installedCapabilities: [], knowledgeDebt: 0 },
      });

      if (isJson) {
        outputJson({ type: "rule_decision", ruleId, action, rule });
      } else {
        const icon = action === "approve" ? "✅" : "❌";
        const color = action === "approve" ? chalk.green : chalk.red;
        output("");
        output(`${icon} ${color(`Rule ${ruleId} ${action}d`)}`);
        output(chalk.gray(`   Title: ${rule.title}`));
        output(chalk.gray(`   Target: ${rule.target}`));
        outputBlank();
      }

      return;
    }

    // Step 2.4: In --auto mode, also check for Done plans to archive
    if (isAuto) {
      try {
        const result = checkAndArchiveDonePlans(ctx.shitennoDir);
        if (result.archived > 0) {
          // Log minimal info for hooks (goes to stderr which is /dev/null usually, but good practice)
          logger.error("detect", `[shugo detect --auto] Archived ${result.archived} plan(s): ${result.archivedIds.join(", ")}`);
        }
      } catch (err) {
        // Don't crash the hook if archiving fails
        logger.error("detect", `[shugo detect --auto] Plan archiving failed: ${err}`);
      }
    }

    const spinner = isAuto ? null : ora("Analyzing history and reports...").start();

    try {
      // Check cache first
      let report: PatternDetectionReport;
      let cacheHit = false;
      if (options.cache !== false) {
        const cached = getCached<PatternDetectionReport>(ctx.projectRoot, ctx.shitennoDir, "patterns",
          () => computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir));
        if (cached) {
          report = cached;
          cacheHit = true;
        } else {
          report = detectPatterns(ctx.projectRoot, ctx.shitennoDir);
          setCache({ projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir, key: "patterns", data: report,
            checksums: computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir) });
        }
      } else {
        report = detectPatterns(ctx.projectRoot, ctx.shitennoDir);
      }

      // Write report
      const reportFile = writePatternReport(ctx.shitennoDir, report);

      if (!isJson && !isAuto) {
        spinner?.succeed(`Analyzed ${report.historyEntriesAnalyzed} history entries, ${report.reportsAnalyzed} reports`);
      }

      // JSON output
      if (format === "json") {
        const growthProfile = loadGrowthProfile(ctx.shitennoDir);
        outputJson({
          projectRoot: ctx.projectRoot,
          historyEntriesAnalyzed: report.historyEntriesAnalyzed,
          reportsAnalyzed: report.reportsAnalyzed,
          patterns: report.patterns,
          candidateRules: report.candidateRules,
          summary: report.summary,
          cacheHit,
          reportFile: reportFile || null,
          detectedAt: report.detectedAt,
          growthProfile: {
            growthCapacity: growthProfile.growthCapacity,
            challengeLevel: growthProfile.challengeLevel,
            pattern: growthProfile.patterns[0]?.type || "balanced",
            totalChoices: growthProfile.pathHistory.length,
          },
        });
        return;
      }

      // Markdown output
      if (format === "markdown") {
        const lines: string[] = [];
        lines.push(`# Pattern Detection Report`);
        lines.push(``);
        lines.push(`**Date:** ${report.detectedAt}`);
        lines.push(`**History entries:** ${report.historyEntriesAnalyzed}`);
        lines.push(`**Reports analyzed:** ${report.reportsAnalyzed}`);
        lines.push(``);

        if (report.patterns.length === 0) {
          lines.push(`✔ No significant patterns detected. System is healthy.`);
        } else {
          lines.push(`## Patterns (${report.patterns.length})`);
          lines.push(``);
          for (const p of report.patterns) {
            lines.push(`### ${p.description}`);
            lines.push(`- **Type:** ${p.type}`);
            lines.push(`- **Severity:** ${p.severity}/5`);
            lines.push(`- **Occurrences:** ${p.occurrences}`);
            lines.push(`- **Affected:** ${p.affectedArea}`);
            if (p.evidence.length > 0) {
              lines.push(`- **Evidence:**`);
              for (const ev of p.evidence) {
                lines.push(`  - ${ev}`);
              }
            }
            lines.push(``);
          }
        }

        if (report.candidateRules.length > 0) {
          lines.push(`## Candidate Rules (${report.candidateRules.length})`);
          lines.push(``);
          for (const r of report.candidateRules) {
            lines.push(`- **${r.id}:** ${r.title}`);
            lines.push(`  - Target: ${r.target}`);
            lines.push(`  - ${r.description}`);
          }
          lines.push(``);
        }

        lines.push(`## Summary`);
        lines.push(`${report.summary}`);
        lines.push(``);

        output(lines.join("\n"));
        return;
      }

      // Human-readable output
      if (cacheHit) {
        output(chalk.gray("  Used cached results"));
      }
      output("");
      outputSection("Detection Results:");
      outputBlank();
      output(chalk.gray(`    History entries analyzed: ${report.historyEntriesAnalyzed}`));
      output(chalk.gray(`    Reports analyzed:        ${report.reportsAnalyzed}`));
      output(chalk.gray(`    Patterns detected:       ${report.patterns.length}`));
      output(chalk.gray(`    Candidate rules:         ${report.candidateRules.length}`));
      outputBlank();

      if (report.patterns.length === 0) {
        outputSuccess("No significant patterns detected. System is healthy.");
        outputBlank();
        return;
      }

      // Display patterns
      outputSection("Patterns Found:");
      outputBlank();

      for (const pattern of report.patterns) {
        const severityColor = pattern.severity >= 4 ? chalk.red : pattern.severity >= 2 ? chalk.yellow : chalk.gray;
        const icon = pattern.type === "recurring_error" ? "🔴" :
                     pattern.type === "reverted_decision" ? "🟡" :
                     pattern.type === "hot_area" ? "🟠" : "⚪";

        output(`    ${icon} ${chalk.bold(pattern.description)}`);
        output(chalk.gray(`       Type: ${pattern.type} | Severity: ${severityColor(pattern.severity + "/5")} | Occurrences: ${pattern.occurrences}`));
        output(chalk.gray(`       Affected: ${pattern.affectedArea}`));
        for (const ev of pattern.evidence.slice(0, 3)) {
          output(chalk.gray(`         • ${ev}`));
        }
        if (pattern.evidence.length > 3) {
          output(chalk.gray(`         ... and ${pattern.evidence.length - 3} more`));
        }
        outputBlank();
      }

      // Display candidate rules
      if (report.candidateRules.length > 0) {
        outputSection("Candidate Rules (require Tech Lead approval):");
        outputBlank();

        for (const rule of report.candidateRules) {
          output(chalk.cyan(`    ${rule.id}: ${rule.title}`));
          output(chalk.gray(`      Target: ${rule.target}`));
          output(chalk.gray(`      ${rule.description}`));
          output(chalk.gray(`      Rule: ${rule.ruleText}`));
          outputBlank();
        }

        output(chalk.yellow("  ⚠ These rules are PROPOSALS only. Aprovação manual do Tech Lead necessária."));
      }

      outputBlank();

      if (reportFile) {
        output(chalk.gray(`  Report saved: shitenno/reports/${reportFile}`));
        outputBlank();
      }

      // Summary
      outputSection("Summary:");
      output(chalk.gray(`    ${report.summary}`));
      outputBlank();

      // Growth profile
      const growthProfile = loadGrowthProfile(ctx.shitennoDir);
      output(formatGrowthProgress(growthProfile));
      outputBlank();

      // Publish event
      const avgConfidence = report.patterns.length > 0
        ? report.patterns.reduce((sum, p) => sum + (p.severity / 5), 0) / report.patterns.length
        : 0;
      getEventBus().publish("pattern.detected", {
        patternType: report.patterns[0]?.type ?? "unknown",
        confidence: avgConfidence,
        patterns: report.patterns.map((p) => ({
          type: p.type,
          description: p.description,
          severity: p.severity,
        })),
      });

      // Record feedback for candidate rules
      for (const rule of report.candidateRules) {
        recordFeedback(ctx.shitennoDir, {
          recommendationId: `rule-${rule.id}`,
          action: "deferred",
          context: { maturityScore: 0, installedCapabilities: [], knowledgeDebt: 0 },
        });
      }

    } catch (error) {
      if (isJson) {
        outputJson({ error: "detection_failed", message: String(error) });
      } else if (!isAuto) {
        spinner?.fail("Pattern detection failed");
        outputError(`Error: ${error}`);
        outputBlank();
      }
    }
  });
