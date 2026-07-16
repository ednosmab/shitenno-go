/**
 * advanced-infrastructure.ts — Event Replay, Dead-Letter Queue, Event Versioning
 *
 * Provides advanced event infrastructure:
 * - Event replay: Re-process events from history
 * - Dead-letter queue: Capture events that failed processing
 * - Event versioning: Handle schema evolution gracefully
 *
 * PRINCIPLE: Events are the system's memory. Never lose them.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus, type ShitenEventType, type EventBus } from "./event-bus.js";
import { logger } from "./logger.js";
import { BoundedQueue, LRUCache } from "./daemon-resources.js";

// ── Memory Limits ────────────────────────────────────────────────────────────
const MAX_DLQ_SIZE = 500;
const MAX_REPLAYER_PROCESSED = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

/** Event version for schema evolution. */
export type EventVersion = number;

/** A versioned event with metadata. */
export interface VersionedEvent<T = unknown> {
  /** Unique event ID. */
  id: string;
  /** Event type. */
  type: ShitenEventType;
  /** Event payload. */
  payload: T;
  /** Schema version (for migration). */
  version: EventVersion;
  /** ISO timestamp. */
  timestamp: string;
  /** Correlation ID. */
  correlationId?: string;
  /** Trace ID. */
  traceId?: string;
}

/** Dead-letter event (failed processing). */
export interface DeadLetterEvent {
  /** Original event. */
  event: VersionedEvent;
  /** Error that caused failure. */
  error: string;
  /** Number of retry attempts. */
  retries: number;
  /** ISO timestamp of failure. */
  failedAt: string;
  /** Handler that failed. */
  handlerName: string;
}

/** Replay result. */
export interface ReplayResult {
  /** Total events replayed. */
  total: number;
  /** Successfully processed. */
  success: number;
  /** Failed (sent to dead-letter). */
  failed: number;
  /** Skipped (already processed). */
  skipped: number;
  /** Duration in milliseconds. */
  duration: number;
}

// ── Event Version Registry ─────────────────────────────────────────────────

const EVENT_VERSIONS: Record<ShitenEventType, EventVersion> = {
  "session.start": 1,
  "session.end": 1,
  "analysis.complete": 1,
  "command.completed": 1,
  "score.calculated": 1,
  "pattern.detected": 1,
  "health.checked": 1,
  "debt.detected": 1,
  "capability.installed": 1,
  "capability.unlocked": 1,
  "maturity.changed": 1,
  "rule.triggered": 1,
  "evolution.recommended": 1,
  "adr.created": 1,
  "skill.created": 1,
  "validation.completed": 1,
  "task.completed": 1,
  "pipeline.stage.start": 1,
  "pipeline.stage.complete": 1,
  "pipeline.started": 1,
  "pipeline.complete": 1,
  "plan.archived": 1,
  "plan.created": 1,
  "plan.file_changed": 1,
  "plan.status_changed": 1,
  "plan.format_warning": 1,
  "plan.inconsistency_detected": 1,
  "backlog.updated": 1,
  "lifecycle.state_changed": 1,
  "knowledge.analyzed": 1,
  "engineering_state.updated": 1,
  "engineering_state.consolidated": 1,
  "knowledge_debt.detected": 1,
  "recommendation.accepted": 1,
  "recommendation.rejected": 1,
  "governance.policy_applied": 1,
  "asset.created": 1,
  "asset.updated": 1,
  "asset.archived": 1,
  "entropy.calculated": 1,
  "docs.sync.triggered": 1,
  "doc.lifecycle.audited": 1,
  "system.updated": 1,
  "challenge.generated": 1,
  "state.mutated": 1,
  "workdir.large_uncommitted_drift": 1,
  "context.p4_loaded": 1,
  "context.tier_mismatch": 1,
  "watcher.error": 1,
};

/** Migrate a payload from one version to another. */
function migratePayload(

  payload: unknown,
  _fromVersion: EventVersion,
  _toVersion: EventVersion
): unknown {
  // Future: add migration logic here
  // For now, return payload as-is (version 1 → 1)
  return payload;
}

// ── Dead-Letter Queue ──────────────────────────────────────────────────────

export class DeadLetterQueue {
  private queue: BoundedQueue<DeadLetterEvent>;
  private dir: string;

  constructor(shitenDir: string) {
    this.queue = new BoundedQueue<DeadLetterEvent>(MAX_DLQ_SIZE);
    this.dir = join(shitenDir, "telemetry", "dead-letter");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    this.load();
  }

  /** Add an event to the dead-letter queue. */
  enqueue(
    event: VersionedEvent,
    error: string,
    handlerName: string,
    retries = 0
  ): DeadLetterEvent {
    const deadLetter: DeadLetterEvent = {
      event,
      error,
      retries,
      failedAt: new Date().toISOString(),
      handlerName,
    };

    this.queue.push(deadLetter); // BoundedQueue: auto-evicts oldest if over 500
    this.persist(deadLetter);

    return deadLetter;
  }

  /** Get all dead-letter events. */
  getAll(): DeadLetterEvent[] {
    return this.queue.toArray();
  }

  /** Get dead-letter events for a specific event type. */
  getByType(type: ShitenEventType): DeadLetterEvent[] {
    return this.queue.filter((dl) => dl.event.type === type);
  }

