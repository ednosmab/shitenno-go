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
import { getEventBus } from "./event-bus.js";
import { trackCommand } from "./session-tracker.js";
import { loadPlugins, getHookBus } from "./plugin-system.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MiddlewareContext {
  projectRoot: string;
  nexusDir: string;
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
  program.hook("preAction", async (thisCommand) => {
    const commandName = thisCommand.name();

    // Track command in session
    if (ctx.sessionId) {
      trackCommand(ctx.nexusDir, ctx.sessionId, commandName);
    }

    // Ensure plugins are loaded
    await ensurePluginsLoaded(ctx.projectRoot);

    // Execute pre-analysis hook
    const hookBus = getHookBus();
    await hookBus.executeHook(
      "pre-analysis",
      { command: commandName, projectRoot: ctx.projectRoot },
      (_plugin, input) => input
    );
  });

  program.hook("postAction", async (thisCommand) => {
    const commandName = thisCommand.name();

    // Execute post-analysis hook
    const hookBus = getHookBus();
    await hookBus.executeHook(
      "post-analysis",
      { command: commandName, projectRoot: ctx.projectRoot, success: true, duration: 0 },
      (_plugin, input) => input
    );

    // Publish completion event
    getEventBus().publish("analysis.complete", {
      projectId: ctx.projectRoot,
      maturityScore: 0,
      dimensions: {},
      recommendations: [],
    });
  });
}
