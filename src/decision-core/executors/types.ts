/**
 * Decision Core — Executor Types
 *
 * Shared interface for all action executors in the unified execution core.
 * Each executor wraps a real action type and implements execute().
 */

export interface ExecutorContext {
  projectRoot: string;
  shitenDir: string;
}

export interface ActionExecutor {
  readonly name: string;
  execute(params: Record<string, unknown>, context: ExecutorContext): Promise<Record<string, unknown>>;
}
