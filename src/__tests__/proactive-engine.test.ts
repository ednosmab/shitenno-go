/**
 * proactive-engine.test.ts — Tests for Proactive Engine
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEventBus, resetEventBus } from "../event-bus.js";
import { initializeProactiveEngine } from "../proactive-engine.js";

describe("initializeProactiveEngine", () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  it("returns an unsubscribe function", () => {
    const unsubscribe = initializeProactiveEngine(
      "/tmp/project",
      "/tmp/project/nexus-system"
    );
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });

  it("subscribes to engineering_state.consolidated event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeProactiveEngine(
      "/tmp/project",
      "/tmp/project/nexus-system"
    );

    expect(bus.listenerCount("engineering_state.consolidated")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("unsubscribe removes subscription", () => {
    const bus = getEventBus();
    const unsubscribe = initializeProactiveEngine(
      "/tmp/project",
      "/tmp/project/nexus-system"
    );

    const before = bus.listenerCount("engineering_state.consolidated");
    unsubscribe();
    const after = bus.listenerCount("engineering_state.consolidated");

    expect(after).toBeLessThan(before);
  });
});
