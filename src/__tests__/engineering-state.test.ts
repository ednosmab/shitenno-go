import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  consolidateEngineeringState,
  saveEngineeringState,
  loadEngineeringState,
  engineeringStateToText,
  type EngineeringState,
} from "../engineering-state.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const TEST_DIR = join(tmpdir(), "nexus-eng-state-test");
const NEXUS_DIR = join(TEST_DIR, "nexus");

beforeAll(() => {
  mkdirSync(join(NEXUS_DIR, "governance", "rules"), { recursive: true });
  mkdirSync(join(NEXUS_DIR, "governance", "context"), { recursive: true });
  mkdirSync(join(NEXUS_DIR, "governance", "backlog"), { recursive: true });
  writeFileSync(
    join(NEXUS_DIR, "governance", "context", "context_buffer.yaml"),
    "reminders:\n  - test\n",
  );
});
afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("consolidateEngineeringState", () => {
  it("returns a valid EngineeringState", () => {
    const state = consolidateEngineeringState(TEST_DIR, NEXUS_DIR);
    expect(state).toBeDefined();
    expect(typeof state.consolidatedAt).toBe("string");
    expect(state.project).toBeDefined();
    expect(typeof state.project.name).toBe("string");
    expect(Array.isArray(state.assets)).toBe(true);
    expect(typeof state.entropy).toBe("object");
  });

  it("computes entropy metrics", () => {
    const state = consolidateEngineeringState(TEST_DIR, NEXUS_DIR);
    expect(typeof state.entropy.orphanedAssets).toBe("number");
    expect(typeof state.entropy.staleAssets).toBe("number");
    expect(typeof state.entropy.missingDependencies).toBe("number");
    expect(typeof state.entropy.score).toBe("number");
    expect(state.entropy.score).toBeGreaterThanOrEqual(0);
    expect(state.entropy.score).toBeLessThanOrEqual(100);
  });
});

describe("saveEngineeringState / loadEngineeringState", () => {
  it("round-trips through disk", () => {
    const state = consolidateEngineeringState(TEST_DIR, NEXUS_DIR);
    saveEngineeringState(NEXUS_DIR, state);
    const loaded = loadEngineeringState(NEXUS_DIR);
    expect(loaded).toBeDefined();
    expect(loaded!.project.name).toBe(state.project.name);
    expect(loaded!.assets.length).toBe(state.assets.length);
  });

  it("returns null when file missing", () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });
    expect(loadEngineeringState(emptyDir)).toBeNull();
  });
});

describe("engineeringStateToText", () => {
  it("returns a non-empty string", () => {
    const state = consolidateEngineeringState(TEST_DIR, NEXUS_DIR);
    const text = engineeringStateToText(state);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("mentions entropy", () => {
    const state = consolidateEngineeringState(TEST_DIR, NEXUS_DIR);
    const text = engineeringStateToText(state);
    expect(text.toLowerCase()).toContain("entropy");
  });
});
