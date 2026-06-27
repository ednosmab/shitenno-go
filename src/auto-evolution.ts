/**
 * auto-evolution.ts — Pilar 10: Evolução Autónoma
 *
 * Permite que o Nexus recomende a sua própria evolução.
 * Detect → Assess → Recommend → Confirm → Install → Govern → Automate
 *
 * PRINCÍPIO: O crescimento não depende exclusivamente do usuário.
 * O sistema aprende e recomenda a sua própria evolução.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { consolidateState, type NexusState } from "./state-manager.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "./knowledge-debt.js";
import { CAPABILITIES } from "./maturity-profile.js";
import { getAllFeedbackSummaries, adjustConfidence, shouldSuppress, type FeedbackSummary } from "./feedback-loops.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Tipo de recomendação. */
export type RecommendationType =
  | "capability_install"
  | "capability_upgrade"
  | "knowledge_creation"
  | "governance_enhancement"
  | "automation_addition"
  | "debt_remediation"
  | "pattern_extraction"
  | "architecture_improvement";

/** Prioridade da recomendação. */
export type RecommendationPriority = "urgent" | "high" | "medium" | "low";

/** Uma recomendação de evolução. */
export interface EvolutionRecommendation {
  /** ID único. */
  id: string;
  /** Tipo. */
  type: RecommendationType;
  /** Prioridade. */
  priority: RecommendationPriority;
  /** Título. */
  title: string;
  /** Descrição detalhada. */
  description: string;
  /** Impacto esperado. */
  expectedImpact: string;
  /** Acção concreta a executar. */
  action: string;
  /** Comando para executar (se aplicável). */
  command?: string;
  /** Artefactos que serão criados/modificados. */
  affectedArtifacts: string[];
  /** Dependências (outras recomendações que devem vir primeiro). */
  dependencies: string[];
  /** Confiança na recomendação (0-1). */
  confidence: number;
  /** Evidência que suporta a recomendação. */
  evidence: string[];
  /** Se a confiança foi ajustada por feedback. */
  feedbackAdjusted: boolean;
}

/** Resultado da análise de evolução. */
export interface EvolutionReport {
  /** Data da análise. */
  analyzedAt: string;
  /** Estado actual do projecto. */
  currentState: {
    maturityScore: number;
    installedCapabilities: string[];
    knowledgeDebtScore: number;
  };
  /** Total de recomendações. */
  totalRecommendations: number;
  /** Recomendações por tipo. */
  byType: Record<RecommendationType, number>;
  /** Recomendações por prioridade. */
  byPriority: Record<RecommendationPriority, number>;
  /** Lista de recomendações. */
  recommendations: EvolutionRecommendation[];
  /** Próximos passos mais importantes. */
  topNextSteps: string[];
  /** Resumo. */
  summary: string;
}

// ── Recommendation Generators ───────────────────────────────────────────────

