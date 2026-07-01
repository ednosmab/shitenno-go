/**
 * decide.ts — Decision Engine CLI Command
 *
 * The `nexus decide` command. Evaluates proposed actions using specialized evaluators.
 *
 * Usage:
 *   nexus decide "Upgrade authentication module" --category security --risk high
 *   nexus decide "Add unit tests" --category quality --impact high --goal GOAL-abc123
 *   nexus decide "Refactor database layer" --category architecture --introduces-debt --debt-severity low
 *   nexus decide --list
 *   nexus decide --show DEC-abc123
 *   nexus decide --stats
 */

import { Command } from "commander";
import chalk from "chalk";
import { resolve, join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import {
  DecisionEngine,
  FileDecisionRepository,
  type DecisionRecommendation,
  type RiskLevel,
} from "../decision-engine.js";
import { outputJson } from "../formatting.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): DecisionEngine {
  const nexusDir = join(dir, "nexus-system");
  return new DecisionEngine(new FileDecisionRepository(nexusDir));
}

const RECO_COLORS: Record<DecisionRecommendation, (s: string) => string> = {
  proceed: (s) => chalk.green(s),
  proceed_with_caution: (s) => chalk.yellow(s),
  defer: (s) => chalk.gray(s),
  block: (s) => chalk.red.bold(s),
};

function formatDecision(d: { id: string; request: { action: string; category: string }; recommendation: DecisionRecommendation; compositeScore: number; confidence: number }): string {
  const reco = RECO_COLORS[d.recommendation](d.recommendation.padEnd(20));
  return `  ${chalk.bold(d.id)}  ${reco}  score=${d.compositeScore}  conf=${d.confidence}%  ${d.request.category}: ${d.request.action.slice(0, 50)}`;
}

// ── Command ────────────────────────────────────────────────────────────────

