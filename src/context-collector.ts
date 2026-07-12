/**
 * context-collector.ts — Context Pipeline: Data Collection Layer
 *
 * Collects all project context from existing modules into a single
 * ContextSnapshot. This is the "Collect" stage of the Context Pipeline.
 *
 * PRINCIPLE: A single source of truth for project context.
 * All downstream components (briefing, cache, feedback) consume this.
 *
 * DI: All external calls are injected via the ContextDeps interface,
 * making the function fully testable without filesystem/git access.
 */

import { generateProjectFingerprint, loadFingerprint, saveFingerprint, isFingerprintStale, type ProjectFingerprint } from "./project-fingerprint.js";
import { generateRiskMap, type RiskMap } from "./risk-map.js";
import { generateContextRules, type ContextRule } from "./context-rules.js";
import { generateDynamicRules, type DynamicRule } from "./dynamic-rules.js";
import { generateBriefing, type Briefing, type Reminder, type ReminderPriority, type ReminderCategory } from "./briefing.js";
import { loadMaturityProfile, type MaturityProfile } from "./maturity-profile.js";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { analyseProject, type ProjectAnalysis } from "./analyser.js";
import { detectPatterns as _detectPatterns, type PatternDetectionReport, type DetectedPattern } from "./pattern-detector.js";
import { getFeedbackRecords, computeFeedbackSummary } from "./session-feedback.js";
import { logger } from "./logger.js";
import { computeInputHash } from "./briefing-cache.js";
import { computeKeyChecksums, getCached, setCache } from "./cache.js";
import { readPersistedEvents, type EventEnvelope } from "./event-bus.js";


// ── Types ──────────────────────────────────────────────────────────────────

/** Injectable dependencies for testability. */
export interface ContextDeps {
  loadFingerprint: (nexusDir: string) => ProjectFingerprint | null;
  saveFingerprint: (nexusDir: string, fp: ProjectFingerprint) => void;
  isFingerprintStale: (nexusDir: string) => boolean;
  analyseProject: (projectRoot: string) => ProjectAnalysis;
  loadMaturityProfile: (nexusDir: string) => MaturityProfile | null;
  generateProjectFingerprint: (root: string, analysis: ProjectAnalysis, score?: number) => ProjectFingerprint;
  generateRiskMap: (root: string, nexusDir: string) => RiskMap;
  generateContextRules: (fp: ProjectFingerprint, risk: RiskMap) => ContextRule[];
  generateDynamicRules: (root: string, nexusDir: string) => DynamicRule[];
  generateBriefing: (fp: ProjectFingerprint, risk: RiskMap, ctx: ContextRule[], dyn: DynamicRule[], mat?: MaturityProfile, quickBoard?: { currentTask: string; nextP0: string; p1Debts: string; impediments: string; lastSessionStatus: string }, reminders?: Reminder[]) => Briefing;
  detectPatterns: (projectRoot: string, nexusDir: string) => PatternDetectionReport;
  /** Optional: compute checksums for snapshot cache invalidation. */
  computeKeyChecksums?: (projectRoot: string, nexusDir: string) => Record<string, string>;
  /** Optional: read cached snapshot. Return null to disable cache reads. */
  getCached?: <T>(projectRoot: string, nexusDir: string, key: string, checksumsFn: () => Record<string, string>) => T | null;
  /** Optional: write snapshot to cache. No-op to disable cache writes. */
  setCache?: <T>(projectRoot: string, nexusDir: string, key: string, data: T, checksums: Record<string, string>) => void;
}

/** The collected context snapshot. */
export interface ContextSnapshot {
  /** When the snapshot was collected. */
  collectedAt: string;
  /** SHA-256 hash of the collected inputs (for cache invalidation). */
  inputHash: string;
  /** Project fingerprint. */
  fingerprint: ProjectFingerprint;
  /** Risk map. */
  riskMap: RiskMap;
  /** Context-aware rules. */
  contextRules: ContextRule[];
  /** Dynamic rules from history. */
  dynamicRules: DynamicRule[];
  /** Maturity profile (if available). */
  maturityProfile: MaturityProfile | null;
  /** The generated briefing. */
  briefing: Briefing;
}

// ── Default Dependencies ───────────────────────────────────────────────────

/** Real I/O dependencies (production). */
export const defaultDeps: ContextDeps = {
  loadFingerprint,
  saveFingerprint,
  isFingerprintStale,
  analyseProject,
  loadMaturityProfile,
  generateProjectFingerprint,
  generateRiskMap,
  generateContextRules,
  generateDynamicRules,
  generateBriefing,
  detectPatterns: _detectPatterns,
};

