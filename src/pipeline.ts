/**
 * pipeline.ts — Explicit Architectural Pipeline
 *
 * Chains analysis stages into a single, coherent flow.
 * The pipeline is now explicit: Analyser → Pattern Detection → Knowledge Debt
 * → Capability Engine → Engineering State → Recommendation Engine → Auto Evolution
 *
 * PRINCIPLE: Every component feeds the Engineering State.
 * The state drives all decisions.
 */

import { getEventBus } from "./event-bus.js";
import { getHookBus } from "./plugin-system.js";
import type { ProjectAnalysis } from "./analyser.js";
import type { ComplexityReport } from "./scorer.js";
import type { PatternDetectionReport } from "./pattern-detector.js";
import type { KnowledgeDebtReport } from "./knowledge-debt.js";
import type { CapabilityEngineResult } from "./capability-engine.js";
import type { EngineeringState } from "./engineering-state.js";
import type { RecommendationEngineResult } from "./prioritization/recommend.js";
import type { EvolutionReport } from "./auto-evolution.js";
import type { HealthAuditReport } from "./health-auditor.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  projectRoot: string;
  shitennoDir: string;

  // Stage outputs (populated incrementally through the pipeline)
  analysis?: ProjectAnalysis;
  complexityReport?: ComplexityReport;
  patternReport?: PatternDetectionReport;
  knowledgeDebtReport?: KnowledgeDebtReport;
  capabilityEngineResult?: CapabilityEngineResult;
  engineeringState?: EngineeringState;
  recommendationEngineResult?: RecommendationEngineResult;
  evolutionReport?: EvolutionReport;
  healthReport?: HealthAuditReport;

  // Metadata
  startedAt: string;
  completedAt?: string;
  errors: Array<{ stage: string; error: Error }>;
  stageResults: Array<{ stage: string; duration: number; status: "success" | "failed" | "skipped" }>;
}

