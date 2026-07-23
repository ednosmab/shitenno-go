/**
 * file-watcher.ts — Governance Artifact Watcher
 *
 * Watches shitenno/ for file changes and triggers automatic
 * context regeneration, knowledge graph rebuild, and briefing cache
 * invalidation.
 *
 * PRINCIPLE: File changes should propagate through the event system.
 */

import { watch, type FSWatcher } from "chokidar";
import { join, basename } from "node:path";
import { readFileSync } from "node:fs";
import { getEventBus } from "../../event-bus.js";
import {
  calculateSignificance,
  ChangeHistoryTracker,
  type SignificanceResult,
} from "../../doc-sync-significance.js";
import { logger } from "../../logger.js";
import { isSyncWriteInProgress } from "../../sync-write-guard.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WatcherOptions {
  /** Debounce interval in ms (default: 500) */
  debounceMs?: number;
  /** Additional paths to watch beyond shitenno/ */
  extraPaths?: string[];
  /** Enable doc sync on significant changes (default: true) */
  enableDocSync?: boolean;
}

interface WatcherContext {
  shitennoDir: string;
  bus: ReturnType<typeof getEventBus>;
  enableDocSync: boolean;
  debounceMs: number;
  pendingEvents: Map<string, NodeJS.Timeout>;
}

interface ChangeInfo {
  filePath: string;
  relativePath: string;
  significance: SignificanceResult;
}

// ── File Type Detection ──────────────────────────────────────────────────────

type ArtifactType = "adr" | "skill" | "workflow" | "rule" | "config" | "doc" | "unknown";

function detectArtifactType(filePath: string, shitennoDir: string): ArtifactType {
  const relative = filePath.slice(shitennoDir.length + 1);

  if (relative.startsWith("docs/adrs/")) return "adr";
  if (relative.startsWith("docs/skills/")) return "skill";
  if (relative.startsWith("governance/WORKFLOW")) return "workflow";
  if (relative.startsWith("governance/rules/")) return "rule";
  if (relative.endsWith(".json") || relative.endsWith(".yaml")) return "config";
  if (relative.endsWith(".md")) return "doc";

  return "unknown";
}

// ── Watcher ──────────────────────────────────────────────────────────────────

let activeWatcher: FSWatcher | null = null;
const changeHistory = new ChangeHistoryTracker();
let watcherRestartCount = 0;
const MAX_RESTARTS = 5;
const BASE_RESTART_DELAY_MS = 1000;

function getRestartDelay(attempt: number): number {
  return Math.min(BASE_RESTART_DELAY_MS * 2 ** attempt, 30_000);
}

/**
 * Start watching governance artifacts for changes.
 * Returns a stop function to close the watcher.
 */
export function startWatching(
  shitennoDir: string,
  options: WatcherOptions = {}
): () => void {
  const { debounceMs = 500, enableDocSync = true } = options;

  if (activeWatcher) {
    activeWatcher.close();
  }

  const watchPaths = [
    join(shitennoDir, "governance"),
    join(shitennoDir, "docs"),
    ...(options.extraPaths || []),
  ];

  const ctx: WatcherContext = {
    shitennoDir,
    bus: getEventBus(),
    enableDocSync,
    debounceMs,
    pendingEvents: new Map<string, NodeJS.Timeout>(),
  };

  activeWatcher = createWatcherInstance(watchPaths, ctx);

  return () => {
    for (const timeout of ctx.pendingEvents.values()) {
      clearTimeout(timeout);
    }
    ctx.pendingEvents.clear();
    watcherRestartCount = MAX_RESTARTS;
    activeWatcher?.close();
    activeWatcher = null;
  };
}

function createWatcherInstance(watchPaths: string[], ctx: WatcherContext): FSWatcher {
  const watcher = watch(watchPaths, {
    ignoreInitial: true,
    depth: 3,
    ignored: [
      /node_modules/,
      /telemetry\/events-/,
      /docs\/generated\//,
    ],
  });

  watcher.on("ready", () => {
    watcherRestartCount = 0;
    logger.info("file-watcher", "Watcher ready");
  });

  watcher.on("error", (err: unknown) => {
    handleWatcherError(err, watchPaths, ctx);
  });

  watcher.on("change", (filePath: string) => {
    handleChangeEvent(filePath, ctx);
  });

  watcher.on("add", (filePath: string) => {
    handleFileAdd(filePath, ctx);
  });

  return watcher;
}

