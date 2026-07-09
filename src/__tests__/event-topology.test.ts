/**
 * event-topology.test.ts — Tests for event topology
 *
 * Verifies that critical events have functional subscribers.
 * This is a simplified version of Phase F.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetEventBus, getEventBus } from "../event-bus.js";

describe("event-topology", () => {
  let bus: ReturnType<typeof getEventBus>;

  beforeEach(() => {
    resetEventBus();
    bus = getEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  describe("session.start", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("session.start", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("session.start", {
        sessionId: "test-session",
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.sessionId).toBe("test-session");
    });
  });

  describe("session.end", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("session.end", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("session.end", {
        sessionId: "test-session",
        duration: 12345,
        tasksCompleted: 3,
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.sessionId).toBe("test-session");
      expect(payload.duration).toBe(12345);
    });
  });

  describe("plan.archived", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("plan.archived", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("plan.archived", {
        planPath: "/tmp/plan.md",
        outcome: "success",
        tasksCompleted: 5,
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.planPath).toBe("/tmp/plan.md");
      expect(payload.outcome).toBe("success");
    });
  });

  describe("state.mutated", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("state.mutated", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("state.mutated", {
        source: "test",
        trigger: "manual",
        description: "Test mutation",
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.source).toBe("test");
    });
  });

  describe("challenge.generated", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("challenge.generated", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("challenge.generated", {
        type: "entropy_reduction",
        severity: "high",
        description: "Test challenge",
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.type).toBe("entropy_reduction");
    });
  });
});
