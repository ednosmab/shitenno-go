/**
 * plugin-system.ts — Extensibility Framework
 *
 * Allows projects to extend Nexus without modifying core.
 * Plugins provide hooks that execute at specific points in the pipeline.
 *
 * PRINCIPLE: Extensibility without modification.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type HookName =
  | "pre-analysis"
  | "post-analysis"
  | "pre-scaffold"
  | "post-scaffold"
  | "custom-check"
  | "custom-recommendation"
  | "custom-metric";

export interface NexusPlugin {
  name: string;
  version: string;
  description: string;
  hooks?: Partial<Record<HookName, (...args: unknown[]) => unknown | Promise<unknown>>>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  nexusVersion?: string;
  hooks?: string[];
  author?: string;
}

// ── Hook Bus ─────────────────────────────────────────────────────────────────

export class HookBus {
  private plugins: NexusPlugin[] = [];

  /** Register a plugin. */
  registerPlugin(plugin: NexusPlugin): void {
    // Check for duplicate names
    if (this.plugins.some((p) => p.name === plugin.name)) {
      logger.warn("PluginSystem", `Plugin "${plugin.name}" already registered, skipping.`);
      return;
    }
    this.plugins.push(plugin);
  }

  /** Get all registered plugins. */
  getPlugins(): NexusPlugin[] {
    return [...this.plugins];
  }

  /** Execute a hook across all plugins. */
  async executeHook<T>(
    hookName: HookName,
    input: T,
    transformer: (plugin: NexusPlugin, input: T) => T | Promise<T>
  ): Promise<T> {
    let current = input;

    for (const plugin of this.plugins) {
      if (plugin.hooks?.[hookName]) {
        try {
          current = await transformer(plugin, current);
        } catch (error) {
          logger.error(
            "PluginSystem",
            `Hook "${hookName}" failed in plugin "${plugin.name}":`,
            error
          );
        }
      }
    }

    return current;
  }

  /** Execute a hook that collects results. */
  async collectHook<T>(
    hookName: HookName,
    collector: (plugin: NexusPlugin) => T | Promise<T | null>
  ): Promise<T[]> {
    const results: T[] = [];

    for (const plugin of this.plugins) {
      if (plugin.hooks?.[hookName]) {
        try {
          const result = await collector(plugin);
          if (result !== null && result !== undefined) {
            results.push(result);
          }
        } catch (error) {
          logger.error(
            "PluginSystem",
            `Collector hook "${hookName}" failed in plugin "${plugin.name}":`,
            error
          );
        }
      }
    }

    return results;
  }
}

// ── Plugin Loader ────────────────────────────────────────────────────────────

/** Load plugins from a directory. */
export async function loadPluginsFromDir(pluginsDir: string): Promise<NexusPlugin[]> {
  if (!existsSync(pluginsDir)) return [];

  const plugins: NexusPlugin[] = [];
  const entries = readdirSync(pluginsDir, { withFileTypes: true }).filter(
    (e) => e.isDirectory()
  );

  for (const entry of entries) {
    const pluginDir = join(pluginsDir, entry.name);
    const pluginFile = join(pluginDir, "plugin.js");
    const tsFile = join(pluginDir, "plugin.ts");

    const filePath = existsSync(pluginFile) ? pluginFile : existsSync(tsFile) ? tsFile : null;

    if (filePath) {
      try {
        const mod = await import(filePath);
        const plugin = mod.default || mod;
        if (isNexusPlugin(plugin)) {
          plugins.push(plugin);
        }
      } catch (error) {
        logger.error("PluginSystem", `Failed to load plugin from "${entry.name}":`, error);
      }
    }
  }

  return plugins;
}

/** Load all plugins for a project. */
export async function loadPlugins(projectRoot: string): Promise<NexusPlugin[]> {
  const plugins: NexusPlugin[] = [];

  // Project-level plugins
  const projectPluginsDir = join(projectRoot, "nexus-plugins");
  plugins.push(...(await loadPluginsFromDir(projectPluginsDir)));

  // Global plugins
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (homeDir) {
    const globalPluginsDir = join(homeDir, ".config", "nexus", "plugins");
    plugins.push(...(await loadPluginsFromDir(globalPluginsDir)));
  }

  return plugins;
}

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_HOOK_NAMES = new Set([
  "pre-analysis", "post-analysis", "pre-scaffold", "post-scaffold",
  "custom-check", "custom-recommendation", "custom-metric",
]);

const SAFE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function isNexusPlugin(obj: unknown): obj is NexusPlugin {
  if (typeof obj !== "object" || obj === null) return false;
  const plugin = obj as Record<string, unknown>;

  if (typeof plugin.name !== "string" || !SAFE_NAME_REGEX.test(plugin.name)) return false;
  if (typeof plugin.version !== "string") return false;
  if (typeof plugin.description !== "string") return false;

  if (plugin.hooks !== undefined) {
    if (typeof plugin.hooks !== "object" || plugin.hooks === null) return false;
    const hooks = plugin.hooks as Record<string, unknown>;
    for (const hookName of Object.keys(hooks)) {
      if (!VALID_HOOK_NAMES.has(hookName as HookName)) return false;
      if (typeof hooks[hookName] !== "function") return false;
    }
  }

  return true;
}

// ── Singleton ────────────────────────────────────────────────────────────────

let globalHookBus: HookBus | null = null;

/** Get the global hook bus instance. */
export function getHookBus(): HookBus {
  if (!globalHookBus) {
    globalHookBus = new HookBus();
  }
  return globalHookBus;
}

/** Reset the global hook bus (for testing). */
export function resetHookBus(): void {
  globalHookBus = null;
}
