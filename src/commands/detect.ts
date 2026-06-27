import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { detectPatterns, writePatternReport, type PatternDetectionReport } from "../pattern-detector.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";

export const detectCommand = new Command("detect")
  .description("Detect patterns in history and propose candidate rules (Phase 2)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║   nexus detect — Pattern Detection   ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("detect", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const spinner = ora("Analyzing history and reports...").start();

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

      if (!isJson) {
        spinner.succeed(`Analyzed ${report.historyEntriesAnalyzed} history entries, ${report.reportsAnalyzed} reports`);
      }

      // JSON output
      if (isJson) {
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
        });
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

      // Publish event
      getEventBus().publish("pattern.detected", {
        projectRoot: ctx.projectRoot,
        patterns: report.patterns.length,
        candidateRules: report.candidateRules.length,
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
      } else {
        spinner.fail("Pattern detection failed");
        console.log(chalk.red(`  Error: ${error}`));
        console.log("");
      }
    }
  });
