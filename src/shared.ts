/**
 * shared.ts — Shared Infrastructure for CLI Commands
 *
 * Extracts duplicated patterns from commands into reusable functions.
 * Reduces ~280 lines of duplicated code across 10 commands.
 *
 * PRINCIPLE: DRY — Don't Repeat Yourself.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { detectNexusProject } from "./utils.js";
import { outputJson } from "./formatting.js";
import { NotInitializedError } from "./errors.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectContext {
  projectRoot: string;
  nexusDir: string;
  isInitialized: boolean;
  hasMaturityProfile: boolean;
}

// ── Project Context Resolution ───────────────────────────────────────────────

/** Resolve project context from CLI options. Replaces duplicated init guards. */
export function resolveProjectContext(options: { dir?: string }): ProjectContext {
  const projectRoot = options.dir || process.cwd();
  const nexusDir = join(projectRoot, "nexus-system");

  const isInitialized =
    existsSync(join(projectRoot, "opencode.json")) && existsSync(nexusDir);

  const hasMaturityProfile = existsSync(join(nexusDir, "maturity-profile.json"));

  return { projectRoot, nexusDir, isInitialized, hasMaturityProfile };
}

// ── Command Factory ──────────────────────────────────────────────────────────

/** Create a command with common patterns (banner, JSON mode, error handling). */
export function createNexusCommand(
  name: string,
  description: string,
  action: (ctx: ProjectContext, options: Record<string, unknown>) => Promise<void>
): Command {
  const cmd = new Command(name)
    .description(description)
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;

      if (!isJson) {
        console.log(`\n╔══╗  ${name.toUpperCase()}`);
        console.log(`╚══╝  ${description}\n`);
      }

      try {
        const ctx = resolveProjectContext(options);

        if (!ctx.isInitialized) {
          throw new NotInitializedError();
        }

        await action(ctx, options);
      } catch (error) {
        if (error instanceof NotInitializedError) {
          if (isJson) {
            outputJson({ error: error.code, message: error.message });
          } else {
            console.error(error.message);
          }
        } else {
          const err = {
            error: "unknown",
            message: error instanceof Error ? error.message : String(error),
          };
          if (isJson) {
            outputJson(err);
          } else {
            console.error(err.message);
          }
        }
        process.exit(1);
      }
    });

  return cmd;
}

// ── Lifecycle Gate ─────────────────────────────────────────────────────────

import { detectLifecycleState, canRunCommand, type NexusLifecycleState } from "./nexus-state-machine.js";
import { COMMAND_GATES } from "./constants.js";

/**
 * Check if a command is allowed to run in the current lifecycle state.
 * Outputs error and returns false if not allowed.
 */
export function checkLifecycleGate(
  command: string,
  projectRoot: string,
  nexusDir: string,
  isJson: boolean
): boolean {
  const state = detectLifecycleState(projectRoot, nexusDir);

  if (!canRunCommand(command, state)) {
    if (isJson) {
      outputJson({
        error: "lifecycle_gate",
        message: `Command '${command}' requires state '${getRequiredState(command)}' but current state is '${state}'.`,
        currentState: state,
        requiredState: getRequiredState(command),
      });
    } else {
      console.log(chalk.yellow(`  ⚠ Command '${command}' cannot run in '${state}' state.`));
      console.log(chalk.gray(`  Required state: ${getRequiredState(command)} or later.`));
      console.log("");
    }
    return false;
  }

  return true;
}

function getRequiredState(command: string): NexusLifecycleState {
  return (COMMAND_GATES[command] || "discovered") as NexusLifecycleState;
}

// ── Report Writer ────────────────────────────────────────────────────────────

/** Write a report to nexus-system/reports/. Returns filename or null. */
export function writeReport(
  nexusDir: string,
  prefix: string,
  report: Record<string, unknown>
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().split("T")[0];
  const existing = readdirSync(reportsDir).filter((f) =>
    f.startsWith(`${prefix}-${date}`)
  );
  const sessionNum = existing.length + 1;

  const filename = `${prefix}-${date}-session${sessionNum}.json`;
  const filepath = join(reportsDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filename;
}

// ── Init Guard ──────────────────────────────────────────────────────────────

/**
 * Common initialization guard for all commands.
 * Resolves project context, checks if initialized, outputs error if not.
 * Returns context if initialized, or null if guard handled the error.
 */
export function guardNotInitialized(
  options: { dir?: string },
  isJson: boolean
): ProjectContext | null {
  const ctx = resolveProjectContext(options);

  if (!ctx.isInitialized) {
    if (isJson) {
      outputJson({ error: "not_initialized", message: "Run 'nexus init' to initialize governance." });
    } else {
      console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
      console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
      console.log("");
    }
    return null;
  }

  return ctx;
}

// ── Cache Wrapper ────────────────────────────────────────────────────────────

/** Wrap cache read/write pattern. Returns data and whether cache was hit. */
export async function withCache<T>(
  projectRoot: string,
  nexusDir: string,
  key: string,
  compute: () => T | Promise<T>,
  options?: { force?: boolean }
): Promise<{ data: T; cacheHit: boolean }> {
  // Dynamic import to avoid circular dependencies
  const { getCached, setCache, computeKeyChecksums } = await import("./cache.js");

  if (!options?.force) {
    const cached = getCached(projectRoot, nexusDir, key as "complexity" | "patterns" | "health",
      () => computeKeyChecksums(projectRoot, nexusDir));
    if (cached) {
      return { data: cached as T, cacheHit: true };
    }
  }

  const data = await compute();
  setCache(projectRoot, nexusDir, key as "complexity" | "patterns" | "health",
    data as Record<string, unknown>, computeKeyChecksums(projectRoot, nexusDir));
  return { data, cacheHit: false };
}
