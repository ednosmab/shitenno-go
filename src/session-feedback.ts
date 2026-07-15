/**
 * session-feedback.ts — Context Pipeline: Session Outcome Feedback
 *
 * Records the outcome of a session (success/failure) and associates it
 * with the briefing that was used. Enables learning from results.
 *
 * Storage: .nexus/session-feedback.jsonl (append-only).
 *
 * PRINCIPLE: Close the feedback loop — outcomes inform future briefings.
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export type SessionOutcome = "success" | "failure" | "partial" | "session-start" | "session-end";

export interface SessionFeedbackRecord {
  /** Unique record ID. */
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  /** The outcome of the session. */
  outcome: SessionOutcome;
  /** Briefing hash that was used for this session. */
  briefingHash: string;
  /** Briefing timestamp (when the briefing was generated). */
  briefingTimestamp: string;
  /** Link to session-tracker session ID (bridges the two systems). */
  sessionId?: string;
  /** Session duration in minutes (if known). */
  durationMinutes?: number;
  /** Areas that were modified during the session. */
  modifiedAreas?: string[];
  /** Optional notes about the session. */
  notes?: string;
  /** Whether the session followed the briefing recommendations. */
  followedRecommendations?: boolean;
  /** User-provided rating (1-5). */
  userRating?: 1 | 2 | 3 | 4 | 5;
  /** User-provided comment about the session. */
  userComment?: string;
  /** User-provided tags for categorization. */
  userTags?: string[];
  /** Briefing depth profile used for this session (minimal/standard/full). */
  briefingProfile?: string;
  /** Token economy metrics for this session */
  tokenEconomy?: {
    /** Tokens saved by using briefing vs manual discovery */
    tokensSaved: number;
    /** Whether briefing was served from cache */
    cacheHit: boolean;
    /** Briefing depth used (minimal/standard/full) */
    briefingDepth: string;
  };
}

export interface SessionFeedbackSummary {
  /** Total sessions recorded. */
  totalSessions: number;
  /** Breakdown by outcome. */
  byOutcome: Record<SessionOutcome, number>;
  /** Success rate (0-1). */
  successRate: number;
  /** Average duration of successful sessions. */
  avgSuccessDuration: number | null;
  /** Areas with most failures. */
  failureHotspots: string[];
  /** Average user rating across sessions that have ratings. */
  avgUserRating: number | null;
  /** Total sessions with user ratings. */
  ratedSessions: number;
  /** Token economy aggregated metrics */
  tokenEconomy: {
    /** Total tokens saved across all sessions */
    totalTokensSaved: number;
    /** Average tokens saved per session */
    avgTokensSaved: number;
    /** Number of cache hits */
    cacheHits: number;
    /** Cache hit rate (0-1) */
    cacheHitRate: number;
    /** Estimated monthly savings (10 sessions) */
    monthlyProjection: number;
  };
}

// ── Storage ────────────────────────────────────────────────────────────────

function getFeedbackDir(nexusDir: string): string {
  return join(nexusDir, "session-feedback");
}

function getRecordsPath(nexusDir: string): string {
  return join(getFeedbackDir(nexusDir), "records.jsonl");
}

