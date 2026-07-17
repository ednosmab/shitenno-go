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
import { printDaemonBanner } from "../daemon-context-banner.js";
import { METRIC_LABELS, type PerformanceMetric } from "../feedback-loops.js";
import { output, outputBlank, outputSection } from "../output.js";
import { logger } from "../logger.js";

// ── Formatting Helpers ───────────────────────────────────────────────────────

export function formatDimensionBar(label: string, report: DimensionReport): string {
  const bar = healthBar(report.score, 100, 20);
  const trendIcon = report.trend === "improving" ? chalk.green("↑") :
                    report.trend === "declining" ? chalk.red("↓") : chalk.gray("→");
  return `   ${label.padEnd(30)} ${bar}  ${trendIcon}`;
}

export function formatInsight(insight: Insight): string {
  const icon = insight.type === "strength" ? chalk.green("✅") :
               insight.type === "improvement" ? chalk.yellow("⚠️") :
               insight.type === "pattern" ? chalk.blue("📊") :
               chalk.cyan("💡");
  const text = insight.evidence
    ? `${insight.text}\n      ${chalk.gray(insight.evidence)}`
    : insight.text;
  return `   ${icon} ${text}`;
}

export function formatReport(report: PerformanceReport): void {
  output("");
  output(`${chalk.bold.cyan("╔══╗")}  ${chalk.bold("REPORT")}`);
  output(`${chalk.bold.cyan("╚══╝")}  Relatório de Desempenho — Últimos ${report.period.days} dias`);
  output(`   ${chalk.gray(`${report.period.from} → ${report.period.to}`)}`);
  outputBlank();

  // Profile
  outputSection("📊 Perfil");
  output(`   Padrão: ${chalk.cyan(report.profile.growthPattern)} (${report.profile.challengeLevel > 0.5 ? "desafiador" : "conforto"})`);
  output(`   Capacidade: ${chalk.cyan(Math.round(report.profile.growthCapacity * 100) + "%")}`);
  output(`   Nível de desafio: ${chalk.cyan(Math.round(report.profile.challengeLevel * 100) + "%")}`);
  outputBlank();

  // Dimensions
  outputSection("📐 Dimensões");
  const dims = Object.entries(report.dimensions) as [PerformanceMetric, DimensionReport][];
  // Sort by score descending
  dims.sort((a, b) => b[1].score - a[1].score);
  for (const [dim, data] of dims) {
    output(formatDimensionBar(METRIC_LABELS[dim], data));
  }
  outputBlank();

  // Trends
  outputSection("📈 Tendências");
  const debtColor = report.debtTrend.delta < 0 ? chalk.green : report.debtTrend.delta > 0 ? chalk.red : chalk.gray;
  const matColor = report.maturityTrend.delta > 0 ? chalk.green : report.maturityTrend.delta < 0 ? chalk.red : chalk.gray;
  output(`   Maturidade:  ${report.maturityTrend.current} → ${report.maturityTrend.current + report.maturityTrend.delta}  (${matColor((report.maturityTrend.delta > 0 ? "+" : "") + report.maturityTrend.delta)})`);
  output(`   Knowledge Debt:  ${report.debtTrend.current} → ${report.debtTrend.current + report.debtTrend.delta}  (${debtColor((report.debtTrend.delta > 0 ? "+" : "") + report.debtTrend.delta)})`);
  outputBlank();

  // Feedback
  outputSection("💬 Feedback");
  output(`   ${report.feedback.totalInteractions} interações | ${report.feedback.acceptanceRate}% aceitação | ${report.feedback.challengingRatio}% desafio`);
  if (report.feedback.patterns.length > 0) {
    for (const pattern of report.feedback.patterns) {
      output(`   ${chalk.gray("•")} ${pattern}`);
    }
  }
  outputBlank();

  // Sessions
  if (report.sessions.total > 0) {
    outputSection("🕐 Sessões");
    output(`   Total: ${report.sessions.total} | Média: ${report.sessions.avgDuration}min`);
    if (Object.keys(report.sessions.commandFrequency).length > 0) {
      const topCmds = Object.entries(report.sessions.commandFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      output(`   Comandos: ${topCmds.map(([cmd, count]) => `${cmd}(${count})`).join(", ")}`);
    }
    outputBlank();
  }

  // Insights
  outputSection("💡 Insights");
  for (const insight of report.insights) {
    output(formatInsight(insight));
  }
  outputBlank();

  // Next Steps
  outputSection("📌 Próximos Passos");
  for (let i = 0; i < report.nextSteps.length; i++) {
    output(`   ${i + 1}. ${report.nextSteps[i]}`);
  }
  outputBlank();

  // Summary
  output(chalk.gray(report.summary));
  outputBlank();
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
        output("");
        output(`${chalk.bold.cyan("╔══╗")}  ${chalk.bold("REPORT")}`);
        output(`${chalk.bold.cyan("╚══╝")}  Relatório de Desempenho`);
        outputBlank();
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      void printDaemonBanner(ctx.shitenDir, isJson);

      if (!checkLifecycleGate("report", ctx.projectRoot, ctx.shitenDir, isJson)) {
        return;
      }

      const spinner = ora({ spinner: "dots" }).start(isJson ? "Generating" : "A gerar relatório...");

      try {
        const report = generatePerformanceReport(ctx.projectRoot, ctx.shitenDir, { days });

        spinner.stop();

        if (isJson) {
          outputJson(report as unknown as Record<string, unknown>);
        } else {
          formatReport(report);
        }

        // Save if requested
        if (options.save) {
          const filename = writePerformanceReport(ctx.shitenDir, report);
          if (filename && !isJson) {
            output(chalk.gray(`  Relatório salvo em: reports/${filename}`));
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
          logger.error("report", `Erro: ${error}`);
        }
      }
    });

  return cmd;
}
