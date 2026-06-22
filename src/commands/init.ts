import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { analyseProject } from "../analyser.js";
import { askQuestions } from "../prompts.js";
import { scaffoldL1 } from "../scaffolder.js";

export const initCommand = new Command("init")
  .description("Initialize nexus governance framework in this project")
  .option("-d, --dir <path>", "Target directory (default: current)", ".")
  .action(async (options) => {
    const targetDir = resolve(options.dir);

    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║     nexus init — Governance Setup    ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log("");

    // Check if already initialized
    if (existsSync(resolve(targetDir, "opencode.json"))) {
      console.log(
        chalk.yellow(
          "  ⚠ nexus is already initialized in this directory."
        )
      );
      console.log(
        chalk.gray("  Use 'nexus upgrade' to add more capabilities.")
      );
      console.log("");
      return;
    }

    // Analyse project
    const analyseSpinner = ora("Analysing project...").start();
    const analysis = analyseProject(targetDir);
    analyseSpinner.succeed("Project analysis complete");

    // Show what was detected
    console.log("");
    console.log(chalk.bold("  Detected:"));
    console.log(
      `    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`
    );
    console.log(
      `    Packages:  ${analysis.packageCount}`
    );
    console.log(
      `    Apps:      ${analysis.appCount}`
    );
    console.log(
      `    Source:    ${analysis.sourceFileCount} files`
    );
    console.log(
      `    Manager:   ${analysis.packageManager}`
    );
    console.log(
      `    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`
    );
    console.log(
      `    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`
    );
    console.log("");

    // Ask user questions
    console.log(chalk.bold("  Configure your governance:"));
    console.log("");
    const answers = await askQuestions(analysis);

    // Scaffold
    const scaffoldSpinner = ora("Installing governance framework...").start();
    try {
      const result = scaffoldL1(targetDir, answers);
      scaffoldSpinner.succeed("Framework installed!");

      // Show results
      console.log("");
      console.log(chalk.bold.green("  ✓ Nexus Governance Framework installed!"));
      console.log("");
      console.log(chalk.bold("  Files created:"));
      for (const file of result.filesCreated) {
        console.log(chalk.gray(`    ${file}`));
      }
      console.log("");
      console.log(chalk.bold("  Directories created:"));
      for (const dir of result.directoriesCreated) {
        console.log(chalk.gray(`    ${dir}/`));
      }
      console.log("");
      console.log(chalk.bold("  Next steps:"));
      console.log(chalk.gray("    1. Edit docs/AGENTS.md to customise rules"));
      console.log(chalk.gray("    2. Edit opencode.json to set your AI models"));
      console.log(chalk.gray("    3. Run 'nexus status' to check governance health"));
      console.log("");
      console.log(
        chalk.bold.cyan(
          "  Level: L1 (Base) — for solo devs and small projects"
        )
      );
      console.log(
        chalk.gray(
          "  When you grow, run 'nexus upgrade' to add governance."
        )
      );
      console.log("");
    } catch (error) {
      scaffoldSpinner.fail("Failed to install framework");
      console.error(chalk.red(`  Error: ${error}`));
      process.exit(1);
    }
  });
