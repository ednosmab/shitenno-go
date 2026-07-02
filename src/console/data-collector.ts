/**
 * data-collector.ts — Collects all data from Nexus modules for the Console
 *
 * Reads from engineering-state, maturity-profile, knowledge-graph,
 * knowledge-debt, goal-engine, decision-engine, session-tracker,
 * event-bus, growth-profile, and health-auditor.
 *
 * PRINCIPLE: Single data source for all console tabs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { consolidateEngineeringState, type EngineeringState } from "../engineering-state.js";
import { loadMaturityProfile, type MaturityProfile } from "../maturity-profile.js";
import { loadArtifacts, loadRelations, analyzeGraph, type GraphAnalysis } from "../knowledge-graph.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "../knowledge-debt.js";
import { detectLifecycleState, type NexusLifecycleState } from "../nexus-state-machine.js";
import { getSessionMetrics, type SessionMetrics } from "../session-tracker.js";
import { getEventBus, type EventEnvelope } from "../event-bus.js";
import { detectInstalledCapabilities, type Capability } from "../maturity-profile.js";
import { evaluateCapabilities, type CapabilityEntity } from "../capability-engine.js";
import { loadGrowthProfile, type GrowthProfile } from "../growth-profile.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConsoleData {
  timestamp: string;
  projectRoot: string;
  nexusDir: string;

  // Lifecycle
  lifecycle: NexusLifecycleState;

  // Engineering State
  engineering: EngineeringState;

  // Maturity
  maturity: MaturityProfile | null;

  // Knowledge Graph
  graph: GraphAnalysis;

  // Knowledge Debt
  debt: KnowledgeDebtReport | null;

  // Capabilities
  capabilities: Capability[];
  capabilityEntities: CapabilityEntity[];

  // Goals (raw JSON files)
  goals: GoalData[];

  // Decisions (raw JSON files)
  decisions: DecisionData[];

  // Session Metrics
  session: SessionMetrics;

  // Recent Events
  recentEvents: EventEnvelope[];

  // Growth Profile
  growth: GrowthProfile | null;

  // Entropy
  entropy: {
    orphanedAssets: number;
    staleAssets: number;
    missingDependencies: number;
    score: number;
  };

  // Health Scores
  health: {
    overall: number;
    knowledgeDebt: number;
    knowledgeGraph: number;
    entropy: number;
  };

  // Quick Stats
  stats: {
    totalAssets: number;
    totalRules: number;
    totalSkills: number;
    totalAdrs: number;
    totalContracts: number;
    totalSessions: number;
    totalEvents: number;
    totalGoals: number;
    totalDecisions: number;
  };
}

export interface GoalData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  targets: string[];
  criteria: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionData {
  id: string;
  request: { action: string; category: string };
  scores: Array<{ evaluator: string; score: number; reasoning: string }>;
  compositeScore: number;
  recommendation: string;
  confidence: number;
  decidedAt: string;
}

// ── Data Collection ────────────────────────────────────────────────────────

export function collectConsoleData(projectRoot: string, nexusDir: string): ConsoleData {
  const timestamp = new Date().toISOString();

  // Lifecycle
  const lifecycle = detectLifecycleState(projectRoot, nexusDir);

  // Engineering State
  const engineering = consolidateEngineeringState(projectRoot, nexusDir);

  // Maturity
  const maturity = loadMaturityProfile(nexusDir);

  // Knowledge Graph
  const artifacts = loadArtifacts(nexusDir);
  const relations = loadRelations(nexusDir);
  const graph = analyzeGraph(artifacts, relations);

  // Knowledge Debt
  const debt = detectKnowledgeDebt(projectRoot, nexusDir);

  // Capabilities
  const capabilities = detectInstalledCapabilities(nexusDir);

  // Capability Entities (with full metadata)
  const capabilityResult = evaluateCapabilities(engineering, nexusDir);
  const capabilityEntities = capabilityResult.capabilities;

  // Goals
  const goals = loadGoals(nexusDir);

  // Decisions
  const decisions = loadDecisions(nexusDir);

  // Session Metrics
  const session = getSessionMetrics(nexusDir);

  // Recent Events (last 20)
  const recentEvents = getEventBus().getHistory().slice(-20);

  // Growth Profile
  const growth = loadGrowthProfile(nexusDir);

  // Entropy
  const entropy = engineering.entropy;

  // Health Scores
  const health = {
    overall: engineering.healthScores.overall,
    knowledgeDebt: engineering.healthScores.knowledgeDebt,
    knowledgeGraph: engineering.healthScores.knowledgeGraph,
    entropy: 100 - entropy.score, // Invert so higher = better
  };

  // Quick Stats
  const stats = {
    totalAssets: engineering.assets.length,
    totalRules: engineering.activeRules,
    totalSkills: countByType(artifacts, "skill"),
    totalAdrs: countByType(artifacts, "adr"),
    totalContracts: countByType(artifacts, "contract"),
    totalSessions: session.totalSessions,
    totalEvents: recentEvents.length,
    totalGoals: goals.length,
    totalDecisions: decisions.length,
  };

  return {
    timestamp,
    projectRoot,
    nexusDir,
    lifecycle,
    engineering,
    maturity,
    graph,
    debt,
    capabilities,
    capabilityEntities,
    goals,
    decisions,
    session,
    recentEvents,
    growth,
    entropy,
    health,
    stats,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function countByType(artifacts: Array<{ type: string }>, type: string): number {
  return artifacts.filter((a) => a.type === type).length;
}

function loadGoals(nexusDir: string): GoalData[] {
  const goalsDir = join(nexusDir, "governance", "goals");
  if (!existsSync(goalsDir)) return [];

  return readdirSync(goalsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(goalsDir, f), "utf-8")) as GoalData;
      } catch {
        return null;
      }
    })
    .filter((g): g is GoalData => g !== null);
}

function loadDecisions(nexusDir: string): DecisionData[] {
  const decisionsDir = join(nexusDir, "governance", "decisions");
  if (!existsSync(decisionsDir)) return [];

  return readdirSync(decisionsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(decisionsDir, f), "utf-8")) as DecisionData;
      } catch {
        return null;
      }
    })
    .filter((d): d is DecisionData => d !== null);
}
