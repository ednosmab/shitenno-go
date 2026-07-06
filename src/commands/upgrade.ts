/**
 * upgrade.ts — Capability-based Upgrade
 *
 * Substitui o upgrade por níveis (L1→L2→L3) por upgrade por capacidades.
 * O usuário pode adicionar capacidades individuais ou aceitar recomendações.
 */

import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
import { getCapabilityFiles } from "../capability-mapping.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";
import { readManifest, writeManifest, updateManifest } from "../manifest.js";
import { updateSystemMapCapabilityStatus } from "../scaffolder.js";

const { copySync, ensureDirSync } = fse;

function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "templates", "base");
}

export const upgradeCommand = new Command("upgrade")
  .description("Add capabilities to your governance ecosystem")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("-c, --capability <cap>", "Capability to add (knowledge, architecture, governance, ai, quality, metrics, operations, compliance)")
  .option("--list", "List all capabilities and their status")
  .option("--accept-recommended", "Install all recommended capabilities from maturity profile")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;
    const targetDir = resolve(options.dir || ".");

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║  nexus upgrade — Add Capabilities        ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("upgrade", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const installed = detectInstalledCapabilities(ctx.nexusDir);

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
        outputJson({ projectRoot: ctx.projectRoot, installed, capabilities });
      } else {
        displayCapabilityStatus(installed);
      }
      return;
    }

    // Accept recommended capabilities
    if (options.acceptRecommended) {
      const profile = loadMaturityProfile(ctx.nexusDir);
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

      // Update AGENTS.md and SYSTEM_MAP.md with new capability sections
      const allInstalled = [...installed, ...toInstall];
      updateAgentsMdWithCapabilities(targetDir, allInstalled);
      updateSystemMapStatus(targetDir, allInstalled);

      // Update manifest
      const currentManifest = readManifest(ctx.nexusDir);
      const { readFileSync: readFS } = await import("node:fs");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      let cliVersion = "unknown";
      try {
        const pkg = JSON.parse(readFS(join(__dirname, "..", "..", "package.json"), "utf-8"));
        cliVersion = pkg.version || "unknown";
      } catch {
        // Skip
      }
      const updatedManifest = updateManifest(
        currentManifest,
        cliVersion,
        ctx.nexusDir,
        [...installed, ...toInstall],
        profile?.overallScore ?? 0
      );
      writeManifest(ctx.nexusDir, updatedManifest);

      invalidateCache(targetDir);

      // Publish event
      for (const cap of toInstall) {
        getEventBus().publish("capability.installed", { capability: cap, projectRoot: ctx.projectRoot });
        recordFeedback(ctx.nexusDir, {
          recommendationId: `cap-${cap}`,
          action: "accepted",
          context: { maturityScore: 0, installedCapabilities: installed, knowledgeDebt: 0 },
        });
      }

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
      return;
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
      return;
    }

    // Install
      const spinner = ora(`Installing ${capInfo.name}...`).start();
      try {
        const result = installCapabilities(targetDir, [targetCapability as Capability]);
        spinner.succeed(`Installed ${capInfo.name}`);

        // Update AGENTS.md with new capability sections
        updateAgentsMdWithCapabilities(targetDir, [...installed, targetCapability as Capability]);

        // Update SYSTEM_MAP.md capability status indicators
        updateSystemMapStatus(targetDir, [...installed, targetCapability as Capability]);

        // Update manifest
        const currentManifest = readManifest(ctx.nexusDir);
        const { readFileSync: readFS } = await import("node:fs");
        const __filename2 = fileURLToPath(import.meta.url);
        const __dirname2 = dirname(__filename2);
        let cliVersion = "unknown";
        try {
          const pkg = JSON.parse(readFS(join(__dirname2, "..", "..", "package.json"), "utf-8"));
          cliVersion = pkg.version || "unknown";
        } catch {
          // Skip
        }
        const updatedManifest = updateManifest(
          currentManifest,
          cliVersion,
          ctx.nexusDir,
          [...installed, targetCapability as Capability],
          0
        );
        writeManifest(ctx.nexusDir, updatedManifest);

        invalidateCache(targetDir);

      // Publish event
      getEventBus().publish("capability.installed", { capability: targetCapability, projectRoot: ctx.projectRoot });
      recordFeedback(ctx.nexusDir, {
        recommendationId: `cap-${targetCapability}`,
        action: "accepted",
        context: { maturityScore: 0, installedCapabilities: installed, knowledgeDebt: 0 },
      });

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

      // Generate and display context rules
      try {
        const { generateProjectFingerprint, loadFingerprint } = await import("../project-fingerprint.js");
        const { generateRiskMap } = await import("../risk-map.js");
        const { generateContextRules } = await import("../context-rules.js");

        const analysis = (await import("../analyser.js")).analyseProject(targetDir);
        let fingerprint = loadFingerprint(ctx.nexusDir);
        if (!fingerprint) {
          const { saveFingerprint } = await import("../project-fingerprint.js");
          fingerprint = generateProjectFingerprint(targetDir, analysis);
          saveFingerprint(ctx.nexusDir, fingerprint);
        }

        const riskMap = generateRiskMap(targetDir, ctx.nexusDir);
        const contextRules = generateContextRules(fingerprint, riskMap);

        if (contextRules.length > 0 && !isJson) {
          console.log(chalk.bold("  Context-Aware Rules Generated:"));
          for (const rule of contextRules.slice(0, 3)) {
            console.log(chalk.gray(`    • ${rule.rule}`));
          }
          console.log("");
        }
      } catch {
        // Skip context rules on error
      }
    } catch (error) {
      if (isJson) {
        outputJson({ error: "install_failed", message: String(error) });
      } else {
        spinner.fail("Installation failed");
        console.error(chalk.red(`  Error: ${error}`));
      }
      return;
    }
  });