// ── Main Collector ─────────────────────────────────────────────────────────

/**
 * Collect all project context into a single snapshot.
 *
 * Uses an intermediate disk cache keyed by a lightweight pre-hash
 * (git HEAD + nexus-system dir). On cache hit, all heavy computation
 * (fingerprint, risk map, rules, briefing) is skipped.
 *
 * @param projectRoot - Root directory of the project.
 * @param nexusDir - Path to nexus-system/ directory.
 * @param deps - Injectable dependencies (for testing). Uses real I/O if omitted.
 * @returns A complete ContextSnapshot.
 */
export function collectContext(
  projectRoot: string,
  nexusDir: string,
  deps: ContextDeps = defaultDeps
): ContextSnapshot {
  // 0. Snapshot cache check (intermediate cache — 2.15b)
  const computeChecksums = deps.computeKeyChecksums ?? computeKeyChecksums;
  const cacheGet = deps.getCached ?? getCached;
  const cacheSet = deps.setCache ?? setCache;
  try {
    const cached = cacheGet<ContextSnapshot>(projectRoot, nexusDir, "complexity", () =>
      computeChecksums(projectRoot, nexusDir)
    );
    if (cached && (cached as ContextSnapshot).inputHash) {
      logger.debug("collectContext", "Snapshot cache hit — skipping recomputation");
      return cached as ContextSnapshot;
    }
  } catch {
    logger.debug("collectContext", "Cache read failed — computing fresh snapshot");
  }

  // 1. Fingerprint
  let fingerprint = deps.loadFingerprint(nexusDir);
  if (!fingerprint || deps.isFingerprintStale(nexusDir)) {
    const analysis = deps.analyseProject(projectRoot);
    const maturityProfile = deps.loadMaturityProfile(nexusDir);
    fingerprint = deps.generateProjectFingerprint(projectRoot, analysis, maturityProfile?.overallScore);
    deps.saveFingerprint(nexusDir, fingerprint);
  }

  // 2. Risk Map
  const riskMap = deps.generateRiskMap(projectRoot, nexusDir);

  // 3. Context Rules
  const contextRules = deps.generateContextRules(fingerprint, riskMap);

  // 4. Dynamic Rules
  const dynamicRules = deps.generateDynamicRules(projectRoot, nexusDir);

  // 5. Maturity Profile
  const maturityProfile = deps.loadMaturityProfile(nexusDir);

  // 6. Load Quick Board data from context_buffer.yaml
  const quickBoard = loadQuickBoard(nexusDir);

  // 7. Generate Briefing
  const briefing = deps.generateBriefing(
    fingerprint, riskMap, contextRules, dynamicRules,
    maturityProfile ?? undefined,
    {
      currentTask: quickBoard.currentTask,
      nextP0: quickBoard.nextP0,
      p1Debts: quickBoard.p1Debts,
      impediments: quickBoard.impediments,
      lastSessionStatus: quickBoard.lastSessionStatus,
    },
    quickBoard.reminders
  );

  // 7. Enrich briefing with detected patterns (Gap 4+5: feedback hotspots + pattern-detector)
  const enrichedBriefing = enrichBriefingWithPatterns(briefing, projectRoot, nexusDir, deps);

  // 7b. Enrich briefing with recent activity from persisted events (last 24h)
  const finalBriefing = enrichBriefingWithRecentActivity(enrichedBriefing, nexusDir);

  // 8. Compute input hash for cache invalidation
  const inputHash = computeInputHash({
    fingerprintHash: fingerprint.hash,
    riskMapHash: riskMap.generatedAt,
    contextRuleCount: contextRules.length,
    dynamicRuleCount: dynamicRules.length,
    maturityScore: maturityProfile?.overallScore ?? null,
  });

  const snapshot: ContextSnapshot = {
    collectedAt: new Date().toISOString(),
    inputHash,
    fingerprint,
    riskMap,
    contextRules,
    dynamicRules,
    maturityProfile,
    briefing: finalBriefing,
  };

  // 9. Store snapshot in cache (reuse complexity slot in nexus-cache.json)
  try {
    const checksums = computeChecksums(projectRoot, nexusDir);
    cacheSet(projectRoot, nexusDir, "complexity", snapshot, checksums);
  } catch (err) {
    logger.debug("collectContext", "Failed to cache snapshot:", err instanceof Error ? err.message : err);
  }

  return snapshot;
}

