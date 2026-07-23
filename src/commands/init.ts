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
import { scaffoldShitenno } from "../scaffolder.js";
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
import { SHITENNO_DIR_NAME } from "../constants.js";
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
 * Determines if init should be blocked because the target is inside shitenno-cli.
 * Extracted for testability.
 */
export function shouldBlockInit(targetDir: string, force: boolean): boolean {
  return targetDir.includes("shitenno-cli") && !force;
}

function displayProjectAnalysis(analysis: ProjectAnalysis, title: string): void {
  output(chalk.bold(`  ${title}:`));
  output(`    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`);
  output(`    Packages:  ${analysis.packageCount}`);
  output(`    Apps:      ${analysis.appCount}`);
  output(`    Source:    ${analysis.sourceFileCount} files`);
  output(`    Manager:  ${analysis.packageManager}`);
  output(`    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`);
  output(`    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`);
  output(`    CI/CD:     ${analysis.hasCI ? "yes" : chalk.gray("no")}`);
  outputBlank();
}

async function handleAlreadyInitialized(targetDir: string): Promise<boolean> {
  if (!existsSync(resolve(targetDir, SHITENNO_DIR_NAME))) return false;

  output(chalk.yellow("  ⚠ Shugo is already initialized in this directory."));
  outputBlank();
  output(chalk.bold("  Your project has grown — let me re-analyze your maturity:"));
  outputBlank();

  const analyseSpinner = ora("Re-analysing project complexity...").start();
  const analysis = analyseProject(targetDir);
  analyseSpinner.succeed("Project analysis complete");

  outputBlank();
  displayProjectAnalysis(analysis, "Current state");

  const shitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
  const previousProfile = loadMaturityProfile(shitennoDir);

  if (previousProfile) {
    output(chalk.bold("  Previous maturity score:"));
    output(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
    outputBlank();
  }

  output(chalk.gray("  Or:  shugo init --accept-recommended"));
  outputBlank();

  return true;
}

function analyseAndDisplay(targetDir: string): ProjectAnalysis {
  const analyseSpinner = ora("Analysing project...").start();
  const analysis = analyseProject(targetDir);
  analyseSpinner.succeed("Project analysis complete");
  outputBlank();
  displayProjectAnalysis(analysis, "Detected");
  return analysis;
}

async function getAnswers(
  options: { answersFile?: string },
  analysis: ProjectAnalysis,
): Promise<UserAnswers | null> {
  if (options.answersFile) {
    const answersPath = resolve(options.answersFile);
    if (!existsSync(answersPath)) {
      output(chalk.red(`  ✘ Answers file not found: ${answersPath}`));
      process.exitCode = 1;
      return null;
    }
    const raw = readFileSync(answersPath, "utf-8");
    output(chalk.gray(`  Loaded answers from ${options.answersFile}`));
    return JSON.parse(raw);
  }

  if (!guardInteractive(options, false)) return null;

  output(chalk.bold("  Answer a few questions to determine your maturity profile:"));
  outputBlank();
  return await askQuestions(analysis);
}

function calculateAndDisplayProfile(
  targetDir: string,
  answers: UserAnswers,
  analysis: ProjectAnalysis,
): { profile: MaturityProfile; shitennoDir: string } {
  const profileSpinner = ora("Calculating maturity profile...").start();
  const shitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
  const profile = calculateMaturityProfile(answers.maturity, analysis, shitennoDir);
  profileSpinner.succeed("Maturity profile calculated");

  outputBlank();
  output(chalk.bold.green("  ═══ Maturity Profile ═══"));
  outputBlank();
  displayMaturityDimensions(profile);
  outputBlank();
  displayCapabilities(profile);

  return { profile, shitennoDir };
}

function handleDryRun(profile: MaturityProfile): void {
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
  output(chalk.gray("    shitenno/ (governance ecosystem)"));
  for (const dir of ["governance", "docs", "skills", "scripts", "telemetry"] as string[]) {
    output(chalk.gray(`      ${dir}/`));
  }
  outputBlank();
  output(chalk.gray("  Run without --dry-run to apply changes."));
  outputBlank();
}

function displaySuccessResults(
  result: { directoriesCreated: string[]; filesCreated: string[] },
): void {
  outputBlank();
  output(chalk.bold.green("  ✓ Shitenno Framework installed!"));
  outputBlank();
  output(chalk.bold("  Structure created:"));
  output(chalk.gray("    opencode.json          ← configuration (project root)"));
  output(chalk.gray("    shitenno/          ← governance ecosystem"));
  for (const dir of result.directoriesCreated) {
    if (dir === SHITENNO_DIR_NAME) continue;
    output(chalk.gray(`      ${dir.replace("shitenno/", "")}/`));
  }
  outputBlank();
  output(chalk.bold("  Files created:"));
  for (const file of result.filesCreated) {
    output(chalk.gray(`    ${file}`));
  }
  outputBlank();
  output(chalk.bold("  Next steps:"));
  output(chalk.gray("    1. Edit shitenno/docs/AGENTS.md to customise rules"));
  output(chalk.gray("    2. Edit opencode.json to set your AI models"));
  output(chalk.gray("    3. Run 'shugo status' to check governance health"));
  output(chalk.gray("    4. Run 'shugo assess' to re-evaluate maturity later"));
  outputBlank();
}

function mergeMcpJson(
  mcpJsonPath: string,
  entry: Record<string, { command: string; args: string[] }>,
): void {
  try {
    const existing = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    if (!existing.mcpServers) existing.mcpServers = {};
    existing.mcpServers["shitenno-mcp"] = entry["shitenno-mcp"];
    writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  } catch {
    const merged = { mcpServers: { ...entry } };
    writeFileSync(mcpJsonPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  }
}

function generateMcpJson(
  targetDir: string,
  result: { filesCreated: string[] },
): void {
  const mcpJsonPath = join(targetDir, ".mcp.json");
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const mcpTemplatePath = join(currentDir, "..", "templates", "base", ".mcp.json");
  const shitennoMcpEntry = { "shitenno-mcp": { command: "shugo", args: ["mcp"] } };

  if (existsSync(mcpJsonPath)) {
    mergeMcpJson(mcpJsonPath, shitennoMcpEntry);
  } else if (existsSync(mcpTemplatePath)) {
    copySync(mcpTemplatePath, mcpJsonPath);
  } else {
    const content = { mcpServers: shitennoMcpEntry };
    writeFileSync(mcpJsonPath, JSON.stringify(content, null, 2) + "\n", "utf-8");
  }
  result.filesCreated.push(".mcp.json");
}

interface PublishInitEventsOptions {
  bus: ReturnType<typeof getEventBus>;
  result: { filesCreated: string[] };
  capsToInstall: Capability[];
  cliVersion: string;
  previousProfile: MaturityProfile | null;
  profile: MaturityProfile;
}

function publishInitEvents(options: PublishInitEventsOptions): void {
  const { bus, result, capsToInstall, cliVersion, previousProfile, profile } = options;
  for (const file of result.filesCreated) {
    bus.publish("asset.created", {
      assetId: file,
      assetType: "governance",
      path: file,
    });
  }

  for (const cap of capsToInstall) {
    bus.publish("capability.installed", {
      capabilityId: cap,
      capabilityName: cap,
      version: cliVersion,
    });
  }

  if (previousProfile) {
    bus.publish("maturity.changed", {
      dimension: "overall",
      previousScore: previousProfile.overallScore,
      newScore: profile.overallScore,
      delta: profile.overallScore - previousProfile.overallScore,
    });
  }
}

function installGitHooks(targetDir: string): void {
  try {
    const hooksResult = installReactiveHooks(targetDir, "shugo");
    if (hooksResult.installed.length > 0) {
      output(chalk.gray(`  ✓ Shugo git hooks installed: ${hooksResult.installed.join(", ")}`));
    } else if (hooksResult.skipped.length > 0 && hooksResult.skipped[0] !== "not-a-git-repo") {
      output(chalk.gray(`  • Git hooks already configured`));
    }
  } catch (error) {
    logger.debug("init", "Failed to install git hooks", { error });
  }
}

async function getCliVersion(): Promise<string> {
  try {
    const { readFileSync: readFS } = await import("node:fs");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkg = JSON.parse(readFS(join(__dirname, "..", "..", "package.json"), "utf-8"));
    return pkg.version || "unknown";
  } catch (error) {
    logger.debug("init", "Suppressed error", { error });
    return "unknown";
  }
}

function saveUserProfileFromAnswers(shitennoDir: string, answers: UserAnswers): void {
  if (answers.userProfile) {
    saveUserProfile(shitennoDir, {
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
}

async function generateFingerprintAndBriefing(
  targetDir: string,
  shitennoDir: string,
  analysis: ProjectAnalysis,
  profile: MaturityProfile,
): Promise<void> {
  const { generateProjectFingerprint, saveFingerprint } = await import("../project-fingerprint.js");
  const fingerprint = generateProjectFingerprint(targetDir, analysis, profile.overallScore);
  saveFingerprint(shitennoDir, fingerprint);

  try {
    const { generateRiskMap } = await import("../risk-map.js");
    const { generateBriefing, briefingToMarkdown } = await import("../briefing.js");
    const riskMap = generateRiskMap(targetDir, shitennoDir);
    const briefing = generateBriefing({ fingerprint, riskMap, contextRules: [], dynamicRules: [], maturityProfile: profile, projectRoot: targetDir });
    const briefingPath = join(shitennoDir, "BRIEFING.md");
    writeFileSync(briefingPath, briefingToMarkdown(briefing), "utf-8");
  } catch (error) {
    logger.debug("init", "Suppressed error", { error });
  }
}

async function loadAndRegisterPlugins(targetDir: string): Promise<void> {
  const plugins = await loadPlugins(targetDir);
  const hookBus = getHookBus();
  for (const plugin of plugins) {
    hookBus.registerPlugin(plugin);
  }
  if (plugins.length > 0) {
    output(chalk.gray(`  🔌 Loaded ${plugins.length} plugin(s)`));
  }
}

function handleScaffoldError(error: unknown, shitennoDir: string): void {
  outputError(chalk.red(`  Error: ${error}`));
  if (existsSync(shitennoDir)) {
    try {
      fse.removeSync(shitennoDir);
      output(chalk.gray("  Cleaned up partial shitenno/ directory."));
    } catch {
      output(chalk.yellow("  ⚠ Could not clean up shitenno/ — remove manually."));
    }
  }
  process.exitCode = 1;
}

async function runScaffolding(
  targetDir: string,
  analysis: ProjectAnalysis,
  profile: MaturityProfile,
  answers: UserAnswers,
): Promise<void> {
  const scaffoldSpinner = ora("Installing governance ecosystem...").start();
  const shitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
  const previousProfile = existsSync(shitennoDir) ? loadMaturityProfile(shitennoDir) : null;

  try {
    const capsToInstall: Capability[] = ["core", ...profile.recommendedCapabilities];
    const result = scaffoldShitenno(targetDir, answers, capsToInstall);
    scaffoldSpinner.succeed("Framework installed!");

    initializeRules(shitennoDir);
    saveMaturityProfile(shitennoDir, profile);
    recordMaturitySnapshot(shitennoDir, profile);

    const cliVersion = await getCliVersion();
    const manifest = createManifest(cliVersion, shitennoDir, capsToInstall, profile.overallScore);
    writeManifest(shitennoDir, manifest);

    saveUserProfileFromAnswers(shitennoDir, answers);
    await generateFingerprintAndBriefing(targetDir, shitennoDir, analysis, profile);

    displaySuccessResults(result);
    invalidateCache({ projectRoot: targetDir });

    if (answers.enableMcpRegistration) {
      generateMcpJson(targetDir, result);
    }

    installGitHooks(targetDir);
    await loadAndRegisterPlugins(targetDir);

    if (profile.futureCapabilities.length > 0) {
      output(chalk.gray("  As your project grows, run 'shugo assess' to discover new capabilities."));
    }
    outputBlank();

    const bus = getEventBus();
    publishInitEvents({ bus, result, capsToInstall, cliVersion, previousProfile, profile });
  } catch (error) {
    scaffoldSpinner.fail("Failed to install ecosystem");
    handleScaffoldError(error, shitennoDir);
  }
}

export const initCommand = new Command("init")
  .description("Initialize Shitenno ecosystem with maturity-based discovery")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--answers-file <path>", "JSON file with pre-defined answers (skips interactive prompts)")
  .option("--force", "Force creation inside shitenno-cli (not recommended)")
  .option("--dry-run", "Show what would be created without writing files")
  .action(async (options) => {
    const isDryRun = options.dryRun === true;
    outputBlank();
    banner("shugo init", isDryRun ? "Dry Run — No files will be written" : "Maturity-Based Discovery");
    outputBlank();

    const targetDir = options.dir ? resolve(options.dir) : resolve(process.cwd());

    if (shouldBlockInit(targetDir, options.force === true)) {
      output(chalk.yellow("  ⚠ shitenno should be created in your project, not inside shitenno-cli."));
      output(chalk.gray("  Run from your project root: shugo init"));
      output(chalk.gray("  Or:  shugo init --force (to create inside shitenno-cli)"));
      outputBlank();
      return;
    }

    if (await handleAlreadyInitialized(targetDir)) return;

    const analysis = analyseAndDisplay(targetDir);
    const answers = await getAnswers(options, analysis);
    if (!answers) return;

    const { profile } = calculateAndDisplayProfile(targetDir, answers, analysis);

    if (isDryRun) {
      handleDryRun(profile);
      return;
    }

    await runScaffolding(targetDir, analysis, profile, answers);
  });
