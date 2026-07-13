/**
 * init.ts — Maturity-based Discovery & Installation
 *
 * Substitui a instalação fixa L1/L2/L3 por:
 * 1. Questionário de descoberta (múltiplas categorias)
 * 2. Cálculo de perfil de maturidade (7 dimensões)
 * 3. Recomendação de capacidades
 * 4. Instalação por capacidades modulares
 */

import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
const { copySync } = fse;
import { analyseProject } from "../analyser.js";
import { askQuestions, type UserAnswers } from "../prompts.js";
import { scaffoldNexusSystem } from "../scaffolder.js";
import { invalidateCache } from "../cache.js";
import { loadPlugins, getHookBus } from "../plugin-system.js";
import { guardInteractive } from "../shared.js";
import {
  calculateMaturityProfile,
  saveMaturityProfile,
  recordMaturitySnapshot,
  loadMaturityProfile,
  CAPABILITIES,
  type MaturityProfile,
  type Capability,
} from "../maturity-profile.js";
import { healthBar, banner } from "../formatting.js";
import { saveUserProfile } from "../feedback-engine.js";
import { initializeRules } from "../rule-engine.js";
import { createManifest, writeManifest } from "../manifest.js";
import { getEventBus } from "../event-bus.js";
import type { ProjectAnalysis } from "../analyser.js";
import { logger } from "../logger.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import { installReactiveHooks } from "../git-hooks-installer.js";

function displayMaturityDimensions(profile: MaturityProfile): void {
  const dims = profile.dimensions;
  const dimLabels: Record<string, string> = {
    architecture: "Arquitetura",
    governance: "Governança",
    quality: "Qualidade",
    automation: "Automação",
    ai: "IA",
    documentation: "Documentação",
    observability: "Observabilidade",
  };

  const barWidth = 20;
  for (const [key, label] of Object.entries(dimLabels)) {
    const value = dims[key as keyof typeof dims];
    const filled = Math.round((value / 100) * barWidth);
    const empty = barWidth - filled;
    const color = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
    const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    console.log(`    ${label.padEnd(16)} ${bar} ${chalk.bold(String(value).padStart(3))}%`);
  }
  console.log("");
  console.log(`    ${chalk.bold("Score Geral:")}      ${chalk.bold(String(profile.overallScore))}/100`);
}

function displayCapabilities(profile: MaturityProfile): void {
  const installed = profile.installedCapabilities;
  const recommended = profile.recommendedCapabilities;
  const future = profile.futureCapabilities;

  console.log(chalk.bold("  Capacidades instaladas:"));
  for (const cap of installed) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    console.log(chalk.green(`    ✓ ${info?.name || cap}`));
  }
  console.log("");

  if (recommended.length > 0) {
    console.log(chalk.bold("  Capacidades recomendadas:"));
    for (const cap of recommended) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      console.log(chalk.cyan(`    → ${info?.name || cap} — ${info?.description || ""}`));
    }
    console.log("");
  }

  if (future.length > 0) {
    console.log(chalk.bold("  Capacidades futuras:"));
    for (const cap of future) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      console.log(chalk.gray(`    □ ${info?.name || cap}`));
    }
    console.log("");
  }
}

// ── Starter vs Active Project Detection ────────────────────────────────────

/**
 * Determines if a project is a "starter" (just framework installed, minimal code)
 * vs "active" (has meaningful implementation).
 *
 * Logic: sourceFileCount < 10 AND totalCommits < 1
 * - sourceFileCount counts .ts/.tsx/.js/.jsx/.vue/.svelte (excludes node_modules)
 * - totalCommits uses git rev-list --count HEAD
 */
export function isStarterProject(analysis: ProjectAnalysis): boolean {
  return analysis.sourceFileCount < 10 && analysis.totalCommits < 1;
}


// ── Safety Guard ───────────────────────────────────────────────────────────

/**
 * Determines if init should be blocked because the target is inside nexus-cli.
 * Extracted for testability.
 */
export function shouldBlockInit(targetDir: string, force: boolean): boolean {
  return targetDir.includes("nexus-cli") && !force;
}

