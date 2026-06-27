/**
 * upgrade.ts — Capability-based Upgrade
 *
 * Substitui o upgrade por níveis (L1→L2→L3) por upgrade por capacidades.
 * O usuário pode adicionar capacidades individuais ou aceitar recomendações.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import { invalidateCache } from "../cache.js";
import { outputJson } from "../formatting.js";
import {
  CAPABILITIES,
  detectInstalledCapabilities,
  loadMaturityProfile,
  type Capability,
} from "../maturity-profile.js";

const { copySync, ensureDirSync } = fse;

function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "templates", "l1");
}

export const upgradeCommand = new Command("upgrade")
  .description("Add capabilities to your governance framework")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("-c, --capability <cap>", "Capability to add (knowledge, architecture, governance, ai, quality, metrics, operations, compliance)")
  .option("--list", "List all capabilities and their status")
  .option("--accept-recommended", "Install all recommended capabilities from maturity profile")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const targetDir = resolve(options.dir || ".");
    const isJson = options.json === true;
    const nexusDir = join(targetDir, "nexus-system");

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║  nexus upgrade — Add Capabilities        ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
      console.log("");
    }

    // Check if project is initialized
    if (!existsSync(resolve(targetDir, "opencode.json"))) {
      if (isJson) {
        outputJson({ error: "not_initialized", message: "Run 'nexus init' first." });
      } else {
        console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
        console.log(chalk.gray("  Run 'nexus init' first."));
        console.log("");
      }
      return;
    }

    const installed = detectInstalledCapabilities(nexusDir);

    // List capabilities
    if (options.list) {
      if (isJson) {
        const capabilities = CAPABILITIES.map((cap) => ({
          id: cap.id,
          name: cap.name,
          description: cap.description,
          status: installed.includes(cap.id) ? "installed" : "available",
          alwaysInstalled: cap.alwaysInstalled,
        }));
        outputJson({ projectRoot: targetDir, installed, capabilities });
      } else {
        displayCapabilityStatus(installed);
      }
      return;
    }

    // Accept recommended capabilities
    if (options.acceptRecommended) {
      const profile = loadMaturityProfile(nexusDir);
      if (!profile) {
        if (isJson) {
          outputJson({ error: "no_profile", message: "No maturity profile found. Run 'nexus init' first." });
        } else {
          console.log(chalk.yellow("  ⚠ No maturity profile found."));
          console.log(chalk.gray("  Run 'nexus init' first to create a maturity profile."));
          console.log("");
        }
        return;
      }

      const toInstall = profile.recommendedCapabilities.filter(
        (cap) => !installed.includes(cap)
      );

      if (toInstall.length === 0) {
        if (isJson) {
          outputJson({ message: "All recommended capabilities already installed", installed });
        } else {
          console.log(chalk.green("  ✔ All recommended capabilities are already installed!"));
          console.log("");
        }
        return;
      }

      const spinner = ora(`Installing ${toInstall.length} capability(ies)...`).start();
      const result = installCapabilities(targetDir, toInstall);
      spinner.succeed(`Installed ${result.filesInstalled} file(s) in ${result.directoriesCreated} directory(ies)`);

      invalidateCache(targetDir);

      if (isJson) {
        outputJson({ installed: toInstall, filesInstalled: result.filesInstalled, directoriesCreated: result.directoriesCreated });
      } else {
        console.log("");
        console.log(chalk.green("  ✔ Capabilities installed!"));
        console.log("");
        for (const cap of toInstall) {
          const info = CAPABILITIES.find((c) => c.id === cap);
          console.log(chalk.cyan(`    ✓ ${info?.name || cap}`));
        }
        console.log("");
      }
      return;
    }

    // Install specific capability
    let targetCapability = options.capability;

    if (!targetCapability) {
      // Interactive selection
      const available = CAPABILITIES.filter(
        (cap) => !cap.alwaysInstalled && !installed.includes(cap.id)
      );

      if (available.length === 0) {
        if (isJson) {
          outputJson({ message: "All capabilities already installed", installed });
        } else {
          console.log(chalk.green("  ✔ All capabilities are already installed!"));
          console.log("");
        }
        return;
      }

      const { select } = await import("inquirer").then((mod) =>
        mod.default.prompt([
          {
            type: "list",
            name: "select",
            message: "Select capability to add:",
            choices: available.map((cap) => ({
              name: `${cap.name} — ${cap.description}`,
              value: cap.id,
            })),
          },
        ])
      );
      targetCapability = select;
    }

    // Validate capability
    const capInfo = CAPABILITIES.find((c) => c.id === targetCapability);
    if (!capInfo) {
      if (isJson) {
        outputJson({ error: "invalid_capability", message: `Invalid capability: ${targetCapability}. Valid: ${CAPABILITIES.map((c) => c.id).join(", ")}` });
      } else {
        console.log(chalk.red(`  ✘ Invalid capability: ${targetCapability}`));
        console.log(chalk.gray(`  Valid: ${CAPABILITIES.map((c) => c.id).join(", ")}`));
      }
      process.exit(1);
    }

    // Check if already installed
    if (installed.includes(targetCapability as Capability)) {
      if (isJson) {
        outputJson({ error: "already_installed", message: `Capability '${targetCapability}' is already installed.`, installed });
      } else {
        console.log(chalk.yellow(`  ⚠ Capability '${capInfo.name}' is already installed.`));
        console.log("");
      }
      return;
    }

    // Check dependencies
    const depsMet = capInfo.requires.every((req) => installed.includes(req));
    if (!depsMet) {
      const missing = capInfo.requires.filter((req) => !installed.includes(req));
      if (isJson) {
        outputJson({ error: "missing_dependencies", message: `Missing dependencies: ${missing.join(", ")}`, missing });
      } else {
        console.log(chalk.red(`  ✘ Missing dependencies: ${missing.join(", ")}`));
        console.log(chalk.gray("  Install these capabilities first."));
      }
      process.exit(1);
    }

    // Install
    const spinner = ora(`Installing ${capInfo.name}...`).start();
    try {
      const result = installCapabilities(targetDir, [targetCapability as Capability]);
      spinner.succeed(`Installed ${capInfo.name}`);

      invalidateCache(targetDir);

      if (isJson) {
        outputJson({ capability: targetCapability, filesInstalled: result.filesInstalled, directoriesCreated: result.directoriesCreated });
      } else {
        console.log("");
        console.log(chalk.green("  ✔ Capability installed!"));
        console.log("");
        console.log(chalk.bold("  Changes:"));
        console.log(chalk.gray(`    Directories created: ${result.directoriesCreated}`));
        console.log(chalk.gray(`    Files installed: ${result.filesInstalled}`));
        console.log("");
      }
    } catch (error) {
      if (isJson) {
        outputJson({ error: "install_failed", message: String(error) });
      } else {
        spinner.fail("Installation failed");
        console.error(chalk.red(`  Error: ${error}`));
      }
      process.exit(1);
    }
  });

// ── Capability Installation ─────────────────────────────────────────────────

function installCapabilities(
  targetDir: string,
  capabilities: Capability[]
): { filesInstalled: number; directoriesCreated: number } {
  const templatesDir = getTemplatesDir();
  let directoriesCreated = 0;
  let filesInstalled = 0;

  // Simplified capability → file mapping for upgrade
  const capabilityFiles: Record<string, Array<{ src: string; dest: string }>> = {
    knowledge: [
      // Skills are copied from skills directory
    ],
    architecture: [
      { src: "docs/adrs/ADR-TEMPLATE.md", dest: "nexus-system/docs/adrs/ADR-TEMPLATE.md" },
      { src: "docs/sdr/SDR-TEMPLATE.md", dest: "nexus-system/docs/sdr/SDR-TEMPLATE.md" },
      { src: "docs/plans/TEMPLATE.md", dest: "nexus-system/docs/plans/TEMPLATE.md" },
      { src: "docs/session-template.md", dest: "nexus-system/docs/session-template.md" },
    ],
    governance: [
      { src: "governance/WORKFLOW.md", dest: "nexus-system/governance/WORKFLOW.md" },
      { src: "governance/context/context_buffer.yaml", dest: "nexus-system/governance/context/context_buffer.yaml" },
    ],
    ai: [
      { src: "governance/agents/AI-CONTRACT-planner-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-planner-v1.yaml" },
      { src: "governance/agents/AI-CONTRACT-executor-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-executor-v1.yaml" },
      { src: "governance/agents/AI-CONTRACT-reviewer-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-reviewer-v1.yaml" },
      { src: "governance/agents/AI-CONTRACT-orchestrator-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-orchestrator-v1.yaml" },
      { src: "governance/contracts/CONTRACTS_INDEX.md", dest: "nexus-system/governance/contracts/CONTRACTS_INDEX.md" },
      { src: "governance/handoffs/TEMPLATE.md", dest: "nexus-system/governance/handoffs/TEMPLATE.md" },
      { src: "cognition/context/CONTEXT_HIERARCHY.md", dest: "nexus-system/cognition/context/CONTEXT_HIERARCHY.md" },
      { src: "cognition/memory/MEM-operational-state-v1.json", dest: "nexus-system/cognition/memory/MEM-operational-state-v1.json" },
    ],
    quality: [
      { src: "scripts/validate-session.ts", dest: "nexus-system/scripts/validate-session.ts" },
    ],
    metrics: [
      { src: "docs/reports/README.md", dest: "nexus-system/reports/README.md" },
    ],
    operations: [
      { src: "scripts/close-session.ts", dest: "nexus-system/scripts/close-session.ts" },
      { src: "scripts/premortem-check.ts", dest: "nexus-system/scripts/premortem-check.ts" },
      { src: "docs/runbooks/merge.md", dest: "nexus-system/docs/runbooks/merge.md" },
    ],
    compliance: [
      { src: "governance/premortem/PREMORTEM.md", dest: "nexus-system/governance/premortem/PREMORTEM.md" },
      { src: "governance/reviews/SESSION_REVIEW.md", dest: "nexus-system/governance/reviews/SESSION_REVIEW.md" },
    ],
  };

  for (const cap of capabilities) {
    const files = capabilityFiles[cap] || [];
    for (const file of files) {
      const srcPath = join(templatesDir, file.src);
      const destPath = join(targetDir, file.dest);

      if (existsSync(destPath)) continue;
      if (!existsSync(srcPath)) continue;

      ensureDirSync(resolve(destPath, ".."));
      copySync(srcPath, destPath);
      filesInstalled++;
    }
  }

  return { filesInstalled, directoriesCreated };
}

// ── Display ─────────────────────────────────────────────────────────────────

function displayCapabilityStatus(installed: string[]): void {
  console.log(chalk.bold("  Capabilities Status:"));
  console.log("");

  for (const cap of CAPABILITIES) {
    const isInstalled = installed.includes(cap.id);
    const icon = isInstalled ? chalk.green("✔") : chalk.gray("□");
    const name = isInstalled ? chalk.bold(cap.name) : chalk.gray(cap.name);
    const status = isInstalled ? chalk.green("installed") : chalk.gray("available");

    console.log(`    ${icon} ${name} — ${chalk.gray(cap.description)} [${status}]`);
  }

  console.log("");
  console.log(chalk.gray("  Use 'nexus upgrade --capability <name>' to add a capability."));
  console.log(chalk.gray("  Use 'nexus upgrade --accept-recommended' to install all recommended."));
  console.log("");
}
