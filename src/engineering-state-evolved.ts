/**
 * engineering-state-evolved.ts — Engineering State: Incremental Updates
 *
 * Extends the base engineering state with:
 * - Incremental updates (delta-based, not full consolidation)
 * - Capability lifecycle tracking (Detected → Installed → Configured → Validated → Healthy → Deprecated → Removed)
 * - Event sourcing (every state change recorded as an event)
 *
 * PRINCIPLE: State changes are incremental and traceable.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync as fsAppendFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";
import { logger } from "./logger.js";
import type { EngineeringState, EngineeringAsset, AssetType } from "./engineering-state.js";
import { BoundedQueue } from "./daemon-resources.js";

// ── Memory Limits ─────────────────────────────────────────────────────────────
const MAX_STATE_EVENTS = 10_000;
const MAX_CAPABILITY_HISTORY = 50;
const MAX_PENDING_DELTAS = 100;

// ── Types ──────────────────────────────────────────────────────────────────

/** Capability lifecycle states. */
export type CapabilityLifecycleState =
  | "detected"
  | "installed"
  | "configured"
  | "validated"
  | "healthy"
  | "deprecated"
  | "removed";

/** A state change event for event sourcing. */
export interface StateEvent {
  /** Unique event ID. */
  id: string;
  /** Event type. */
  type: "state_changed" | "capability_updated" | "asset_added" | "asset_removed" | "dimension_updated" | "consolidation";
  /** Path to the affected entity. */
  entityPath: string;
  /** Previous state (for state changes). */
  previousState?: unknown;
  /** New state. */
  newState: unknown;
  /** Source of the change (e.g., "nexus audit", "nexus upgrade"). */
  source: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Optional: correlation ID linking related events. */
  correlationId?: string;
}

/** Delta between two engineering states. */
export interface StateDelta {
  /** ISO timestamp of delta creation. */
  timestamp: string;
  /** Assets added since previous state. */
  assetsAdded: EngineeringAsset[];
  /** Assets removed since previous state. */
  assetsRemoved: string[];
  /** Dimensions that changed. */
  dimensionsChanged: Array<{
    dimension: string;
    previousScore: number;
    newScore: number;
    delta: number;
  }>;
  /** Capabilities that changed lifecycle state. */
  capabilitiesChanged: Array<{
    capabilityId: string;
    previousState: CapabilityLifecycleState;
    newState: CapabilityLifecycleState;
  }>;
  /** Health score changes. */
  healthChanges: {
    previous: number;
    current: number;
    delta: number;
  };
}

/** Consolidated state with incremental update support. */
export interface IncrementalState {
  /** Full state snapshot. */
  state: EngineeringState;
  /** Version counter (incremented on each update). */
  version: number;
  /** Last consolidation timestamp. */
  lastConsolidated: string;
  /** Pending deltas not yet applied. */
  pendingDeltas: StateDelta[];
}

// ── Capability Lifecycle Tracker ───────────────────────────────────────────

export class CapabilityLifecycleTracker {
  private states = new Map<string, CapabilityLifecycleState>();
  private history = new Map<string, BoundedQueue<{ state: CapabilityLifecycleState; timestamp: string }>>();

  /** Record a capability state transition. */
  transition(
    capabilityId: string,
    newState: CapabilityLifecycleState,
    source: string
  ): { previous: CapabilityLifecycleState; current: CapabilityLifecycleState } | undefined {
    const previous = this.states.get(capabilityId) ?? "detected";
    if (previous === newState) return undefined;

    this.states.set(capabilityId, newState);

    const history = this.history.get(capabilityId) ?? new BoundedQueue<{ state: CapabilityLifecycleState; timestamp: string }>(MAX_CAPABILITY_HISTORY);
    history.push({ state: newState, timestamp: new Date().toISOString() });
    this.history.set(capabilityId, history);

    // Publish event
    const bus = getEventBus();
    bus.publish("lifecycle.state_changed", {
      capabilityId,
      previousState: previous,
      newState,
      source,
      timestamp: new Date().toISOString(),
    });

    // Publish capability.unlocked if this is an upgrade
    const stateOrder: CapabilityLifecycleState[] = ["detected", "installed", "configured", "validated", "healthy"];
    const prevIdx = stateOrder.indexOf(previous);
    const newIdx = stateOrder.indexOf(newState);
    if (prevIdx >= 0 && newIdx > prevIdx) {
      bus.publish("capability.unlocked", {
        capabilityId,
        previousLevel: previous,
        newLevel: newState,
        timestamp: new Date().toISOString(),
      });
    }

    return { previous, current: newState };
  }