// ── Pattern Enrichment (Gaps 4+5) ─────────────────────────────────────────

/**
 * Enrich a briefing with detected patterns from pattern-detector
 * and failure hotspots from session-feedback.
 *
 * Gap 4: patterns.recurringErrors populated from feedback failure hotspots.
 * Gap 5: patterns.detected populated from pattern-detector DetectedPattern[].
 *
 * @param briefing - The base briefing to enrich.
 * @param projectRoot - Root directory of the project.
 * @param nexusDir - Path to nexus-system/ directory.
 * @param deps - Injectable dependencies (for testing).
 * @param existingPatternReport - Optional pre-computed pattern report to avoid re-detection.
 * @returns The enriched briefing with recurringErrors and detected patterns populated.
 */
function enrichBriefingWithPatterns(
  briefing: Briefing,
  projectRoot: string,
  nexusDir: string,
  deps: ContextDeps,
  existingPatternReport?: PatternDetectionReport
): Briefing {
  // Gap 4: Populate recurringErrors from feedback failure hotspots
  let recurringErrors: string[] = [];
  try {
    const records = getFeedbackRecords(nexusDir);
    if (records.length > 0) {
      const summary = computeFeedbackSummary(records);
      recurringErrors = summary.failureHotspots;
    }
  } catch (err) {
    logger.debug("enrichBriefing", "Feedback data unavailable:", err instanceof Error ? err.message : err);
  }

  // Gap 5: Populate detected patterns from pattern-detector
  let detected: Briefing["patterns"]["detected"] = [];
  try {
    const patternReport = existingPatternReport ?? deps.detectPatterns(projectRoot, nexusDir);
    detected = patternReport.patterns.map((p: DetectedPattern) => ({
      type: p.type,
      description: p.description,
      occurrences: p.occurrences,
      affectedArea: p.affectedArea,
      severity: p.severity,
    }));
  } catch (err) {
    logger.debug("enrichBriefing", "Pattern detection unavailable:", err instanceof Error ? err.message : err);
  }

  return {
    ...briefing,
    patterns: {
      ...briefing.patterns,
      recurringErrors,
      detected,
    },
  };
}

// ── Recent Activity Enrichment ──────────────────────────────────────────────

/** Event types to include in recent activity summary. */
const ACTIVITY_EVENT_TYPES = new Set([
  "plan.created",
  "plan.file_changed",
  "plan.format_warning",
  "plan.archived",
  "backlog.updated",
]);

/** Summarize an event payload into a human-readable string. */
function summarizeEvent(event: EventEnvelope): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "plan.created":
      return `Plano criado: ${p.planId ?? "unknown"}`;
    case "plan.file_changed":
      return `Plano alterado: ${p.planId ?? "unknown"}`;
    case "plan.format_warning":
      return `Formato inválido: ${p.planId ?? "unknown"}`;
    case "plan.archived":
      return `Plano arquivado: ${p.planId ?? "unknown"}`;
    case "backlog.updated":
      return `${p.source ?? "sync"}: ${p.stepsCount ?? 0} passos`;
    default:
      return String(p.planId ?? p.source ?? event.type);
  }
}

/**
 * Enrich a briefing with recent activity from persisted events (last 24h).
 * Reads from telemetry/events-YYYY-MM-DD.jsonl files.
 */
