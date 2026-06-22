import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";

const { copySync, ensureDirSync, readdirSync } = fse;

interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  files: string[];
}

const UPGRADE_OPTIONS: UpgradeOption[] = [
  {
    id: "governance-full",
    name: "Full Governance",
    description: "Add complete governance structure (context buffer, contracts, premortem)",
    files: [
      "governance/context/context_buffer.yaml",
      "governance/agents/AI-CONTRACT-planner-v1.yaml",
      "governance/agents/AI-CONTRACT-reviewer-v1.yaml",
      "governance/contracts/CONTRACTS_INDEX.md",
      "governance/premortem/PREMORTEM.md",
      "governance/reviews/SESSION_REVIEW.md",
    ],
  },
  {
    id: "scripts-full",
    name: "Full Scripts",
    description: "Add all governance scripts (close-session, premortem-check)",
    files: [
      "scripts/close-session.ts",
      "scripts/premortem-check.ts",
    ],
  },
  {
    id: "templates",
    name: "Templates",
    description: "Add ADR, SDR, and Plan templates",
    files: [
      "docs/adrs/ADR-TEMPLATE.md",
      "docs/sdr/SDR-TEMPLATE.md",
      "docs/plans/TEMPLATE.md",
      "docs/plans/README.md",
    ],
  },
  {
    id: "skills-advanced",
    name: "Advanced Skills",
    description: "Add advanced engineering skills",
    files: [
      "docs/skills/architectural_integrity.md",
      "docs/skills/design_patterns.md",
      "docs/skills/error_handling_observability.md",
    ],
  },
];

export const upgradeCommand = new Command("upgrade")
  .description("Upgrade governance capabilities")
  .option("-d, --dir <path>", "Project directory (default: current)", ".")
  .option("-n, --nexus-path <path>", "Path to nexus-system directory")
  .option("--all", "Install all optional components")
  .option("--list", "List available upgrades")
  .action(async (options) => {
    const targetDir = resolve(options.dir);
    const nexusPath = options.nexusPath || process.env.NEXUS_SYSTEM_PATH;

    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║     nexus upgrade — Add Capabilities ║"));
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

    // List available upgrades
    if (options.list) {
      displayUpgradeOptions(targetDir);
      return;
    }

    // Validate nexus-system path
    if (!nexusPath) {
      console.log(
        chalk.red(
          "  ✘ nexus-system path not specified."
        )
      );
      console.log(
        chalk.gray(
          "  Use --nexus-path <path> or set NEXUS_SYSTEM_PATH environment variable."
        )
      );
      console.log("");
      console.log(
        chalk.gray("  Example: nexus upgrade --nexus-path ../nexus-system")
      );
      console.log("");
      return;
    }

    const nexusDir = resolve(nexusPath);
    if (!existsSync(nexusDir)) {
      console.log(
        chalk.red(
          `  ✘ nexus-system directory not found: ${nexusDir}`
        )
      );
      process.exit(1);
    }

    // Select what to install
    let selectedOptions: UpgradeOption[];

    if (options.all) {
      selectedOptions = UPGRADE_OPTIONS;
    } else {
      const { select } = await import("inquirer").then((mod) =>
        mod.default.prompt([
          {
            type: "checkbox",
            name: "select",
            message: "Select components to install:",
            choices: UPGRADE_OPTIONS.map((opt) => {
              const existing = checkExistingFiles(targetDir, opt.files);
              return {
                name: `${opt.name} - ${opt.description}${existing > 0 ? ` (${existing} files exist)` : ""}`,
                value: opt.id,
                checked: existing === 0,
              };
            }),
          },
        ])
      );

      selectedOptions = UPGRADE_OPTIONS.filter((opt) =>
        select.includes(opt.id)
      );

      if (selectedOptions.length === 0) {
        console.log(chalk.gray("  No components selected."));
        console.log("");
        return;
      }
    }

    // Install selected components
    const spinner = ora("Installing components...").start();

    try {
      let filesInstalled = 0;

      for (const option of selectedOptions) {
        for (const file of option.files) {
          const nexusFile = join(nexusDir, file);
          const targetFile = join(targetDir, file);

          if (existsSync(targetFile)) {
            continue; // Skip existing files
          }

          if (!existsSync(nexusFile)) {
            continue; // Skip if not in nexus-system
          }

          ensureDirSync(resolve(targetFile, ".."));
          copySync(nexusFile, targetFile);
          filesInstalled++;
        }
      }

      spinner.succeed(`Installed ${filesInstalled} files`);

      console.log("");
      console.log(chalk.green("  ✔ Upgrade complete!"));
      console.log("");
      console.log(chalk.gray("  Installed components:"));
      for (const option of selectedOptions) {
        console.log(chalk.gray(`    - ${option.name}`));
      }
      console.log("");
    } catch (error) {
      spinner.fail("Upgrade failed");
      console.error(chalk.red(`  Error: ${error}`));
      process.exit(1);
    }
  });

function checkExistingFiles(targetDir: string, files: string[]): number {
  let count = 0;
  for (const file of files) {
    if (existsSync(join(targetDir, file))) {
      count++;
    }
  }
  return count;
}

function displayUpgradeOptions(targetDir: string): void {
  console.log(chalk.bold("  Available upgrades:"));
  console.log("");

  for (const option of UPGRADE_OPTIONS) {
    const existing = checkExistingFiles(targetDir, option.files);
    const total = option.files.length;

    let status: string;
    if (existing === total) {
      status = chalk.green("installed");
    } else if (existing > 0) {
      status = chalk.yellow(`${existing}/${total} installed`);
    } else {
      status = chalk.gray("not installed");
    }

    console.log(`    ${chalk.bold(option.id)}`);
    console.log(`      ${option.description}`);
    console.log(`      Status: ${status}`);
    console.log("");
  }

  console.log(chalk.gray("  Use 'nexus upgrade --all' to install all components."));
  console.log("");
}
