/**
 * recommendation-engine.ts — Recommendation Engine
 *
 * Continuously answers: "What is the next best action to increase
 * engineering capacity?" Considers complexity, engineering state,
 * knowledge debt, AI readiness, and capabilities.
 *
 * PRINCIPLE: The system should always know what to do next.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";
import type { EngineeringState, AssetType } from "./engineering-state.js";
import type { CapabilityEngineResult } from "./capability-engine.js";
import type { KnowledgeDebtReport } from "./knowledge-debt.js";
import type { PatternDetectionReport } from "./pattern-detector.js";
import { getAllFeedbackSummaries, adjustConfidence, shouldSuppress } from "./feedback-loops.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Source of a recommendation. */
export type RecommendationSource =
  | "capability_engine"
  | "knowledge_debt"
  | "pattern_detection"
  | "entropy_reduction"
  | "ai_readiness"
  | "complexity_analysis"
  | "asset_management";

/** A recommendation from the engine. */
export interface Recommendation {
  /** Unique identifier. */
  id: string;
  /** Source subsystem. */
  source: RecommendationSource;
  /** Type of recommendation. */
  type: string;
  /** Priority. */
  priority: "urgent" | "high" | "medium" | "low";
  /** Title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Expected impact. */
  expectedImpact: string;
  /** Concrete action to take. */
  action: string;
  /** Command to execute (if applicable). */
  command?: string;
  /** Affected artifacts. */
  affectedArtifacts: string[];
  /** Dependencies (other recommendations that should come first). */
  dependencies: string[];
  /** Confidence (0-1). */
  confidence: number;
  /** Evidence supporting the recommendation. */
  evidence: string[];
  /** When this recommendation was generated. */
  generatedAt: string;
}

/** Result of the recommendation engine. */
export interface RecommendationEngineResult {
  /** Timestamp. */
  generatedAt: string;
  /** Total recommendations. */
  totalRecommendations: number;
  /** By source. */
  bySource: Record<RecommendationSource, number>;
  /** By priority. */
  byPriority: Record<string, number>;
  /** List of recommendations. */
  recommendations: Recommendation[];
  /** Top next steps (up to 5). */
  topNextSteps: string[];
  /** Overall engineering capacity score (0-100). */
  engineeringCapacityScore: number;
  /** Summary. */
  summary: string;
}

// ── Recommendation Generators ───────────────────────────────────────────────

