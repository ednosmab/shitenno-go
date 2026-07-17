/**
 * cli-middleware.ts — Pre/Post Command Hooks for CLI
 *
 * Uses Commander.js native preAction/postAction hooks to provide:
 * - Command tracking (session telemetry)
 * - Plugin loading (project + global)
 * - Event bus integration (pre/post analysis events)
 *
 * PRINCIPLE: Cross-cutting concerns belong in middleware, not in commands.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { getEventBus } from "./event-bus.js";
import { trackCommand } from "./session-tracker.js";
import { loadPlugins, getHookBus } from "./plugin-system.js";
import { isDaemonRunning, startDaemon, shouldSkipDaemon, getApprovedPath } from "./daemon-client.js";
import { DaemonCircuitBreaker } from "./daemon-circuit-breaker.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MiddlewareContext {
  projectRoot: string;
  shitenDir: string;
  sessionId: string | null;
}

// ── Plugin Loader ────────────────────────────────────────────────────────────

let pluginsLoaded = false;

/** Load plugins once per process. Safe to call multiple times. */
export async function ensurePluginsLoaded(projectRoot: string): Promise<void> {
  if (pluginsLoaded) return;

  const plugins = await loadPlugins(projectRoot);
  const hookBus = getHookBus();

  for (const plugin of plugins) {
    hookBus.registerPlugin(plugin);
  }

  pluginsLoaded = true;
}

// ── Middleware Setup ──────────────────────────────────────────────────────────

/**
 * Install preAction/postAction hooks on a Commander program.
 * Every subcommand will automatically:
 * 1. Track the command in the session
 * 2. Load plugins on first invocation
 * 3. Execute pre/post analysis hooks
 * 4. Publish analysis.complete events
 */
export function installMiddleware(program: Command, ctx: MiddlewareContext): void {
  const resolvedSessionId = ctx.sessionId ?? `cli-${Date.now()}`;
  let sessionStarted = false;
  let sessionEnded = false;
  const sessionStartTime = Date.now();

  program.hook("preAction", async (thisCommand) => {
    const commandName = thisCommand.name();

    // Track command in session
    if (ctx.sessionId) {
      trackCommand(ctx.shitenDir, ctx.sessionId, commandName);
    }

    // Publish session.start once per CLI invocation
    if (!sessionStarted) {
      sessionStarted = true;
      getEventBus().publish("session.start", {
        sessionId: resolvedSessionId,
        projectRoot: ctx.projectRoot,
      });
    }

    // Ensure plugins are loaded
    await ensurePluginsLoaded(ctx.projectRoot);

    // Daemon auto-start: only if approved by user and circuit not tripped
    // Fire-and-forget — never blocks or throws into CLI flow
    if (!shouldSkipDaemon() && commandName !== "daemon") {
      try {
        const breaker = new DaemonCircuitBreaker(ctx.shitenDir);
        const approvedPath = getApprovedPath(ctx.shitenDir);
        if (
          existsSync(approvedPath) &&
          !breaker.isTripped() &&
          !isDaemonRunning(ctx.shitenDir)
        ) {
          startDaemon(ctx.shitenDir).catch(() => {
            // Auto-start failure is silent — CLI continues without daemon
          });
        }
      } catch {
        // Daemon logic must never crash the CLI
      }
    }

    // Execute pre-analysis hook
    const hookBus = getHookBus();
    await hookBus.executeHook(
      "pre-analysis",
      { command: commandName, projectRoot: ctx.projectRoot },
      (_plugin, input) => input
    );
  });

  let preActionTimestamp = 0;

  program.hook("preAction", () => {
    preActionTimestamp = Date.now();
  });

  program.hook("postAction", async (thisCommand) => {
    const commandName = thisCommand.name();
    const duration = preActionTimestamp ? Date.now() - preActionTimestamp : 0;

    // Execute post-analysis hook
    const hookBus = getHookBus();
    await hookBus.executeHook(
      "post-analysis",
      { command: commandName, projectRoot: ctx.projectRoot, success: true, duration },
      (_plugin, input) => input
    );

    // Publish telemetry event (command completed)
    getEventBus().publish("command.completed", {
      command: commandName,
      projectRoot: ctx.projectRoot,
      timestamp: new Date().toISOString(),
      duration,
    });

    // Publish session.end once for the daemon to track session lifecycle
    if (!sessionEnded) {
      sessionEnded = true;
      const sessionDuration = Date.now() - sessionStartTime;
      const outcome = process.exitCode && process.exitCode !== 0 ? "failed" : "success";
      getEventBus().publish("session.end", {
        sessionId: resolvedSessionId,
        duration: sessionDuration,
        outcome,
      });
    }
  });
}
