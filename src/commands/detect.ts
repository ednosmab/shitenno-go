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
    const isAuto = options.auto === true;
    const format = isJson ? "json" : (String(options.format || "text"));

    if (!isJson && !isAuto) {
      console.log("");
      banner("nexus detect", "Pattern Detection");
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("detect", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    // ── Approve/Reject mode ────────────────────────────────────────
    if (options.approve || options.reject) {
      const ruleId = options.approve || options.reject;
      const action = options.approve ? "approve" : "reject";

      // Read existing report
      const cached = getCached<PatternDetectionReport>(ctx.projectRoot, ctx.nexusDir, "patterns",
        () => computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));

      if (!cached) {
        if (isJson) {
          outputJson({ error: "no_report", message: "No detection report found. Run 'nexus detect' first." });
        } else {
          console.log(chalk.red("  ✘ No detection report found."));
          console.log(chalk.gray("    Run 'nexus detect' first."));
        }
        return;
      }

      const rule = cached.candidateRules.find((r) => r.id === ruleId);
      if (!rule) {
        if (isJson) {
          outputJson({ error: "rule_not_found", message: `Rule '${ruleId}' not found in candidate rules.` });
        } else {
          console.log(chalk.red(`  ✘ Rule '${ruleId}' not found.`));
          console.log(chalk.gray("    Available rules:"));
          for (const r of cached.candidateRules) {
            console.log(chalk.gray(`      • ${r.id}: ${r.title}`));
          }
        }
        return;
      }

      // Record the decision
      recordFeedback(ctx.nexusDir, {
        recommendationId: `rule-${ruleId}`,
        action: action === "approve" ? "accepted" : "rejected",
        context: { maturityScore: 0, installedCapabilities: [], knowledgeDebt: 0 },
      });

      if (isJson) {
        outputJson({ type: "rule_decision", ruleId, action, rule });
      } else {
        const icon = action === "approve" ? "✅" : "❌";
        const color = action === "approve" ? chalk.green : chalk.red;
        console.log("");
        console.log(`${icon} ${color(`Rule ${ruleId} ${action}d`)}`);
        console.log(chalk.gray(`   Title: ${rule.title}`));
        console.log(chalk.gray(`   Target: ${rule.target}`));
        console.log("");
      }

      return;
    }

    const spinner = isAuto ? null : ora("Analyzing history and reports...").start();

    try {
      // Check cache first
      let report: PatternDetectionReport;
      let cacheHit = false;
      if (options.cache !== false) {
        const cached = getCached<PatternDetectionReport>(ctx.projectRoot, ctx.nexusDir, "patterns",
          () => computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));
        if (cached) {
          report = cached;
          cacheHit = true;
        } else {
          report = detectPatterns(ctx.projectRoot, ctx.nexusDir);
          setCache(ctx.projectRoot, ctx.nexusDir, "patterns", report,
            computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));
        }
      } else {
        report = detectPatterns(ctx.projectRoot, ctx.nexusDir);
      }

      // Write report
      const reportFile = writePatternReport(ctx.nexusDir, report);

      if (!isJson && !isAuto) {
        spinner?.succeed(`Analyzed ${report.historyEntriesAnalyzed} history entries, ${report.reportsAnalyzed} reports`);
      }

      // JSON output
      if (format === "json") {
        const growthProfile = loadGrowthProfile(ctx.nexusDir);
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

        console.log(lines.join("\n"));
        return;
      }

      // Human-readable output
      if (cacheHit) {
        console.log(chalk.gray("  📦 Used cached results"));
      }
      console.log("");
      console.log(chalk.bold("  📊 Detection Results:"));
      console.log("");
      console.log(chalk.gray(`    History entries analyzed: ${report.historyEntriesAnalyzed}`));
      console.log(chalk.gray(`    Reports analyzed:        ${report.reportsAnalyzed}`));
      console.log(chalk.gray(`    Patterns detected:       ${report.patterns.length}`));
      console.log(chalk.gray(`    Candidate rules:         ${report.candidateRules.length}`));
      console.log("");

      if (report.patterns.length === 0) {
        console.log(chalk.green("  ✔ No significant patterns detected. System is healthy."));
        console.log("");
        return;
      }

      // Display patterns
      console.log(chalk.bold("  🔍 Patterns Found:"));
      console.log("");

      for (const pattern of report.patterns) {
        const severityColor = pattern.severity >= 4 ? chalk.red : pattern.severity >= 2 ? chalk.yellow : chalk.gray;
        const icon = pattern.type === "recurring_error" ? "🔴" :
                     pattern.type === "reverted_decision" ? "🟡" :
                     pattern.type === "hot_area" ? "🟠" : "⚪";

        console.log(`    ${icon} ${chalk.bold(pattern.description)}`);
        console.log(chalk.gray(`       Type: ${pattern.type} | Severity: ${severityColor(pattern.severity + "/5")} | Occurrences: ${pattern.occurrences}`));
        console.log(chalk.gray(`       Affected: ${pattern.affectedArea}`));
        for (const ev of pattern.evidence.slice(0, 3)) {
          console.log(chalk.gray(`         • ${ev}`));
        }
        if (pattern.evidence.length > 3) {
          console.log(chalk.gray(`         ... and ${pattern.evidence.length - 3} more`));
        }
        console.log("");
      }

      // Display candidate rules
      if (report.candidateRules.length > 0) {
        console.log(chalk.bold("  📋 Candidate Rules (require Tech Lead approval):"));
        console.log("");

        for (const rule of report.candidateRules) {
          console.log(chalk.cyan(`    ${rule.id}: ${rule.title}`));
          console.log(chalk.gray(`      Target: ${rule.target}`));
          console.log(chalk.gray(`      ${rule.description}`));
          console.log(chalk.gray(`      Rule: ${rule.ruleText}`));
          console.log("");
        }

        console.log(chalk.yellow("  ⚠ These rules are PROPOSALS only. Aprovação manual do Tech Lead necessária."));
      }

      console.log("");

      if (reportFile) {
        console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
        console.log("");
      }

      // Summary
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

      // Growth profile
      const growthProfile = loadGrowthProfile(ctx.nexusDir);
      console.log(formatGrowthProgress(growthProfile));
      console.log("");

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
        recordFeedback(ctx.nexusDir, {
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
        console.log(chalk.red(`  Error: ${error}`));
        console.log("");
      }
    }
  });
