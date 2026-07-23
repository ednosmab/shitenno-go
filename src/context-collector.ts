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
import { generateBriefing, type Briefing, type BriefingOptions, type Reminder, type ReminderPriority, type ReminderCategory } from "./briefing.js";
import { loadMaturityProfile, type MaturityProfile } from "./maturity-profile.js";
import { listAdrs, listSkills } from "./knowledge-loader.js";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { analyseProject, type ProjectAnalysis } from "./analyser.js";
import { detectPatterns as _detectPatterns, type PatternDetectionReport, type DetectedPattern } from "./pattern-detector.js";
import { getFeedbackRecords, computeFeedbackSummary } from "./session-feedback.js";
import { logger } from "./logger.js";
import { computeInputHash } from "./briefing-cache.js";
import { computeKeyChecksums, getCached, setCache } from "./cache.js";
import { readPersistedEvents, getEventBus, type EventEnvelope } from "./event-bus.js";


// ── Types ──────────────────────────────────────────────────────────────────

/** Injectable dependencies for testability. */
export interface ContextDeps {
  loadFingerprint: (shitennoDir: string) => ProjectFingerprint | null;
  saveFingerprint: (shitennoDir: string, fp: ProjectFingerprint) => void;
  isFingerprintStale: (shitennoDir: string) => boolean;
  analyseProject: (projectRoot: string) => ProjectAnalysis;
  loadMaturityProfile: (shitennoDir: string) => MaturityProfile | null;
  generateProjectFingerprint: (root: string, analysis: ProjectAnalysis, score?: number) => ProjectFingerprint;
  generateRiskMap: (root: string, shitennoDir: string) => RiskMap;
  generateContextRules: (fp: ProjectFingerprint, risk: RiskMap) => ContextRule[];
  generateDynamicRules: (root: string, shitennoDir: string) => DynamicRule[];
  generateBriefing: (options: BriefingOptions) => Briefing;
  detectPatterns: (projectRoot: string, shitennoDir: string) => PatternDetectionReport;
  /** Optional: compute checksums for snapshot cache invalidation. */
  computeKeyChecksums?: (projectRoot: string, shitennoDir: string) => Record<string, string>;
  /** Optional: read cached snapshot. Return null to disable cache reads. */
  getCached?: <T>(input: { projectRoot: string; key: "complexity" | "patterns" | "health"; computeChecksumsFn: () => Record<string, string> }) => T | null;
  /** Optional: write snapshot to cache. No-op to disable cache writes. */
  setCache?: <T>(input: { projectRoot: string; shitennoDir: string; key: string; data: T; checksums: Record<string, string> }) => void;
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

function tryReadCache<T>(
  projectRoot: string,
  shitennoDir: string,
  computeChecksums: (root: string, dir: string) => Record<string, string>,
  cacheGet: <R>(input: { projectRoot: string; key: "complexity" | "patterns" | "health"; computeChecksumsFn: () => Record<string, string> }) => R | null,
): T | null {
  try {
    const cached = cacheGet<T>({ projectRoot, key: "complexity", computeChecksumsFn: () =>
      computeChecksums(projectRoot, shitennoDir)
    });
    if (cached && (cached as { inputHash?: string }).inputHash) {
      logger.debug("collectContext", "Snapshot cache hit — skipping recomputation");
      return cached;
    }
  } catch {
    logger.debug("collectContext", "Cache read failed — computing fresh snapshot");
  }
  return null;
}

function ensureFingerprint(
  projectRoot: string,
  shitennoDir: string,
  deps: ContextDeps,
): ProjectFingerprint {
  let fingerprint = deps.loadFingerprint(shitennoDir);
  if (!fingerprint || deps.isFingerprintStale(shitennoDir)) {
    const analysis = deps.analyseProject(projectRoot);
    const maturityProfile = deps.loadMaturityProfile(shitennoDir);
    fingerprint = deps.generateProjectFingerprint(projectRoot, analysis, maturityProfile?.overallScore);
    deps.saveFingerprint(shitennoDir, fingerprint);
  }
  return fingerprint;
}

function buildSnapshot(
  projectRoot: string,
  shitennoDir: string,
  fingerprint: ProjectFingerprint,
  deps: ContextDeps,
): ContextSnapshot {
  const riskMap = deps.generateRiskMap(projectRoot, shitennoDir);
  const contextRules = deps.generateContextRules(fingerprint, riskMap);
  const dynamicRules = deps.generateDynamicRules(projectRoot, shitennoDir);
  const maturityProfile = deps.loadMaturityProfile(shitennoDir);
  const quickBoard = loadQuickBoard(shitennoDir);

  const briefing = deps.generateBriefing({
    fingerprint,
    riskMap,
    contextRules,
    dynamicRules,
    maturityProfile: maturityProfile ?? undefined,
    projectRoot,
    quickBoard: {
      currentTask: quickBoard.currentTask,
      nextP0: quickBoard.nextP0,
      p1Debts: quickBoard.p1Debts,
      impediments: quickBoard.impediments,
      lastSessionStatus: quickBoard.lastSessionStatus,
    },
    reminders: quickBoard.reminders,
  });

  const enrichedBriefing = enrichBriefingWithPatterns({ briefing, projectRoot, shitennoDir, deps });
  const activityEnriched = enrichBriefingWithRecentActivity(enrichedBriefing, shitennoDir);
  const finalBriefing = enrichBriefingWithGovernanceKnowledge(activityEnriched, shitennoDir);

  const inputHash = computeInputHash({
    fingerprintHash: fingerprint.hash,
    riskMapHash: riskMap.generatedAt,
    contextRuleCount: contextRules.length,
    dynamicRuleCount: dynamicRules.length,
    maturityScore: maturityProfile?.overallScore ?? null,
  });

  return {
    collectedAt: new Date().toISOString(),
    inputHash,
    fingerprint,
    riskMap,
    contextRules,
    dynamicRules,
    maturityProfile,
    briefing: finalBriefing,
  };
}

/**
 * Collect all project context into a single snapshot.
 *
 * Uses an intermediate disk cache keyed by a lightweight pre-hash
 * (git HEAD + shitenno dir). On cache hit, all heavy computation
 * (fingerprint, risk map, rules, briefing) is skipped.
 */
export function collectContext(
  projectRoot: string,
  shitennoDir: string,
  deps: ContextDeps = defaultDeps
): ContextSnapshot {
  const computeChecksums = deps.computeKeyChecksums ?? computeKeyChecksums;
  const cacheGet = deps.getCached ?? getCached;
  const cacheSet = deps.setCache ?? setCache;

  const cached = tryReadCache<ContextSnapshot>(projectRoot, shitennoDir, computeChecksums, cacheGet);
  if (cached) return cached;

  const fingerprint = ensureFingerprint(projectRoot, shitennoDir, deps);
  const snapshot = buildSnapshot(projectRoot, shitennoDir, fingerprint, deps);

  try {
    const checksums = computeChecksums(projectRoot, shitennoDir);
    cacheSet({ projectRoot, shitennoDir, key: "complexity", data: snapshot, checksums });
  } catch (err) {
    logger.debug("collectContext", "Failed to cache snapshot:", err instanceof Error ? err.message : err);
  }

  return snapshot;
}

// ── Governance Knowledge Enrichment ────────────────────────────────────────

/**
 * Enrich a briefing with governance knowledge (ADRs + skills).
 * Only includes lightweight summaries (id/title/status for ADRs, name/description for skills).
 * Full content is available on-demand via MCP getADRs/getSkills tools.
 */
function enrichBriefingWithGovernanceKnowledge(
  briefing: Briefing,
  shitennoDir: string
): Briefing {
  try {
    const activeAdrs = listAdrs(shitennoDir).filter(
      (a) => a.status === "Accepted" || a.status === "Proposed"
    );
    const availableSkills = listSkills(shitennoDir);

    return {
      ...briefing,
      governanceKnowledge: {
        adrs: activeAdrs.map((a) => ({ id: a.id, title: a.title, status: a.status })),
        skills: availableSkills.map((s) => ({ name: s.name, description: s.description })),
      },
    };
  } catch (err) {
    logger.debug("enrichBriefing", "Governance knowledge unavailable:", err instanceof Error ? err.message : err);
    return briefing;
  }
}

// ── Pattern Enrichment (Gaps 4+5) ─────────────────────────────────────────

interface EnrichPatternsOptions {
  briefing: Briefing;
  projectRoot: string;
  shitennoDir: string;
  deps: ContextDeps;
  existingPatternReport?: PatternDetectionReport;
}

function collectRecurringErrors(shitennoDir: string): string[] {
  try {
    const records = getFeedbackRecords(shitennoDir);
    if (records.length > 0) {
      const summary = computeFeedbackSummary(records);
      return summary.failureHotspots;
    }
  } catch (err) {
    logger.debug("enrichBriefing", "Feedback data unavailable:", err instanceof Error ? err.message : err);
  }
  return [];
}

function collectDetectedPatterns(
  projectRoot: string,
  shitennoDir: string,
  deps: ContextDeps,
  existingPatternReport?: PatternDetectionReport,
): Briefing["patterns"]["detected"] {
  try {
    const patternReport = existingPatternReport ?? deps.detectPatterns(projectRoot, shitennoDir);
    return patternReport.patterns.map((p: DetectedPattern) => ({
      type: p.type,
      description: p.description,
      occurrences: p.occurrences,
      affectedArea: p.affectedArea,
      severity: p.severity,
    }));
  } catch (err) {
    logger.debug("enrichBriefing", "Pattern detection unavailable:", err instanceof Error ? err.message : err);
  }
  return [];
}

function enrichBriefingWithPatterns(opts: EnrichPatternsOptions): Briefing {
  const { briefing, projectRoot, shitennoDir, deps, existingPatternReport } = opts;
  const recurringErrors = collectRecurringErrors(shitennoDir);
  const detected = collectDetectedPatterns(projectRoot, shitennoDir, deps, existingPatternReport);

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
  shitennoDir: string
): Briefing {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

    const todayEvents = readPersistedEvents(shitennoDir, today);
    const yesterdayEvents = readPersistedEvents(shitennoDir, yesterday);
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

interface QuickBoardResult {
  currentTask: string;
  nextP0: string;
  p1Debts: string;
  impediments: string;
  lastSessionStatus: string;
  reminders: Reminder[];
}

function parseSessionStatus(status: string | undefined): string {
  if (status === "completed") return "Concluída";
  if (status === "in_progress" || status === "active") return "Em curso";
  return "Desconhecido";
}

function extractImpediments(data: Record<string, unknown>): string {
  const impediments = data?.impediments as Array<{ description: string }> | undefined;
  if (!impediments || impediments.length === 0) return "Nenhum";
  return impediments.map((i) => i.description).join(", ");
}

function extractP1Debts(data: Record<string, unknown>): string {
  const debts = data?.technical_debt as Array<{ priority?: string; severity?: string; description: string }> | undefined;
  if (!debts || debts.length === 0) return "Nenhuma";
  const p1Debts = debts.filter((d) => d.priority === "P1" || d.severity === "high");
  return p1Debts.length > 0 ? p1Debts.map((d) => d.description).join(", ") : "Nenhuma";
}

function findInProgressItems(backlog: string): string[] {
  const items: string[] = [];
  const sections = backlog.split(/^### /m).slice(1);
  for (const item of sections) {
    const title = item.split("\n")[0]?.trim();
    if (title && item.includes("| **Status** | In Progress")) {
      items.push(`${title} (In Progress)`);
    }
  }
  return items;
}

function normalizeReminders(data: Record<string, unknown>): Reminder[] {
  if (!Array.isArray(data?.reminders)) return [];
  return data.reminders.map((r: string | Reminder) => {
    if (typeof r === "string") {
      return {
        message: r,
        priority: "medium" as ReminderPriority,
        category: "feature" as ReminderCategory,
        createdAt: new Date().toISOString(),
      };
    }
    return {
      message: r.message || "",
      priority: (r.priority as ReminderPriority) || "medium",
      category: (r.category as ReminderCategory) || "feature",
      createdAt: r.createdAt || new Date().toISOString(),
    };
  });
}

function publishP4LoadedEvent(): void {
  try {
    const bus = getEventBus();
    bus.publish("context.p4_loaded", {
      docPath: "governance/context/context_buffer.yaml",
      taskType: "loadQuickBoard",
      tierDeclared: "P4",
    });
  } catch {
    logger.debug("context-collector", "Failed to publish quick-board event — best-effort");
  }
}

function readContextBuffer(shitennoDir: string): Record<string, unknown> | null {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return null;
  const content = readFileSync(bufferPath, "utf-8");
  return parseYaml(content) as Record<string, unknown>;
}

function resolveWithContext(
  shitennoDir: string,
  fallbackNextP0: string,
  currentTaskData: { description?: string; status?: string } | undefined,
  baseCurrentTask: string,
): { nextP0: string; currentTask: string } {
  let nextP0 = fallbackNextP0;
  let currentTaskVal = baseCurrentTask;
  const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
  if (!existsSync(backlogPath)) return { nextP0, currentTask: currentTaskVal };

  try {
    const backlog = readFileSync(backlogPath, "utf-8");
    const p0Section = backlog.split(/^## P0 /m)?.[1]?.split(/^## P1 /m)?.[0] ?? "";
    const p0Items = findInProgressItems(p0Section);
    if (p0Items.length > 0) nextP0 = p0Items[0]!;
    if (currentTaskData?.status === "completed" || !currentTaskData?.description) {
      const allItems = findInProgressItems(backlog);
      if (allItems.length > 0) currentTaskVal = allItems[0]!;
    }
  } catch {
    logger.debug("context-collector", "Failed to read supplemental context — using buffer values");
  }
  return { nextP0, currentTask: currentTaskVal };
}

function loadQuickBoard(shitennoDir: string): QuickBoardResult {
  const defaultQuickBoard: QuickBoardResult = {
    currentTask: "Nenhuma",
    nextP0: "Definir novo P0 no BACKLOG.md",
    p1Debts: "Nenhuma",
    impediments: "Nenhum",
    lastSessionStatus: "Desconhecido",
    reminders: [],
  };

  try {
    const data = readContextBuffer(shitennoDir);
    if (!data) return defaultQuickBoard;
    publishP4LoadedEvent();

    const session = data?.session as { status?: string } | undefined;
    const currentTaskData = data?.current_task as { description?: string; status?: string } | undefined;
    const currentTask = currentTaskData?.description
      ? `${currentTaskData.description} (${currentTaskData.status})`
      : "Nenhuma";
    const fallbackNextP0 = (data?.next_p0 as string) ?? "Verificar BACKLOG.md para próximo P0";
    const resolved = resolveWithContext(shitennoDir, fallbackNextP0, currentTaskData, currentTask);

    return {
      currentTask: resolved.currentTask,
      nextP0: resolved.nextP0,
      p1Debts: extractP1Debts(data),
      impediments: extractImpediments(data),
      lastSessionStatus: parseSessionStatus(session?.status),
      reminders: normalizeReminders(data),
    };
  } catch (err) {
    logger.debug("loadQuickBoard", "Failed to load context buffer:", err instanceof Error ? err.message : err);
    return defaultQuickBoard;
  }
}
