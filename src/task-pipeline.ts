import { existsSync } from "node:fs";
import { getEventBus, type ShitennoEventType } from "./event-bus.js";
import { validateCompletionGate } from "./task-completion.js";
import { transitionBacklogStatus, type BacklogStatus } from "./backlog-transitions.js";
import { updateCurrentTask, updateSession } from "./context-buffer-writer.js";
import { logger } from "./logger.js";
import { resolveBacklogPaths } from "./backlog-core.js";

export interface TaskPipelineConfig {
  projectRoot: string;
  shitennoDir: string;
}

export interface TaskPipelineEvent {
  taskId: string;
  source: string;
  affectedFiles?: string[];
}

export function initializeTaskPipeline(config: TaskPipelineConfig): () => void {
  const bus = getEventBus();

  const onValidationComplete = (payload: Record<string, unknown>) => {
    const taskId = String(payload.taskId ?? "unknown");
    const affectedFiles = payload.affectedFiles as string[] | undefined;

    logger.debug("task-pipeline", `Validation completed for task: ${taskId}`);

    const result = validateCompletionGate({
      projectRoot: config.projectRoot,
      shitennoDir: config.shitennoDir,
      taskId,
      affectedFiles,
    });

    if (result.passed) {
      bus.publish("task.completed", {
        taskId,
        source: "validation_pass",
        affectedFiles: affectedFiles ?? [],
        gates: result.gates.map((g) => ({ name: g.name, passed: g.passed })),
      });
      logger.info("task-pipeline", `Task ${taskId} passed all gates — published task.completed`);
    } else {
      const failures = result.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.name}: ${g.message}`);
      logger.info("task-pipeline", `Task ${taskId} gate(s) still failing: ${failures.join("; ")}`);
    }
  };

  const onTaskCompleted = (payload: Record<string, unknown>) => {
    const taskId = String(payload.taskId ?? "unknown");
    logger.info("task-pipeline", `Processing task.completed for: ${taskId}`);

    // 1. Update context_buffer.yaml
    updateCurrentTask(config.shitennoDir, {
      id: taskId,
      description: "Task completed via pipeline",
      status: "completed",
      started_at: "unknown",
      completed_at: new Date().toISOString(),
    });
    updateSession(config.shitennoDir, { status: "completed" });

    // 2. Update backlog status to concluído
    updateBacklogStatus(config.shitennoDir, taskId);

    // 3. Log event
    logger.info("task-pipeline", `Task ${taskId} pipeline complete`);
  };

  const unsub1 = bus.subscribe("validation.completed" as ShitennoEventType, onValidationComplete);
  const unsub2 = bus.subscribe("task.completed" as ShitennoEventType, onTaskCompleted);

  return () => {
    unsub1();
    unsub2();
  };
}

function updateBacklogStatus(shitennoDir: string, taskId: string): void {
  const { active: backlogPath } = resolveBacklogPaths(shitennoDir);

  if (!existsSync(backlogPath)) return;

  const result = transitionBacklogStatus(backlogPath, taskId, "concluído" as BacklogStatus, {
    date: new Date().toISOString().slice(0, 10),
  });

  if (result.success) {
    logger.info("task-pipeline", `Updated backlog: ${result.message}`);
  }
}