export interface PipelineStage {
  name: string;
  description: string;
  execute: (context: PipelineContext) => Promise<PipelineContext>;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export class Pipeline {
  private stages: PipelineStage[] = [];

  /** Add a stage to the pipeline. */
  addStage(stage: PipelineStage): Pipeline {
    this.stages.push(stage);
    return this;
  }

  /** Get the list of stages. */
  getStages(): PipelineStage[] {
    return [...this.stages];
  }

  /** Execute all stages sequentially. */
  async execute(context: PipelineContext): Promise<PipelineContext> {
    const bus = getEventBus();
    let current = { ...context };

    bus.publish("pipeline.complete", {
      stages: this.stages.map((s) => s.name),
      startedAt: current.startedAt,
    });

    for (const stage of this.stages) {
      current = await this.runStage(stage, current, bus);
    }

    current.completedAt = new Date().toISOString();

    bus.publish("pipeline.complete", {
      stages: this.stages.map((s) => s.name),
      startedAt: current.startedAt,
      completedAt: current.completedAt,
      errors: current.errors.length,
      totalDuration: Date.now() - new Date(current.startedAt).getTime(),
    });

    return current;
  }

  private async runStage(
    stage: PipelineStage,
    context: PipelineContext,
    bus: ReturnType<typeof getEventBus>
  ): Promise<PipelineContext> {
    const stageStart = Date.now();
    const hookBus = getHookBus();
    let current = await hookBus.executeHook("pre-analysis", context, (_plugin, ctx) => ctx);

    bus.publish("pipeline.stage.start", {
      stage: stage.name,
      description: stage.description,
    });

    try {
      current = await stage.execute(current);
      const duration = Date.now() - stageStart;
      const skipped = (current as { __lastStageSkipped?: boolean }).__lastStageSkipped === true;

      current.stageResults.push({
        stage: stage.name,
        duration,
        status: skipped ? "skipped" : "success",
      });

      this.publishStageEvents(stage.name, current, bus);

      current = await hookBus.executeHook("post-analysis", current, (_plugin, ctx) => ctx);

      bus.publish("pipeline.stage.complete", {
        stage: stage.name,
        duration,
        success: true,
      });
    } catch (error) {
      const duration = Date.now() - stageStart;
      const err = error instanceof Error ? error : new Error(String(error));

      current.errors.push({ stage: stage.name, error: err });
      current.stageResults.push({
        stage: stage.name,
        duration,
        status: "failed",
      });

      bus.publish("pipeline.stage.complete", {
        stage: stage.name,
        duration,
        success: false,
        error: err.message,
      });
    }

    return current;
  }

  private publishStageEvents(
    stageName: string,
    context: PipelineContext,
    bus: ReturnType<typeof getEventBus>
  ): void {
    if (stageName === "pattern_detection" && context.patternReport) {
      const patterns = context.patternReport.patterns;
      bus.publish("pattern.detected", {
        patternType: patterns[0]?.type ?? "unknown",
        confidence: patterns.length > 0
          ? patterns.reduce((sum, p) => sum + (p.severity / 5), 0) / patterns.length
          : 0,
        patterns: patterns.map((p) => ({
          type: p.type,
          description: p.description,
          severity: p.severity,
        })),
      });
    }

    if (stageName === "knowledge_debt" && context.knowledgeDebtReport) {
      bus.publish("knowledge_debt.detected", {
        gapCount: context.knowledgeDebtReport.totalGaps,
        gaps: context.knowledgeDebtReport.gaps.map((g) => ({
          source: g.location,
          gap: g.description,
          severity: g.severity,
        })),
      });
    }

    if (stageName === "engineering_state" && context.engineeringState) {
      bus.publish("engineering_state.consolidated", {
        totalDimensions: 7,
        changedDimensions: [],
        overallHealth: context.engineeringState.healthScores.overall,
      });
    }
  }
}

// ── Context Factory ──────────────────────────────────────────────────────────

/** Create a new pipeline context. */
export function createPipelineContext(
  projectRoot: string,
  shitennoDir: string
): PipelineContext {
  return {
    projectRoot,
    shitennoDir,
    errors: [],
    stageResults: [],
    startedAt: new Date().toISOString(),
  };
}

// ── Default Explicit Pipeline ───────────────────────────────────────────────

/**
 * Creates the default explicit pipeline with all stages:
 * 1. Analysis (project structure detection)
 * 2. Complexity Scoring
 * 3. Pattern Detection
 * 4. Knowledge Debt Detection
 * 5. Capability Engine Evaluation
 * 6. Engineering State Consolidation
 * 7. Recommendation Engine
 * 8. Evolution Analysis
 */
function buildCoreStages(
  analyseProject: (root: string) => ProjectAnalysis,
  calculateComplexityScore: (root: string, dir: string, analysis: ProjectAnalysis) => Promise<ComplexityReport>,
  detectPatterns: (root: string, dir: string) => PatternDetectionReport,
  detectKnowledgeDebt: (root: string, dir: string) => KnowledgeDebtReport,
): PipelineStage[] {
  return [
    {
      name: "analysis",
      description: "Detect project structure and stack",
      execute: async (context) => {
        const analysis = analyseProject(context.projectRoot);
        return { ...context, analysis };
      },
    },
    {
      name: "complexity",
      description: "Calculate complexity score and area breakdown",
      execute: async (context) => {
        if (!context.analysis) return context;
        const complexityReport = await calculateComplexityScore(context.projectRoot, context.shitennoDir, context.analysis);
        return { ...context, complexityReport };
      },
    },
    {
      name: "pattern_detection",
      description: "Detect recurring patterns in history and reports",
      execute: async (context) => {
        const patternReport = detectPatterns(context.projectRoot, context.shitennoDir);
        return { ...context, patternReport };
      },
    },
    {
      name: "knowledge_debt",
      description: "Detect knowledge gaps and debt",
      execute: async (context) => {
        const knowledgeDebtReport = detectKnowledgeDebt(context.projectRoot, context.shitennoDir);
        return { ...context, knowledgeDebtReport };
      },
    },
  ];
}

function buildEvaluationStages(
  consolidateEngineeringState: (root: string, dir: string) => EngineeringState,
  evaluateCapabilities: (state: EngineeringState, dir: string) => CapabilityEngineResult,
  runRecommendationEngine: (options: { state: EngineeringState; capResult: CapabilityEngineResult; shitennoDir: string }) => RecommendationEngineResult,
  analyzeEvolution: (root: string, dir: string) => EvolutionReport,
): PipelineStage[] {
  return [
    {
      name: "capability_engine",
      description: "Evaluate capabilities and their maturity",
      execute: async (context) => {
        const partialState = consolidateEngineeringState(context.projectRoot, context.shitennoDir);
        const capabilityEngineResult = evaluateCapabilities(partialState, context.shitennoDir);
        return { ...context, capabilityEngineResult };
      },
    },
    {
      name: "engineering_state",
      description: "Consolidate all information into canonical state",
      execute: async (context) => {
        const engineeringState = consolidateEngineeringState(context.projectRoot, context.shitennoDir);
        return { ...context, engineeringState };
      },
    },
    {
      name: "recommendation_engine",
      description: "Generate next-best-action recommendations",
      execute: async (context) => {
        if (!context.engineeringState || !context.capabilityEngineResult) return context;
        const recommendationEngineResult = runRecommendationEngine({
          state: context.engineeringState,
          capResult: context.capabilityEngineResult,
          shitennoDir: context.shitennoDir,
        });
        return { ...context, recommendationEngineResult };
      },
    },
    {
      name: "evolution",
      description: "Analyze evolution opportunities and generate report",
      execute: async (context) => {
        const evolutionReport = analyzeEvolution(context.projectRoot, context.shitennoDir);
        return { ...context, evolutionReport };
      },
    },
  ];
}

export async function createDefaultPipeline(): Promise<Pipeline> {
  const { analyseProject } = await import("./analyser.js");
  const { calculateComplexityScore } = await import("./scorer.js");
  const { detectPatterns } = await import("./pattern-detector.js");
  const { detectKnowledgeDebt } = await import("./knowledge-debt.js");
  const { evaluateCapabilities } = await import("./capability-engine.js");
  const { consolidateEngineeringState } = await import("./engineering-state.js");
  const { runRecommendationEngine } = await import("./prioritization/recommend.js");
  const { analyzeEvolution } = await import("./auto-evolution.js");

  const pipeline = new Pipeline();
  buildCoreStages(analyseProject, calculateComplexityScore, detectPatterns, detectKnowledgeDebt)
    .forEach((s) => pipeline.addStage(s));
  buildEvaluationStages(consolidateEngineeringState, evaluateCapabilities, runRecommendationEngine, analyzeEvolution)
    .forEach((s) => pipeline.addStage(s));
  return pipeline;
}
