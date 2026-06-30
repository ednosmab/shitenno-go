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
import { createHash } from "node:crypto";
import { analyseProject, type ProjectAnalysis } from "./analyser.js";
import { detectPatterns, type DetectedPattern } from "./pattern-detector.js";
import { getFeedbackRecords, computeFeedbackSummary } from "./session-feedback.js";

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
  generateBriefing: (fp: ProjectFingerprint, risk: RiskMap, ctx: ContextRule[], dyn: DynamicRule[], mat?: MaturityProfile) => Briefing;
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
};

// ── Hash Computation ───────────────────────────────────────────────────────

function computeInputHash(data: {
  fingerprintHash: string;
  riskMapHash: string;
  contextRuleCount: number;
  dynamicRuleCount: number;
  maturityScore: number | null;
}): string {
  const payload = JSON.stringify(data);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ── Main Collector ─────────────────────────────────────────────────────────

/**
 * Collect all project context into a single snapshot.
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

  // 6. Generate Briefing
  const briefing = deps.generateBriefing(fingerprint, riskMap, contextRules, dynamicRules, maturityProfile ?? undefined);

  // 7. Enrich briefing with detected patterns (Gap 4+5: feedback hotspots + pattern-detector)
  const enrichedBriefing = enrichBriefingWithPatterns(briefing, projectRoot, nexusDir);

  // 8. Compute input hash for cache invalidation
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
    briefing: enrichedBriefing,
  };
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
  existingPatternReport?: ReturnType<typeof detectPatterns>
): Briefing {
  // Gap 4: Populate recurringErrors from feedback failure hotspots
  let recurringErrors: string[] = [];
  try {
    const records = getFeedbackRecords(nexusDir);
    if (records.length > 0) {
      const summary = computeFeedbackSummary(records);
      recurringErrors = summary.failureHotspots;
    }
  } catch {
    // Feedback data unavailable — not fatal
  }

  // Gap 5: Populate detected patterns from pattern-detector
  let detected: Briefing["patterns"]["detected"] = [];
  try {
    const patternReport = existingPatternReport ?? detectPatterns(projectRoot, nexusDir);
    detected = patternReport.patterns.map((p: DetectedPattern) => ({
      type: p.type,
      description: p.description,
      occurrences: p.occurrences,
      affectedArea: p.affectedArea,
      severity: p.severity,
    }));
  } catch {
    // Pattern detection unavailable — not fatal
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
