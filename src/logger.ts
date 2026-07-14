/**
 * logger.ts — Centralized Logging for Nexus
 *
 * Replaces console.* in library code.
 * Allows suppressing output in tests.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

let currentLevel: LogLevel = "info";
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Define o nível de log global.
 *
 * Níveis: "debug" | "info" | "warn" | "error"
 * Default: "info"
 *
 * @param level - Nível de log a ativar
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Suprime todo output de log (útil em testes).
 * Equivalente a setLogLevel("error").
 */
export function muteLogs(): void {
  currentLevel = "error";
}

function shouldLog(level: LogLevel): boolean {
  // Respect --quiet flag via env var
  if (process.env.NEXUS_QUIET === "1" && LEVEL_PRIORITY[level] < LEVEL_PRIORITY["error"]) {
    return false;
  }
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, module: string, message: string): string {
  const prefix = `[${module}]`;
  const levelTag = level.toUpperCase().padEnd(5);
  return `${prefix} ${levelTag} ${message}`;
}

export const logger = {
  debug(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", module, message), ...args);
    }
  },
  info(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(formatMessage("info", module, message), ...args);
    }
  },
  warn(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", module, message), ...args);
    }
  },
  error(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", module, message), ...args);
    }
  },
};
