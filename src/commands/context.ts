/**
 * context.ts — Context command for AI agents
 *
 * Provides a single command that outputs the full project context
 * optimized for AI agent consumption.
 *
 * PRINCIPLE: One command, complete context.
 */

import { getEngineeringState } from "../engineering-state/index.js";
import { generateForecast } from "../trend-engine.js";
import { logger } from "../logger.js";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { output, outputBlank } from "../output.js";
import { Command } from "commander";
import { queryDaemon, isDaemonRunning } from "../daemon-client.js";

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
function buildContextOutput(
  state: ReturnType<typeof getEngineeringState>,
  trend: ReturnType<typeof generateForecast>,
  trendDirection: string,
  challenges: ContextOutput["challenges"]
): ContextOutput {
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

export async function generateContext(shitennoDir: string): Promise<ContextOutput | null> {
  const projectRoot = process.cwd();

  if (isDaemonRunning(shitennoDir)) {
    const result = await queryDaemon<{ type: string; data: ContextOutput }>(shitennoDir, {
      type: "query_briefing",
    });
    if (result?.data) {
      return result.data as ContextOutput;
    }
  }

  let state;
  try {
    state = getEngineeringState(projectRoot, shitennoDir);
  } catch {
    logger.debug("context", "No engineering state found");
    return null;
  }

  const trend = generateForecast(loadHistoricalStates(shitennoDir));
  const challenges = loadChallenges(state);
  const trendDirection = trend?.trends.find((t) => t.metric === "health")?.direction ?? "unknown";

  return buildContextOutput(state, trend, trendDirection, challenges);
}

/**
 * Load historical states for trend analysis.
 */
function loadHistoricalStates(shitennoDir: string) {
  const projectRoot = process.cwd();
  try {
    const state = getEngineeringState(projectRoot, shitennoDir);
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
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  let context = await generateContext(shitennoDir);

  if (!context) {
    output("No engineering state found. Run 'shugo init' first.");
    return;
  }

  if (options.forAgent) {
    context = filterContextForAgent(context, options.forAgent);
  }

  if (options.json) {
    output(JSON.stringify(context, null, 2));
  } else {
    printContext(context);
  }
}

function printContext(context: ContextOutput): void {
  output("📋 Project Context");
  output("==================");
  output(`Project: ${context.project.name}`);
  output(`Stack: ${context.project.stack.join(", ")}`);
  output(`Root: ${context.project.root}`);
  outputBlank();

  output("📊 Engineering State");
  output("====================");
  output(`Lifecycle: ${context.engineeringState.lifecycle}`);
  output(`Health: ${context.engineeringState.healthScores.overall}/100`);
  output(`Knowledge Debt: ${context.engineeringState.healthScores.knowledgeDebt}/100`);
  output(`Knowledge Graph: ${context.engineeringState.healthScores.knowledgeGraph}/100`);
  output(`Entropy: ${context.engineeringState.entropy.score}/100`);
  output(`Capabilities: ${context.engineeringState.capabilities.join(", ")}`);
  output(`Assets: ${context.engineeringState.assets.length}`);
  output(`Rules: ${context.engineeringState.rules}`);
  output(`Policies: ${context.engineeringState.policies}`);
  outputBlank();

  if (context.trend) {
    output("📈 Trend");
    output("========");
    output(`Direction: ${context.trend.direction}`);
    output(`Confidence: ${(context.trend.confidence * 100).toFixed(0)}%`);
    outputBlank();
  }

  if (context.challenges.length > 0) {
    output("⚠️  Challenges");
    output("==============");
    for (const challenge of context.challenges) {
      output(`  [${challenge.severity}] ${challenge.description}`);
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
