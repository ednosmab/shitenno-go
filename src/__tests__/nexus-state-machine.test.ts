import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isValidTransition,
  detectLifecycleState,
  createStateMachine,
  canRunCommand,
} from "../nexus-state-machine.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-state-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("NexusStateMachine", () => {
  describe("isValidTransition", () => {
    it("allows uninitialized -> discovered", () => {
      expect(isValidTransition("uninitialized", "discovered")).toBe(true);
    });

    it("allows discovered -> assessed", () => {
      expect(isValidTransition("discovered", "assessed")).toBe(true);
    });

    it("allows assessed -> governed", () => {
      expect(isValidTransition("assessed", "governed")).toBe(true);
    });

    it("allows governed -> evolved", () => {
      expect(isValidTransition("governed", "evolved")).toBe(true);
    });

    it("allows evolved -> governed (regression)", () => {
      expect(isValidTransition("evolved", "governed")).toBe(true);
    });

    it("blocks uninitialized -> assessed", () => {
      expect(isValidTransition("uninitialized", "assessed")).toBe(false);
    });

    it("blocks uninitialized -> governed", () => {
      expect(isValidTransition("uninitialized", "governed")).toBe(false);
    });

    it("blocks discovered -> evolved", () => {
      expect(isValidTransition("discovered", "evolved")).toBe(false);
    });
  });

  describe("detectLifecycleState", () => {
    it("returns uninitialized for empty directory", () => {
      const state = detectLifecycleState(tempDir, join(tempDir, "nexus-system"));
      expect(state).toBe("uninitialized");
    });

    it("returns discovered when opencode.json exists", () => {
      writeFileSync(join(tempDir, "opencode.json"), "{}");
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });

      const state = detectLifecycleState(tempDir, nexusDir);
      expect(state).toBe("discovered");
    });

    it("returns assessed when maturity-profile.json exists", () => {
      writeFileSync(join(tempDir, "opencode.json"), "{}");
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });
      writeFileSync(join(nexusDir, "maturity-profile.json"), "{}");

      const state = detectLifecycleState(tempDir, nexusDir);
      expect(state).toBe("assessed");
    });

    it("returns governed when WORKFLOW.md exists", () => {
      writeFileSync(join(tempDir, "opencode.json"), "{}");
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });
      writeFileSync(join(nexusDir, "maturity-profile.json"), "{}");
      mkdirSync(join(nexusDir, "governance"), { recursive: true });
      writeFileSync(join(nexusDir, "governance", "WORKFLOW.md"), "# Workflow");

      const state = detectLifecycleState(tempDir, nexusDir);
      expect(state).toBe("governed");
    });

    it("returns evolved when evolution report exists", () => {
      writeFileSync(join(tempDir, "opencode.json"), "{}");
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });
      writeFileSync(join(nexusDir, "maturity-profile.json"), "{}");
      mkdirSync(join(nexusDir, "governance"), { recursive: true });
      writeFileSync(join(nexusDir, "governance", "WORKFLOW.md"), "# Workflow");
      mkdirSync(join(nexusDir, "reports"), { recursive: true });
      writeFileSync(
        join(nexusDir, "reports", "evolution-2026-06-27.json"),
        "{}"
      );

      const state = detectLifecycleState(tempDir, nexusDir);
      expect(state).toBe("evolved");
    });
  });

  describe("state machine operations", () => {
    it("transitions between states", () => {
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });

      const sm = createStateMachine(nexusDir);
      expect(sm.getState()).toBe("uninitialized");

      sm.transition("discovered", "nexus init");
      expect(sm.getState()).toBe("discovered");
    });

    it("rejects invalid transitions", () => {
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });

      const sm = createStateMachine(nexusDir);
      const result = sm.transition("assessed", "skip init");
      expect(result).toBe(false);
      expect(sm.getState()).toBe("uninitialized");
    });

    it("canTransition returns correct value", () => {
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });

      const sm = createStateMachine(nexusDir);
      expect(sm.canTransition("discovered")).toBe(true);
      expect(sm.canTransition("assessed")).toBe(false);
    });

    it("records transition history", () => {
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });

      const sm = createStateMachine(nexusDir);
      sm.transition("discovered", "nexus init");
      sm.transition("assessed", "nexus assess");

      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe("uninitialized");
      expect(history[0].to).toBe("discovered");
      expect(history[1].from).toBe("discovered");
      expect(history[1].to).toBe("assessed");
    });

    it("persists state to disk", () => {
      const nexusDir = join(tempDir, "nexus-system");
      mkdirSync(nexusDir, { recursive: true });

      const sm = createStateMachine(nexusDir);
      sm.transition("discovered", "nexus init");

      // Create new instance from same directory
      const sm2 = createStateMachine(nexusDir);
      expect(sm2.getState()).toBe("discovered");
    });
  });

  describe("canRunCommand", () => {
    it("allows init only when uninitialized", () => {
      expect(canRunCommand("init", "uninitialized")).toBe(true);
      expect(canRunCommand("init", "discovered")).toBe(false);
    });

    it("allows status when discovered or later", () => {
      expect(canRunCommand("status", "uninitialized")).toBe(false);
      expect(canRunCommand("status", "discovered")).toBe(true);
      expect(canRunCommand("status", "assessed")).toBe(true);
    });

    it("allows detect when discovered or later", () => {
      expect(canRunCommand("detect", "discovered")).toBe(true);
      expect(canRunCommand("detect", "assessed")).toBe(true);
    });

    it("allows unknown commands", () => {
      expect(canRunCommand("unknown", "uninitialized")).toBe(true);
    });
  });
});