function ensureDir(nexusDir: string): void {
  const dir = getFeedbackDir(nexusDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ── Core Functions ─────────────────────────────────────────────────────────

/**
 * Record a session outcome (append-only).
 */
export function recordOutcome(
  storage: { append(record: SessionFeedbackRecord): void },
  record: Omit<SessionFeedbackRecord, "id" | "timestamp">
): SessionFeedbackRecord {
  const fullRecord: SessionFeedbackRecord = {
    ...record,
    id: `SF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  storage.append(fullRecord);
  return fullRecord;
}

/**
 * Get a file-system based storage for session feedback.
 */
export function createFileStorage(nexusDir: string) {
  ensureDir(nexusDir);
  const recordsPath = getRecordsPath(nexusDir);

  return {
    read(): SessionFeedbackRecord[] {
      if (!existsSync(recordsPath)) return [];
      try {
        const content = readFileSync(recordsPath, "utf-8").trim();
        if (!content) return [];
        return content.split("\n")
          .map((line) => {
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              if (
                typeof parsed === "object" && parsed !== null &&
                typeof parsed.id === "string" &&
                typeof parsed.timestamp === "string" &&
                typeof parsed.outcome === "string"
              ) {
                return parsed as unknown as SessionFeedbackRecord;
              }
              return null;
            } catch {
              return null;
            }
          })
          .filter((r): r is SessionFeedbackRecord => r !== null);
      } catch {
        return [];
      }
    },
    append(record: SessionFeedbackRecord): void {
      ensureDir(nexusDir);
      appendFileSync(recordsPath, JSON.stringify(record) + "\n", "utf-8");
    },
  };
}

/**
 * Get all session feedback records.
 */
export function getFeedbackRecords(nexusDir: string): SessionFeedbackRecord[] {
  return createFileStorage(nexusDir).read();
}

/**
 * Get feedback records for a specific session-tracker session.
 * Bridges session-feedback with session-tracker.
 */
export function getFeedbackForSession(
  nexusDir: string,
  sessionId: string
): SessionFeedbackRecord[] {
  return getFeedbackRecords(nexusDir).filter((r) => r.sessionId === sessionId);
}

/**
 * Get the latest feedback record (for pattern analysis).
 */
export function getLatestFeedback(nexusDir: string): SessionFeedbackRecord | null {
  const records = getFeedbackRecords(nexusDir);
  return records.at(-1) ?? null;
}

/**
 * Compute a summary of all feedback records.
 */
export function computeFeedbackSummary(
  records: SessionFeedbackRecord[]
): SessionFeedbackSummary {
  const byOutcome: Record<SessionOutcome, number> = {
    success: 0,
    failure: 0,
    partial: 0,
    "session-start": 0,
    "session-end": 0,
  };

  let totalDuration = 0;
  let successDurationCount = 0;
  const failureAreas: Record<string, number> = {};
  let totalUserRating = 0;
  let ratedSessions = 0;

  // Token economy aggregation
  let totalTokensSaved = 0;
  let cacheHits = 0;
  let tokenSessions = 0;

  for (const record of records) {
    byOutcome[record.outcome]++;

    if (record.outcome === "success" && record.durationMinutes) {
      totalDuration += record.durationMinutes;
      successDurationCount++;
    }

    if (record.outcome === "failure" && record.modifiedAreas) {
      for (const area of record.modifiedAreas) {
        failureAreas[area] = (failureAreas[area] || 0) + 1;
      }
    }

    if (record.tokenEconomy) {
      totalTokensSaved += record.tokenEconomy.tokensSaved;
      if (record.tokenEconomy.cacheHit) cacheHits++;
      tokenSessions++;
    }

    if (record.userRating) {
      totalUserRating += record.userRating;
      ratedSessions++;
    }
  }

  const totalSessions = records.length;
  const successRate = totalSessions > 0 ? byOutcome.success / totalSessions : 0;
  const avgSuccessDuration = successDurationCount > 0
    ? Math.round(totalDuration / successDurationCount)
    : null;

  const failureHotspots = Object.entries(failureAreas)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([area]) => area);

  const avgUserRating = ratedSessions > 0
    ? Math.round((totalUserRating / ratedSessions) * 10) / 10
    : null;

  const avgTokensSaved = tokenSessions > 0 ? Math.round(totalTokensSaved / tokenSessions) : 0;
  const cacheHitRate = tokenSessions > 0 ? cacheHits / tokenSessions : 0;
  const monthlyProjection = avgTokensSaved * 10; // 10 sessions/month

  return {
    totalSessions,
    byOutcome,
    successRate,
    avgSuccessDuration,
    failureHotspots,
    avgUserRating,
    ratedSessions,
    tokenEconomy: {
      totalTokensSaved,
      avgTokensSaved,
      cacheHits,
      cacheHitRate,
      monthlyProjection,
    },
  };
}
