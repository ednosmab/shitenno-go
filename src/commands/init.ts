import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { analyseProject } from "../analyser.js";
import { askQuestions } from "../prompts.js";
import { scaffoldNexusSystem } from "../scaffolder.js";
import { invalidateCache } from "../cache.js";

function getLevelInfo(level: string): { name: string; description: string } {
  switch (level) {
    case "junior":
      return {
        name: "L1 (Base)",
        description: "Docs + Scripts — para equipas junior que precisam de guia básico",
      };
    case "pleno":
      return {
        name: "L2 (Intermediária)",
        description: "Docs + Scripts + Governance — para equipas pleno com projectos em crescimento",
      };
    case "senior":
      return {
        name: "L3 (Completa)",
        description: "Tudo — para equipas senior com projectos complexos",
      };
    default:
      return {
        name: "L1 (Base)",
        description: "Docs + Scripts — para equipas junior que precisam de guia básico",
      };
  }
}

export const initCommand = new Command("init")
  .description("Initialize nexus governance framework in this project")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--force", "Force creation inside nexus-cli (not recommended)")
  .action(async (options) => {
    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║     nexus init — Governance Setup    ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log("");

    // Determine project root
    const targetDir = options.dir
      ? resolve(options.dir)
      : resolve(process.cwd());

    // Safety guard: prevent creating inside nexus-cli
    if (targetDir.includes("nexus-cli") && !options.force) {
      console.log(
        chalk.yellow(
          "  ⚠ nexus-system should be created in your project, not inside nexus-cli."
        )
      );
      console.log(
        chalk.gray("  Run from your project root: nexus init")
      );
      console.log(
        chalk.gray("  Or:  nexus init --force (to create inside nexus-cli)")
      );
      console.log("");
      return;
    }

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
      const result = scaffoldNexusSystem(targetDir, answers);
      scaffoldSpinner.succeed("Framework installed!");

      const levelInfo = getLevelInfo(result.level);

      // Show results
      console.log("");
      console.log(chalk.bold.green("  ✓ Nexus Governance Framework installed!"));
      console.log("");
      console.log(chalk.bold("  Level:"));
      console.log(chalk.cyan(`    ${levelInfo.name}`));
      console.log(chalk.gray(`    ${levelInfo.description}`));
      console.log("");
      console.log(chalk.bold("  Structure created:"));
      console.log(chalk.gray("    opencode.json          ← configuration (project root)"));
      console.log(chalk.gray("    nexus-system/          ← governance framework"));
      if (result.level === "junior") {
        console.log(chalk.gray("      ├── docs/"));
        console.log(chalk.gray("      └── scripts/"));
      } else if (result.level === "pleno") {
        console.log(chalk.gray("      ├── docs/"));
        console.log(chalk.gray("      ├── governance/"));
        console.log(chalk.gray("      └── scripts/"));
      } else {
        console.log(chalk.gray("      ├── cognition/"));
        console.log(chalk.gray("      ├── docs/"));
        console.log(chalk.gray("      ├── governance/"));
        console.log(chalk.gray("      └── scripts/"));
      }
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
      console.log(chalk.gray("    1. Edit nexus-system/docs/AGENTS.md to customise rules"));
      console.log(chalk.gray("    2. Edit opencode.json to set your AI models"));
      console.log(chalk.gray("    3. Run 'nexus status' to check governance health"));
      console.log("");
      // Invalidate cache since project structure changed
      invalidateCache(targetDir);

      if (result.level !== "senior") {
        console.log(
          chalk.gray(
            "  When you grow, run 'nexus upgrade --level <pleno|senior>' to add governance."
          )
        );
      }
      console.log("");
    } catch (error) {
      scaffoldSpinner.fail("Failed to install framework");
      console.error(chalk.red(`  Error: ${error}`));
      process.exit(1);
    }
  });