  /** Retry a dead-letter event (re-publish to bus). */
  retry(deadLetterId: string, bus?: EventBus): boolean {
    const index = this.queue.toArray().findIndex((dl) => dl.event.id === deadLetterId);
    if (index === -1) return false;

    const all = this.queue.toArray();
    const dl = all[index]!;
    const eventBus = bus ?? getEventBus();

    try {
      eventBus.publish(dl.event.type as ShitenEventType, dl.event.payload as Record<string, unknown>, {
        correlationId: dl.event.correlationId,
        traceId: dl.event.traceId,
      });

      // Rebuild queue without the retried event
      this.queue.clear();
      all.filter((_, i) => i !== index).forEach((item) => this.queue.push(item));
      this.saveAll();
      return true;
    } catch {
      return false;
    }
  }

  /** Clear all dead-letter events. */
  clear(): void {
    this.queue.clear();
    this.saveAll();
  }

  /** Get queue size. */
  size(): number {
    return this.queue.size();
  }

  private persist(dl: DeadLetterEvent): void {
    try {
      const date = dl.failedAt.slice(0, 10);
      const filePath = join(this.dir, `dead-letter-${date}.jsonl`);
      appendFileSync(filePath, JSON.stringify(dl) + "\n", "utf-8");
    } catch (error) {
      logger.debug("advanced-infrastructure", "Suppressed error", { error });
    }
  }

  private load(): void {
    if (!existsSync(this.dir)) return;

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".jsonl"));
    const allItems: DeadLetterEvent[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(this.dir, file), "utf-8").trim();
        if (!content) continue;
        const lines = content.split("\n");
        for (const line of lines) {
          allItems.push(JSON.parse(line) as DeadLetterEvent);
        }
      } catch (error) {
        logger.debug("advanced-infrastructure", "Suppressed error", { error });
      }
    }
    // Load with cap: keep most recent MAX_DLQ_SIZE items
    this.queue.load(allItems);
  }

  private saveAll(): void {
    try {
      const filePath = join(this.dir, "dead-letter-current.json");
      writeFileSync(filePath, JSON.stringify(this.queue.toArray(), null, 2), "utf-8");
    } catch (error) {
      logger.debug("advanced-infrastructure", "Suppressed error", { error });
    }
  }
}

// ── Event Replayer ─────────────────────────────────────────────────────────

export class EventReplayer {
  /** LRU cache prevents Set from growing unboundedly during long daemon sessions. */
  private processed = new LRUCache<string, true>(MAX_REPLAYER_PROCESSED);

  constructor(
    private bus: EventBus,
    private deadLetterQueue: DeadLetterQueue
  ) {}

  /** Replay events from history. */
  replay(
    events: VersionedEvent[],
    handler: (event: VersionedEvent) => void | Promise<void>,
    options?: { skipDuplicates?: boolean }
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const skipDuplicates = options?.skipDuplicates ?? true;

    const promises = events.map(async (event) => {
      // Skip duplicates
      if (skipDuplicates && this.processed.has(event.id)) {
        skipped++;
        return;
      }

      try {
        await handler(event);
        this.processed.set(event.id, true); // LRUCache: auto-evicts oldest if over 10k
        success++;
      } catch (error) {
        failed++;
        this.deadLetterQueue.enqueue(
          event,
          error instanceof Error ? error.message : String(error),
          "replay-handler"
        );
      }
    });

    return Promise.all(promises).then(() => ({
      total: events.length,
      success,
      failed,
      skipped,
      duration: Date.now() - startTime,
    }));
  }

  /** Replay all events from event bus history. */
  replayFromBus(
    handler: (event: VersionedEvent) => void | Promise<void>
  ): Promise<ReplayResult> {
    const history = this.bus.getHistory();
    const events: VersionedEvent[] = history.map((entry) => ({
      id: randomUUID(),
      type: entry.type as ShitenEventType,
      payload: entry.payload,
      version: EVENT_VERSIONS[entry.type as ShitenEventType] ?? 1,
      timestamp: entry.timestamp,
    }));

    return this.replay(events, handler);
  }

  /** Get processed event IDs (snapshot). */
  getProcessed(): Set<string> {
    return new Set(this.processed.keys());
  }

  /** Clear processed set. */
  clearProcessed(): void {
    this.processed.clear();
  }
}

// ── Versioned Event Factory ────────────────────────────────────────────────

/** Create a versioned event with automatic version. */
export function createVersionedEvent<T>(
  type: ShitenEventType,
  payload: T,
  options?: { correlationId?: string; traceId?: string; version?: EventVersion }
): VersionedEvent<T> {
  return {
    id: randomUUID(),
    type,
    payload,
    version: options?.version ?? EVENT_VERSIONS[type] ?? 1,
    timestamp: new Date().toISOString(),
    correlationId: options?.correlationId,
    traceId: options?.traceId,
  };
}

/** Migrate a versioned event to the latest version. */
export function migrateEvent<T>(event: VersionedEvent<T>): VersionedEvent<T> {
  const latestVersion = EVENT_VERSIONS[event.type] ?? 1;
  if (event.version === latestVersion) return event;

  return {
    ...event,
    payload: migratePayload(event.payload, event.version, latestVersion) as T,
    version: latestVersion,
  };
}

/** Get current version for an event type. */
export function getEventVersion(type: ShitenEventType): EventVersion {
  return EVENT_VERSIONS[type] ?? 1;
}
