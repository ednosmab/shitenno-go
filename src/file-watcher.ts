/**
 * file-watcher.ts — Governance Artifact Watcher
 *
 * Watches nexus-system/ for file changes and triggers automatic
 * context regeneration, knowledge graph rebuild, and briefing cache
 * invalidation.
 *
 * PRINCIPLE: File changes should propagate through the event system.
 */

import { watch, type FSWatcher } from "chokidar";
import { join, basename } from "node:path";
import { readFileSync } from "node:fs";
import { getEventBus } from "./event-bus.js";
import {
  calculateSignificance,
  ChangeHistoryTracker,
  type SignificanceResult,
} from "./doc-sync-significance.js";
import { logger } from "./logger.js";
import { isSyncWriteInProgress } from "./sync-write-guard.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WatcherOptions {
  /** Debounce interval in ms (default: 500) */
  debounceMs?: number;
  /** Additional paths to watch beyond nexus-system/ */
  extraPaths?: string[];
  /** Enable doc sync on significant changes (default: true) */
  enableDocSync?: boolean;
}

// ── File Type Detection ──────────────────────────────────────────────────────

type ArtifactType = "adr" | "skill" | "workflow" | "rule" | "config" | "doc" | "unknown";

function detectArtifactType(filePath: string, nexusDir: string): ArtifactType {
  const relative = filePath.slice(nexusDir.length + 1);

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

/**
 * Start watching governance artifacts for changes.
 * Returns a stop function to close the watcher.
 */
export function startWatching(
  nexusDir: string,
  options: WatcherOptions = {}
): () => void {
  const { debounceMs = 500, enableDocSync = true } = options;

  if (activeWatcher) {
    activeWatcher.close();
  }

  // Watch specific subdirectories (chokidar v5 is slow scanning entire tree)
  const watchPaths = [
    join(nexusDir, "governance"),
    join(nexusDir, "docs"),
    join(nexusDir, "reports"),
    ...(options.extraPaths || []),
  ];

  const bus = getEventBus();
  const pendingEvents = new Map<string, NodeJS.Timeout>();

  activeWatcher = watch(watchPaths, {
    ignoreInitial: true,
    depth: 3,
    ignored: [
      /(^|[\/\\])\../, // dot files
      /node_modules/,
      /telemetry\/events-/, // event log files
      /docs\/generated\//, // auto-generated documentation
    ],
  });

  activeWatcher.on("ready", () => {
    logger.info("file-watcher", "Watcher ready");
  });

  activeWatcher.on("change", (filePath: string) => {
    // Skip files without governance-relevant extensions
    if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

    // Debounce rapid changes to the same file
    const existing = pendingEvents.get(filePath);
    if (existing) clearTimeout(existing);

    pendingEvents.set(
      filePath,
      setTimeout(() => {
        pendingEvents.delete(filePath);
        handleFileChange(filePath, nexusDir, bus, enableDocSync);
      }, debounceMs)
    );
  });

  activeWatcher.on("add", (filePath: string) => {
    // Skip files without governance-relevant extensions
    if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

    const artifactType = detectArtifactType(filePath, nexusDir);

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

    // Detect new plan files in governance/plans/
    const relativePath = filePath.replace(nexusDir, "").replace(/^\//, "");
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

      // Also publish plan.file_changed on ADD so sync subscribers run immediately
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

  return () => {
    for (const timeout of pendingEvents.values()) {
      clearTimeout(timeout);
    }
    pendingEvents.clear();
    activeWatcher?.close();
    activeWatcher = null;
  };
}

/**
 * Handle a file change event.
 */
function handleFileChange(
  filePath: string,
  nexusDir: string,
  bus: ReturnType<typeof getEventBus>,
  enableDocSync: boolean
): void {
  const artifactType = detectArtifactType(filePath, nexusDir);

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
    nexusDir,
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
    const relativePath = filePath.slice(nexusDir.length + 1);

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

  const relativePath = filePath.slice(nexusDir.length + 1);
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
    import("./plan-backlog-sync.js").then(({ syncBacklogToPlan }) => {
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
          nexusDir,
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
