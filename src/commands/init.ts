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
import { output, outputBlank, outputError } from "../output.js";

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
    output(`    ${label.padEnd(16)} ${bar} ${chalk.bold(String(value).padStart(3))}%`);
  }
  outputBlank();
  output(`    ${chalk.bold("Score Geral:")}      ${chalk.bold(String(profile.overallScore))}/100`);
}

function displayCapabilities(profile: MaturityProfile): void {
  const installed = profile.installedCapabilities;
  const recommended = profile.recommendedCapabilities;
  const future = profile.futureCapabilities;

  output(chalk.bold("  Capacidades instaladas:"));
  for (const cap of installed) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    output(chalk.green(`    ✓ ${info?.name || cap}`));
  }
  outputBlank();

  if (recommended.length > 0) {
    output(chalk.bold("  Capacidades recomendadas:"));
    for (const cap of recommended) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.cyan(`    → ${info?.name || cap} — ${info?.description || ""}`));
    }
    outputBlank();
  }

  if (future.length > 0) {
    output(chalk.bold("  Capacidades futuras:"));
    for (const cap of future) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.gray(`    □ ${info?.name || cap}`));
    }
    outputBlank();
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
    outputBlank();
    banner("nexus init", isDryRun ? "Dry Run — No files will be written" : "Maturity-Based Discovery");
    outputBlank();

    // Determine project root
    const targetDir = options.dir
      ? resolve(options.dir)
      : resolve(process.cwd());

    // Safety guard
    if (shouldBlockInit(targetDir, options.force === true)) {
      output(chalk.yellow("  ⚠ nexus-system should be created in your project, not inside nexus-cli."));
      output(chalk.gray("  Run from your project root: nexus init"));
      output(chalk.gray("  Or:  nexus init --force (to create inside nexus-cli)"));
      outputBlank();
      return;
    }

    // Check if already initialized
    if (existsSync(resolve(targetDir, NEXUS_DIR_NAME))) {
      output(chalk.yellow("  ⚠ Nexus is already initialized in this directory."));
      outputBlank();
      output(chalk.bold("  Your project has grown — let me re-analyze your maturity:"));
      outputBlank();

      // Re-analyse project complexity
      const analyseSpinner = ora("Re-analysing project complexity...").start();
      const analysis = analyseProject(targetDir);
      analyseSpinner.succeed("Project analysis complete");

      // Show what was detected (compare with initial state)
      outputBlank();
      output(chalk.bold("  Current state:"));
      output(`    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`);
      output(`    Packages:  ${analysis.packageCount}`);
      output(`    Apps:      ${analysis.appCount}`);
      output(`    Source:    ${analysis.sourceFileCount} files`);
      output(`    Manager:  ${analysis.packageManager}`);
      output(`    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`);
      output(`    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`);
      output(`    CI/CD:     ${analysis.hasCI ? "yes" : chalk.gray("no")}`);
      outputBlank();

      // Load previous maturity profile
      const nexusDir = resolve(targetDir, NEXUS_DIR_NAME);
      const previousProfile = loadMaturityProfile(nexusDir);

      if (previousProfile) {
        output(chalk.bold("  Previous maturity score:"));
        output(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
        outputBlank();
      }

      output(chalk.gray("  Or:  nexus init --accept-recommended"));
      outputBlank();

      return;
    }

    // Step 1: Analyse project
    const analyseSpinner = ora("Analysing project...").start();
    const analysis = analyseProject(targetDir);
    analyseSpinner.succeed("Project analysis complete");

    // Show what was detected
    outputBlank();
    output(chalk.bold("  Detected:"));
    output(`    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`);
    output(`    Packages:  ${analysis.packageCount}`);
    output(`    Apps:      ${analysis.appCount}`);
    output(`    Source:    ${analysis.sourceFileCount} files`);
    output(`    Manager:  ${analysis.packageManager}`);
    output(`    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`);
    output(`    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`);
    output(`    CI/CD:     ${analysis.hasCI ? "yes" : chalk.gray("no")}`);
    outputBlank();

    // Step 2: Get answers (interactive or from file)
    let answers: UserAnswers;
    if (options.answersFile) {
      const answersPath = resolve(options.answersFile);
      if (!existsSync(answersPath)) {
        output(chalk.red(`  ✘ Answers file not found: ${answersPath}`));
        process.exitCode = 1;
        return;
      }
      const raw = readFileSync(answersPath, "utf-8");
      answers = JSON.parse(raw);
      output(chalk.gray(`  Loaded answers from ${options.answersFile}`));
    } else {
      // Guard against non-interactive environments
      if (!guardInteractive(options, false)) return;

      output(chalk.bold("  Answer a few questions to determine your maturity profile:"));
      outputBlank();
      answers = await askQuestions(analysis);
    }

    // Step 3: Calculate maturity profile
    const profileSpinner = ora("Calculating maturity profile...").start();      const nexusDir = resolve(targetDir, NEXUS_DIR_NAME);
    const profile = calculateMaturityProfile(answers.maturity, analysis, nexusDir);
    profileSpinner.succeed("Maturity profile calculated");

    // Step 4: Display maturity profile
    outputBlank();
    output(chalk.bold.green("  ═══ Maturity Profile ═══"));
    outputBlank();
    displayMaturityDimensions(profile);
    outputBlank();
    displayCapabilities(profile);

    // Dry-run: show what would be installed and return
    if (isDryRun) {
      const capsToInstall: Capability[] = ["core", ...profile.recommendedCapabilities];
      output(chalk.bold.green("  ═══ Dry Run — Would install ═══"));
      outputBlank();
      output(chalk.bold("  Capabilities:"));
      for (const cap of capsToInstall) {
        const info = CAPABILITIES.find((c) => c.id === cap);
        output(chalk.green(`    ✓ ${info?.name || cap}`));
      }
      outputBlank();
      output(chalk.bold("  Files that would be created:"));
      output(chalk.gray("    opencode.json"));
      output(chalk.gray("    nexus-system/ (governance ecosystem)"));
      for (const dir of ["governance", "docs", "skills", "scripts", "telemetry"] as string[]) {
        output(chalk.gray(`      ${dir}/`));
      }
      outputBlank();
      output(chalk.gray("  Run without --dry-run to apply changes."));
      outputBlank();
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
      outputBlank();
      output(chalk.bold.green("  ✓ Nexus System Framework installed!"));
      outputBlank();
      output(chalk.bold("  Structure created:"));
      output(chalk.gray("    opencode.json          ← configuration (project root)"));
      output(chalk.gray("    nexus-system/          ← governance ecosystem"));
      for (const dir of result.directoriesCreated) {
        if (dir === NEXUS_DIR_NAME) continue;
        output(chalk.gray(`      ${dir.replace("nexus-system/", "")}/`));
      }
      outputBlank();
      output(chalk.bold("  Files created:"));
      for (const file of result.filesCreated) {
        output(chalk.gray(`    ${file}`));
      }
      outputBlank();
      output(chalk.bold("  Next steps:"));
      output(chalk.gray("    1. Edit nexus-system/docs/AGENTS.md to customise rules"));
      output(chalk.gray("    2. Edit opencode.json to set your AI models"));
      output(chalk.gray("    3. Run 'nexus status' to check governance health"));
      output(chalk.gray("    4. Run 'nexus assess' to re-evaluate maturity later"));
      outputBlank();

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
          output(chalk.gray(`  ✓ Nexus git hooks installed: ${hooksResult.installed.join(", ")}`));
        } else if (hooksResult.skipped.length > 0 && hooksResult.skipped[0] !== "not-a-git-repo") {
          output(chalk.gray(`  • Git hooks already configured`));
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
        output(chalk.gray(`  🔌 Loaded ${plugins.length} plugin(s)`));
      }

      // Suggest future capabilities
      if (profile.futureCapabilities.length > 0) {
        output(chalk.gray("  As your project grows, run 'nexus assess' to discover new capabilities."));
      }
      outputBlank();

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
      outputError(chalk.red(`  Error: ${error}`));

      // Rollback: remove partial nexus-system directory
      const nexusDir = resolve(targetDir, NEXUS_DIR_NAME);
      if (existsSync(nexusDir)) {
        try {
          fse.removeSync(nexusDir);
          output(chalk.gray("  Cleaned up partial nexus-system/ directory."));
        } catch {
          output(chalk.yellow("  ⚠ Could not clean up nexus-system/ — remove manually."));
        }
      }

      process.exitCode = 1;
      return;
    }
  });
