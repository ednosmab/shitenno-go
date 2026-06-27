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
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { analyseProject } from "../analyser.js";
import { askQuestions } from "../prompts.js";
import { scaffoldNexusSystem } from "../scaffolder.js";
import { invalidateCache } from "../cache.js";
import {
  calculateMaturityProfile,
  saveMaturityProfile,
  recordMaturitySnapshot,
  profileToLegacyLevel,
  CAPABILITIES,
  type MaturityProfile,
  type Capability,
} from "../maturity-profile.js";

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

export const initCommand = new Command("init")
  .description("Initialize nexus governance framework with maturity-based discovery")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--force", "Force creation inside nexus-cli (not recommended)")
  .action(async (options) => {
    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║  nexus init — Maturity-Based Discovery   ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
    console.log("");

    // Determine project root
    const targetDir = options.dir
      ? resolve(options.dir)
      : resolve(process.cwd());

    // Safety guard
    if (targetDir.includes("nexus-cli") && !options.force) {
      console.log(chalk.yellow("  ⚠ nexus-system should be created in your project, not inside nexus-cli."));
      console.log(chalk.gray("  Run from your project root: nexus init"));
      console.log(chalk.gray("  Or:  nexus init --force (to create inside nexus-cli)"));
      console.log("");
      return;
    }

    // Check if already initialized
    if (existsSync(resolve(targetDir, "opencode.json"))) {
      console.log(chalk.yellow("  ⚠ nexus is already initialized in this directory."));
      console.log(chalk.gray("  Use 'nexus upgrade' to add more capabilities."));
      console.log(chalk.gray("  Use 'nexus assess' to re-evaluate maturity."));
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

    // Step 2: Discovery questionnaire
    console.log(chalk.bold("  Answer a few questions to determine your maturity profile:"));
    console.log("");
    const answers = await askQuestions(analysis);

    // Step 3: Calculate maturity profile
    const profileSpinner = ora("Calculating maturity profile...").start();
    const nexusDir = resolve(targetDir, "nexus-system");
    const profile = calculateMaturityProfile(answers.maturity, analysis, nexusDir);
    profileSpinner.succeed("Maturity profile calculated");

    // Step 4: Display maturity profile
    console.log("");
    console.log(chalk.bold.green("  ═══ Maturity Profile ═══"));
    console.log("");
    displayMaturityDimensions(profile);
    console.log("");
    displayCapabilities(profile);

    // Step 5: Scaffold by capabilities
    const scaffoldSpinner = ora("Installing governance framework...").start();
    try {
      // Determine which capabilities to install (recommended + selected)
      const capsToInstall: Capability[] = ["core", ...profile.recommendedCapabilities];

      // Allow user to customize if they want more
      const result = scaffoldNexusSystem(targetDir, answers, capsToInstall);
      scaffoldSpinner.succeed("Framework installed!");

      // Save maturity profile
      saveMaturityProfile(nexusDir, profile);
      recordMaturitySnapshot(nexusDir, profile);

      // Display results
      console.log("");
      console.log(chalk.bold.green("  ✓ Nexus Governance Framework installed!"));
      console.log("");
      console.log(chalk.bold("  Structure created:"));
      console.log(chalk.gray("    opencode.json          ← configuration (project root)"));
      console.log(chalk.gray("    nexus-system/          ← governance framework"));
      for (const dir of result.directoriesCreated) {
        if (dir === "nexus-system") continue;
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

      // Suggest future capabilities
      if (profile.futureCapabilities.length > 0) {
        console.log(chalk.gray("  As your project grows, run 'nexus assess' to discover new capabilities."));
      }
      console.log("");
    } catch (error) {
      scaffoldSpinner.fail("Failed to install framework");
      console.error(chalk.red(`  Error: ${error}`));
      process.exit(1);
    }
  });