function generateCapabilityRecommendations(state: NexusState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 1;

  for (const capId of state.project.recommendedCapabilities) {
    const capInfo = CAPABILITIES.find((c) => c.id === capId);
    if (!capInfo) continue;

    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`,
      type: "capability_install",
      priority: "high",
      title: `Install ${capInfo.name} capability`,
      description: capInfo.description,
      expectedImpact: `Adds ${capInfo.name.toLowerCase()} governance to your project`,
      action: `Run 'nexus upgrade --capability ${capId}'`,
      command: `nexus upgrade --capability ${capId}`,
      affectedArtifacts: [`nexus-system/ (${capInfo.name})`],
      dependencies: capInfo.requires.map((r) => `capability:${r}`),
      confidence: 0.8,
      evidence: [`Maturity profile recommends this capability`],
      feedbackAdjusted: false,
    });
  }

  return recs;
}

function generateKnowledgeRecommendations(
  state: NexusState,
  debtReport: KnowledgeDebtReport | null
): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 100;

  // ADR creation
  if (state.knowledge.adrs.length === 0 && state.project.projectInfo.sourceFileCount > 10) {
    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`,
      type: "knowledge_creation",
      priority: "high",
      title: "Create first ADR",
      description: "No Architecture Decision Records found. ADRs document important decisions.",
      expectedImpact: "Captures decision rationale for future reference",
      action: "Create an ADR for your most recent architectural decision",
      affectedArtifacts: ["docs/adrs/ADR-001.md"],
      dependencies: [],
      confidence: 0.9,
      evidence: ["No ADRs in project", "Project has source files indicating decisions were made"],
      feedbackAdjusted: false,
    });
  }

  // Skill extraction
  if (state.knowledge.adrs.length > 3 && state.knowledge.skills.length === 0) {
    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`,
      type: "pattern_extraction",
      priority: "medium",
      title: "Extract skills from ADRs",
      description: `${state.knowledge.adrs.length} ADRs exist but no Skills — patterns not extracted`,
      expectedImpact: "Reusable patterns improve consistency across sessions",
      action: "Review ADRs and extract common patterns into Skills",
      affectedArtifacts: ["docs/skills/"],
      dependencies: [],
      confidence: 0.7,
      evidence: [`${state.knowledge.adrs.length} ADRs, 0 skills`],
      feedbackAdjusted: false,
    });
  }

  // Knowledge debt remediation
  if (debtReport && debtReport.totalGaps > 0) {
    const criticalGaps = debtReport.gaps.filter((g) => g.severity === "critical" || g.severity === "high");
    if (criticalGaps.length > 0) {
      recs.push({
        id: `EVO-${String(id++).padStart(3, "0")}`,
        type: "debt_remediation",
        priority: "urgent",
        title: "Address knowledge debt",
        description: `${criticalGaps.length} critical/high knowledge gap(s) detected`,
        expectedImpact: "Reduces risk of repeated mistakes and knowledge loss",
        action: "Review and address critical knowledge gaps",
        affectedArtifacts: criticalGaps.map((g) => g.location),
        dependencies: [],
        confidence: 0.95,
        evidence: criticalGaps.map((g) => g.description),
        feedbackAdjusted: false,
      });
    }
  }

  return recs;
}

function generateGovernanceRecommendations(state: NexusState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 200;

  // No workflow
  const hasWorkflow = state.knowledge.governanceDocs.some((d) => d.name === "WORKFLOW.md");
  if (!hasWorkflow && state.project.installedCapabilities.includes("governance")) {
    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`,
      type: "governance_enhancement",
      priority: "medium",
      title: "Create workflow document",
      description: "Governance capability installed but no WORKFLOW.md found",
      expectedImpact: "Defines standard session procedures for consistency",
      action: "Create governance/WORKFLOW.md with session flow",
      affectedArtifacts: ["governance/WORKFLOW.md"],
      dependencies: ["capability:governance"],
      confidence: 0.85,
      evidence: ["Governance capability installed", "No WORKFLOW.md"],
      feedbackAdjusted: false,
    });
  }

  // No system map
  const hasSystemMap = state.knowledge.governanceDocs.some((d) => d.name === "SYSTEM_MAP.md");
  if (!hasSystemMap) {
    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`,
      type: "governance_enhancement",
      priority: "low",
      title: "Create system map",
      description: "No SYSTEM_MAP.md — directory structure not documented",
      expectedImpact: "Helps navigate the governance structure",
      action: "Create governance/SYSTEM_MAP.md",
      affectedArtifacts: ["governance/SYSTEM_MAP.md"],
      dependencies: [],
      confidence: 0.6,
      evidence: ["No SYSTEM_MAP.md found"],
      feedbackAdjusted: false,
    });
  }

  return recs;
}

function generateAutomationRecommendations(state: NexusState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 300;

  if (state.knowledge.scripts.length < 3 && state.project.projectInfo.sourceFileCount > 30) {
    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`,
      type: "automation_addition",
      priority: "medium",
      title: "Add more automation scripts",
      description: `Only ${state.knowledge.scripts.length} script(s) for a project with ${state.project.projectInfo.sourceFileCount} files`,
      expectedImpact: "Reduces manual work and human error",
      action: "Identify repetitive processes and create automation scripts",
      affectedArtifacts: ["nexus-system/scripts/"],
      dependencies: [],
      confidence: 0.7,
      evidence: [`${state.knowledge.scripts.length} scripts, ${state.project.projectInfo.sourceFileCount} source files`],
      feedbackAdjusted: false,
    });
  }

  return recs;
}

