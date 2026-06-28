# 15 — EVENT BUS

> Pub/sub architecture for module communication.

## The Problem

Today, Nexus modules are isolated. `pattern-detector` doesn't know what `health-auditor` found. `knowledge-debt` doesn't feed `auto-evolution`. Each module is an island.

The event bus connects them.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Module A │     │ Module B │     │ Module C │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     ▼                ▼                ▼
┌─────────────────────────────────────────────┐
│              EVENT BUS                      │
│                                             │
│  publish(event) → filter → deliver          │
│                                             │
│  subscribers: Map<EventType, Handler[]>     │
└─────────────────────────────────────────────┘
```

## Event Types

| Event | Payload | Published By |
|-------|---------|-------------|
| `session.start` | `{ sessionId, branch }` | init, assess |
| `session.end` | `{ sessionId, summary }` | close-session |
| `analysis.complete` | `{ analysis }` | analyser |
| `score.calculated` | `{ report }` | scorer |
| `pattern.detected` | `{ patterns }` | pattern-detector |
| `health.checked` | `{ report }` | health-auditor |
| `debt.detected` | `{ report }` | knowledge-debt |
| `capability.installed` | `{ capability }` | upgrade |
| `maturity.changed` | `{ previous, current }` | assess |
| `rule.triggered` | `{ ruleId, result }` | rule-engine |
| `evolution.recommended` | `{ recommendations }` | auto-evolution |
| `adr.created` | `{ adr }` | (external) |
| `skill.created` | `{ skill }` | (external) |
| `validation.completed` | `{ results }` | validate |

## The Interface

```typescript
type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventBus {
  publish<T>(eventType: NexusEventType, payload: T): void;
  subscribe<T>(eventType: NexusEventType, handler: EventHandler<T>): unsubscribe;
  subscribeOnce<T>(eventType: NexusEventType, handler: EventHandler<T>): unsubscribe;
  removeAllListeners(eventType?: NexusEventType): void;
  listenerCount(eventType: NexusEventType): number;
}
```

## Implementation

```typescript
class NexusEventBus implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private eventHistory: Array<{ type: string; payload: unknown; timestamp: string }> = [];

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
          handler(payload);
        } catch (error) {
          console.error(`Event handler error for ${eventType}:`, error);
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
}
```

## Singleton Pattern

The event bus is a singleton — one instance shared across all modules:

```typescript
let globalBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new NexusEventBus();
  }
  return globalBus;
}
```

## Usage Examples

### Publishing Events

```typescript
import { getEventBus } from "./event-bus.js";

// After scoring
const bus = getEventBus();
bus.publish("score.calculated", { report: complexityReport });

// After pattern detection
bus.publish("pattern.detected", { patterns: detectedPatterns });
```

### Subscribing to Events

```typescript
import { getEventBus } from "./event-bus.js";

const bus = getEventBus();

// When patterns are detected, check if rules should fire
bus.subscribe("pattern.detected", ({ patterns }) => {
  if (patterns.length > 0) {
    bus.publish("rule.triggered", { ruleId: "RULE-006", patterns });
  }
});

// When maturity changes, suggest upgrade
bus.subscribe("maturity.changed", ({ previous, current }) => {
  if (current.overallScore - previous.overallScore > 10) {
    bus.publish("evolution.recommended", {
      recommendations: [{ type: "capability_upgrade", priority: "high" }]
    });
  }
});
```

## Error Handling

- Handler errors are caught and logged, not propagated
- Failed handlers do not affect other handlers
- Event history is preserved for debugging

## Performance

- Event delivery is synchronous (for simplicity)
- History is unbounded (can be capped in future)
- No async scheduling (handlers should be fast)

## Implementation

- **File:** `src/event-bus.ts` (~200 lines)
- **Singleton:** `getEventBus()`
- **Types:** `NexusEventType`, `EventHandler`, `EventBus`
