/**
 * run.ts — Full Analysis Pipeline
 *
 * Chains all analysis stages into a single command.
 * Stages: analyze → score → detect → audit → evolve
 *
 * PRINCIPLE: One command to understand the full project state.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Pipeline, createPipelineContext, type PipelineContext, type PipelineStage } from "../pipeline.js";
import type { ComplexityReport } from "../scorer.js";
import { analyseProject } from "../analyser.js";
import { calculateComplexityScore, writeComplexityReport } from "../scorer.js";
import { detectPatterns, writePatternReport } from "../pattern-detector.js";
import { auditHealth, writeHealthReport } from "../health-auditor.js";
import { analyzeEvolution, writeEvolutionReport } from "../auto-evolution.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";

// ── Stages ───────────────────────────────────────────────────────────────────

const analyzeStage: PipelineStage = {
  name: "analyze",
  description: "Analyse project structure",
  execute: async (ctx: PipelineContext) => {
    const analysis = analyseProject(ctx.projectRoot);
    ctx.analysis = analysis;
    return ctx;
  },
};

const scoreStage: PipelineStage = {
  name: "score",
  description: "Calculate complexity score",
  execute: async (ctx: PipelineContext) => {
    if (!ctx.analysis) return ctx;
    const analysis = ctx.analysis as ReturnType<typeof analyseProject>;
    const complexity = await calculateComplexityScore(ctx.projectRoot, ctx.nexusDir, analysis);
    writeComplexityReport(ctx.projectRoot, ctx.nexusDir, complexity);
    ctx.complexityReport = complexity as ComplexityReport;
    return ctx;
  },
};

const detectStage: PipelineStage = {
  name: "detect",
  description: "Detect patterns in history",
  execute: async (ctx: PipelineContext) => {
    const report = detectPatterns(ctx.projectRoot, ctx.nexusDir);
    writePatternReport(ctx.nexusDir, report);
    ctx.patternReport = report;
    return ctx;
  },
};

const auditStage: PipelineStage = {
  name: "audit",
  description: "Audit governance health",
  execute: async (ctx: PipelineContext) => {
    const report = auditHealth(ctx.projectRoot, ctx.nexusDir);
    writeHealthReport(ctx.nexusDir, report);
    ctx.healthReport = report;
    return ctx;
  },
};

const evolveStage: PipelineStage = {
  name: "evolve",
  description: "Generate evolution recommendations",
  execute: async (ctx: PipelineContext) => {
    if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.nexusDir, false)) {
      console.log(chalk.yellow("  ⚠ Skipping evolve stage (requires 'governed' state)"));
      return ctx;
    }
    const report = analyzeEvolution(ctx.projectRoot, ctx.nexusDir);
    writeEvolutionReport(ctx.nexusDir, report);
    ctx.evolutionReport = report;
    return ctx;
  },
};

// ── Command ──────────────────────────────────────────────────────────────────

export const runCommand = new Command("run")
  .description("Run the full analysis pipeline (analyze → score → detect → audit → evolve)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║    nexus run — Full Analysis         ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("run", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const pipeline = new Pipeline()
      .addStage(analyzeStage)
      .addStage(scoreStage)
      .addStage(detectStage)
      .addStage(auditStage)
      .addStage(evolveStage);

    const pipelineCtx = createPipelineContext(ctx.projectRoot, ctx.nexusDir);
    const spinner = isJson ? null : ora("Running analysis pipeline...").start();

    try {
      const result = await pipeline.execute(pipelineCtx);

      if (spinner) {
        const successCount = result.stageResults.filter((s) => s.success).length;
        const failCount = result.stageResults.filter((s) => !s.success).length;
        spinner.succeed(
          `Pipeline complete — ${successCount} stage(s) succeeded` +
          (failCount > 0 ? `, ${failCount} failed` : "")
        );
      }

      // Build summary
      const complexity = result.complexityReport as { score: number; level: string } | undefined;
      const patterns = result.patternReport as { patterns: unknown[]; candidateRules: unknown[] } | undefined;
      const health = result.healthReport;
      const evolution = result.evolutionReport as { totalRecommendations: number; recommendations: unknown[] } | undefined;

      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          stages: result.stageResults,
          complexity: complexity ? {
            score: complexity.score,
            level: complexity.level,
          } : null,
          patterns: patterns ? {
            count: patterns.patterns.length,
            candidateRules: patterns.candidateRules.length,
          } : null,
          health: health ? {
            score: health.healthScore,
            issues: health.issues.length,
          } : null,
          evolution: evolution ? {
            recommendations: evolution.totalRecommendations,
          } : null,
          errors: result.errors.map((e) => ({ stage: e.stage, error: e.error.message })),
          duration: result.completedAt
            ? new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()
            : 0,
        });
        return;
      }

      // Human-readable summary
      console.log(chalk.bold("  Pipeline Results:"));
      console.log("");

      for (const sr of result.stageResults) {
        const icon = sr.success ? chalk.green("✔") : chalk.red("✘");
        const duration = chalk.gray(`(${sr.duration}ms)`);
        console.log(`    ${icon} ${sr.stage} ${duration}`);
      }
      console.log("");

      if (complexity) {
        const color = complexity.level === "junior" ? chalk.green
          : complexity.level === "pleno" ? chalk.yellow : chalk.red;
        console.log(chalk.bold("  Summary:"));
        console.log(`    Complexity: ${color(complexity.score + "/20")} — ${color(complexity.level)}`);
      }

      if (patterns) {
        console.log(`    Patterns:  ${patterns.patterns.length} detected, ${patterns.candidateRules.length} candidate rules`);
      }

      if (health) {
        const color = health.healthScore >= 70 ? chalk.green : health.healthScore >= 40 ? chalk.yellow : chalk.red;
        console.log(`    Health:    ${color(health.healthScore + "/100")}`);
      }

      if (evolution) {
        console.log(`    Evolution: ${evolution.totalRecommendations} recommendation(s)`);
      }

      if (result.errors.length > 0) {
        console.log("");
        console.log(chalk.red(`  ${result.errors.length} stage(s) failed:`));
        for (const e of result.errors) {
          console.log(chalk.red(`    - ${e.stage}: ${e.error.message}`));
        }
      }

      console.log("");
    } catch (error) {
      if (spinner) spinner.fail("Pipeline failed");
      if (isJson) {
        outputJson({ error: "pipeline_failed", message: String(error) });
      } else {
        console.error(chalk.red(`  Error: ${error}`));
      }
      console.log("");
    }
  });
