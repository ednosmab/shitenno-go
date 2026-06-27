/**
 * assess.ts — Maturity Assessment & Evolution Recommendations
 *
 * Re-avalia a maturidade do projeto e recomenda novas capacidades.
 * Permite evolução contínua — o Nexus cresce conforme o projeto amadurece.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { analyseProject } from "../analyser.js";
import { askQuestions } from "../prompts.js";
import { detectNexusProject } from "../utils.js";
import {
  calculateMaturityProfile,
  saveMaturityProfile,
  recordMaturitySnapshot,
  loadMaturityProfile,
  readMaturityHistory,
  detectInstalledCapabilities,
  type MaturityProfile,
} from "../maturity-profile.js";
import { outputJson, healthBar } from "../formatting.js";

function displayDimensionBar(label: string, value: number, prev?: number): void {
  const barWidth = 20;
  const filled = Math.round((value / 100) * barWidth);
  const empty = barWidth - filled;
  const color = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
  const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));

  let delta = "";
  if (prev !== undefined) {
    const diff = value - prev;
    if (diff > 0) delta = chalk.green(` +${diff}`);
    else if (diff < 0) delta = chalk.red(` ${diff}`);
    else delta = chalk.gray(" =");
  }

  console.log(`    ${label.padEnd(16)} ${bar} ${chalk.bold(String(value).padStart(3))}%${delta}`);
}

function displayEvolution(history: Array<{ timestamp: string; overallScore: number }>): void {
  if (history.length < 2) {
    console.log(chalk.gray("    (need more assessments to show evolution)"));
    return;
  }

  console.log(chalk.bold("  Evolution:"));
  console.log("");

  const maxScore = Math.max(...history.map((h) => h.overallScore));
  const sparkWidth = 30;

  // Simple ASCII sparkline
  const scores = history.map((h) => h.overallScore);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;

  const chars = " ▁▂▃▄▅▆▇█";
  const sparkline = scores.map((s) => {
    const idx = Math.round(((s - minScore) / range) * (chars.length - 1));
    return chars[idx];
  }).join("");

  console.log(`    ${chalk.cyan(sparkline)} ${chalk.gray(`(${history.length} assessments)`)}`);
  console.log("");
}

export const assessCommand = new Command("assess")
  .description("Re-evaluate project maturity and recommend new capabilities")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║  nexus assess — Maturity Assessment      ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
      console.log("");
    }

    // Find project
    let projectRoot: string;
    let nexusDir: string;

    if (options.dir) {
      projectRoot = resolve(options.dir);
      nexusDir = join(projectRoot, "nexus-system");
    } else {
      const detected = detectNexusProject(process.cwd());
      if (!detected) {
        if (isJson) {
          outputJson({ error: "not_initialized", message: "Run 'nexus init' first." });
        } else {
          console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
          console.log(chalk.gray("  Run 'nexus init' first."));
          console.log("");
        }
        return;
      }
      projectRoot = detected.root;
      nexusDir = detected.nexusDir;
    }

    // Check initialization
    if (!existsSync(resolve(projectRoot, "opencode.json"))) {
      if (isJson) {
        outputJson({ error: "not_initialized", message: "Run 'nexus init' first." });
      } else {
        console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
        console.log(chalk.gray("  Run 'nexus init' first."));
        console.log("");
      }
      return;
    }

    // Load previous profile
    const previousProfile = loadMaturityProfile(nexusDir);

    // Analyse project
    const analyseSpinner = ora("Analysing project...").start();
    const analysis = analyseProject(projectRoot);
    analyseSpinner.succeed("Project analysis complete");

    // Run questionnaire
    if (!isJson) {
      console.log(chalk.bold("  Re-evaluate your maturity profile:"));
      console.log("");
    }

    const answers = await askQuestions(analysis);

    // Calculate new profile
    const calcSpinner = ora("Calculating maturity profile...").start();
    const newProfile = calculateMaturityProfile(answers.maturity, analysis, nexusDir);
    calcSpinner.succeed("Maturity profile calculated");

    // Save and record
    saveMaturityProfile(nexusDir, newProfile);
    recordMaturitySnapshot(nexusDir, newProfile);

    // Calculate delta
    const scoreDelta = previousProfile
      ? newProfile.overallScore - previousProfile.overallScore
      : undefined;

    // JSON output
    if (isJson) {
      outputJson({
        projectRoot,
        previousScore: previousProfile?.overallScore,
        newProfile: {
          dimensions: newProfile.dimensions,
          overallScore: newProfile.overallScore,
          installedCapabilities: newProfile.installedCapabilities,
          recommendedCapabilities: newProfile.recommendedCapabilities,
          futureCapabilities: newProfile.futureCapabilities,
        },
        scoreDelta,
        computedAt: newProfile.computedAt,
      });
      return;
    }

    // Human-readable output
    console.log("");
    console.log(chalk.bold.green("  ═══ Maturity Assessment Results ═══"));
    console.log("");

    if (previousProfile) {
      const color = scoreDelta !== undefined
        ? scoreDelta > 0 ? chalk.green : scoreDelta < 0 ? chalk.red : chalk.gray
        : chalk.gray;

      console.log(chalk.bold("  Previous Score:"));
      console.log(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
      console.log("");

      console.log(chalk.bold("  New Score:"));
      const deltaStr = scoreDelta !== undefined
        ? ` (${scoreDelta > 0 ? "+" : ""}${scoreDelta})`
        : "";
      console.log(`    ${newProfile.overallScore}/100 ${healthBar(newProfile.overallScore, 100)}${color(deltaStr)}`);
    } else {
      console.log(chalk.bold("  Overall Score:"));
      console.log(`    ${newProfile.overallScore}/100 ${healthBar(newProfile.overallScore, 100)}`);
    }
    console.log("");

    // Dimensions with delta
    console.log(chalk.bold("  Dimensions:"));
    console.log("");
    const dimLabels: Record<string, string> = {
      architecture: "Arquitetura",
      governance: "Governança",
      quality: "Qualidade",
      automation: "Automação",
      ai: "IA",
      documentation: "Documentação",
      observability: "Observabilidade",
    };

    for (const [key, label] of Object.entries(dimLabels)) {
      const prevDim = previousProfile?.dimensions[key as keyof typeof previousProfile.dimensions];
      displayDimensionBar(label, newProfile.dimensions[key as keyof typeof newProfile.dimensions], prevDim);
    }
    console.log("");

    // Capabilities
    const installed = newProfile.installedCapabilities;
    const recommended = newProfile.recommendedCapabilities;
    const future = newProfile.futureCapabilities;

    console.log(chalk.bold("  Installed Capabilities:"));
    for (const cap of installed) {
      console.log(chalk.green(`    ✓ ${cap}`));
    }
    console.log("");

    if (recommended.length > 0) {
      console.log(chalk.bold("  🎯 Recommended Capabilities:"));
      for (const cap of recommended) {
        console.log(chalk.cyan(`    → ${cap} — install with: nexus upgrade --capability ${cap}`));
      }
      console.log("");
    }

    if (future.length > 0) {
      console.log(chalk.bold("  Future Capabilities:"));
      for (const cap of future) {
        console.log(chalk.gray(`    □ ${cap}`));
      }
      console.log("");
    }

    // Evolution
    const history = readMaturityHistory(nexusDir);
    displayEvolution(history);

    // Summary
    if (recommended.length > 0) {
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${recommended.length} capability(ies) recommended.`));
      console.log(chalk.gray("    Run 'nexus upgrade --accept-recommended' to install all."));
    } else {
      console.log(chalk.green("  ✔ Your project is well-equipped! No new capabilities recommended."));
    }
    console.log("");
  });
