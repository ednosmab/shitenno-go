import { describe, it, expect, beforeEach } from "vitest";
import { getEventBus, resetEventBus } from "../event-bus.js";
import type { NexusEventType } from "../event-bus.js";

describe("EventBus", () => {
  beforeEach(() => {
    resetEventBus();
  });

  it("publishes and subscribes to events", () => {
    const bus = getEventBus();
    const received: unknown[] = [];

    bus.subscribe("score.calculated", (payload) => {
      received.push(payload);
    });

    bus.publish("score.calculated", { score: 42 });
    bus.publish("score.calculated", { score: 84 });

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ score: 42 });
    expect(received[1]).toEqual({ score: 84 });
  });

  it("unsubscribe stops delivery", () => {
    const bus = getEventBus();
    const received: unknown[] = [];

    const unsub = bus.subscribe("pattern.detected", (payload) => {
      received.push(payload);
    });

    bus.publish("pattern.detected", { patterns: [] });
    unsub();
    bus.publish("pattern.detected", { patterns: [] });

    expect(received).toHaveLength(1);
  });

  it("subscribeOnce fires only once", () => {
    const bus = getEventBus();
    let count = 0;

    bus.subscribeOnce("session.start", () => {
      count++;
    });

    bus.publish("session.start", {});
    bus.publish("session.start", {});
    bus.publish("session.start", {});

    expect(count).toBe(1);
  });

  it("listenerCount returns correct count", () => {
    const bus = getEventBus();

    bus.subscribe("health.checked", () => {});
    bus.subscribe("health.checked", () => {});
    bus.subscribe("debt.detected", () => {});

    expect(bus.listenerCount("health.checked")).toBe(2);
    expect(bus.listenerCount("debt.detected")).toBe(1);
    expect(bus.listenerCount("score.calculated")).toBe(0);
  });

  it("removeAllListeners clears all handlers", () => {
    const bus = getEventBus();

    bus.subscribe("session.start", () => {});
    bus.subscribe("session.end", () => {});
    bus.subscribe("score.calculated", () => {});

    bus.removeAllListeners();

    expect(bus.listenerCount("session.start")).toBe(0);
    expect(bus.listenerCount("session.end")).toBe(0);
    expect(bus.listenerCount("score.calculated")).toBe(0);
  });

  it("removeAllListeners with eventType clears only that type", () => {
    const bus = getEventBus();

    bus.subscribe("session.start", () => {});
    bus.subscribe("session.end", () => {});

    bus.removeAllListeners("session.start");

    expect(bus.listenerCount("session.start")).toBe(0);
    expect(bus.listenerCount("session.end")).toBe(1);
  });

  it("records event history", () => {
    const bus = getEventBus();

    bus.publish("session.start", { id: "1" });
    bus.publish("score.calculated", { score: 50 });

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.type).toBe("session.start");
    expect(history[1]!.type).toBe("score.calculated");
  });

  it("returns singleton instance", () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    expect(bus1).toBe(bus2);
  });

  it("handler errors do not affect other handlers", () => {
    const bus = getEventBus();
    const received: string[] = [];

    bus.subscribe("validation.completed", () => {
      throw new Error("handler error");
    });

    bus.subscribe("validation.completed", () => {
      received.push("ok");
    });

    // Should not throw
    bus.publish("validation.completed", {});

    expect(received).toHaveLength(1);
  });
});
