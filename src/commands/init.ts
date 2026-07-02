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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
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
import { healthBar } from "../formatting.js";
import { saveUserProfile } from "../feedback-engine.js";
import { initializeRules } from "../rule-engine.js";
import { auditHealth, type HealthAuditReport } from "../health-auditor.js";
import { discoverArtifacts, discoverRelations, analyzeGraph, type GraphAnalysis } from "../knowledge-graph.js";
import type { ProjectAnalysis } from "../analyser.js";

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

// ── Mini Dashboard Display ─────────────────────────────────────────────────

function displayMiniDashboard(
  auditReport: HealthAuditReport,
  graphAnalysis: GraphAnalysis,
): void {
  const score = auditReport.healthScore;
  const scoreColor = score >= 70 ? chalk.green : score >= 40 ? chalk.yellow : chalk.red;

  console.log(chalk.bold.green("  ═══ Governance Health ═══"));
  console.log("");

  // Health Score
  console.log(`    Health Score:  ${scoreColor(String(score) + "/100")}  ${healthBar(score, 100)}`);
  console.log(`    Rules:         ${chalk.bold(String(auditReport.totalRules))} active`);
  console.log(`    History:       ${auditReport.historyEntries} session(s) analyzed`);

  // Issues summary
  const critical = auditReport.issues.filter((i) => i.severity === 3).length;
  const warning = auditReport.issues.filter((i) => i.severity === 2).length;
  const info = auditReport.issues.filter((i) => i.severity === 1).length;
  console.log(`    Issues:        ${auditReport.issues.length} (${critical} critical, ${warning} warning, ${info} info)`);

  // Knowledge Graph
  const graphScore = graphAnalysis.healthScore;
  const graphColor = graphScore >= 70 ? chalk.green : graphScore >= 40 ? chalk.yellow : chalk.red;
  console.log("");
  console.log(chalk.bold("  Knowledge Graph:"));
  console.log(`    Artifacts:   ${graphAnalysis.totalArtifacts}`);
  console.log(`    Relations:   ${graphAnalysis.totalRelations}`);
  console.log(`    Health:      ${graphColor(String(graphScore) + "/100")}  ${healthBar(graphScore, 100)}`);
  console.log(`    Orphans:     ${graphAnalysis.orphanArtifacts.length}`);

  // Top issues (max 3)
  if (auditReport.issues.length > 0) {
    console.log("");
    console.log(chalk.bold("  Top Issues:"));
    const topIssues = auditReport.issues.slice(0, 3);
    for (const issue of topIssues) {
      const icon = issue.severity === 3 ? chalk.red("✘") : issue.severity === 2 ? chalk.yellow("⚠") : chalk.gray("ℹ");
      console.log(`    ${icon} ${issue.description}`);
    }
  }

  console.log("");
  console.log(chalk.gray("  Next: nexus audit --json for full report"));
  console.log("");
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
    if (shouldBlockInit(targetDir, options.force === true)) {
      console.log(chalk.yellow("  ⚠ nexus-system should be created in your project, not inside nexus-cli."));
      console.log(chalk.gray("  Run from your project root: nexus init"));
      console.log(chalk.gray("  Or:  nexus init --force (to create inside nexus-cli)"));
      console.log("");
      return;
    }

    // Check if already initialized
    if (existsSync(resolve(targetDir, "opencode.json"))) {
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
      const nexusDir = resolve(targetDir, "nexus-system");
      const previousProfile = loadMaturityProfile(nexusDir);

      if (previousProfile) {
        console.log(chalk.bold("  Previous maturity score:"));
        console.log(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
        console.log("");
      }

      // Get fresh answers
      console.log(chalk.bold("  Answer a few questions to re-evaluate your maturity:"));
      console.log("");
      const answers = await askQuestions(analysis);

      // Calculate new maturity profile
      const profileSpinner = ora("Calculating maturity profile...").start();
      const profile = calculateMaturityProfile(answers.maturity, analysis, nexusDir);
      profileSpinner.succeed("Maturity profile calculated");

      // Display new profile
      console.log("");
      console.log(chalk.bold.green("  ═══ Updated Maturity Profile ═══"));
      console.log("");
      displayMaturityDimensions(profile);
      console.log("");
      displayCapabilities(profile);

      // Check if there are new capabilities to install
      const recommended = profile.recommendedCapabilities;

      if (recommended.length > 0) {
        console.log(chalk.bold.cyan("  🎯 New capabilities available:"));
        for (const cap of recommended) {
          const info = CAPABILITIES.find((c) => c.id === cap);
          console.log(chalk.cyan(`    → ${info?.name || cap} — ${info?.description || ""}`));
          console.log(chalk.gray(`      Install with: nexus upgrade --capability ${cap}`));
        }
        console.log("");
        console.log(chalk.gray("  Or install all recommended: nexus upgrade --accept-recommended"));
      } else {
        console.log(chalk.green("  ✔ Your project is well-equipped! No new capabilities recommended."));
      }
      console.log("");

      // Run audit for active projects (not starters)
      if (isStarterProject(analysis)) {
        console.log(chalk.bold("  Project appears to be a starter (minimal code detected)."));
        console.log(chalk.gray("  Run 'nexus audit' once you have implementation code."));
        console.log("");
      } else {
        const auditSpinner = ora("Running governance audit...").start();
        try {
          const auditReport = auditHealth(targetDir, nexusDir);
          const artifacts = discoverArtifacts(nexusDir);
          const relations = discoverRelations(artifacts);
          const graphAnalysis = analyzeGraph(artifacts, relations);
          auditSpinner.succeed("Audit complete");
          console.log("");
          displayMiniDashboard(auditReport, graphAnalysis);
        } catch (error) {
          auditSpinner.fail("Audit failed");
          console.log(chalk.gray(`  ${error instanceof Error ? error.message : "Unknown error"}`));
          console.log(chalk.gray("  Run 'nexus audit' manually for details."));
          console.log("");
        }
      }

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
    const scaffoldSpinner = ora("Installing governance ecosystem...").start();
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

      // Display results
      console.log("");
      console.log(chalk.bold.green("  ✓ Nexus System Framework installed!"));
      console.log("");
      console.log(chalk.bold("  Structure created:"));
      console.log(chalk.gray("    opencode.json          ← configuration (project root)"));
      console.log(chalk.gray("    nexus-system/          ← governance ecosystem"));
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
    } catch (error) {
      scaffoldSpinner.fail("Failed to install ecosystem");
      console.error(chalk.red(`  Error: ${error}`));

      // Rollback: remove partial nexus-system directory
      const nexusDir = resolve(targetDir, "nexus-system");
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
