import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { auditHealth, writeHealthReport } from "../health-auditor.js";
import { detectNexusProject } from "../utils.js";

export const auditCommand = new Command("audit")
  .description("Audit Nexus governance health (Phase 3)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .action(async (options) => {
    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║    nexus audit — Health Audit        ║"));
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

    const spinner = ora("Auditing governance health...").start();

    try {
      const report = auditHealth(projectRoot, nexusDir);
      spinner.succeed(`Audit complete — health score: ${report.healthScore}/100`);

      console.log("");
      console.log(chalk.bold("  🏥 Health Audit Results:"));
      console.log("");
      console.log(chalk.gray(`    Rules:           ${report.totalRules}`));
      console.log(chalk.gray(`    History entries:  ${report.historyEntries}`));
      console.log(chalk.gray(`    Issues found:    ${report.issues.length}`));
      console.log(chalk.gray(`    Optimizations:   ${report.optimizations.length}`));
      console.log("");

      // Health score
      const scoreColor =
        report.healthScore >= 80 ? chalk.green :
        report.healthScore >= 50 ? chalk.yellow : chalk.red;
      console.log(chalk.bold("    Health Score:"));
      console.log(scoreColor(`      ${report.healthScore}/100`));
      console.log("");

      if (report.issues.length === 0) {
        console.log(chalk.green("  ✔ No issues found. Governance is healthy!"));
        console.log("");
      } else {
        // Display issues
        console.log(chalk.bold("  🔍 Issues Found:"));
        console.log("");

        for (const issue of report.issues) {
          const icon = issue.severity === 3 ? "🔴" : issue.severity === 2 ? "🟡" : "⚪";
          const sevLabel = issue.severity === 3 ? "CRITICAL" : issue.severity === 2 ? "WARNING" : "INFO";
          const sevColor = issue.severity === 3 ? chalk.red : issue.severity === 2 ? chalk.yellow : chalk.gray;

          console.log(`    ${icon} ${sevColor(`[${sevLabel}]`)} ${issue.description}`);
          console.log(chalk.gray(`       Location: ${issue.location}`));
          console.log(chalk.gray(`       Fix: ${issue.recommendation}`));
          console.log("");
        }

        // Display optimizations
        if (report.optimizations.length > 0) {
          console.log(chalk.bold("  🔧 Proposed Optimizations (require Tech Lead approval):"));
          console.log("");

          for (const opt of report.optimizations) {
            console.log(chalk.cyan(`    ${opt.id}: ${opt.title}`));
            console.log(chalk.gray(`      Action: ${opt.action}`));
            console.log(chalk.gray(`      ${opt.description}`));
            console.log("");
          }

          console.log(chalk.yellow("  ⚠ These are PROPOSALS only. Aprovação manual do Tech Lead necessária."));
        }

        console.log("");
      }

      // Write report (always, even with 0 issues)
      const reportFile = writeHealthReport(nexusDir, report);
      if (reportFile) {
        console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
        console.log("");
      }

      // Summary
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

    } catch (error) {
      spinner.fail("Health audit failed");
      console.log(chalk.red(`  Error: ${error}`));
      console.log("");
    }
  });
