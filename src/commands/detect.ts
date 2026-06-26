import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { detectPatterns, writePatternReport, type PatternDetectionReport } from "../pattern-detector.js";
import { detectNexusProject } from "../utils.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";

export const detectCommand = new Command("detect")
  .description("Detect patterns in history and propose candidate rules (Phase 2)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .action(async (options) => {
    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║   nexus detect — Pattern Detection   ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log("");

    let projectRoot: string;
    let nexusDir: string;

    if (options.dir) {
      projectRoot = resolve(options.dir);
      nexusDir = join(projectRoot, "nexus-system");
    } else {
      const detected = detectNexusProject(process.cwd());
      if (!detected) {
        console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
        console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
        console.log("");
        return;
      }
      projectRoot = detected.root;
      nexusDir = detected.nexusDir;
    }

    if (!existsSync(nexusDir)) {
      console.log(chalk.yellow("  ⚠ nexus-system/ directory not found."));
      console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
      console.log("");
      return;
    }

    const spinner = ora("Analyzing history and reports...").start();

    try {
      // Check cache first
      let report: PatternDetectionReport;
      let cacheHit = false;
      if (options.cache !== false) {
        const cached = getCached<PatternDetectionReport>(projectRoot, nexusDir, "patterns",
          () => computeKeyChecksums(projectRoot, nexusDir));
        if (cached) {
          report = cached;
          cacheHit = true;
        } else {
          report = detectPatterns(projectRoot, nexusDir);
          setCache(projectRoot, nexusDir, "patterns", report,
            computeKeyChecksums(projectRoot, nexusDir));
        }
      } else {
        report = detectPatterns(projectRoot, nexusDir);
      }
      spinner.succeed(`Analyzed ${report.historyEntriesAnalyzed} history entries, ${report.reportsAnalyzed} reports`);

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

      // Write report
      const reportFile = writePatternReport(nexusDir, report);
      if (reportFile) {
        console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
        console.log("");
      }

      // Summary
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

    } catch (error) {
      spinner.fail("Pattern detection failed");
      console.log(chalk.red(`  Error: ${error}`));
      console.log("");
    }
  });
