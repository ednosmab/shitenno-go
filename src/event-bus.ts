/**
 * event-bus.ts — Pub/Sub System for Module Communication
 *
 * Enables decoupled communication between Nexus modules.
 * Modules publish events; other modules subscribe and react.
 *
 * PRINCIPLE: Modules communicate through events, not direct imports.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type NexusEventType =
  | "session.start"
  | "session.end"
  | "analysis.complete"
  | "score.calculated"
  | "pattern.detected"
  | "health.checked"
  | "debt.detected"
  | "capability.installed"
  | "maturity.changed"
  | "rule.triggered"
  | "evolution.recommended"
  | "adr.created"
  | "skill.created"
  | "validation.completed"
  | "pipeline.stage.start"
  | "pipeline.stage.complete"
  | "pipeline.complete"
  | "lifecycle.state_changed";

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface EventBus {
  publish<T>(eventType: NexusEventType, payload: T): void;
  subscribe<T>(eventType: NexusEventType, handler: EventHandler<T>): () => void;
  subscribeOnce<T>(eventType: NexusEventType, handler: EventHandler<T>): () => void;
  removeAllListeners(eventType?: NexusEventType): void;
  listenerCount(eventType: NexusEventType): number;
  getHistory(): Array<{ type: string; payload: unknown; timestamp: string }>;
}

// ── Implementation ───────────────────────────────────────────────────────────

class NexusEventBus implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private eventHistory: Array<{
    type: string;
    payload: unknown;
    timestamp: string;
  }> = [];

  publish<T>(eventType: NexusEventType, payload: T): void {
    // Record in history
    this.eventHistory.push({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });

    // Deliver to all subscribers
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(payload);
          // Handle async handlers
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch((error: unknown) => {
              console.error(`[EventBus] Async handler error for "${eventType}":`, error);
            });
          }
        } catch (error) {
          console.error(`[EventBus] Handler error for "${eventType}":`, error);
        }
      }
    }
  }

  subscribe<T>(eventType: NexusEventType, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(handler as EventHandler);
    };
  }

  subscribeOnce<T>(eventType: NexusEventType, handler: EventHandler<T>): () => void {
    const wrapper = ((payload: T) => {
      this.unsubscribe(eventType, wrapper);
      handler(payload);
    }) as EventHandler;

    return this.subscribe(eventType, wrapper);
  }

  removeAllListeners(eventType?: NexusEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(eventType: NexusEventType): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  getHistory(): Array<{ type: string; payload: unknown; timestamp: string }> {
    return [...this.eventHistory];
  }

  private unsubscribe(eventType: NexusEventType, handler: EventHandler): void {
    this.listeners.get(eventType)?.delete(handler);
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let globalBus: EventBus | null = null;

/** Get the global event bus instance. */
export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new NexusEventBus();
  }
  return globalBus;
}

/** Reset the global event bus (for testing). */
export function resetEventBus(): void {
  globalBus = null;
}
