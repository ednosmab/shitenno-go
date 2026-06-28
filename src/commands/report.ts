/**
 * report.ts — User Performance Report Command
 *
 * Generates a rich performance report for the user, inspired by
 * the manual feedback templates. Shows 7 dimensions, growth
 * trajectory, session metrics, and personal insights.
 *
 * PRINCIPLE: To improve, one must first see oneself clearly.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  generatePerformanceReport,
  writePerformanceReport,
  type PerformanceReport,
  type DimensionReport,
  type Insight,
} from "../performance-reporter.js";
import { healthBar, outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { DIMENSION_LABELS, type PerformanceDimension } from "../feedback-loops.js";

// ── Formatting Helpers ───────────────────────────────────────────────────────

function formatDimensionBar(label: string, report: DimensionReport): string {
  const bar = healthBar(report.score, 100, 20);
  const trendIcon = report.trend === "improving" ? chalk.green("↑") :
                    report.trend === "declining" ? chalk.red("↓") : chalk.gray("→");
  return `   ${label.padEnd(30)} ${bar}  ${trendIcon}`;
}

function formatInsight(insight: Insight): string {
  const icon = insight.type === "strength" ? chalk.green("✅") :
               insight.type === "improvement" ? chalk.yellow("⚠️") :
               insight.type === "pattern" ? chalk.blue("📊") :
               chalk.cyan("💡");
  const text = insight.evidence
    ? `${insight.text}\n      ${chalk.gray(insight.evidence)}`
    : insight.text;
  return `   ${icon} ${text}`;
}

function formatReport(report: PerformanceReport): void {
  console.log(`\n${chalk.bold.cyan("╔══╗")}  ${chalk.bold("REPORT")}`);
  console.log(`${chalk.bold.cyan("╚══╝")}  Relatório de Desempenho — Últimos ${report.period.days} dias`);
  console.log(`   ${chalk.gray(`${report.period.from} → ${report.period.to}`)}\n`);

  // Profile
  console.log(chalk.bold("📊 Perfil"));
  console.log(`   Padrão: ${chalk.cyan(report.profile.growthPattern)} (${report.profile.challengeLevel > 0.5 ? "desafiador" : "conforto"})`);
  console.log(`   Capacidade: ${chalk.cyan(Math.round(report.profile.growthCapacity * 100) + "%")}`);
  console.log(`   Nível de desafio: ${chalk.cyan(Math.round(report.profile.challengeLevel * 100) + "%")}`);
  console.log("");

  // Dimensions
  console.log(chalk.bold("📐 Dimensões"));
  const dims = Object.entries(report.dimensions) as [PerformanceDimension, DimensionReport][];
  // Sort by score descending
  dims.sort((a, b) => b[1].score - a[1].score);
  for (const [dim, data] of dims) {
    console.log(formatDimensionBar(DIMENSION_LABELS[dim], data));
  }
  console.log("");

  // Trends
  console.log(chalk.bold("📈 Tendências"));
  const debtColor = report.debtTrend.delta < 0 ? chalk.green : report.debtTrend.delta > 0 ? chalk.red : chalk.gray;
  const matColor = report.maturityTrend.delta > 0 ? chalk.green : report.maturityTrend.delta < 0 ? chalk.red : chalk.gray;
  console.log(`   Maturidade:  ${report.maturityTrend.current} → ${report.maturityTrend.current + report.maturityTrend.delta}  (${matColor((report.maturityTrend.delta > 0 ? "+" : "") + report.maturityTrend.delta)})`);
  console.log(`   Knowledge Debt:  ${report.debtTrend.current} → ${report.debtTrend.current + report.debtTrend.delta}  (${debtColor((report.debtTrend.delta > 0 ? "+" : "") + report.debtTrend.delta)})`);
  console.log("");

  // Feedback
  console.log(chalk.bold("💬 Feedback"));
  console.log(`   ${report.feedback.totalInteractions} interações | ${report.feedback.acceptanceRate}% aceitação | ${report.feedback.challengingRatio}% desafio`);
  if (report.feedback.patterns.length > 0) {
    for (const pattern of report.feedback.patterns) {
      console.log(`   ${chalk.gray("•")} ${pattern}`);
    }
  }
  console.log("");

  // Sessions
  if (report.sessions.total > 0) {
    console.log(chalk.bold("🕐 Sessões"));
    console.log(`   Total: ${report.sessions.total} | Média: ${report.sessions.avgDuration}min`);
    if (Object.keys(report.sessions.commandFrequency).length > 0) {
      const topCmds = Object.entries(report.sessions.commandFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      console.log(`   Comandos: ${topCmds.map(([cmd, count]) => `${cmd}(${count})`).join(", ")}`);
    }
    console.log("");
  }

  // Insights
  console.log(chalk.bold("💡 Insights"));
  for (const insight of report.insights) {
    console.log(formatInsight(insight));
  }
  console.log("");

  // Next Steps
  console.log(chalk.bold("📌 Próximos Passos"));
  for (let i = 0; i < report.nextSteps.length; i++) {
    console.log(`   ${i + 1}. ${report.nextSteps[i]}`);
  }
  console.log("");

  // Summary
  console.log(chalk.gray(report.summary));
  console.log("");
}

// ── Command ──────────────────────────────────────────────────────────────────

export function reportCommand(): Command {
  const cmd = new Command("report")
    .description("Relatório de desempenho do utilizador")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--period <days>", "Período em dias (padrão: 30)", "30")
    .option("--save", "Salvar relatório em reports/")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;
      const days = Number(options.period) || 30;

      if (!isJson) {
        console.log(`\n${chalk.bold.cyan("╔══╗")}  ${chalk.bold("REPORT")}`);
        console.log(`${chalk.bold.cyan("╚══╝")}  Relatório de Desempenho\n`);
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("report", ctx.projectRoot, ctx.nexusDir, isJson)) {
        return;
      }

      const spinner = ora({ spinner: "dots" }).start(isJson ? "Generating" : "A gerar relatório...");

      try {
        const report = generatePerformanceReport(ctx.projectRoot, ctx.nexusDir, { days });

        spinner.stop();

        if (isJson) {
          outputJson(report as unknown as Record<string, unknown>);
        } else {
          formatReport(report);
        }

        // Save if requested
        if (options.save) {
          const filename = writePerformanceReport(ctx.nexusDir, report);
          if (filename && !isJson) {
            console.log(chalk.gray(`  Relatório salvo em: reports/${filename}`));
          }
        }

        // Publish event
        getEventBus().publish("analysis.complete", {
          type: "performance_report",
          days,
          dimensions: Object.keys(report.dimensions).length,
          insights: report.insights.length,
        });

      } catch (error) {
        spinner.fail("Erro ao gerar relatório");
        if (isJson) {
          outputJson({ error: "report_failed", message: String(error) });
        } else {
          console.error(chalk.red(`  Erro: ${error}`));
        }
      }
    });

  return cmd;
}