function generateFromCapabilityEngine(
  capResult: CapabilityEngineResult
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const capRec of capResult.recommendations) {
    recs.push({
      id: `REC-CAP-${capRec.capability.toUpperCase()}`,
      source: "capability_engine",
      type: capRec.action,
      priority: capRec.priority,
      title: `${capRec.action.charAt(0).toUpperCase() + capRec.action.slice(1)} ${capRec.capability} capability`,
      description: capRec.reason,
      expectedImpact: capRec.expectedImpact,
      action: `Activate and configure ${capRec.capability} capability`,
      command: `nexus upgrade --capability ${capRec.capability}`,
      affectedArtifacts: [`nexus-system/ (${capRec.capability})`],
      dependencies: capRec.dependencies.map((d) => `REC-CAP-${d.toUpperCase()}`),
      confidence: 0.8,
      evidence: [capRec.reason],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

function generateFromKnowledgeDebt(
  debtReport: KnowledgeDebtReport | null
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!debtReport || debtReport.totalGaps === 0) return recs;

  const criticalGaps = debtReport.gaps.filter(
    (g) => g.severity === "critical" || g.severity === "high"
  );

  if (criticalGaps.length > 0) {
    recs.push({
      id: "REC-DEBT-CRITICAL",
      source: "knowledge_debt",
      type: "debt_remediation",
      priority: "urgent",
      title: "Address critical knowledge debt",
      description: `${criticalGaps.length} critical/high knowledge gap(s) detected`,
      expectedImpact: "Reduces risk of repeated mistakes and knowledge loss",
      action: "Review and address critical knowledge gaps",
      affectedArtifacts: criticalGaps.map((g) => g.location),
      dependencies: [],
      confidence: 0.95,
      evidence: criticalGaps.map((g) => g.description),
      generatedAt: new Date().toISOString(),
    });
  }

  // Individual gap recommendations
  for (const gap of debtReport.gaps.slice(0, 5)) {
    recs.push({
      id: `REC-DEBT-${gap.id}`,
      source: "knowledge_debt",
      type: gap.type,
      priority: gap.severity === "critical" ? "urgent" : gap.severity === "high" ? "high" : "medium",
      title: gap.recommendation,
      description: gap.description,
      expectedImpact: `Resolves ${gap.type.replace(/_/g, " ")} gap`,
      action: gap.recommendation,
      affectedArtifacts: [gap.location],
      dependencies: gap.severity === "critical" ? ["REC-DEBT-CRITICAL"] : [],
      confidence: 0.7,
      evidence: [gap.description],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

function generateFromPatternDetection(
  patternReport: PatternDetectionReport | null
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!patternReport || patternReport.patterns.length === 0) return recs;

  for (const pattern of patternReport.patterns.slice(0, 3)) {
    if (pattern.severity >= 3) {
      recs.push({
        id: `REC-PATTERN-${pattern.type.toUpperCase()}`,
        source: "pattern_detection",
        type: "pattern_response",
        priority: pattern.severity >= 4 ? "high" : "medium",
        title: `Address ${pattern.type.replace(/_/g, " ")} pattern`,
        description: pattern.description,
        expectedImpact: "Prevents recurring issues",
        action: pattern.evidence[0] || "Review pattern and take corrective action",
        affectedArtifacts: [pattern.affectedArea],
        dependencies: [],
        confidence: 0.6,
        evidence: pattern.evidence,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return recs;
}

function generateFromEntropy(
  state: EngineeringState
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (state.entropy.orphanedAssets > 3) {
    recs.push({
      id: "REC-ENTROPY-ORPHANS",
      source: "entropy_reduction",
      type: "entropy_reduction",
      priority: "medium",
      title: "Connect orphaned assets",
      description: `${state.entropy.orphanedAssets} assets have no relations — knowledge is fragmented`,
      expectedImpact: "Improves knowledge graph connectivity and discoverability",
      action: "Add relations between orphaned assets in the knowledge graph",
      affectedArtifacts: state.assets
        .filter((_a) => !state.knowledgeGraph || true) // simplified
        .slice(0, state.entropy.orphanedAssets)
        .map((a) => a.path),
      dependencies: [],
      confidence: 0.65,
      evidence: [`${state.entropy.orphanedAssets} orphaned assets detected`],
      generatedAt: new Date().toISOString(),
    });
  }

  if (state.entropy.score > 50) {
    recs.push({
      id: "REC-ENTROPY-HIGH",
      source: "entropy_reduction",
      type: "entropy_reduction",
      priority: "high",
      title: "Reduce organizational entropy",
      description: `Entropy score is ${state.entropy.score}/100 — significant organizational decay`,
      expectedImpact: "Preserves engineering organization and knowledge",
      action: "Review and clean up stale assets, connect orphaned artifacts",
      affectedArtifacts: [],
      dependencies: [],
      confidence: 0.8,
      evidence: [`Entropy score: ${state.entropy.score}/100`],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

function generateFromAIReadiness(
  state: EngineeringState
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Check AI readiness indicators
  const hasAgentContracts = state.assets.some((a) => a.type === "contract");
  const hasPrompts = state.assets.some((a) => a.type === "prompt");

  if (!hasAgentContracts && state.project.sourceFileCount > 50) {
    recs.push({
      id: "REC-AI-CONTRACTS",
      source: "ai_readiness",
      type: "ai_readiness",
      priority: "medium",
      title: "Add AI agent contracts",
      description: "Project has significant code but no AI agent contracts",
      expectedImpact: "Enables structured AI assistance with defined roles",
      action: "Create AI agent contracts for planner, executor, and reviewer roles",
      command: "nexus upgrade --capability ai",
      affectedArtifacts: ["governance/agents/"],
      dependencies: [],
      confidence: 0.7,
      evidence: [`${state.project.sourceFileCount} source files, no agent contracts`],
      generatedAt: new Date().toISOString(),
    });
  }

  if (!hasPrompts && hasAgentContracts) {
    recs.push({
      id: "REC-AI-PROMPTS",
      source: "ai_readiness",
      type: "ai_readiness",
      priority: "low",
      title: "Add AI prompts",
      description: "Agent contracts exist but no structured prompts",
      expectedImpact: "Improves AI interaction quality",
      action: "Create structured prompts for each agent role",
      affectedArtifacts: ["cognition/prompts/"],
      dependencies: ["REC-AI-CONTRACTS"],
      confidence: 0.5,
      evidence: ["Agent contracts exist, no prompts"],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

function generateFromAssetManagement(
  state: EngineeringState
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Check for missing asset types
  const assetTypes = new Set(state.assets.map((a) => a.type));
  const criticalAssets: AssetType[] = ["adr", "skill", "workflow", "contract"];

  for (const assetType of criticalAssets) {
    if (!assetTypes.has(assetType)) {
      recs.push({
        id: `REC-ASSET-${assetType.toUpperCase()}`,
        source: "asset_management",
        type: "asset_creation",
        priority: assetType === "workflow" ? "high" : "medium",
        title: `Create ${assetType} assets`,
        description: `No ${assetType} assets found in the project`,
        expectedImpact: `Adds ${assetType} governance to the project`,
        action: `Create initial ${assetType} asset`,
        affectedArtifacts: [],
        dependencies: [],
        confidence: 0.6,
        evidence: [`No ${assetType} assets in project`],
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return recs;
}

// ── Main Engine ─────────────────────────────────────────────────────────────

/** Run the recommendation engine. */
export function runRecommendationEngine(
  state: EngineeringState,
  capResult: CapabilityEngineResult,
  nexusDir: string,
  patternReport: PatternDetectionReport | null = null,
  knowledgeDebtReport: KnowledgeDebtReport | null = null
): RecommendationEngineResult {
  // Collect recommendations from all sources
  const allRecommendations: Recommendation[] = [
    ...generateFromCapabilityEngine(capResult),
    ...generateFromKnowledgeDebt(knowledgeDebtReport ?? state.knowledgeDebt as KnowledgeDebtReport | null),
    ...generateFromPatternDetection(patternReport),
    ...generateFromEntropy(state),
    ...generateFromAIReadiness(state),
    ...generateFromAssetManagement(state),
  ];

  // Apply feedback loop: adjust confidence and suppress frequently rejected recommendations
  const feedbackSummaries = getAllFeedbackSummaries(nexusDir);
  const adjustedRecommendations: Recommendation[] = [];

  for (const rec of allRecommendations) {
    const summary = feedbackSummaries[rec.id];

    // Skip if recommendation should be suppressed
    if (summary && shouldSuppress(summary)) {
      continue;
    }

    // Adjust confidence based on feedback history
    if (summary) {
      if (summary.lastAction === "accepted") {
        rec.confidence = adjustConfidence(rec.confidence, "accepted");
      } else if (summary.lastAction === "rejected") {
        rec.confidence = adjustConfidence(rec.confidence, "rejected");
      }
    }

    adjustedRecommendations.push(rec);
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  adjustedRecommendations.sort(
    (x, y) => priorityOrder[x.priority] - priorityOrder[y.priority]
  );

  // Count by source and priority
  const bySource: Record<RecommendationSource, number> = {
    capability_engine: 0,
    knowledge_debt: 0,
    pattern_detection: 0,
    entropy_reduction: 0,
    ai_readiness: 0,
    complexity_analysis: 0,
    asset_management: 0,
  };
  const byPriority: Record<string, number> = {};

  for (const rec of adjustedRecommendations) {
    bySource[rec.source]++;
    byPriority[rec.priority] = (byPriority[rec.priority] || 0) + 1;
  }

  // Top next steps
  const topNextSteps = adjustedRecommendations
    .filter((r) => r.priority === "urgent" || r.priority === "high")
    .slice(0, 5)
    .map((r) => r.command || r.action);

  // Engineering capacity score
  const knowledgeDebtScore = state.healthScores.knowledgeDebt;
  const graphScore = state.healthScores.knowledgeGraph;
  const entropyInverse = 100 - state.entropy.score;
  const capScore = capResult.overallScore;
  const engineeringCapacityScore = Math.round(
    knowledgeDebtScore * 0.25 +
    graphScore * 0.2 +
    entropyInverse * 0.25 +
    capScore * 0.3
  );

  // Summary
  const parts: string[] = [];
  parts.push(`${adjustedRecommendations.length} recommendation(s).`);
  if (byPriority.urgent) parts.push(`${byPriority.urgent} urgent.`);
  if (byPriority.high) parts.push(`${byPriority.high} high.`);
  parts.push(`Engineering capacity: ${engineeringCapacityScore}/100.`);

  return {
    generatedAt: new Date().toISOString(),
    totalRecommendations: adjustedRecommendations.length,
    bySource,
    byPriority,
    recommendations: adjustedRecommendations,
    topNextSteps,
    engineeringCapacityScore,
    summary: parts.join(" "),
  };
}

// ── Persistence ────────────────────────────────────────────────────────────

/** Save recommendation engine result to disk. */
export function saveRecommendationResult(
  nexusDir: string,
  result: RecommendationEngineResult
): void {
  const filePath = join(nexusDir, "recommendation-engine.json");
  writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
}

/** Load recommendation engine result from disk. */
export function loadRecommendationResult(
  nexusDir: string
): RecommendationEngineResult | null {
  const filePath = join(nexusDir, "recommendation-engine.json");
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as RecommendationEngineResult;
  } catch (err) {
    logger.debug("recommendation-engine", `Cannot load recommendation result: ${err}`);
    return null;
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

/** Generate human-readable report. */
export function recommendationEngineToText(result: RecommendationEngineResult): string {
  const lines: string[] = [];

  lines.push("# Recommendation Engine Report");
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Engineering Capacity: ${result.engineeringCapacityScore}/100`);
  lines.push("");

  // By source
  lines.push("## By Source");
  for (const [source, count] of Object.entries(result.bySource)) {
    if (count > 0) {
      lines.push(`  ${source}: ${count}`);
    }
  }
  lines.push("");

  // Top next steps
  if (result.topNextSteps.length > 0) {
    lines.push("## Top Next Steps");
    for (const step of result.topNextSteps) {
      lines.push(`  → ${step}`);
    }
    lines.push("");
  }

  // Recommendations
  lines.push("## Recommendations");
  for (const rec of result.recommendations) {
    const icon = rec.priority === "urgent" ? "🔴" : rec.priority === "high" ? "🟡" : rec.priority === "medium" ? "🔵" : "⚪";
    lines.push(`  ${icon} [${rec.id}] ${rec.priority.toUpperCase()} — ${rec.title}`);
    lines.push(`     ${rec.description}`);
    lines.push(`     Impact: ${rec.expectedImpact}`);
    if (rec.command) lines.push(`     Command: ${rec.command}`);
    lines.push("");
  }

  return lines.join("\n");
}
