/**
 * doctor.ts — Pilar 9: Mentor de Engenharia
 *
 * Transforma o CLI num assistente técnico.
 * Identifica riscos, sugere melhorias, explica impactos,
 * orienta próximos passos e ensina boas práticas.
 *
 * PRINCÍPIO: O Nexus actua como mentor durante o desenvolvimento.
 * Nunca impõe — sempre orienta.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { consolidateState, type NexusState } from "../state-manager.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "../knowledge-debt.js";
import { healthBar, outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";

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

export function analyzeRisks(state: NexusState, debtReport: KnowledgeDebtReport | null): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  // Knowledge debt risks
  if (debtReport && debtReport.totalGaps > 0) {
    const critical = debtReport.gaps.filter((g) => g.severity === "critical");
    if (critical.length > 0) {
      findings.push({
        category: "risk",
        severity: "critical",
        title: "Knowledge debt critical",
        description: `${critical.length} critical knowledge gap(s) detected`,
        impact: "Missing knowledge can lead to repeated mistakes and architectural drift",
        nextSteps: [
          "Review knowledge debt report: nexus assess --json",
          "Address critical gaps first",
          "Create ADRs for undocumented decisions",
        ],
      });
    }
  }

  // Maturity risks
  if (state.project.maturity) {
    const dims = state.project.maturity.dimensions;
    const lowDims = Object.entries(dims).filter(([, v]) => v < 25);
    if (lowDims.length > 0) {
      findings.push({
        category: "risk",
        severity: "high",
        title: "Low maturity dimensions",
        description: `${lowDims.length} dimension(s) below 25%: ${lowDims.map(([k]) => k).join(", ")}`,
        impact: "Low maturity areas are more likely to have issues and require manual intervention",
        nextSteps: [
          `Focus on improving: ${lowDims.map(([k]) => k).join(", ")}`,
          "Run 'nexus upgrade --accept-recommended' to install relevant capabilities",
          "Consider adding governance for low-maturity areas",
        ],
      });
    }
  }

  // Session memory risks
  if (state.memory.blockers.length > 0) {
    findings.push({
      category: "risk",
      severity: "high",
      title: "Active blockers",
      description: `${state.memory.blockers.length} blocker(s) in current session`,
      impact: "Blockers prevent progress and may indicate deeper issues",
      nextSteps: [
        "Review and resolve blockers",
        "Consider splitting blocked task into smaller pieces",
        "Escalate if blockers cannot be resolved locally",
      ],
    });
  }

  // No tests risk
  if (!state.project.projectInfo.hasTests && state.project.projectInfo.sourceFileCount > 20) {
    findings.push({
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
    });
  }

  return findings;
}

export function analyzeImprovements(state: NexusState, nexusDir: string): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  // No CI/CD
  if (!state.project.projectInfo.hasCI) {
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
  if (state.project.installedCapabilities.length < 4) {
    findings.push({
      category: "improvement",
      severity: "low",
      title: "Few capabilities installed",
      description: `Only ${state.project.installedCapabilities.length} capability(ies) installed`,
      impact: "Missing capabilities may leave governance gaps",
      nextSteps: [
        "Run 'nexus upgrade --list' to see available capabilities",
        "Run 'nexus upgrade --accept-recommended' to install suggested capabilities",
      ],
    });
  }

  // No knowledge graph
  const graphPath = join(nexusDir, "governance", "knowledge-graph");
  if (!existsSync(graphPath)) {
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

export function analyzeTeaching(state: NexusState): { findings: DoctorFinding[]; moments: string[] } {
  const findings: DoctorFinding[] = [];
  const moments: string[] = [];

  // Teaching: ADR importance
  if (state.knowledge.adrs.length === 0 && state.knowledge.skills.length > 0) {
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
  if (state.project.installedCapabilities.length > 0 && state.project.recommendedCapabilities.length > 0) {
    moments.push(
      `Your project has ${state.project.installedCapabilities.length} capabilities installed. ` +
      `${state.project.recommendedCapabilities.length} more are recommended based on your maturity profile. ` +
      "Capabilities are modular — install only what you need."
    );
  }

  // Teaching: Knowledge lifecycle
  if (state.knowledge.adrs.length > 0 && state.knowledge.skills.length === 0) {
    moments.push(
      "You have ADRs but no Skills. Consider extracting reusable patterns from your ADRs into Skills. " +
      "This is the Knowledge Lifecycle in action: Observation → Hypothesis → Experiment → Decision → ADR → Skill."
    );
  }

  return { findings, moments };
}

// ── Main Analysis ───────────────────────────────────────────────────────────

export function runDoctorAnalysis(
  projectRoot: string,
  nexusDir: string
): DoctorReport {
  const state = consolidateState(projectRoot, nexusDir);

  // Knowledge debt
  let debtReport: KnowledgeDebtReport | null = null;
  try {
    debtReport = detectKnowledgeDebt(projectRoot, nexusDir);
  } catch {
    // skip
  }

  // Run analyses
  const riskFindings = analyzeRisks(state, debtReport);
  const improvementFindings = analyzeImprovements(state, nexusDir);
  const { findings: teachingFindings, moments: teachingMoments } = analyzeTeaching(state);

  const allFindings = [...riskFindings, ...improvementFindings, ...teachingFindings];

  // Calculate health
  let healthScore = 100;
  for (const f of allFindings) {
    if (f.category === "risk") {
      if (f.severity === "critical") healthScore -= 25;
      else if (f.severity === "high") healthScore -= 15;
      else if (f.severity === "medium") healthScore -= 8;
      else healthScore -= 3;
    }
  }
  healthScore = Math.max(0, Math.min(100, healthScore));

  let overallHealth: DoctorReport["overallHealth"] = "healthy";
  if (healthScore < 50) overallHealth = "critical";
  else if (healthScore < 70) overallHealth = "warning";
  else if (healthScore < 85) overallHealth = "attention";

  const summary = `${allFindings.length} finding(s) — health score: ${healthScore}/100 — ${overallHealth}`;

  return {
    findings: allFindings,
    overallHealth,
    healthScore,
    summary,
    teachingMoments,
  };
}

// ── Command ─────────────────────────────────────────────────────────────────

export const doctorCommand = new Command("doctor")
  .description("Engineering mentor — identify risks, suggest improvements, teach best practices")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║    nexus doctor — Engineering Mentor ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("doctor", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const spinner = ora("Analyzing project health...").start();

    try {
      const report = runDoctorAnalysis(ctx.projectRoot, ctx.nexusDir);
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

      // Display
      const healthColor =
        report.overallHealth === "healthy" ? chalk.green :
        report.overallHealth === "attention" ? chalk.yellow :
        report.overallHealth === "warning" ? chalk.yellow :
        chalk.red;

      console.log(chalk.bold("  Health:"));
      console.log(`    ${healthColor(report.overallHealth.toUpperCase())} — ${report.healthScore}/100 ${healthBar(report.healthScore, 100)}`);
      console.log("");

      // Risks
      const risks = report.findings.filter((f) => f.category === "risk");
      if (risks.length > 0) {
        console.log(chalk.bold.red("  🔍 Risks:"));
        console.log("");
        for (const finding of risks) {
          const icon = finding.severity === "critical" ? "🔴" : finding.severity === "high" ? "🟠" : "🟡";
          console.log(`    ${icon} ${chalk.bold(finding.title)}`);
          console.log(chalk.gray(`       ${finding.description}`));
          console.log(chalk.gray(`       Impact: ${finding.impact}`));
          console.log(chalk.cyan("       Next steps:"));
          for (const step of finding.nextSteps) {
            console.log(chalk.cyan(`         → ${step}`));
          }
          console.log("");
        }
      }

      // Improvements
      const improvements = report.findings.filter((f) => f.category === "improvement");
      if (improvements.length > 0) {
        console.log(chalk.bold.yellow("  💡 Improvements:"));
        console.log("");
        for (const finding of improvements) {
          console.log(`    ⚡ ${chalk.bold(finding.title)}`);
          console.log(chalk.gray(`       ${finding.description}`));
          console.log(chalk.cyan("       Next steps:"));
          for (const step of finding.nextSteps) {
            console.log(chalk.cyan(`         → ${step}`));
          }
          console.log("");
        }
      }

      // Teaching moments
      if (report.teachingMoments.length > 0) {
        console.log(chalk.bold.cyan("  📚 Learn:"));
        console.log("");
        for (const moment of report.teachingMoments) {
          console.log(chalk.gray(`    ${moment}`));
          console.log("");
        }
      }

      // Summary
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

      // Publish event
      getEventBus().publish("health.checked", {
        projectRoot: ctx.projectRoot,
        healthScore: report.healthScore,
        overallHealth: report.overallHealth,
        findings: report.findings.length,
      });

      // Record feedback for improvement findings
      for (const finding of report.findings) {
        if (finding.category === "improvement") {
          recordFeedback(ctx.nexusDir, {
            recommendationId: `doctor-${finding.title}`,
            action: "deferred",
            context: { maturityScore: report.healthScore, installedCapabilities: [], knowledgeDebt: 0 },
          });
        }
      }

    } catch (error) {
      spinner.fail("Doctor analysis failed");
      console.error(chalk.red(`  Error: ${error}`));
      console.log("");
    }
  });