// ── Main Analysis ───────────────────────────────────────────────────────────

/** Executa análise de evolução autónoma. */
export function analyzeEvolution(
  projectRoot: string,
  nexusDir: string
): EvolutionReport {
  const state = consolidateState(projectRoot, nexusDir);

  let debtReport: KnowledgeDebtReport | null = null;
  try {
    debtReport = detectKnowledgeDebt(projectRoot, nexusDir);
  } catch {
    // skip
  }

  // Generate all recommendations
  const allRecommendations: EvolutionRecommendation[] = [
    ...generateCapabilityRecommendations(state),
    ...generateKnowledgeRecommendations(state, debtReport),
    ...generateGovernanceRecommendations(state),
    ...generateAutomationRecommendations(state),
  ];

  // Load feedback and adjust confidence
  const feedbackSummaries = getAllFeedbackSummaries(nexusDir);
  let suppressedCount = 0;

  for (const rec of allRecommendations) {
    const summary = feedbackSummaries[rec.id] as FeedbackSummary | undefined;

    if (summary) {
      // Suppress if rejected too many times
      if (shouldSuppress(summary)) {
        rec.confidence = 0;
        rec.feedbackAdjusted = true;
        suppressedCount++;
        continue;
      }

      // Adjust confidence based on feedback
      if (summary.acceptCount > 0) {
        rec.confidence = adjustConfidence(rec.confidence, "accepted");
        rec.feedbackAdjusted = true;
      }
      if (summary.rejectCount > 0) {
        rec.confidence = adjustConfidence(rec.confidence, "rejected");
        rec.feedbackAdjusted = true;
      }
    }
  }

  // Filter out suppressed recommendations
  const recommendations = allRecommendations.filter((r) => r.confidence > 0);

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Count by type and priority
  const byType = {} as Record<RecommendationType, number>;
  const byPriority = {} as Record<RecommendationPriority, number>;
  for (const rec of recommendations) {
    byType[rec.type] = (byType[rec.type] || 0) + 1;
    byPriority[rec.priority] = (byPriority[rec.priority] || 0) + 1;
  }

  // Top next steps
  const topNextSteps = recommendations
    .filter((r) => r.priority === "urgent" || r.priority === "high")
    .slice(0, 5)
    .map((r) => r.command || r.action);

  // Summary
  const parts: string[] = [];
  parts.push(`${recommendations.length} recommendation(s).`);
  if (byPriority.urgent) parts.push(`${byPriority.urgent} urgent.`);
  if (byPriority.high) parts.push(`${byPriority.high} high.`);
  if (suppressedCount > 0) parts.push(`${suppressedCount} suppressed by feedback.`);
  parts.push(`Maturity: ${state.project.maturity?.overallScore || 0}/100.`);
  parts.push(`Debt: ${debtReport?.healthScore || 100}/100.`);

  return {
    analyzedAt: new Date().toISOString(),
    currentState: {
      maturityScore: state.project.maturity?.overallScore || 0,
      installedCapabilities: state.project.installedCapabilities,
      knowledgeDebtScore: debtReport?.healthScore || 100,
    },
    totalRecommendations: recommendations.length,
    byType,
    byPriority,
    recommendations,
    topNextSteps,
    summary: parts.join(" "),
  };
}

// ── Report Writer ───────────────────────────────────────────────────────────

/** Grava relatório de evolução. */
export function writeEvolutionReport(
  nexusDir: string,
  report: EvolutionReport
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `evolution-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
