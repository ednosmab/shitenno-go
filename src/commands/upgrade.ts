import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import { invalidateCache } from "../cache.js";

const { copySync, ensureDirSync } = fse;

const LEVEL_ORDER = ["junior", "pleno", "senior"];

interface LevelUpgrade {
  level: string;
  name: string;
  description: string;
  directories: string[];
  files: Array<{ src: string; dest: string }>;
}

const LEVEL_UPGRADES: LevelUpgrade[] = [
  {
    level: "pleno",
    name: "L2 (Intermediária)",
    description: "Governança completa para equipas pleno",
    directories: [
      "nexus-system/governance",
      "nexus-system/governance/context",
      "nexus-system/governance/agents",
    ],
    files: [
      { src: "governance/context/context_buffer.yaml", dest: "nexus-system/governance/context/context_buffer.yaml" },
    ],
  },
  {
    level: "senior",
    name: "L3 (Completa)",
    description: "Governança completa para equipas senior",
    directories: [
      "nexus-system/cognition",
      "nexus-system/cognition/context",
      "nexus-system/cognition/memory",
      "nexus-system/cognition/prompts",
      "nexus-system/governance/contracts",
      "nexus-system/governance/handoffs",
      "nexus-system/governance/policies",
      "nexus-system/governance/premortem",
      "nexus-system/governance/reviews",
      "nexus-system/docs/adrs",
      "nexus-system/docs/feedback",
      "nexus-system/docs/history",
      "nexus-system/docs/layers",
      "nexus-system/docs/plans",
      "nexus-system/docs/roadmaps",
      "nexus-system/docs/sdr",
      "nexus-system/reports",
    ],
    files: [
      { src: "cognition/context/CONTEXT_HIERARCHY.md", dest: "nexus-system/cognition/context/CONTEXT_HIERARCHY.md" },
      { src: "cognition/memory/MEM-operational-state-v1.json", dest: "nexus-system/cognition/memory/MEM-operational-state-v1.json" },
      { src: "cognition/prompts/executor/README.md", dest: "nexus-system/cognition/prompts/executor/README.md" },
      { src: "cognition/prompts/planner/README.md", dest: "nexus-system/cognition/prompts/planner/README.md" },
      { src: "cognition/prompts/reviewer/README.md", dest: "nexus-system/cognition/prompts/reviewer/README.md" },
      { src: "governance/contracts/CONTRACTS_INDEX.md", dest: "nexus-system/governance/contracts/CONTRACTS_INDEX.md" },
      { src: "governance/handoffs/TEMPLATE.md", dest: "nexus-system/governance/handoffs/TEMPLATE.md" },
      { src: "governance/premortem/PREMORTEM.md", dest: "nexus-system/governance/premortem/PREMORTEM.md" },
      { src: "governance/reviews/SESSION_REVIEW.md", dest: "nexus-system/governance/reviews/SESSION_REVIEW.md" },
      { src: "docs/adrs/ADR-TEMPLATE.md", dest: "nexus-system/docs/adrs/ADR-TEMPLATE.md" },
      { src: "docs/sdr/SDR-TEMPLATE.md", dest: "nexus-system/docs/sdr/SDR-TEMPLATE.md" },
      { src: "docs/plans/TEMPLATE.md", dest: "nexus-system/docs/plans/TEMPLATE.md" },
      { src: "docs/session-template.md", dest: "nexus-system/docs/session-template.md" },
      { src: "docs/runbooks/merge.md", dest: "nexus-system/docs/runbooks/merge.md" },
      { src: "docs/reports/README.md", dest: "nexus-system/reports/README.md" },
    ],
  },
];

function getCurrentLevel(targetDir: string): string {
  const nexusDir = join(targetDir, "nexus-system");

  // Check for L3 indicators (cognition)
  if (existsSync(join(nexusDir, "cognition"))) {
    return "senior";
  }

  // Check for L2 indicators (governance)
  if (existsSync(join(nexusDir, "governance"))) {
    return "pleno";
  }

  // Default to L1
  return "junior";
}

function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "templates", "l1");
}

