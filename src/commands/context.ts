/**
 * context.ts — Context command for AI agents
 *
 * Provides a single command that outputs the full project context
 * optimized for AI agent consumption.
 *
 * PRINCIPLE: One command, complete context.
 */

import { getEngineeringState } from "../engineering-state-access.js";
import { generateForecast } from "../trend-engine.js";
import { logger } from "../logger.js";
import { join } from "node:path";
import { Command } from "commander";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ContextOutput {
  version: string;
  timestamp: string;
  project: {
    name: string;
    root: string;
    stack: string[];
  };
  engineeringState: {
    consolidatedAt: string;
    lifecycle: string;
    healthScores: {
      overall: number;
      knowledgeDebt: number;
      knowledgeGraph: number;
    };
    entropy: {
      score: number;
    };
    maturity: {
      score: number;
      level: string;
    } | null;
    capabilities: string[];
    assets: {
      type: string;
      path: string;
      status: string;
    }[];
    rules: number;
    policies: number;
  };
  trend: {
    direction: string;
    confidence: number;
  } | null;
  challenges: {
    type: string;
    severity: string;
    description: string;
  }[];
}

// ── Context Generation ──────────────────────────────────────────────────────

/**
 * Generate context output for AI agents.
 */
export function generateContext(nexusDir: string): ContextOutput | null {
  const projectRoot = process.cwd();
  let state;
  try {
    state = getEngineeringState(projectRoot, nexusDir);
  } catch {
    logger.debug("context", "No engineering state found");
    return null;
  }

  const trend = generateForecast(loadHistoricalStates(nexusDir));
  const challenges = loadChallenges(state);

  const trendDirection = trend?.trends.find((t) => t.metric === "health")?.direction ?? "unknown";

  return {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    project: {
      name: state.project.name,
      root: state.project.root,
      stack: state.project.stack,
    },
    engineeringState: {
      consolidatedAt: state.consolidatedAt,
      lifecycle: state.lifecycle,
      healthScores: state.healthScores,
      entropy: state.entropy,
      maturity: state.maturity ? {
      score: state.maturity.overallScore,
      level: "defined",
    } : null,
      capabilities: state.capabilities,
      assets: state.assets.map((a) => ({
        type: a.type,
        path: a.path,
        status: a.status,
      })),
      rules: state.activeRules,
      policies: state.activePolicies,
    },
    trend: trend ? {
      direction: trendDirection,
      confidence: trend.confidence,
    } : null,
    challenges,
  };
}

/**
 * Load historical states for trend analysis.
 */
function loadHistoricalStates(nexusDir: string) {
  const projectRoot = process.cwd();
  try {
    const state = getEngineeringState(projectRoot, nexusDir);
    return [state];
  } catch {
    return [];
  }
}

/**
 * Load challenges from engineering state.
 */
function loadChallenges(state: ReturnType<typeof getEngineeringState>): ContextOutput["challenges"] {
  const challenges: ContextOutput["challenges"] = [];

  if (state.entropy.score > 50) {
    challenges.push({
      type: "entropy",
      severity: "high",
      description: `Entropy score is ${state.entropy.score}/100 — consider cleanup`,
    });
  }

  if (state.healthScores.knowledgeDebt < 70) {
    challenges.push({
      type: "knowledge_debt",
      severity: "medium",
      description: `Knowledge debt score is ${state.healthScores.knowledgeDebt}/100`,
    });
  }

  if (state.healthScores.knowledgeGraph < 70) {
    challenges.push({
      type: "knowledge_graph",
      severity: "medium",
      description: `Knowledge graph score is ${state.healthScores.knowledgeGraph}/100`,
    });
  }

  return challenges;
}

// ── CLI Integration ─────────────────────────────────────────────────────────

/**
 * Execute the context command.
 */
export async function executeContextCommand(options: { json?: boolean; forAgent?: string }): Promise<void> {
  const projectRoot = process.cwd();
  const nexusDir = join(projectRoot, "nexus-system");
  let context = generateContext(nexusDir);

  if (!context) {
    console.log("No engineering state found. Run 'nexus init' first.");
    return;
  }

  if (options.forAgent) {
    context = filterContextForAgent(context, options.forAgent);
  }

  if (options.json) {
    console.log(JSON.stringify(context, null, 2));
  } else {
    printContext(context);
  }
}

function printContext(context: ContextOutput): void {
  console.log("📋 Project Context");
  console.log("==================");
  console.log(`Project: ${context.project.name}`);
  console.log(`Stack: ${context.project.stack.join(", ")}`);
  console.log(`Root: ${context.project.root}`);
  console.log();

  console.log("📊 Engineering State");
  console.log("====================");
  console.log(`Lifecycle: ${context.engineeringState.lifecycle}`);
  console.log(`Health: ${context.engineeringState.healthScores.overall}/100`);
  console.log(`Knowledge Debt: ${context.engineeringState.healthScores.knowledgeDebt}/100`);
  console.log(`Knowledge Graph: ${context.engineeringState.healthScores.knowledgeGraph}/100`);
  console.log(`Entropy: ${context.engineeringState.entropy.score}/100`);
  console.log(`Capabilities: ${context.engineeringState.capabilities.join(", ")}`);
  console.log(`Assets: ${context.engineeringState.assets.length}`);
  console.log(`Rules: ${context.engineeringState.rules}`);
  console.log(`Policies: ${context.engineeringState.policies}`);
  console.log();

  if (context.trend) {
    console.log("📈 Trend");
    console.log("========");
    console.log(`Direction: ${context.trend.direction}`);
    console.log(`Confidence: ${(context.trend.confidence * 100).toFixed(0)}%`);
    console.log();
  }

  if (context.challenges.length > 0) {
    console.log("⚠️  Challenges");
    console.log("==============");
    for (const challenge of context.challenges) {
      console.log(`  [${challenge.severity}] ${challenge.description}`);
    }
  }
}

// ── Agent Filtering ────────────────────────────────────────────────────────

function filterContextForAgent(context: ContextOutput, agentName: string): ContextOutput {
  return {
    ...context,
    project: {
      ...context.project,
      name: `${context.project.name} (agent: ${agentName})`,
    },
  };
}

// ── CLI Command ────────────────────────────────────────────────────────────

export const contextCommand = new Command("context")
  .description("Show project context for AI agents")
  .option("--json", "Output as JSON")
  .option("--for-agent <name>", "Filter context for a specific agent")
  .action(async (options) => {
    await executeContextCommand(options);
  });