  /** Get current state of a capability. */
  getState(capabilityId: string): CapabilityLifecycleState {
    return this.states.get(capabilityId) ?? "detected";
  }

  /** Get transition history of a capability. */
  getHistory(capabilityId: string): Array<{ state: CapabilityLifecycleState; timestamp: string }> {
    return this.history.get(capabilityId)?.toArray() ?? [];
  }

  /** Get all capabilities and their states. */
  getAll(): Map<string, CapabilityLifecycleState> {
    return new Map(this.states);
  }

  /** Check if a capability can transition to a new state. */
  canTransition(capabilityId: string, newState: CapabilityLifecycleState): boolean {
    const current = this.getState(capabilityId);
    const validTransitions: Record<CapabilityLifecycleState, CapabilityLifecycleState[]> = {
      detected: ["installed", "removed"],
      installed: ["configured", "removed"],
      configured: ["validated", "deprecated"],
      validated: ["healthy", "deprecated"],
      healthy: ["deprecated"],
      deprecated: ["removed"],
      removed: [],
    };
    return validTransitions[current]?.includes(newState) ?? false;
  }
}

// ── Event Sourced State ────────────────────────────────────────────────────

export class EventSourcedState {
  private events: BoundedQueue<StateEvent> = new BoundedQueue<StateEvent>(MAX_STATE_EVENTS);
  private eventsDir: string;

  constructor(nexusDir: string) {
    this.eventsDir = join(nexusDir, "governance", "state-events");
    if (!existsSync(this.eventsDir)) {
      mkdirSync(this.eventsDir, { recursive: true });
    }
    this.loadEvents();
  }