export const upgradeCommand = new Command("upgrade")
  .description("Upgrade governance level")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("-l, --level <level>", "Target level (junior, pleno, senior)")
  .option("--list", "List available upgrades")
  .action(async (options) => {
    const targetDir = resolve(options.dir || ".");

    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║     nexus upgrade — Add Governance  ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log("");

    // Check if project is initialized
    if (!existsSync(resolve(targetDir, "opencode.json"))) {
      console.log(
        chalk.yellow(
          "  ⚠ This project is not initialized with nexus."
        )
      );
      console.log(
        chalk.gray("  Run 'nexus init' first.")
      );
      console.log("");
      return;
    }

    const currentLevel = getCurrentLevel(targetDir);

    // List available upgrades
    if (options.list) {
      displayUpgradeOptions(targetDir, currentLevel);
      return;
    }

    // Determine target level
    let targetLevel = options.level;

    if (!targetLevel) {
      // Interactive selection
      const { select } = await import("inquirer").then((mod) =>
        mod.default.prompt([
          {
            type: "list",
            name: "select",
            message: "Select target governance level:",
            choices: LEVEL_UPGRADES
              .filter((upgrade) => {
                // Only show levels higher than current
                return LEVEL_ORDER.indexOf(upgrade.level) > LEVEL_ORDER.indexOf(currentLevel);
              })
              .map((upgrade) => ({
                name: `${upgrade.name} - ${upgrade.description}`,
                value: upgrade.level,
              })),
          },
        ])
      );
      targetLevel = select;
    }

    // Validate target level
    const upgrade = LEVEL_UPGRADES.find((u) => u.level === targetLevel);
    if (!upgrade) {
      console.log(
        chalk.red(
          `  ✘ Invalid level: ${targetLevel}. Valid levels: junior, pleno, senior`
        )
      );
      process.exit(1);
    }

    // Check if already at this level
    if (currentLevel === targetLevel) {
      console.log(
        chalk.yellow(
          `  ⚠ Already at ${upgrade.name} level.`
        )
      );
      console.log("");
      return;
    }

    // Check if trying to downgrade
    if (LEVEL_ORDER.indexOf(targetLevel) < LEVEL_ORDER.indexOf(currentLevel)) {
      console.log(
        chalk.red(
          `  ✘ Cannot downgrade from ${currentLevel} to ${targetLevel}.`
        )
      );
      console.log("");
      return;
    }

    // Install upgrade
    const spinner = ora(`Upgrading to ${upgrade.name}...`).start();

    try {
      const templatesDir = getTemplatesDir();
      let directoriesCreated = 0;
      let filesInstalled = 0;

      // Create directories
      for (const dir of upgrade.directories) {
        const fullPath = join(targetDir, dir);
        if (!existsSync(fullPath)) {
          ensureDirSync(fullPath);
          directoriesCreated++;
        }
      }

      // Copy files
      for (const file of upgrade.files) {
        const srcPath = join(templatesDir, file.src);
        const destPath = join(targetDir, file.dest);

        if (existsSync(destPath)) {
          continue; // Skip existing files
        }

        if (!existsSync(srcPath)) {
          continue; // Skip if template not found
        }

        ensureDirSync(resolve(destPath, ".."));
        copySync(srcPath, destPath);
        filesInstalled++;
      }

      spinner.succeed(`Upgraded to ${upgrade.name}`);

      console.log("");
      console.log(chalk.green("  ✔ Upgrade complete!"));
      console.log("");
      console.log(chalk.bold("  Changes:"));
      console.log(chalk.gray(`    Directories created: ${directoriesCreated}`));
      console.log(chalk.gray(`    Files installed: ${filesInstalled}`));
      console.log("");
      // Invalidate cache since project structure changed
      invalidateCache(targetDir);

      console.log(chalk.bold("  Next steps:"));
      console.log(chalk.gray("    1. Review the new governance files"));
      console.log(chalk.gray("    2. Customise as needed"));
      console.log(chalk.gray("    3. Run 'nexus status' to verify"));
      console.log("");
    } catch (error) {
      spinner.fail("Upgrade failed");
      console.error(chalk.red(`  Error: ${error}`));
      process.exit(1);
    }
  });

function displayUpgradeOptions(targetDir: string, currentLevel: string): void {
  console.log(chalk.bold("  Current level:"));
  console.log(chalk.cyan(`    ${currentLevel.toUpperCase()}`));
  console.log("");

  console.log(chalk.bold("  Available upgrades:"));
  console.log("");

  for (const upgrade of LEVEL_UPGRADES) {
    const canUpgrade = LEVEL_ORDER.indexOf(upgrade.level) > LEVEL_ORDER.indexOf(currentLevel);

    let status: string;
    if (currentLevel === upgrade.level) {
      status = chalk.green("current");
    } else if (canUpgrade) {
      status = chalk.yellow("available");
    } else {
      status = chalk.gray("not available");
    }

    console.log(`    ${chalk.bold(upgrade.level.toUpperCase())}`);
    console.log(`      ${upgrade.description}`);
    console.log(`      Status: ${status}`);
    console.log("");
  }

  console.log(chalk.gray("  Use 'nexus upgrade --level <level>' to upgrade."));
  console.log("");
}