export function decideCommand(): Command {
  const cmd = new Command("decide")
    .description("Evaluate proposed actions using specialized evaluators")
    .option("-d, --dir <path>", "Project directory");

  // ── evaluate (default: positional arg) ──────────────────────────────────
  cmd
    .argument("[action]", "Action to evaluate")
    .option("--category <cat>", "Action category (security, quality, architecture, etc.)", "general")
    .option("--risk <level>", "Risk level: low, medium, high, critical", "medium")
    .option("--impact <level>", "Impact level: minimal, low, medium, high, critical", "medium")
    .option("--goal <id>", "Target goal ID")
    .option("--introduces-debt", "Action introduces technical debt")
    .option("--debt-severity <level>", "Debt severity: low, medium, high", "low")
    .option("--json", "Output as JSON")
    .action(async (action: string | undefined, opts: Record<string, unknown>) => {
      if (!action) {
        // Show help if no action provided
        cmd.help();
        return;
      }

      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);

      const request = {
        id: `REQ-${Date.now().toString(36).toUpperCase()}`,
        action,
        category: opts.category as string,
        targetGoalId: opts.goal as string,
        context: {
          riskLevel: opts.risk as RiskLevel,
          impact: opts.impact as string,
          introducesDebt: opts.introducesDebt === true,
          debtSeverity: opts.debtSeverity as string,
        },
        timestamp: new Date().toISOString(),
      };

      const decision = await engine.decide(request);

      if (isJson) {
        outputJson(decision as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold("  Decision Engine Result"));
      console.log(chalk.dim("  " + "─".repeat(60)));
      console.log(`  ${chalk.bold("ID:")}\t\t${decision.id}`);
      console.log(`  ${chalk.bold("Action:")}\t${decision.request.action}`);
      console.log(`  ${chalk.bold("Category:")}\t${decision.request.category}`);
      console.log("");
      console.log(chalk.bold("  Evaluator Scores:"));
      for (const score of decision.scores) {
        const bar = chalk.cyan("█".repeat(Math.round(score.score / 10))) +
          chalk.dim("░".repeat(10 - Math.round(score.score / 10)));
        console.log(`    ${score.evaluator.padEnd(14)} ${bar} ${score.score}/100 — ${score.reasoning}`);
        if (score.concerns) {
          for (const c of score.concerns) {
            console.log(chalk.red(`      ⚠ ${c}`));
          }
        }
        if (score.mitigations) {
          for (const m of score.mitigations) {
            console.log(chalk.cyan(`      → ${m}`));
          }
        }
      }
      console.log("");
      console.log(chalk.bold("  Result:"));
      console.log(`  Composite Score:  ${chalk.bold(String(decision.compositeScore))}/100`);
      console.log(`  Recommendation:   ${RECO_COLORS[decision.recommendation](decision.recommendation.toUpperCase())}`);
      console.log(`  Confidence:       ${decision.confidence}%`);
      console.log("");
    });

  // ── list ────────────────────────────────────────────────────────────────
  cmd
    .command("list")
    .description("List past decisions")
    .option("--category <cat>", "Filter by category")
    .option("--recommendation <reco>", "Filter by recommendation")
    .option("--since <date>", "Show decisions since date (ISO)")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const decisions = engine.list({
        category: opts.category as string,
        recommendation: opts.recommendation as DecisionRecommendation,
        since: opts.since as string,
      });

      if (isJson) {
        outputJson(decisions as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      if (decisions.length === 0) {
        console.log(chalk.dim("  No decisions recorded."));
      } else {
        console.log(chalk.bold(`  Decisions (${decisions.length})`));
        console.log(chalk.dim("  " + "─".repeat(80)));
        for (const d of decisions) {
          console.log(formatDecision(d));
        }
      }
      console.log("");
    });

  // ── show ────────────────────────────────────────────────────────────────
  cmd
    .command("show")
    .description("Show decision details")
    .argument("<id>", "Decision ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const decision = engine.get(id);

      if (!decision) {
        if (isJson) {
          outputJson({ error: "Decision not found" });
        } else {
          console.log(chalk.red(`  Decision not found: ${id}`));
        }
        return;
      }

      if (isJson) {
        outputJson(decision as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold(`  ${decision.id}`));
      console.log(`  Action:     ${decision.request.action}`);
      console.log(`  Category:   ${decision.request.category}`);
      console.log(`  Decided:    ${decision.decidedAt}`);
      console.log("");
      console.log(chalk.bold("  Evaluator Scores:"));
      for (const score of decision.scores) {
        console.log(`    ${score.evaluator.padEnd(14)} ${score.score}/100 — ${score.reasoning}`);
      }
      console.log("");
      console.log(`  Composite:  ${decision.compositeScore}/100`);
      console.log(`  Recommendation: ${RECO_COLORS[decision.recommendation](decision.recommendation)}`);
      console.log(`  Confidence: ${decision.confidence}%`);
      console.log("");
    });

  // ── stats ───────────────────────────────────────────────────────────────
  cmd
    .command("stats")
    .description("Show decision statistics")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const all = engine.list();

      const byReco: Record<string, number> = {};
      let totalScore = 0;
      let totalConf = 0;

      for (const d of all) {
        byReco[d.recommendation] = (byReco[d.recommendation] ?? 0) + 1;
        totalScore += d.compositeScore;
        totalConf += d.confidence;
      }

      const stats = {
        total: all.length,
        byRecommendation: byReco,
        avgCompositeScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
        avgConfidence: all.length > 0 ? Math.round(totalConf / all.length) : 0,
      };

      if (isJson) {
        outputJson(stats as unknown as Record<string, unknown>);
        return;
      }

      console.log("");
      console.log(chalk.bold("  Decision Statistics"));
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log(`  Total:       ${stats.total}`);
      console.log(`  Avg Score:   ${stats.avgCompositeScore}/100`);
      console.log(`  Avg Confidence: ${stats.avgConfidence}%`);
      console.log("");
      for (const [reco, count] of Object.entries(stats.byRecommendation)) {
        console.log(`  ${RECO_COLORS[reco as DecisionRecommendation](reco)}: ${count}`);
      }
      console.log("");
    });

  return cmd;
}