  /** Record a state event. */
  record(event: Omit<StateEvent, "id" | "timestamp">): StateEvent {
    const fullEvent: StateEvent = {
      ...event,
      id: `EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent); // BoundedQueue: auto-evicts oldest if over 10k
    this.persistEvent(fullEvent);

    // Publish to event bus
    const bus = getEventBus();
    bus.publish("engineering_state.updated", {
      eventType: fullEvent.type,
      entityPath: fullEvent.entityPath,
      source: fullEvent.source,
      timestamp: fullEvent.timestamp,
    });

    return fullEvent;
  }

  /** Get all events. */
  getEvents(): StateEvent[] {
    return this.events.toArray();
  }

  /** Get events for a specific entity. */
  getEventsForEntity(entityPath: string): StateEvent[] {
    return this.events.filter((e) => e.entityPath === entityPath);
  }


  /** Get events since a timestamp. */
  getEventsSince(timestamp: string): StateEvent[] {
    return this.events.filter((e) => e.timestamp >= timestamp);
  }


  /** Replay events to rebuild state. */
  replay(): Map<string, unknown> {
    const state = new Map<string, unknown>();
    for (const event of this.events) {
      state.set(event.entityPath, event.newState);
    }
    return state;
  }


  private loadEvents(): void {
    if (!existsSync(this.eventsDir)) return;

    const files = readdirSync(this.eventsDir).filter((f) => f.endsWith(".jsonl")).sort();
    const allLoaded: StateEvent[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(this.eventsDir, file), "utf-8").trim();
        if (!content) continue;
        const lines = content.split("\n");
        for (const line of lines) {
          allLoaded.push(JSON.parse(line) as StateEvent);
        }
      } catch (error) {
        logger.debug("engineering-state-evolved", "Suppressed error", { error });
      }
    }
    // Load with cap: if history > 10k, keep only the most recent 10k events
    this.events.load(allLoaded);
  }

  private persistEvent(event: StateEvent): void {
    try {
      const date = event.timestamp.slice(0, 10);
      const filePath = join(this.eventsDir, `state-events-${date}.jsonl`);
      appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
    } catch (error) {
      logger.debug("engineering-state-evolved", "Suppressed error", { error });
    }
  }
}

// ── Incremental Consolidation ──────────────────────────────────────────────

export class IncrementalConsolidator {
  private version = 0;
  private _lastConsolidated: string = "";

  /** Get the timestamp of the last consolidation. */
  getLastConsolidated(): string { return this._lastConsolidated; }
  private pendingDeltas: StateDelta[] = [];

  /** Compute delta between two states. */
  computeDelta(
    previous: EngineeringState | null,
    current: EngineeringState
  ): StateDelta {
    const prevAssets = previous?.assets ?? [];
    const currAssets = current.assets;

    const prevAssetIds = new Set(prevAssets.map((a) => a.id));
    const currAssetIds = new Set(currAssets.map((a) => a.id));

    const assetsAdded = currAssets.filter((a) => !prevAssetIds.has(a.id));
    const assetsRemoved = prevAssets
      .filter((a) => !currAssetIds.has(a.id))
      .map((a) => a.id);

    const dimensionsChanged: StateDelta["dimensionsChanged"] = [];
    if (previous?.maturity?.dimensions && current.maturity?.dimensions) {
      const prevDims = previous.maturity.dimensions as unknown as Record<string, number>;
      const currDims = current.maturity.dimensions as unknown as Record<string, number>;
      for (const key of Object.keys(currDims)) {
        const prev = prevDims[key] ?? 0;
        const curr = currDims[key] ?? 0;
        if (prev !== curr) {
          dimensionsChanged.push({
            dimension: key,
            previousScore: prev,
            newScore: curr,
            delta: curr - prev,
          });
        }
      }
    }

    const prevHealth = previous?.healthScores?.overall ?? 0;
    const currHealth = current.healthScores?.overall ?? 0;

    return {
      timestamp: new Date().toISOString(),
      assetsAdded,
      assetsRemoved,
      dimensionsChanged,
      capabilitiesChanged: [],
      healthChanges: {
        previous: prevHealth,
        current: currHealth,
        delta: currHealth - prevHealth,
      },
    };
  }

  /** Apply a delta to create an incremental update. */
  applyDelta(
    current: EngineeringState,
    delta: StateDelta
  ): { state: EngineeringState; version: number } {
    this.version++;
    this._lastConsolidated = delta.timestamp;
    this.pendingDeltas.push(delta);
    // Auto-drain: prevent unbounded growth in long-running sessions
    if (this.pendingDeltas.length > MAX_PENDING_DELTAS) {
      this.pendingDeltas = this.pendingDeltas.slice(-MAX_PENDING_DELTAS);
    }

    // Apply asset additions
    const newAssets = [...current.assets, ...delta.assetsAdded];
    const removedIds = new Set(delta.assetsRemoved);
    const filteredAssets = newAssets.filter((a) => !removedIds.has(a.id));

    // Recompute assetsByType
    const assetsByType: Record<string, number> = {};
    for (const asset of filteredAssets) {
      assetsByType[asset.type] = (assetsByType[asset.type] ?? 0) + 1;
    }

    return {
      state: {
        ...current,
        assets: filteredAssets,
        assetsByType: assetsByType as Record<AssetType, number>,
        consolidatedAt: delta.timestamp,
      },
      version: this.version,
    };
  }

  /** Get current version. */
  getVersion(): number {
    return this.version;
  }

  /** Get pending deltas. */
  getPendingDeltas(): StateDelta[] {
    return [...this.pendingDeltas];
  }

  /** Clear pending deltas. */
  clearPendingDeltas(): void {
    this.pendingDeltas = [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function appendFileSync(filePath: string, content: string, encoding: BufferEncoding): void {
  fsAppendFileSync(filePath, content, encoding);
}
