/**
 * engineering-state.ts — Engineering State: Single Source of Truth
 *
 * Consolidates all engineering information into a single canonical state.
 * Thin orchestrator — discovery in engineering-state-discovery.ts,
 * persistence in engineering-state-io.ts.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyseProject } from "./analyser.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "./knowledge-debt.js";
import { getEventBus } from "./event-bus.js";
import { logger } from "./logger.js";
import { getKnowledgeHealthScore } from "./health-score-registry.js";
import {
  detectCapabilitySignalsFromFilesystem,
  loadMaturityProfile,
} from "./maturity-profile.js";
import { detectLifecycleState, type NexusLifecycleState } from "./nexus-state-machine.js";
import {
  loadArtifacts,
  loadRelations,
  analyzeGraph,
  type Relation,
} from "./knowledge-graph.js";

// ── Types (re-exported from domain entities) ────────────────────────────────

import type { AssetType, EngineeringAsset, EngineeringState } from "./domain/entities/engineering-state.js";

export type { AssetType, EngineeringAsset, EngineeringState } from "./domain/entities/engineering-state.js";

// ── Re-exports from split modules ───────────────────────────────────────────

export { discoverAssets } from "./engineering-state-discovery.js";
export {
  saveEngineeringState,
  loadEngineeringState,
  engineeringStateToText,
} from "./engineering-state-io.js";

// ── Import from split modules ───────────────────────────────────────────────

import { discoverAssets } from "./engineering-state-discovery.js";
import {
  saveEngineeringState,
  loadEngineeringState,
} from "./engineering-state-io.js";

// ── Entropy Calculation ────────────────────────────────────────────────────

const STALE_THRESHOLDS_DAYS: Record<AssetType, number> = {
  plan: 15,
  checklist: 15,
  prompt: 15,
  decision: 15,
  doc: 30,
  contract: 30,
  runbook: 30,
  context: 30,
  sdr: 30,
  script: 30,
  feedback: 30,
  rule: 45,
  workflow: 45,
  skill: 45,
  policy: 180,
  adr: 180,
  template: 180,
  report: Infinity,
};

const ORPHAN_EXEMPT_TYPES = new Set<AssetType>(["report", "doc", "adr", "policy"]);

function orphanWeightFor(lifecycle: NexusLifecycleState): number {
  if (lifecycle === "uninitialized" || lifecycle === "discovered") return 20;
  if (lifecycle === "governed" || lifecycle === "evolved") return 45;
  return 40;
}

export function calculateEntropy(
  assets: EngineeringAsset[],
  relations: Relation[],
  lifecycle: NexusLifecycleState
): { orphanedAssets: number; staleAssets: number; missingDependencies: number; score: number } {
  const now = Date.now();

  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.source);
    connectedIds.add(r.target);
  }

  const orphanedAssets = assets.filter(
    (a) => !connectedIds.has(a.id) && !ORPHAN_EXEMPT_TYPES.has(a.type)
  ).length;

  const staleAssets = assets.filter((a) => {
    const thresholdDays = STALE_THRESHOLDS_DAYS[a.type] ?? 30;
    if (!isFinite(thresholdDays)) return false;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    return now - new Date(a.updatedAt).getTime() > thresholdMs && a.status === "active";
  }).length;

  const assetIds = new Set(assets.map((a) => a.id));
  const missingDependencies = assets.filter((a) =>
    a.dependencies.some((dep) => !assetIds.has(dep))
  ).length;

  const totalAssets = assets.length || 1;
  const orphanWeight = orphanWeightFor(lifecycle);
  const staleWeight = 100 - orphanWeight - 30;

  const orphanRatio = orphanedAssets / totalAssets;
  const staleRatio = staleAssets / totalAssets;
  const depRatio = missingDependencies / totalAssets;

  const score = Math.round(orphanRatio * orphanWeight + staleRatio * staleWeight + depRatio * 30);

  return {
    orphanedAssets,
    staleAssets,
    missingDependencies,
    score: Math.min(100, score),
  };
}

// ── Main Consolidation ─────────────────────────────────────────────────────

let isConsolidating = false;

export function consolidateEngineeringState(
  projectRoot: string,
  nexusDir: string
): EngineeringState {
  if (isConsolidating) {
    const cached = loadEngineeringState(nexusDir);
    if (cached) return cached;

    return {
      consolidatedAt: new Date().toISOString(),
      lifecycle: detectLifecycleState(projectRoot, nexusDir),
      project: { name: projectRoot.split("/").pop() || "", root: projectRoot, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, entropy: 0, overall: 100 },
      entropy: { score: 0, orphanedAssets: 0, staleAssets: 0, missingDependencies: 0 },
      summary: "Re-entrancy: returning minimal state",
    } as EngineeringState;
  }

  isConsolidating = true;

  try {
    const projectAnalysis = analyseProject(projectRoot);
    const lifecycle = detectLifecycleState(projectRoot, nexusDir);
    const maturityProfile = loadMaturityProfile(nexusDir);

    const installedCapabilities = maturityProfile?.installedCapabilities ?? ["core"];

    const fsDetected = detectCapabilitySignalsFromFilesystem(nexusDir);
    const capabilityDrift = {
      detectedNotRegistered: fsDetected.filter((c) => !installedCapabilities.includes(c)),
      registeredNotDetected: installedCapabilities.filter((c) => !fsDetected.includes(c)),
    };

    const assets = discoverAssets(nexusDir);

    const artifacts = loadArtifacts(nexusDir);
    const relations = loadRelations(nexusDir);
    const graphAnalysis = artifacts.length > 0
      ? analyzeGraph(artifacts, relations)
      : null;

    let debtReport: KnowledgeDebtReport | null = null;
    try {
      debtReport = detectKnowledgeDebt(projectRoot, nexusDir);
    } catch {
      logger.debug("engineering-state", "Knowledge debt detection unavailable");
    }

    const entropy = calculateEntropy(assets, relations, lifecycle);

    const assetsByType = {} as Record<AssetType, number>;
    for (const asset of assets) {
      assetsByType[asset.type] = (assetsByType[asset.type] || 0) + 1;
    }

    const rulesDir = join(nexusDir, "governance", "rules");
    let activeRules = 0;
    if (existsSync(rulesDir)) {
      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
      for (const file of ruleFiles) {
        try {
          const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
          if (content.enabled) activeRules++;
        } catch {
          logger.debug("engineering-state", "Failed to parse rule file:", file);
        }
      }
    }

    const activePolicies = assets.filter((a) => a.type === "policy" && a.status === "active").length;

    const knowledgeDebtScore = debtReport?.healthScore ?? 100;
    const knowledgeGraphScore = graphAnalysis?.healthScore ?? 100;
    const knowledgeHealth = getKnowledgeHealthScore(knowledgeDebtScore, knowledgeGraphScore, entropy.score);
    const overall = knowledgeHealth.score;

    getEventBus().publish("entropy.calculated", {
      projectId: projectRoot.split("/").pop() || "",
      entropyScore: entropy.score,
      factors: {
        orphaned: entropy.orphanedAssets,
        stale: entropy.staleAssets,
        missingDeps: entropy.missingDependencies,
      },
      timestamp: new Date().toISOString(),
    });

    const parts: string[] = [];
    parts.push(`${assets.length} assets.`);
    parts.push(`${installedCapabilities.length} capabilities.`);
    parts.push(`Health: ${overall}/100.`);
    if (entropy.orphanedAssets > 0) parts.push(`${entropy.orphanedAssets} orphaned.`);
    if (debtReport && debtReport.totalGaps > 0) parts.push(`${debtReport.totalGaps} knowledge gaps.`);
    parts.push(`Lifecycle: ${lifecycle}.`);

    const state = {
      consolidatedAt: new Date().toISOString(),
      lifecycle,
      project: {
        name: projectRoot.split("/").pop() || "",
        root: projectRoot,
        stack: projectAnalysis.stack,
        hasGit: projectAnalysis.hasGit,
        hasCI: projectAnalysis.hasCI,
        hasTests: projectAnalysis.hasTests,
        hasTypeScript: projectAnalysis.hasTypeScript,
        packageCount: projectAnalysis.packageCount,
        sourceFileCount: projectAnalysis.sourceFileCount,
        monorepo: projectAnalysis.monorepo,
      },
      maturity: maturityProfile,
      capabilities: installedCapabilities,
      capabilityDrift,
      knowledgeDebt: debtReport ? {
        totalGaps: debtReport.totalGaps,
        healthScore: debtReport.healthScore,
        detectedAt: debtReport.generatedAt,
      } : null,
      knowledgeGraph: graphAnalysis ? {
        totalArtifacts: graphAnalysis.totalArtifacts,
        totalRelations: graphAnalysis.totalRelations,
        healthScore: graphAnalysis.healthScore,
      } : null,
      assets,
      assetsByType,
      activeRules,
      activePolicies,
      healthScores: {
        knowledgeDebt: knowledgeDebtScore,
        knowledgeGraph: knowledgeGraphScore,
        overall,
      },
      entropy,
      summary: parts.join(" "),
    };

    getEventBus().publish("engineering_state.consolidated", {
      totalDimensions: 7,
      changedDimensions: [],
      overallHealth: overall,
      timestamp: new Date().toISOString(),
    });

    return state;
  } finally {
    isConsolidating = false;
  }
}

// ── Reactive Initialization ─────────────────────────────────────────────────

export function initializeEngineeringState(
  projectRoot: string,
  nexusDir: string
): () => void {
  const bus = getEventBus();

  const reconsolidate = () => {
    const state = consolidateEngineeringState(projectRoot, nexusDir);
    saveEngineeringState(nexusDir, state);
    bus.publish("engineering_state.consolidated", {
      consolidatedAt: state.consolidatedAt,
      lifecycle: state.lifecycle,
      overallHealth: state.healthScores.overall,
    });
  };

  const unsubscribers = [
    bus.subscribe("maturity.changed", reconsolidate),
    bus.subscribe("debt.detected", reconsolidate),
    bus.subscribe("knowledge.analyzed", reconsolidate),
    bus.subscribe("lifecycle.state_changed", reconsolidate),
    bus.subscribe("asset.created", reconsolidate),
    bus.subscribe("asset.updated", reconsolidate),
    bus.subscribe("asset.archived", reconsolidate),
  ];

  return () => unsubscribers.forEach((unsub) => unsub());
}
