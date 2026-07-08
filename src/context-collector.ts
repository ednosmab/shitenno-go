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
import { generateBriefing, type Briefing } from "./briefing.js";
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
  generateBriefing: (fp: ProjectFingerprint, risk: RiskMap, ctx: ContextRule[], dyn: DynamicRule[], mat?: MaturityProfile, quickBoard?: { currentTask: string; nextP0: string; p1Debts: string; impediments: string; lastSessionStatus: string }) => Briefing;
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
  const briefing = deps.generateBriefing(fingerprint, riskMap, contextRules, dynamicRules, maturityProfile ?? undefined, quickBoard);

  // 7. Enrich briefing with detected patterns (Gap 4+5: feedback hotspots + pattern-detector)
  const enrichedBriefing = enrichBriefingWithPatterns(briefing, projectRoot, nexusDir, deps);

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
    briefing: enrichedBriefing,
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
} {
  const defaultQuickBoard = {
    currentTask: "Nenhuma",
    nextP0: "Definir novo P0 no BACKLOG.md",
    p1Debts: "Nenhuma",
    impediments: "Nenhum",
    lastSessionStatus: "Desconhecido",
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
      : data?.session?.status === "in_progress"
        ? "Em curso"
        : "Desconhecido";

    // Extract impediments
    const impediments = data?.impediments?.length > 0
      ? data.impediments.map((i: { description: string }) => i.description).join(", ")
      : "Nenhum";

    // Extract technical debt (P1 debts)
    const p1Debts = data?.technical_debt?.length > 0
      ? data.technical_debt
          .filter((d: { priority: string }) => d.priority === "P1")
          .map((d: { description: string }) => d.description)
          .join(", ") || "Nenhuma"
      : "Nenhuma";

    return {
      currentTask,
      nextP0: data?.next_p0 ?? "Verificar BACKLOG.md para próximo P0",
      p1Debts,
      impediments,
      lastSessionStatus,
    };
  } catch (err) {
    logger.debug("loadQuickBoard", "Failed to load context buffer:", err instanceof Error ? err.message : err);
    return defaultQuickBoard;
  }
}