// ── SYSTEM_MAP.md Update ─────────────────────────────────────────────────────

/**
 * Update SYSTEM_MAP.md capability status indicators.
 * Regenerates the file from template with dynamic ✅/📋 status.
 */
function updateSystemMapStatus(
  targetDir: string,
  installedCapabilities: Capability[]
): void {
  const systemMapPath = join(targetDir, "nexus-system", "governance", "SYSTEM_MAP.md");
  if (!existsSync(systemMapPath)) return;

  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, "governance", "SYSTEM_MAP.md");
  if (!existsSync(templatePath)) return;

  // Read template and apply capability status
  let content = readFileSync(templatePath, "utf-8");
  content = updateSystemMapCapabilityStatus(content, installedCapabilities);

  // Write updated file
  writeFileSync(systemMapPath, content, "utf-8");
}

// ── AGENTS.md Update ─────────────────────────────────────────────────────────

/**
 * Update AGENTS.md with new capability sections.
 * Regenerates the file from template with capability filtering.
 */
function updateAgentsMdWithCapabilities(
  targetDir: string,
  installedCapabilities: Capability[]
): void {
  const agentsMdPath = join(targetDir, "nexus-system", "docs", "AGENTS.md");
  if (!existsSync(agentsMdPath)) return;

  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, "docs", "AGENTS.md");
  if (!existsSync(templatePath)) return;

  // Read template
  let content = readFileSync(templatePath, "utf-8");

  // Apply capability filtering
  content = filterAgentsMdByCapabilities(content, installedCapabilities);

  // Write updated file
  writeFileSync(agentsMdPath, content, "utf-8");
}

/**
 * Remove seções de capacidades não instaladas do AGENTS.md.
 */
function filterAgentsMdByCapabilities(
  content: string,
  installedCapabilities: Capability[]
): string {
  const capabilityBlockRegex = /<!-- CAPABILITY: (\w+) -->[\s\S]*?<!-- \/CAPABILITY -->/g;

  return content.replace(capabilityBlockRegex, (match, capability: string) => {
    if (installedCapabilities.includes(capability as Capability)) {
      // Keep the block but remove the comment markers
      return match
        .replace(/<!-- CAPABILITY: \w+ -->\n?/, "")
        .replace(/<!-- \/CAPABILITY -->\n?$/, "");
    }
    // Remove entire block for uninstalled capabilities
    return "";
  });
}

// ── Capability Installation ─────────────────────────────────────────────────

function installCapabilities(
  targetDir: string,
  capabilities: Capability[]
): { filesInstalled: number; directoriesCreated: number } {
  const templatesDir = getTemplatesDir();
  let directoriesCreated = 0;
  let filesInstalled = 0;

  for (const cap of capabilities) {
    const files = getCapabilityFiles(cap);
    for (const file of files) {
      const srcPath = join(templatesDir, file.src);
      const destPath = join(targetDir, file.dest);

      if (existsSync(destPath)) continue;
      if (!existsSync(srcPath)) continue;

      const dir = resolve(destPath, "..");
      if (!existsSync(dir)) {
        ensureDirSync(dir);
        directoriesCreated++;
      }
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
