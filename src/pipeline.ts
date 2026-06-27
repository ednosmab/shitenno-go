/**
 * pipeline.ts — Analysis Pipeline Engine
 *
 * Chains analysis stages into a single, coherent flow.
 * Each stage reads from and writes to a shared context.
 *
 * PRINCIPLE: Stages are independent, sequential, and share state through context.
 */

import { getEventBus, type NexusEventType } from "./event-bus.js";
import { getHookBus } from "./plugin-system.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  projectRoot: string;
  nexusDir: string;

  // Stage outputs (populated incrementally)
  analysis?: unknown;
  complexityReport?: unknown;
  patternReport?: unknown;
  healthReport?: unknown;
  evolutionReport?: unknown;

  // Metadata
  startedAt: string;
  completedAt?: string;
  errors: Array<{ stage: string; error: Error }>;
  stageResults: Array<{ stage: string; duration: number; success: boolean }>;
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

    bus.publish("pipeline.complete" as NexusEventType, {
      stages: this.stages.map((s) => s.name),
      startedAt: current.startedAt,
    });

    for (const stage of this.stages) {
      const stageStart = Date.now();

      bus.publish("pipeline.stage.start" as NexusEventType, {
        stage: stage.name,
        description: stage.description,
      });

      // Execute pre-analysis hooks
      const hookBus = getHookBus();
      current = await hookBus.executeHook("pre-analysis", current, (_plugin, ctx) => ctx);

      try {
        current = await stage.execute(current);
        const duration = Date.now() - stageStart;

        current.stageResults.push({
          stage: stage.name,
          duration,
          success: true,
        });

        // Execute post-analysis hooks
        current = await hookBus.executeHook("post-analysis", current, (_plugin, ctx) => ctx);

        bus.publish("pipeline.stage.complete" as NexusEventType, {
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
          success: false,
        });

        bus.publish("pipeline.stage.complete" as NexusEventType, {
          stage: stage.name,
          duration,
          success: false,
          error: err.message,
        });

        // Continue with other stages
      }
    }

    current.completedAt = new Date().toISOString();

    bus.publish("pipeline.complete" as NexusEventType, {
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
