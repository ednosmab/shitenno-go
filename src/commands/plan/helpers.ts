/**
 * Shared helpers for plan sub-commands.
 */

import chalk from "chalk";
import { join } from "node:path";
import { PlanEngine, FilePlanRepository, type PlanStatus } from "../../plan-engine.js";
import { ActionEngine, FileExecutionRepository } from "../../action-engine.js";
import { SHITEN_DIR_NAME } from "../../constants.js";

export function getEngine(dir: string): PlanEngine {
  const shitenDir = join(dir, SHITEN_DIR_NAME);
  const actionEngine = new ActionEngine(new FileExecutionRepository(shitenDir));
  return new PlanEngine(new FilePlanRepository(shitenDir), actionEngine);
}

export const STATUS_COLORS: Record<PlanStatus, (s: string) => string> = {
  draft: (s) => chalk.gray(s),
  running: (s) => chalk.cyan(s),
  completed: (s) => chalk.green(s),
  failed: (s) => chalk.red(s),
  rolled_back: (s) => chalk.yellow(s),
  cancelled: (s) => chalk.dim(s),
};

export function formatPlan(p: { id: string; name: string; status: PlanStatus; steps: Array<{ status: string }>; duration?: number }): string {
  const status = STATUS_COLORS[p.status](p.status.padEnd(12));
  const steps = `${p.steps.length} steps`;
  const duration = p.duration ? `${p.duration}ms` : "-";
  const completed = p.steps.filter((s) => s.status === "completed").length;
  return `  ${chalk.bold(p.id)}  ${status}  ${steps.padEnd(10)}  ${completed}/${p.steps.length} done  ${duration}`;
}
