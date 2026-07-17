/**
 * context-tier-detectors.ts — Context Tier Promotion Detector
 *
 * Detects documents that are frequently loaded on-demand from P4 tier,
 * suggesting they should be promoted to a higher tier (e.g., P2).
 *
 * Follows the exact pattern of existing HealthIssue detectors in audit/.
 * Uses persisted events from context.p4_loaded to count on-demand loads.
 */

import { logger } from "../logger.js";
import { readPersistedEvents, type EventEnvelope } from "../event-bus.js";
import type { HealthIssue } from "./types.js";

// ── Constants ──────────────────────────────────────────────────────────────

/** Number of on-demand loads before suggesting promotion. */
const PROMOTION_THRESHOLD = 3;

/** Event type to monitor for on-demand P4 loads. */
const P4_LOADED_EVENT = "context.p4_loaded";

/** Event type for tier mismatches. */
const TIER_MISMATCH_EVENT = "context.tier_mismatch";

// ── Shared Helper ──────────────────────────────────────────────────────────

/**
 * Read persisted events from the last N days.
 * Shared helper to avoid redundant loops.
 */
function getRecentEvents(shitenDir: string, days: number): EventEnvelope[] {
  const events: EventEnvelope[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 86400000);
    const dateStr = date.toISOString().slice(0, 10);
    const dayEvents = readPersistedEvents(shitenDir, dateStr);
    events.push(...dayEvents);
  }

  return events;
}

// ── Detectors ──────────────────────────────────────────────────────────────

/**
 * Detect documents that are frequently loaded on-demand from P4 tier.
 *
 * Reads persisted events from the event bus and counts how many times
 * each document was loaded on-demand. If a document exceeds the
 * promotion threshold, it is flagged as a candidate for tier promotion.
 *
 * @param shitenDir - Path to shitenno-go/ directory
 * @returns Array of HealthIssue with tier promotion candidates
 */
export function detectMisclassifiedTier(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const events = getRecentEvents(shitenDir, 7);
    const p4Events = events.filter((e) => e.type === P4_LOADED_EVENT);

    if (p4Events.length === 0) {
      return issues;
    }

    // Count loads by document path
    const countsByDoc = new Map<string, number>();
    for (const event of p4Events) {
      const payload = event.payload as { docPath?: string; taskType?: string; tierDeclared?: string };
      const docPath = payload.docPath;

      if (docPath) {
        countsByDoc.set(docPath, (countsByDoc.get(docPath) ?? 0) + 1);
      }
    }

    // Check each document against threshold
    for (const [doc, count] of countsByDoc) {
      if (count >= PROMOTION_THRESHOLD) {
        issues.push({
          type: "tier_promotion_candidate",
          severity: 2,
          description: `"${doc}" foi carregado sob demanda ${count}x — candidato a promoção de P4 para P2.`,
          location: `governance/context/${doc}`,
          recommendation: `Revisar classificação em CONTEXT_HIERARCHY.md e mover "${doc}" para o tier P2.`,
          confidence: 0.8,
        });
      }
    }
  } catch (err) {
    logger.debug("context-tier-detectors", "Failed to detect tier promotions:", err instanceof Error ? err.message : err);
  }

  return issues;
}

/**
 * Detect tier mismatches between declared tier and actual usage.
 *
 * Compares the tier declared in context metadata with the tier
 * used in actual on-demand loads.
 *
 * @param shitenDir - Path to shitenno-go/ directory
 * @returns Array of HealthIssue with tier mismatches
 */
export function detectTierMismatches(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const events = getRecentEvents(shitenDir, 7);
    const mismatchEvents = events.filter((e) => e.type === TIER_MISMATCH_EVENT);

    for (const event of mismatchEvents) {
      const payload = event.payload as {
        docPath?: string;
        declaredTier?: string;
        actualTier?: string;
        reason?: string;
      };

      if (payload.docPath && payload.declaredTier && payload.actualTier) {
        issues.push({
          type: "tier_promotion_candidate",
          severity: 2,
          description: `Tier mismatch para "${payload.docPath}": declarado como ${payload.declaredTier}, mas comportamento indica ${payload.actualTier}.`,
          location: `governance/context/${payload.docPath}`,
          recommendation: `Actualizar tier declarado de ${payload.declaredTier} para ${payload.actualTier}.`,
          confidence: 0.8,
        });
      }
    }
  } catch (err) {
    logger.debug("context-tier-detectors", "Failed to detect tier mismatches:", err instanceof Error ? err.message : err);
  }

  return issues;
}