function handleWatcherError(err: unknown, watchPaths: string[], ctx: WatcherContext): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error("file-watcher", `Watcher error: ${error.message}`);
  ctx.bus.publish("watcher.error" as never, {
    error: error.message,
    timestamp: new Date().toISOString(),
  } as never);

  if (watcherRestartCount >= MAX_RESTARTS) {
    logger.error("file-watcher", `Max restart attempts (${MAX_RESTARTS}) reached — watcher stopped`);
    return;
  }

  watcherRestartCount++;
  const delay = getRestartDelay(watcherRestartCount);
  logger.info("file-watcher", `Restarting watcher in ${delay}ms (attempt ${watcherRestartCount}/${MAX_RESTARTS})`);
  setTimeout(() => {
    activeWatcher?.close();
    activeWatcher = createWatcherInstance(watchPaths, ctx);
  }, delay);
}

function handleChangeEvent(filePath: string, ctx: WatcherContext): void {
  if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

  const existing = ctx.pendingEvents.get(filePath);
  if (existing) clearTimeout(existing);

  ctx.pendingEvents.set(
    filePath,
    setTimeout(() => {
      ctx.pendingEvents.delete(filePath);
      handleFileChange(filePath, ctx.shitennoDir, ctx.bus, ctx.enableDocSync);
    }, ctx.debounceMs)
  );
}

function handleFileAdd(filePath: string, ctx: WatcherContext): void {
  if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

  const { shitennoDir, bus } = ctx;
  const addRelative = filePath.slice(shitennoDir.length + 1);
  if (addRelative.split(/[/\\]/).some((s) => s.startsWith(".") && s !== "")) return;

  const artifactType = detectArtifactType(filePath, shitennoDir);

  publishArtifactCreatedEvents(filePath, artifactType, bus);
  publishPlanFileEvents(filePath, shitennoDir, bus);

  bus.publish("asset.created", {
    assetId: filePath,
    assetType: artifactType,
    path: filePath,
  });
}

function publishArtifactCreatedEvents(
  filePath: string,
  artifactType: ArtifactType,
  bus: ReturnType<typeof getEventBus>,
): void {
  const fileName = filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown";

  if (artifactType === "adr") {
    bus.publish("adr.created", { adrId: fileName, title: fileName, status: "proposed" });
  }

  if (artifactType === "skill") {
    bus.publish("skill.created", { skillId: fileName, skillName: fileName });
  }
}

