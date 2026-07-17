/**
 * event-bus.ts — Pub/Sub System for Module Communication
 *
 * Enables decoupled communication between Shiten modules.
 * Modules publish events; other modules subscribe and react.
 * Optional persistence to disk for performance reporting.
 *
 * PRINCIPLE: Modules communicate through events, not direct imports.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";
import type { CorrelationId, TraceId } from "./event-payloads.js";
import { DeadLetterQueue, createVersionedEvent } from "./advanced-infrastructure.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type ShitenEventType =
  | "session.start"
  | "session.end"
  | "analysis.complete"
  | "command.completed"
  | "score.calculated"
  | "pattern.detected"
  | "health.checked"
  | "debt.detected"
  | "capability.installed"
  | "capability.unlocked"
  | "maturity.changed"
  | "rule.triggered"
  | "evolution.recommended"
  | "adr.created"
  | "skill.created"
  | "validation.completed"
  | "task.completed"
  | "pipeline.stage.start"
  | "pipeline.stage.complete"
  | "pipeline.started"
  | "pipeline.complete"
  | "lifecycle.state_changed"
  | "knowledge.analyzed"
  | "engineering_state.updated"
  | "engineering_state.consolidated"
  | "knowledge_debt.detected"
  | "recommendation.accepted"
  | "recommendation.rejected"
  | "governance.policy_applied"
  | "asset.created"
  | "asset.updated"
  | "asset.archived"
  | "entropy.calculated"
  | "docs.sync.triggered"
  | "doc.lifecycle.audited"
  | "plan.archived"
  | "plan.created"
  | "plan.file_changed"
  | "plan.status_changed"
  | "plan.format_warning"
  | "plan.inconsistency_detected"
  | "backlog.updated"
  | "system.updated"
  | "challenge.generated"
  | "state.mutated"
  | "workdir.large_uncommitted_drift"
  | "context.p4_loaded"
  | "context.tier_mismatch"
  | "watcher.error"
  | "daemon.ready";

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/** Envelope wrapping a typed payload with metadata. */
export interface EventEnvelope<T = unknown> {
  type: ShitenEventType;
  payload: T;
  timestamp: string;
  traceId: TraceId;
  correlationId?: CorrelationId;
}

export interface EventBus {
  /**
   * Publish an event. Payload accepts any shape for backward compatibility.
   * New code should use createEventPayload() from event-payloads.ts for type safety.
   */
  publish<T extends ShitenEventType>(
    eventType: T,
    payload: Record<string, unknown>,
    options?: { correlationId?: CorrelationId; traceId?: TraceId }
  ): void;
  /** Subscribe to an event. Handler receives the raw payload. */
  subscribe(
    eventType: ShitenEventType,
    handler: EventHandler<Record<string, unknown>>
  ): () => void;
  subscribeOnce(eventType: ShitenEventType, handler: EventHandler<Record<string, unknown>>): () => void;
  removeAllListeners(eventType?: ShitenEventType): void;
  listenerCount(eventType: ShitenEventType): number;
  getHistory(): EventEnvelope[];
  enablePersistence(shitenDir: string): void;
  enableDeadLetterQueue(shitenDir: string): void;
}

// ── Implementation ───────────────────────────────────────────────────────────

class ShitenEventBus implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private eventHistory: EventEnvelope[] = [];
  private static readonly MAX_HISTORY = 1000;
  private persistenceDir: string | null = null;
  private deadLetterQueue: DeadLetterQueue | null = null;

  publish<T extends ShitenEventType>(
    eventType: T,
    payload: Record<string, unknown>,
    options?: { correlationId?: CorrelationId; traceId?: TraceId }
  ): void {
    const envelope: EventEnvelope = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      traceId: options?.traceId ?? crypto.randomUUID(),
      correlationId: options?.correlationId,
    };

    this.eventHistory.push(envelope);

    if (this.eventHistory.length > ShitenEventBus.MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-ShitenEventBus.MAX_HISTORY);
    }

    // Persist to disk if enabled
    if (this.persistenceDir) {
      this.persistEvent(envelope);
    }

    // Deliver to all subscribers
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(payload);
          // Handle async handlers
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch((error: unknown) => {
              logger.error("EventBus", `Async handler error for "${eventType}":`, error);
              if (this.deadLetterQueue) {
                const ve = createVersionedEvent(eventType, payload);
                this.deadLetterQueue.enqueue(ve, error instanceof Error ? error.message : String(error), handler.name || "anonymous", 0);
              }
            });
          }
        } catch (error) {
          logger.error("EventBus", `Handler error for "${eventType}":`, error);
          if (this.deadLetterQueue) {
            const ve = createVersionedEvent(eventType, payload);
            this.deadLetterQueue.enqueue(ve, error instanceof Error ? error.message : String(error), handler.name || "anonymous", 0);
          }
        }
      }
    }
  }

  /** Enable persistence to disk. Events are written to JSONL files by date. */
  enablePersistence(shitenDir: string): void {
    const telemetryDir = join(shitenDir, "telemetry");
    if (!existsSync(telemetryDir)) {
      mkdirSync(telemetryDir, { recursive: true });
    }
    this.persistenceDir = telemetryDir;
  }

  enableDeadLetterQueue(shitenDir: string): void {
    this.deadLetterQueue = new DeadLetterQueue(shitenDir);
  }

  private persistEvent(entry: EventEnvelope): void {
    if (!this.persistenceDir) return;
    try {
      const date = entry.timestamp.slice(0, 10);
      const filePath = join(this.persistenceDir, `events-${date}.jsonl`);
      appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      logger.debug("event-bus", "Failed to persist event — best-effort");
    }
  }

  subscribe(
    eventType: ShitenEventType,
    handler: EventHandler<Record<string, unknown>>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(handler as EventHandler);
    };
  }

  subscribeOnce<T>(eventType: ShitenEventType, handler: EventHandler<T>): () => void {
    const wrapper = ((payload: T) => {
      this.unsubscribe(eventType, wrapper);
      handler(payload);
    }) as EventHandler;

    return this.subscribe(eventType, wrapper);
  }

  removeAllListeners(eventType?: ShitenEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(eventType: ShitenEventType): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  getHistory(): EventEnvelope[] {
    return [...this.eventHistory];
  }

  private unsubscribe(eventType: ShitenEventType, handler: EventHandler): void {
    this.listeners.get(eventType)?.delete(handler);
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let globalBus: EventBus | null = null;

/** Get the global event bus instance. */
export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new ShitenEventBus();
  }
  return globalBus;
}

/** Reset the global event bus (for testing). */
export function resetEventBus(): void {
  globalBus = null;
}

/** Enable event persistence to disk for performance reporting. */
export function enableEventPersistence(shitenDir: string): void {
  getEventBus().enablePersistence(shitenDir);
}

/** Read persisted events from a specific date. */
export function readPersistedEvents(
  shitenDir: string,
  date: string
): EventEnvelope[] {
  const telemetryDir = join(shitenDir, "telemetry");
  const filePath = join(telemetryDir, `events-${date}.jsonl`);

  if (!existsSync(filePath)) return [];

  try {
    const content = readFileSync(filePath, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line: string) => JSON.parse(line));
  } catch {
    return [];
  }
}
