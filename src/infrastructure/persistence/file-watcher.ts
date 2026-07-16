/**
 * file-watcher.ts — Governance Artifact Watcher
 *
 * Watches shitenno-go/ for file changes and triggers automatic
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
  /** Additional paths to watch beyond shitenno-go/ */
  extraPaths?: string[];
  /** Enable doc sync on significant changes (default: true) */
  enableDocSync?: boolean;
}

// ── File Type Detection ──────────────────────────────────────────────────────

type ArtifactType = "adr" | "skill" | "workflow" | "rule" | "config" | "doc" | "unknown";

function detectArtifactType(filePath: string, shitenDir: string): ArtifactType {
  const relative = filePath.slice(shitenDir.length + 1);

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
  shitenDir: string,
  options: WatcherOptions = {}
): () => void {
  const { debounceMs = 500, enableDocSync = true } = options;

  if (activeWatcher) {
    activeWatcher.close();
  }

  const watchPaths = [
    join(shitenDir, "governance"),
    join(shitenDir, "docs"),
    ...(options.extraPaths || []),
  ];

  const bus = getEventBus();
  const pendingEvents = new Map<string, NodeJS.Timeout>();

  function createWatcher(): FSWatcher {
    const watcher = watch(watchPaths, {
      ignoreInitial: true,
      depth: 3,
      ignored: [
        /(^|[\/\\])\../,
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
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("file-watcher", `Watcher error: ${error.message}`);
      bus.publish("watcher.error" as never, {
        error: error.message,
        timestamp: new Date().toISOString(),
      } as never);

      if (watcherRestartCount < MAX_RESTARTS) {
        watcherRestartCount++;
        const delay = getRestartDelay(watcherRestartCount);
        logger.info("file-watcher", `Restarting watcher in ${delay}ms (attempt ${watcherRestartCount}/${MAX_RESTARTS})`);
        setTimeout(() => {
          activeWatcher?.close();
          activeWatcher = createWatcher();
        }, delay);
      } else {
        logger.error("file-watcher", `Max restart attempts (${MAX_RESTARTS}) reached — watcher stopped`);
      }
    });

    watcher.on("change", (filePath: string) => {
      if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

      const existing = pendingEvents.get(filePath);
      if (existing) clearTimeout(existing);

      pendingEvents.set(
        filePath,
        setTimeout(() => {
          pendingEvents.delete(filePath);
          handleFileChange(filePath, shitenDir, bus, enableDocSync);
        }, debounceMs)
      );
    });

    watcher.on("add", (filePath: string) => {
      if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

      const artifactType = detectArtifactType(filePath, shitenDir);

      if (artifactType === "adr") {
        bus.publish("adr.created", {
          adrId: filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown",
          title: filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown",
          status: "proposed",
        });
      }

      if (artifactType === "skill") {
        bus.publish("skill.created", {
          skillId: filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown",
          skillName: filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown",
        });
      }

      const relativePath = filePath.replace(shitenDir, "").replace(/^\//, "");
      const plansDir = join("governance", "plans");
      if (
        relativePath.startsWith(plansDir) &&
        relativePath.endsWith(".md") &&
        !relativePath.includes("/done/") &&
        !relativePath.includes("/reference/") &&
        !relativePath.includes("/pipeline/") &&
        !filePath.includes("TEMPLATE") &&
        !filePath.includes("README")
      ) {
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
          // File might have been deleted between add and read
        }
        bus.publish("plan.file_changed", {
          planId,
          path: relativePath,
          content: fileContent,
        });
      }

      bus.publish("asset.created", {
        assetId: filePath,
        assetType: artifactType,
        path: filePath,
      });
    });

    return watcher;
  }

  activeWatcher = createWatcher();

  return () => {
    for (const timeout of pendingEvents.values()) {
      clearTimeout(timeout);
    }
    pendingEvents.clear();
    watcherRestartCount = MAX_RESTARTS;
    activeWatcher?.close();
    activeWatcher = null;
  };
}

/**
 * Handle a file change event.
 */
function handleFileChange(
  filePath: string,
  shitenDir: string,
  bus: ReturnType<typeof getEventBus>,
  enableDocSync: boolean
): void {
  const artifactType = detectArtifactType(filePath, shitenDir);

  // Record change for frequency tracking
  const frequency = changeHistory.recordChange(filePath);

  // Read file content for size calculation
  let newContent: string;
  const oldContent: string | null = null;
  try {
    newContent = readFileSync(filePath, "utf-8");
  } catch {
    // File might have been deleted
    newContent = "";
  }

  // Calculate significance
  const significance: SignificanceResult = calculateSignificance(
    filePath,
    shitenDir,
    oldContent,
    newContent,
    frequency
  );

  // Publish asset.updated for all changes
  bus.publish("asset.updated", {
    assetId: filePath,
    assetType: artifactType,
    path: filePath,
    changes: ["content"],
  });

  // Type-specific events
  if (artifactType === "rule") {
    // Rules changed — rule engine will pick up on next event
    bus.publish("rule.triggered", {
      ruleId: filePath.split("/").pop()?.replace(/\.json$/, "") || "unknown",
      ruleDescription: "Rule file updated",
      actionsExecuted: 0,
      success: true,
    });
  }

  if (artifactType === "workflow") {
    // Workflow changed — lifecycle may need re-evaluation
    bus.publish("engineering_state.updated", {
      dimension: "governance",
      previousValue: null,
      newValue: filePath,
      source: "file-watcher",
    });
  }

  if (artifactType === "config") {
    // Config changed — fingerprint may be stale
    bus.publish("engineering_state.updated", {
      dimension: "configuration",
      previousValue: null,
      newValue: filePath,
      source: "file-watcher",
    });
  }

  // Doc sync trigger based on significance
  if (enableDocSync && significance.shouldSync) {
    const relativePath = filePath.slice(shitenDir.length + 1);

    if (significance.level === "high") {
      logger.info(
        "file-watcher",
        `High significance change: ${relativePath} (${significance.score.toFixed(2)})`
      );
    }

    bus.publish("docs.sync.triggered", {
      path: filePath,
      relativePath,
      significance: significance.score,
      level: significance.level,
      outputLevel: significance.outputLevel,
      reasons: significance.reasons,
    });
  }

  // Plan file change — publish event for rule engine to evaluate
  // Guard: if this change was caused by our own sync write, don't re-trigger
  if (isSyncWriteInProgress()) return;

  const relativePath = filePath.slice(shitenDir.length + 1);
  if (relativePath.startsWith("governance/plans/") && relativePath.endsWith(".md")) {
    const fileName = basename(filePath);
    if (fileName !== "TEMPLATE.md" && fileName !== "README.md" &&
        !relativePath.includes("/done/") && !relativePath.includes("/reference/")) {
      const planId = fileName.replace(".md", "");
      bus.publish("plan.file_changed", {
        planId,
        path: relativePath,
        content: newContent,
      });
    }
  }

  // BACKLOG.md change — sync status back to plan files
  if (basename(filePath) === "BACKLOG.md") {
    import("../../plan-backlog-sync.js").then(({ syncBacklogToPlan }) => {
      // Parse ### BACKLOG-XXX — Title headers and extract Status from table
      const sectionRegex = /### (BACKLOG-[A-Z_0-9]+)(?:\s*—\s*(.+))?/g;
      let match;

      while ((match = sectionRegex.exec(newContent)) !== null) {
        const backlogId = match[1] ?? "";
        const planId = backlogId.replace("BACKLOG-", "").toLowerCase().replace(/_/g, "-");

        // Extract Status field from the table following this header
        const sectionStart = match.index;
        const nextSection = newContent.indexOf("\n### ", sectionStart + 1);
        const section = newContent.slice(sectionStart, nextSection !== -1 ? nextSection : undefined);

        const statusMatch = section.match(/\*\*Status\*\*\s*\|\s*([^|]+)/);
        const backlogStatus = statusMatch?.[1]?.trim().toLowerCase() ?? "planeado";

        syncBacklogToPlan(
          shitenDir,
          planId,
          backlogStatus
        );
      }

      bus.publish("backlog.updated", {
        path: filePath,
        timestamp: new Date().toISOString(),
      });
    }).catch(() => {
      // Import failed — skip silently
    });
  }
}

/**
 * Stop any active watcher.
 */
export function stopWatching(): void {
  activeWatcher?.close();
  activeWatcher = null;
}