function publishPlanFileEvents(
  filePath: string,
  shitennoDir: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  const relativePath = filePath.replace(shitennoDir, "").replace(/^\//, "");
  const plansDir = join("governance", "plans");
  if (
    !relativePath.startsWith(plansDir) ||
    !relativePath.endsWith(".md") ||
    relativePath.includes("/done/") ||
    relativePath.includes("/reference/") ||
    relativePath.includes("/pipeline/") ||
    filePath.includes("TEMPLATE") ||
    filePath.includes("README")
  ) return;

  const planId = filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown";
  bus.publish("plan.created", {
    planId,
    path: relativePath,
    title: planId.replace(/-/g, " "),
  });

  let fileContent = "";
  try {
    fileContent = readFileSync(filePath, "utf-8");
  } catch {
  }
  bus.publish("plan.file_changed", {
    planId,
    path: relativePath,
    content: fileContent,
  });
}

function publishTypeSpecificEvents(
  artifactType: string,
  filePath: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  if (artifactType === "rule") {
    bus.publish("rule.triggered", {
      ruleId: basename(filePath).replace(/\.json$/, "") || "unknown",
      ruleDescription: "Rule file updated",
      actionsExecuted: 0,
      success: true,
    });
  }

  if (artifactType === "workflow" || artifactType === "config") {
    bus.publish("engineering_state.updated", {
      dimension: artifactType === "workflow" ? "governance" : "configuration",
      previousValue: null,
      newValue: filePath,
      source: "file-watcher",
    });
  }
}

function handleDocSync(
  info: ChangeInfo,
  enableDocSync: boolean,
  bus: ReturnType<typeof getEventBus>,
): void {
  if (!enableDocSync || !info.significance.shouldSync) return;
  if (info.significance.level === "high") {
    logger.info("file-watcher", `High significance change: ${info.relativePath} (${info.significance.score.toFixed(2)})`);
  }
  bus.publish("docs.sync.triggered", {
    path: info.filePath,
    relativePath: info.relativePath,
    significance: info.significance.score,
    level: info.significance.level,
    outputLevel: info.significance.outputLevel,
    reasons: info.significance.reasons,
  });
}

function handlePlanChange(
  filePath: string,
  relativePath: string,
  newContent: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  if (isSyncWriteInProgress()) return;
  if (!relativePath.startsWith("governance/plans/") || !relativePath.endsWith(".md")) return;
  const fileName = basename(filePath);
  if (fileName === "TEMPLATE.md" || fileName === "README.md" || relativePath.includes("/done/") || relativePath.includes("/reference/")) return;
  bus.publish("plan.file_changed", { planId: fileName.replace(".md", ""), path: relativePath, content: newContent });
}

function handleBacklogChange(
  filePath: string,
  newContent: string,
  shitennoDir: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  const fileName = basename(filePath);
  const isBacklogFile = fileName === "BACKLOG.md" ||
    (filePath.includes("/backlog/") && (fileName === "ACTIVE.md" || fileName === "DONE.md"));

  if (!isBacklogFile) return;
  import("../../plan-backlog-sync.js").then(({ syncBacklogToPlan }) => {
    const sectionRegex = /### (BACKLOG-[A-Z_0-9]+)(?:\s*—\s*(.+))?/g;
    let match;
    while ((match = sectionRegex.exec(newContent)) !== null) {
      const backlogId = match[1] ?? "";
      const planId = backlogId.replace("BACKLOG-", "").toLowerCase().replace(/_/g, "-");
      const sectionStart = match.index;
      const nextSection = newContent.indexOf("\n### ", sectionStart + 1);
      const section = newContent.slice(sectionStart, nextSection !== -1 ? nextSection : undefined);
      const statusMatch = section.match(/\*\*Status\*\*\s*\|\s*([^|]+)/);
      syncBacklogToPlan(shitennoDir, planId, statusMatch?.[1]?.trim().toLowerCase() ?? "planeado");
    }
    bus.publish("backlog.updated", { path: filePath, timestamp: new Date().toISOString() });
  }).catch(() => { /* Import failed */ });
}

function handleFileChange(
  filePath: string,
  shitennoDir: string,
  bus: ReturnType<typeof getEventBus>,
  enableDocSync: boolean
): void {
  const relativePath = filePath.slice(shitennoDir.length + 1);
  const segments = relativePath.split(/[/\\]/);
  if (segments.some((s) => s.startsWith(".") && s !== "")) return;

  const artifactType = detectArtifactType(filePath, shitennoDir);
  const frequency = changeHistory.recordChange(filePath);

  let newContent: string;
  try { newContent = readFileSync(filePath, "utf-8"); } catch { newContent = ""; }

  const significance = calculateSignificance({ filePath, shitennoDir, oldContent: null, newContent, frequency });

  bus.publish("asset.updated", { assetId: filePath, assetType: artifactType, path: filePath, changes: ["content"] });
  publishTypeSpecificEvents(artifactType, filePath, bus);
  handleDocSync({ filePath, relativePath, significance }, enableDocSync, bus);
  handlePlanChange(filePath, relativePath, newContent, bus);
  handleBacklogChange(filePath, newContent, shitennoDir, bus);
}

/**
 * Stop any active watcher.
 */
export function stopWatching(): void {
  activeWatcher?.close();
  activeWatcher = null;
}
