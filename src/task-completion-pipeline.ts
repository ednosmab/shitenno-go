/**
 * task-completion-pipeline.ts — Task Completion Pipeline
 *
 * Implements the 3-layer automated task completion pipeline:
 * Layer 1: Completion Gates (5 gates)
 * Layer 2: Backlog State Machine
 * Layer 3: Event-Driven Pipeline (plan archive + buffer update)
 *
 * Flow: validate gates → publish event → transition backlog → archive plan → update buffer
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";
import { validateCompletionGate, type CompletionResult } from "./task-completion.js";
import { archivePlan, type ValidationResult } from "./plan-lifecycle.js";
import { completeTask } from "./backlog-state-machine.js";
import { getEventBus } from "./event-bus.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PipelineResult {
  success: boolean;
  taskId: string;
  gates: CompletionResult;
  backlogUpdated: boolean;
  planArchived: boolean;
  eventPublished: boolean;
  errors: string[];
}

export interface PipelineOptions {
  projectRoot: string;
  shitennoDir: string;
  taskId: string;
  affectedFiles?: string[];
  /** Skip plan archival (useful for testing) */
  skipArchive?: boolean;
  /** Skip backlog update (useful for testing) */
  skipBacklog?: boolean;
}

// ── Plan Detection ─────────────────────────────────────────────────────────

/**
 * Find the active plan file for a given task.
 * Returns the plan filename (without extension) or null.
 */
function findActivePlanForTask(shitennoDir: string, taskId: string): string | null {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return null;

  try {
    const files = readdirSync(plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );

    const lowerTaskId = taskId.toLowerCase();

    for (const file of files) {
      const id = file.replace(".md", "").toLowerCase();
      if (id.includes(lowerTaskId) || lowerTaskId.includes(id)) {
        const planPath = join(plansDir, file);
        const content = readFileSync(planPath, "utf-8");

        const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
        if (statusMatch) {
          const statusValue = statusMatch[1] || "";
          const status = statusValue.trim().toLowerCase();
          if (status !== "done" && status !== "concluído" && status !== "concluido") {
            return file.replace(".md", "");
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Run the full task completion pipeline.
 *
 * 1. Validate all 5 completion gates
 * 2. If all pass: publish `task.completed` event
 * 3. Transition backlog item to "concluído"
 * 4. Archive active plan (if found)
 *
 * This function is idempotent — running it multiple times for the same task
 * will not cause errors (backlog transition will fail gracefully if already done).
 */
export function runCompletionPipeline(options: PipelineOptions): PipelineResult {
  const { projectRoot, shitennoDir, taskId, affectedFiles } = options;

  logger.info("task-completion-pipeline", `Running completion pipeline for task: ${taskId}`);

  // Step 1: Validate all 5 completion gates
  const gates = validateCompletionGate({
    projectRoot,
    shitennoDir,
    taskId,
    affectedFiles,
  });

  const errors: string[] = [];

  if (!gates.passed) {
    const failedGates = gates.gates.filter((g) => !g.passed);
    for (const gate of failedGates) {
      errors.push(`Gate "${gate.name}" failed: ${gate.message}`);
    }

    logger.warn("task-completion-pipeline", `Completion gates failed for ${taskId}: ${errors.join("; ")}`);

    return {
      success: false,
      taskId,
      gates,
      backlogUpdated: false,
      planArchived: false,
      eventPublished: false,
      errors,
    };
  }

  logger.info("task-completion-pipeline", `All 5 gates passed for task: ${taskId}`);

  // Step 2: Publish `task.completed` event
  let eventPublished = false;
  try {
    const bus = getEventBus();
    bus.publish("task.completed", {
      taskId,
      completedAt: new Date().toISOString(),
      gatesPassed: gates.gates.length,
    });
    eventPublished = true;
    logger.info("task-completion-pipeline", `Published task.completed event for: ${taskId}`);
  } catch (error) {
    errors.push(`Failed to publish event: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("task-completion-pipeline", `Event publication failed: ${errors[errors.length - 1]}`);
  }

  // Step 3: Transition backlog item to "concluído"
  let backlogUpdated = false;
  if (!options.skipBacklog) {
    try {
      const result = completeTask(shitennoDir, taskId);
      backlogUpdated = result.success;
      if (result.success) {
        logger.info("task-completion-pipeline", `Backlog updated: ${result.message}`);
      } else {
        errors.push(`Backlog update failed: ${result.message}`);
        logger.warn("task-completion-pipeline", `Backlog update failed: ${result.message}`);
      }
    } catch (error) {
      errors.push(`Backlog transition error: ${error instanceof Error ? error.message : String(error)}`);
      logger.warn("task-completion-pipeline", `Backlog transition error: ${errors[errors.length - 1]}`);
    }
  }

  // Step 4: Archive active plan
  let planArchived = false;
  if (!options.skipArchive) {
    const planId = findActivePlanForTask(shitennoDir, taskId);
    if (planId) {
      const validationResult: ValidationResult = {
        valid: gates.passed,
        checks: gates.gates.map((g) => ({ name: g.name.toUpperCase(), passed: g.passed, message: g.message })),
      };
      try {
        planArchived = archivePlan(shitennoDir, planId, validationResult);
        if (planArchived) {
          logger.info("task-completion-pipeline", `Plan archived: ${planId}`);
        } else {
          errors.push(`Plan archival failed for: ${planId}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Plan archival failed for ${planId}: ${msg}`);
        logger.warn("task-completion-pipeline", `Plan archival error: ${msg}`);
      }
    } else {
      logger.info("task-completion-pipeline", `No active plan found for task: ${taskId}`);
    }
  }

  const success = errors.length === 0;

  logger.info("task-completion-pipeline", `Pipeline completed for ${taskId}: success=${success}, backlog=${backlogUpdated}, plan=${planArchived}, event=${eventPublished}`);

  return {
    success,
    taskId,
    gates,
    backlogUpdated,
    planArchived,
    eventPublished,
    errors,
  };
}

/**
 * Convenience function to run pipeline with automatic task ID detection.
 * Reads the current task from context_buffer.yaml.
 */
export function runCurrentTaskPipeline(
  projectRoot: string,
  shitennoDir: string
): PipelineResult | null {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    logger.warn("task-completion-pipeline", "No context_buffer.yaml found");
    return null;
  }

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const taskIdMatch = content.match(/id:\s*"([^"]+)"/);
    if (!taskIdMatch) {
      logger.warn("task-completion-pipeline", "No task ID found in context_buffer.yaml");
      return null;
    }

    const taskId = taskIdMatch[1]!;
    return runCompletionPipeline({ projectRoot, shitennoDir, taskId });
  } catch (error) {
    logger.warn("task-completion-pipeline", `Failed to read task ID: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
