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
import type { RecommendationEngineResult } from "./recommendation-engine.js";
import type { EvolutionReport } from "./auto-evolution.js";
import type { HealthAuditReport } from "./health-auditor.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  projectRoot: string;
  nexusDir: string;

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
      const stageStart = Date.now();

      bus.publish("pipeline.stage.start", {
        stage: stage.name,
        description: stage.description,
      });

      // Execute pre-analysis hooks
      const hookBus = getHookBus();
      current = await hookBus.executeHook("pre-analysis", current, (_plugin, ctx) => ctx);

      try {
        current = await stage.execute(current);
        const duration = Date.now() - stageStart;

        const skipped = (current as { __lastStageSkipped?: boolean }).__lastStageSkipped === true;
        current.stageResults.push({
          stage: stage.name,
          duration,
          status: skipped ? "skipped" : "success",
        });

        // Publish stage-specific events
        if (stage.name === "pattern_detection" && current.patternReport) {
          bus.publish("pattern.detected", {
            patternType: current.patternReport.patterns[0]?.type ?? "unknown",
            confidence: current.patternReport.patterns.length > 0
              ? current.patternReport.patterns.reduce((sum, p) => sum + (p.severity / 5), 0) / current.patternReport.patterns.length
              : 0,
            patterns: current.patternReport.patterns.map((p) => ({
              type: p.type,
              description: p.description,
              severity: p.severity,
            })),
          });
        }

        if (stage.name === "knowledge_debt" && current.knowledgeDebtReport) {
          bus.publish("knowledge_debt.detected", {
            gapCount: current.knowledgeDebtReport.totalGaps,
            gaps: current.knowledgeDebtReport.gaps.map((g) => ({
              source: g.location,
              gap: g.description,
              severity: g.severity,
            })),
          });
        }

        if (stage.name === "engineering_state" && current.engineeringState) {
          bus.publish("engineering_state.consolidated", {
            totalDimensions: 7,
            changedDimensions: [],
            overallHealth: current.engineeringState.healthScores.overall,
          });
        }

        // Execute post-analysis hooks
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

        // Continue with other stages
      }
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
}

// ── Context Factory ──────────────────────────────────────────────────────────

/** Create a new pipeline context. */
export function createPipelineContext(
  projectRoot: string,
  nexusDir: string
): PipelineContext {
  return {
    projectRoot,
    nexusDir,
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
export async function createDefaultPipeline(): Promise<Pipeline> {
  const { analyseProject } = await import("./analyser.js");
  const { calculateComplexityScore } = await import("./scorer.js");
  const { detectPatterns } = await import("./pattern-detector.js");
  const { detectKnowledgeDebt } = await import("./knowledge-debt.js");
  const { evaluateCapabilities } = await import("./capability-engine.js");
  const { consolidateEngineeringState } = await import("./engineering-state.js");
  const { runRecommendationEngine } = await import("./recommendation-engine.js");
  const { analyzeEvolution } = await import("./auto-evolution.js");

  const pipeline = new Pipeline();

  // Stage 1: Project Analysis
  pipeline.addStage({
    name: "analysis",
    description: "Detect project structure and stack",
    execute: async (context) => {
      const analysis = analyseProject(context.projectRoot);
      return { ...context, analysis };
    },
  });

  // Stage 2: Complexity Scoring
  pipeline.addStage({
    name: "complexity",
    description: "Calculate complexity score and area breakdown",
    execute: async (context) => {
      if (!context.analysis) return context;
      const complexityReport = await calculateComplexityScore(
        context.projectRoot,
        context.nexusDir,
        context.analysis
      );
      return { ...context, complexityReport };
    },
  });

  // Stage 3: Pattern Detection
  pipeline.addStage({
    name: "pattern_detection",
    description: "Detect recurring patterns in history and reports",
    execute: async (context) => {
      const patternReport = detectPatterns(context.projectRoot, context.nexusDir);
      return { ...context, patternReport };
    },
  });

  // Stage 4: Knowledge Debt Detection
  pipeline.addStage({
    name: "knowledge_debt",
    description: "Detect knowledge gaps and debt",
    execute: async (context) => {
      const knowledgeDebtReport = detectKnowledgeDebt(
        context.projectRoot,
        context.nexusDir
      );
      return { ...context, knowledgeDebtReport };
    },
  });

  // Stage 5: Capability Engine
  pipeline.addStage({
    name: "capability_engine",
    description: "Evaluate capabilities and their maturity",
    execute: async (context) => {
      // First consolidate partial state for capability evaluation
      const partialState = consolidateEngineeringState(
        context.projectRoot,
        context.nexusDir
      );
      const capabilityEngineResult = evaluateCapabilities(
        partialState,
        context.nexusDir
      );
      return { ...context, capabilityEngineResult };
    },
  });

  // Stage 6: Engineering State Consolidation
  pipeline.addStage({
    name: "engineering_state",
    description: "Consolidate all information into canonical state",
    execute: async (context) => {
      const engineeringState = consolidateEngineeringState(
        context.projectRoot,
        context.nexusDir
      );
      return { ...context, engineeringState };
    },
  });

  // Stage 7: Recommendation Engine
  pipeline.addStage({
    name: "recommendation_engine",
    description: "Generate next-best-action recommendations",
    execute: async (context) => {
      if (!context.engineeringState || !context.capabilityEngineResult) {
        return context;
      }
      const recommendationEngineResult = runRecommendationEngine(
        context.engineeringState,
        context.capabilityEngineResult,
        context.nexusDir
      );
      return { ...context, recommendationEngineResult };
    },
  });

  // Stage 8: Evolution Analysis
  pipeline.addStage({
    name: "evolution",
    description: "Analyze evolution opportunities and generate report",
    execute: async (context) => {
      const evolutionReport = analyzeEvolution(
        context.projectRoot,
        context.nexusDir
      );
      return { ...context, evolutionReport };
    },
  });

  return pipeline;
}