function enrichBriefingWithRecentActivity(
  briefing: Briefing,
  nexusDir: string
): Briefing {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

    const todayEvents = readPersistedEvents(nexusDir, today);
    const yesterdayEvents = readPersistedEvents(nexusDir, yesterday);
    const allEvents = [...yesterdayEvents, ...todayEvents];

    // Filter to relevant event types and last 24h
    const cutoff = now.getTime() - 86400000;
    const recent = allEvents
      .filter((e) => ACTIVITY_EVENT_TYPES.has(e.type))
      .filter((e) => {
        const ts = new Date(e.timestamp).getTime();
        return ts >= cutoff;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const syncCount = recent.filter((e) => e.type === "backlog.updated").length;
    const errorCount = recent.filter((e) => e.type === "plan.format_warning").length;

    return {
      ...briefing,
      recentActivity: recent.length > 0 ? {
        events: recent.map((e) => ({
          type: e.type,
          summary: summarizeEvent(e),
          timestamp: e.timestamp,
        })),
        syncCount,
        errorCount,
      } : undefined,
    };
  } catch (err) {
    logger.debug("enrichBriefing", "Recent activity unavailable:", err instanceof Error ? err.message : err);
    return briefing;
  }
}

// ── Quick Board Loading ─────────────────────────────────────────────────────

/**
 * Load Quick Board data from context_buffer.yaml.
 * Provides session state summary for agent reminder at session start.
 */
function loadQuickBoard(nexusDir: string): {
  currentTask: string;
  nextP0: string;
  p1Debts: string;
  impediments: string;
  lastSessionStatus: string;
  reminders: Reminder[];
} {
  const defaultQuickBoard = {
    currentTask: "Nenhuma",
    nextP0: "Definir novo P0 no BACKLOG.md",
    p1Debts: "Nenhuma",
    impediments: "Nenhum",
    lastSessionStatus: "Desconhecido",
    reminders: [] as Reminder[],
  };

  try {
    const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
    if (!existsSync(bufferPath)) {
      return defaultQuickBoard;
    }

    const content = readFileSync(bufferPath, "utf-8");
    const data = parseYaml(content);

    // Extract current task
    const currentTask = data?.current_task?.description
      ? `${data.current_task.description} (${data.current_task.status})`
      : "Nenhuma";

    // Extract last session status
    const lastSessionStatus = data?.session?.status === "completed"
      ? "Concluída"
      : data?.session?.status === "in_progress" || data?.session?.status === "active"
        ? "Em curso"
        : "Desconhecido";

    // Extract impediments
    const impediments = data?.impediments?.length > 0
      ? data.impediments.map((i: { description: string }) => i.description).join(", ")
      : "Nenhum";

    // Extract technical debt (P1/high debts) — support both 'priority' and 'severity' fields
    const p1Debts = data?.technical_debt?.length > 0
      ? data.technical_debt
          .filter((d: { priority?: string; severity?: string }) => d.priority === "P1" || d.severity === "high")
          .map((d: { description: string }) => d.description)
          .join(", ") || "Nenhuma"
      : "Nenhuma";

    // Auto-update next_p0 and current_task from BACKLOG.md if stale
    const backlogPath = join(nexusDir, "docs", "BACKLOG.md");
    let nextP0 = data?.next_p0 ?? "Verificar BACKLOG.md para próximo P0";
    let currentTaskVal = currentTask;

    if (existsSync(backlogPath)) {
      try {
        const backlog = readFileSync(backlogPath, "utf-8");
        const p0Section = backlog.split(/^## P0 /m)?.[1]?.split(/^## P1 /m)?.[0] ?? "";

        // Find first P0 item with "In Progress" status (skip Done items)
        const p0Items = p0Section.split(/^### /m).slice(1);
        for (const item of p0Items) {
          const title = item.split("\n")[0]?.trim();
          if (title && item.includes("| **Status** | In Progress")) {
            nextP0 = `${title} (In Progress)`;
            break;
          }
        }

        // If current_task is completed or missing, find first In Progress item across all sections
        if (data?.current_task?.status === "completed" || !data?.current_task?.description) {
          const allItems = backlog.split(/^### /m).slice(1);
          for (const item of allItems) {
            const title = item.split("\n")[0]?.trim();
            if (title && item.includes("| **Status** | In Progress")) {
              currentTaskVal = `${title} (In Progress)`;
              break;
            }
          }
        }
      } catch {
        // Ignore read errors — use context_buffer values
      }
    }

    // Extract reminders - support both old string[] and new Reminder[] formats
    let reminders: Reminder[] = [];
    if (Array.isArray(data?.reminders)) {
      reminders = data.reminders.map((r: string | Reminder) => {
        // Handle old format (string) - migrate to new format
        if (typeof r === "string") {
          return {
            message: r,
            priority: "medium" as ReminderPriority,
            category: "feature" as ReminderCategory,
            createdAt: new Date().toISOString(),
          };
        }
        // Handle new format (Reminder object)
        return {
          message: r.message || "",
          priority: (r.priority as ReminderPriority) || "medium",
          category: (r.category as ReminderCategory) || "feature",
          createdAt: r.createdAt || new Date().toISOString(),
        };
      });
    }

    return {
      currentTask: currentTaskVal,
      nextP0,
      p1Debts,
      impediments,
      lastSessionStatus,
      reminders,
    };
  } catch (err) {
    logger.debug("loadQuickBoard", "Failed to load context buffer:", err instanceof Error ? err.message : err);
    return defaultQuickBoard;
  }
}