export const initCommand = new Command("init")
  .description("Initialize Nexus System ecosystem with maturity-based discovery")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--answers-file <path>", "JSON file with pre-defined answers (skips interactive prompts)")
  .option("--force", "Force creation inside nexus-cli (not recommended)")
  .option("--dry-run", "Show what would be created without writing files")
  .action(async (options) => {
    const isDryRun = options.dryRun === true;
    console.log("");
    banner("nexus init", isDryRun ? "Dry Run — No files will be written" : "Maturity-Based Discovery");
    console.log("");

    // Determine project root
    const targetDir = options.dir
      ? resolve(options.dir)
      : resolve(process.cwd());

    // Safety guard
    if (shouldBlockInit(targetDir, options.force === true)) {
      console.log(chalk.yellow("  ⚠ nexus-system should be created in your project, not inside nexus-cli."));
      console.log(chalk.gray("  Run from your project root: nexus init"));
      console.log(chalk.gray("  Or:  nexus init --force (to create inside nexus-cli)"));
      console.log("");
      return;
    }

    // Check if already initialized
    if (existsSync(resolve(targetDir, NEXUS_DIR_NAME))) {
      console.log(chalk.yellow("  ⚠ Nexus is already initialized in this directory."));
      console.log("");
      console.log(chalk.bold("  Your project has grown — let me re-analyze your maturity:"));
      console.log("");

      // Re-analyse project complexity
      const analyseSpinner = ora("Re-analysing project complexity...").start();
      const analysis = analyseProject(targetDir);
      analyseSpinner.succeed("Project analysis complete");

      // Show what was detected (compare with initial state)
      console.log("");
      console.log(chalk.bold("  Current state:"));
      console.log(`    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`);
      console.log(`    Packages:  ${analysis.packageCount}`);
      console.log(`    Apps:      ${analysis.appCount}`);
      console.log(`    Source:    ${analysis.sourceFileCount} files`);
      console.log(`    Manager:  ${analysis.packageManager}`);
      console.log(`    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`);
      console.log(`    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`);
      console.log(`    CI/CD:     ${analysis.hasCI ? "yes" : chalk.gray("no")}`);
      console.log("");

      // Load previous maturity profile
      const nexusDir = resolve(targetDir, NEXUS_DIR_NAME);
      const previousProfile = loadMaturityProfile(nexusDir);

      if (previousProfile) {
        console.log(chalk.bold("  Previous maturity score:"));
        console.log(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
        console.log("");
      }

      console.log(chalk.gray("  Or:  nexus init --accept-recommended"));
      console.log("");

      return;
    }

    // Step 1: Analyse project
    const analyseSpinner = ora("Analysing project...").start();
    const analysis = analyseProject(targetDir);
    analyseSpinner.succeed("Project analysis complete");

    // Show what was detected
    console.log("");
    console.log(chalk.bold("  Detected:"));
    console.log(`    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`);
    console.log(`    Packages:  ${analysis.packageCount}`);
    console.log(`    Apps:      ${analysis.appCount}`);
    console.log(`    Source:    ${analysis.sourceFileCount} files`);
    console.log(`    Manager:  ${analysis.packageManager}`);
    console.log(`    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`);
    console.log(`    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`);
    console.log(`    CI/CD:     ${analysis.hasCI ? "yes" : chalk.gray("no")}`);
    console.log("");

    // Step 2: Get answers (interactive or from file)
    let answers: UserAnswers;
    if (options.answersFile) {
      const answersPath = resolve(options.answersFile);
      if (!existsSync(answersPath)) {
        console.log(chalk.red(`  ✘ Answers file not found: ${answersPath}`));
        process.exitCode = 1;
        return;
      }
      const raw = readFileSync(answersPath, "utf-8");
      answers = JSON.parse(raw);
      console.log(chalk.gray(`  Loaded answers from ${options.answersFile}`));
    } else {
      // Guard against non-interactive environments
      if (!guardInteractive(options, false)) return;

      console.log(chalk.bold("  Answer a few questions to determine your maturity profile:"));
      console.log("");
      answers = await askQuestions(analysis);
    }

    // Step 3: Calculate maturity profile
    const profileSpinner = ora("Calculating maturity profile...").start();      const nexusDir = resolve(targetDir, NEXUS_DIR_NAME);
    const profile = calculateMaturityProfile(answers.maturity, analysis, nexusDir);
    profileSpinner.succeed("Maturity profile calculated");

    // Step 4: Display maturity profile
    console.log("");
    console.log(chalk.bold.green("  ═══ Maturity Profile ═══"));
    console.log("");
    displayMaturityDimensions(profile);
    console.log("");
    displayCapabilities(profile);

    // Dry-run: show what would be installed and return
    if (isDryRun) {
      const capsToInstall: Capability[] = ["core", ...profile.recommendedCapabilities];
      console.log(chalk.bold.green("  ═══ Dry Run — Would install ═══"));
      console.log("");
      console.log(chalk.bold("  Capabilities:"));
      for (const cap of capsToInstall) {
        const info = CAPABILITIES.find((c) => c.id === cap);
        console.log(chalk.green(`    ✓ ${info?.name || cap}`));
      }
      console.log("");
      console.log(chalk.bold("  Files that would be created:"));
      console.log(chalk.gray("    opencode.json"));
      console.log(chalk.gray("    nexus-system/ (governance ecosystem)"));
      for (const dir of ["governance", "docs", "skills", "scripts", "telemetry"] as string[]) {
        console.log(chalk.gray(`      ${dir}/`));
      }
      console.log("");
      console.log(chalk.gray("  Run without --dry-run to apply changes."));
      console.log("");
      return;
    }

    // Step 5: Scaffold by capabilities
    const scaffoldSpinner = ora("Installing governance ecosystem...").start();
    const nexusDirForEvents = resolve(targetDir, NEXUS_DIR_NAME);
    const previousProfile = existsSync(nexusDirForEvents) ? loadMaturityProfile(nexusDirForEvents) : null;
    try {
      // Determine which capabilities to install (recommended + selected)
      const capsToInstall: Capability[] = ["core", ...profile.recommendedCapabilities];

      // Allow user to customize if they want more
      const result = scaffoldNexusSystem(targetDir, answers, capsToInstall);
      scaffoldSpinner.succeed("Framework installed!");

      // Initialize default rules if governance/rules is empty
      initializeRules(nexusDir);

      // Save maturity profile
      saveMaturityProfile(nexusDir, profile);
      recordMaturitySnapshot(nexusDir, profile);

      // Create installation manifest for change detection
      const { readFileSync: readFS } = await import("node:fs");
      let cliVersion = "unknown";
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const pkg = JSON.parse(readFS(join(__dirname, "..", "..", "package.json"), "utf-8"));
        cliVersion = pkg.version || "unknown";
      } catch (error) {
        logger.debug("init", "Suppressed error", { error });
      }
      const manifest = createManifest(cliVersion, nexusDir, capsToInstall, profile.overallScore);
      writeManifest(nexusDir, manifest);

      // Save user profile for personalized feedback
      if (answers.userProfile) {
        saveUserProfile(nexusDir, {
          name: answers.userProfile.name,
          role: answers.userProfile.role,
          architecture: answers.userProfile.architecture,
          coding: answers.userProfile.coding,
          leadership: answers.userProfile.leadership,
          tone: answers.userProfile.tone,
          language: answers.userProfile.language,
          codeFreePercent: answers.userProfile.codeFreePercent,
          focusAreas: answers.userProfile.focusAreas,
        });
      }

      // Generate project fingerprint
      const { generateProjectFingerprint, saveFingerprint } = await import("../project-fingerprint.js");
      const fingerprint = generateProjectFingerprint(targetDir, analysis, profile.overallScore);
      saveFingerprint(nexusDir, fingerprint);

      // Generate initial BRIEFING.md
      try {
        const { generateRiskMap } = await import("../risk-map.js");
        const { generateBriefing, briefingToMarkdown } = await import("../briefing.js");
        const riskMap = generateRiskMap(targetDir, nexusDir);
        const briefing = generateBriefing(fingerprint, riskMap, [], [], profile);
        const briefingPath = join(nexusDir, "BRIEFING.md");
        writeFileSync(briefingPath, briefingToMarkdown(briefing), "utf-8");
      } catch (error) {
        logger.debug("init", "Suppressed error", { error });
      }

      // Display results
      console.log("");
      console.log(chalk.bold.green("  ✓ Nexus System Framework installed!"));
      console.log("");
      console.log(chalk.bold("  Structure created:"));
      console.log(chalk.gray("    opencode.json          ← configuration (project root)"));
      console.log(chalk.gray("    nexus-system/          ← governance ecosystem"));
      for (const dir of result.directoriesCreated) {
        if (dir === NEXUS_DIR_NAME) continue;
        console.log(chalk.gray(`      ${dir.replace("nexus-system/", "")}/`));
      }
      console.log("");
      console.log(chalk.bold("  Files created:"));
      for (const file of result.filesCreated) {
        console.log(chalk.gray(`    ${file}`));
      }
      console.log("");
      console.log(chalk.bold("  Next steps:"));
      console.log(chalk.gray("    1. Edit nexus-system/docs/AGENTS.md to customise rules"));
      console.log(chalk.gray("    2. Edit opencode.json to set your AI models"));
      console.log(chalk.gray("    3. Run 'nexus status' to check governance health"));
      console.log(chalk.gray("    4. Run 'nexus assess' to re-evaluate maturity later"));
      console.log("");

      // Invalidate cache
      invalidateCache(targetDir);

      // Generate .mcp.json at project root if user opted in
      if (answers.enableMcpRegistration) {
        const mcpJsonPath = join(targetDir, ".mcp.json");
        const currentDir = dirname(fileURLToPath(import.meta.url));
        const mcpTemplatePath = join(currentDir, "..", "templates", "base", ".mcp.json");
        const nexusMcpEntry = { "nexus-mcp": { command: "nexus", args: ["mcp"] } };

        if (existsSync(mcpJsonPath)) {
          try {
            const existing = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
            if (!existing.mcpServers) existing.mcpServers = {};
            existing.mcpServers["nexus-mcp"] = nexusMcpEntry["nexus-mcp"];
            writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
          } catch {
            const merged = { mcpServers: { ...nexusMcpEntry } };
            writeFileSync(mcpJsonPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
          }
        } else if (existsSync(mcpTemplatePath)) {
          copySync(mcpTemplatePath, mcpJsonPath);
        } else {
          const content = { mcpServers: nexusMcpEntry };
          writeFileSync(mcpJsonPath, JSON.stringify(content, null, 2) + "\n", "utf-8");
        }
        result.filesCreated.push(".mcp.json");
      }

      // Install reactive git hooks (append-safe, husky-aware)
      try {
        const hooksResult = installReactiveHooks(targetDir, "nexus");
        if (hooksResult.installed.length > 0) {
          console.log(chalk.gray(`  ✓ Nexus git hooks installed: ${hooksResult.installed.join(", ")}`));
        } else if (hooksResult.skipped.length > 0 && hooksResult.skipped[0] !== "not-a-git-repo") {
          console.log(chalk.gray(`  • Git hooks already configured`));
        }
      } catch (error) {
        logger.debug("init", "Failed to install git hooks", { error });
      }

      // Load and register plugins
      const plugins = await loadPlugins(targetDir);
      const hookBus = getHookBus();
      for (const plugin of plugins) {
        hookBus.registerPlugin(plugin);
      }
      if (plugins.length > 0) {
        console.log(chalk.gray(`  🔌 Loaded ${plugins.length} plugin(s)`));
      }

      // Suggest future capabilities
      if (profile.futureCapabilities.length > 0) {
        console.log(chalk.gray("  As your project grows, run 'nexus assess' to discover new capabilities."));
      }
      console.log("");

      // Publish events for init completion
      const bus = getEventBus();

      // Asset created events for scaffolding files
      for (const file of result.filesCreated) {
        bus.publish("asset.created", {
          assetId: file,
          assetType: "governance",
          path: file,
        });
      }

      // Capability installed events
      for (const cap of capsToInstall) {
        bus.publish("capability.installed", {
          capabilityId: cap,
          capabilityName: cap,
          version: cliVersion,
        });
      }

      // Maturity changed event (initial score)
      if (previousProfile) {
        bus.publish("maturity.changed", {
          dimension: "overall",
          previousScore: previousProfile.overallScore,
          newScore: profile.overallScore,
          delta: profile.overallScore - previousProfile.overallScore,
        });
      }
    } catch (error) {
      scaffoldSpinner.fail("Failed to install ecosystem");
      console.error(chalk.red(`  Error: ${error}`));

      // Rollback: remove partial nexus-system directory
      const nexusDir = resolve(targetDir, NEXUS_DIR_NAME);
      if (existsSync(nexusDir)) {
        try {
          fse.removeSync(nexusDir);
          console.log(chalk.gray("  Cleaned up partial nexus-system/ directory."));
        } catch {
          console.log(chalk.yellow("  ⚠ Could not clean up nexus-system/ — remove manually."));
        }
      }

      process.exitCode = 1;
      return;
    }
  });
