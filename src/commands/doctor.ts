/**
 * doctor.ts — Pilar 9: Mentor de Engenharia
 *
 * Transforma o CLI num assistente técnico.
 * Identifica riscos, sugere melhorias, explica impactos,
 * orienta próximos passos e ensina boas práticas.
 *
 * PRINCÍPIO: O Shugo actua como mentor durante o desenvolvimento.
 * Nunca impõe — sempre orienta.
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../logger.js";
import ora from "ora";
import { type EngineeringState, consolidateEngineeringState } from "../engineering-state.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "../knowledge-debt.js";
import { healthBar, outputJson, calculateHealthPenalty } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";
import { output, outputBlank, outputError } from "../output.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface DoctorFinding {
  category: "risk" | "improvement" | "info" | "teaching";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  nextSteps: string[];
  learnMore?: string;
}

interface DoctorReport {
  findings: DoctorFinding[];
  overallHealth: "healthy" | "attention" | "warning" | "critical";
  healthScore: number;
  summary: string;
  teachingMoments: string[];
}

// ── Analysis Functions ──────────────────────────────────────────────────────

export function analyzeRisks(state: EngineeringState, debtReport: KnowledgeDebtReport | null): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  findings.push(...checkKnowledgeDebtRisk(debtReport));
  findings.push(...checkMaturityRisk(state));
  findings.push(...checkMissingTestsRisk(state));
  return findings;
}

export function analyzeImprovements(state: EngineeringState): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  // No CI/CD
  if (!state.project.hasCI) {
    findings.push({
      category: "improvement",
      severity: "medium",
      title: "No CI/CD pipeline",
      description: "No continuous integration or deployment pipeline detected",
      impact: "Manual builds and deploys increase risk of human error",
      nextSteps: [
        "Set up GitHub Actions for CI",
        "Configure automated testing on PRs",
        "Add deployment automation",
      ],
    });
  }

  // Low capability count
  if (state.capabilities.length < 4) {
    findings.push({
      category: "improvement",
      severity: "low",
      title: "Few capabilities installed",
      description: `Only ${state.capabilities.length} capability(ies) installed`,
      impact: "Missing capabilities may leave governance gaps",
      nextSteps: [
        "Run 'shugo upgrade --list' to see available capabilities",
        "Run 'shugo upgrade --accept-recommended' to install suggested capabilities",
      ],
    });
  }

  // No knowledge graph
  if (!state.knowledgeGraph || state.knowledgeGraph.totalArtifacts === 0) {
    findings.push({
      category: "improvement",
      severity: "low",
      title: "Knowledge graph not initialized",
      description: "Artifact relationships are not being tracked",
      impact: "Cannot trace how knowledge flows through the project",
      nextSteps: [
        "Initialize knowledge graph to track artifact relationships",
        "Discover existing artifacts and their connections",
      ],
    });
  }

  return findings;
}

export function analyzeTeaching(state: EngineeringState): { findings: DoctorFinding[]; moments: string[] } {
  const findings: DoctorFinding[] = [];
  const moments: string[] = [];

  const adrs = state.assets.filter((a) => a.type === "adr");
  const skills = state.assets.filter((a) => a.type === "skill");

  // Teaching: ADR importance
  if (adrs.length === 0 && skills.length > 0) {
    findings.push({
      category: "teaching",
      severity: "low",
      title: "ADRs capture decisions, Skills capture patterns",
      description: "ADRs record WHY a decision was made. Skills record HOW to apply patterns.",
      impact: "Understanding the difference helps maintain clean knowledge separation",
      nextSteps: [
        "For each architectural decision, create an ADR in docs/adrs/",
        "For reusable patterns, create a Skill in docs/skills/",
      ],
      learnMore: "docs/KNOWLEDGE_LIFECYCLE.md",
    });
    moments.push("ADRs are immutable records of decisions — they document the 'why'. Skills are living documents — they evolve as patterns mature.");
  }

  // Teaching: Capability system
  if (state.capabilities.length > 0 && state.maturity?.recommendedCapabilities && state.maturity.recommendedCapabilities.length > 0) {
    moments.push(
      `Your project has ${state.capabilities.length} capabilities installed. ` +
      `${state.maturity.recommendedCapabilities.length} more are recommended based on your maturity profile. ` +
      "Capabilities are modular — install only what you need."
    );
  }

  // Teaching: Knowledge lifecycle
  if (adrs.length > 0 && skills.length === 0) {
    moments.push(
      "You have ADRs but no Skills. Consider extracting reusable patterns from your ADRs into Skills. " +
      "This is the Knowledge Lifecycle in action: Observation → Hypothesis → Experiment → Decision → ADR → Skill."
    );
  }

  return { findings, moments };
}

function checkKnowledgeDebtRisk(debtReport: KnowledgeDebtReport | null): DoctorFinding[] {
  if (!debtReport || debtReport.totalGaps === 0) return [];
  const critical = debtReport.gaps.filter((g) => g.severity === "critical");
  if (critical.length === 0) return [];
  return [{
    category: "risk",
    severity: "critical",
    title: "Knowledge debt critical",
    description: `${critical.length} critical knowledge gap(s) detected`,
    impact: "Missing knowledge can lead to repeated mistakes and architectural drift",
    nextSteps: [
      "Review knowledge debt report: shugo assess --json",
      "Address critical gaps first",
      "Create ADRs for undocumented decisions",
    ],
  }];
}

function checkMaturityRisk(state: EngineeringState): DoctorFinding[] {
  if (!state.maturity) return [];
  const dims = state.maturity.dimensions;
  const lowDims = Object.entries(dims).filter(([, v]) => v < 25);
  if (lowDims.length === 0) return [];
  return [{
    category: "risk",
    severity: "high",
    title: "Low maturity dimensions",
    description: `${lowDims.length} dimension(s) below 25%: ${lowDims.map(([k]) => k).join(", ")}`,
    impact: "Low maturity areas are more likely to have issues and require manual intervention",
    nextSteps: [
      `Focus on improving: ${lowDims.map(([k]) => k).join(", ")}`,
      "Run 'shugo upgrade --accept-recommended' to install relevant capabilities",
      "Consider adding governance for low-maturity areas",
    ],
  }];
}

function checkMissingTestsRisk(state: EngineeringState): DoctorFinding[] {
  if (state.project.hasTests || state.project.sourceFileCount <= 20) return [];
  return [{
    category: "risk",
    severity: "medium",
    title: "No automated tests",
    description: "Project has source files but no test framework detected",
    impact: "Changes may introduce regressions without detection",
    nextSteps: [
      "Add a test framework (vitest, jest, or playwright)",
      "Write tests for critical paths first",
      "Enable CI testing",
    ],
    learnMore: "docs/skills/tdd_workflow.md",
  }];
}

// ── Main Analysis ───────────────────────────────────────────────────────────

export function runDoctorAnalysis(
  projectRoot: string,
  shitennoDir: string
): DoctorReport {
  const state = consolidateEngineeringState(projectRoot, shitennoDir);

  // Knowledge debt
  let debtReport: KnowledgeDebtReport | null = null;
  try {
    debtReport = detectKnowledgeDebt(projectRoot, shitennoDir);
  } catch {
    logger.debug("doctor", "Knowledge debt detection unavailable");
  }

  // Run analyses
  const riskFindings = analyzeRisks(state, debtReport);
  const improvementFindings = analyzeImprovements(state);
  const { findings: teachingFindings, moments: teachingMoments } = analyzeTeaching(state);

  const allFindings = [...riskFindings, ...improvementFindings, ...teachingFindings];

  // Calculate health
  let healthScore = 100;
  for (const f of allFindings) {
    if (f.category === "risk") {
      healthScore -= calculateHealthPenalty(f.severity);
    }
  }
  healthScore = Math.max(0, Math.min(100, healthScore));

  let overallHealth: DoctorReport["overallHealth"] = "healthy";
  if (healthScore < 50) overallHealth = "critical";
  else if (healthScore < 70) overallHealth = "warning";
  else if (healthScore < 85) overallHealth = "attention";

  const summary = `${allFindings.length} finding(s) — risk health: ${healthScore}/100 — ${overallHealth}`;

  return {
    findings: allFindings,
    overallHealth,
    healthScore,
    summary,
    teachingMoments,
  };
}

// ── Command ─────────────────────────────────────────────────────────────────

function displayDoctorHeader(): void {
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║    shugo doctor — Engineering Mentor ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

function displayHealthStatus(report: DoctorReport): void {
  const healthColor =
    report.overallHealth === "healthy" ? chalk.green :
    report.overallHealth === "attention" ? chalk.yellow :
    report.overallHealth === "warning" ? chalk.yellow :
    chalk.red;
  output(chalk.bold("  Health:"));
  output(`    ${healthColor(report.overallHealth.toUpperCase())} — ${report.healthScore}/100 ${healthBar(report.healthScore, 100)}`);
  outputBlank();
}

function displayFindings(findings: DoctorFinding[], label: string, color: typeof chalk.bold.red): void {
  if (findings.length === 0) return;
  output(color(`  ${label}:`));
  outputBlank();
  for (const finding of findings) {
    const sevIcon = finding.severity === "critical" ? "🔴" : finding.severity === "high" ? "🟠" : "🟡";
    output(`    ${sevIcon} ${chalk.bold(finding.title)}`);
    output(chalk.gray(`       ${finding.description}`));
    output(chalk.gray(`       Impact: ${finding.impact}`));
    output(chalk.cyan("       Next steps:"));
    for (const step of finding.nextSteps) {
      output(chalk.cyan(`         → ${step}`));
    }
    outputBlank();
  }
}

function displayTeachingMoments(moments: string[]): void {
  if (moments.length === 0) return;
  output(chalk.bold.cyan("  📚 Learn:"));
  outputBlank();
  for (const moment of moments) {
    output(chalk.gray(`    ${moment}`));
    outputBlank();
  }
}

function publishDoctorEvent(
  projectRoot: string,
  report: DoctorReport
): void {
  getEventBus().publish("health.checked", {
    projectRoot,
    healthScore: report.healthScore,
    overallHealth: report.overallHealth,
    findings: report.findings.length,
  });
  for (const finding of report.findings) {
    if (finding.category === "improvement") {
      recordFeedback(projectRoot, {
        recommendationId: `doctor-${finding.title}`,
        action: "deferred",
        context: { maturityScore: report.healthScore, installedCapabilities: [], knowledgeDebt: 0 },
      });
    }
  }
}

export const doctorCommand = new Command("doctor")
  .description("Engineering mentor — identify risks, suggest improvements, teach best practices")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    if (!isJson) displayDoctorHeader();

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("doctor", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    const spinner = ora("Analyzing project health...").start();

    try {
      const report = runDoctorAnalysis(ctx.projectRoot, ctx.shitennoDir);
      spinner.stop();

      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          overallHealth: report.overallHealth,
          healthScore: report.healthScore,
          findings: report.findings,
          teachingMoments: report.teachingMoments,
          summary: report.summary,
        });
        return;
      }

      displayHealthStatus(report);
      displayFindings(report.findings.filter((f) => f.category === "risk"), "🔍 Risks", chalk.bold.red);
      displayFindings(report.findings.filter((f) => f.category === "improvement"), "💡 Improvements", chalk.bold.yellow);
      displayTeachingMoments(report.teachingMoments);
      output(chalk.bold("  📝 Summary:"));
      output(chalk.gray(`    ${report.summary}`));
      outputBlank();
      publishDoctorEvent(ctx.projectRoot, report);
    } catch (error) {
      spinner.fail("Doctor analysis failed");
      outputError(chalk.red(`  Error: ${error}`));
      outputBlank();
    }
  });
