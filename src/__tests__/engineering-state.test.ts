import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  consolidateEngineeringState,
  saveEngineeringState,
  loadEngineeringState,
  engineeringStateToText,
  calculateEntropy,
  type EngineeringAsset,
} from "../engineering-state.js";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeAsset(overrides: Partial<EngineeringAsset>): EngineeringAsset {
  return {
    id: overrides.id || "test-asset",
    type: overrides.type || "doc",
    name: overrides.name || "Test Asset",
    path: overrides.path || "test-asset.md",
    description: overrides.description || "",
    tags: overrides.tags || [],
    status: overrides.status || "active",
    createdAt: overrides.createdAt || daysAgo(1),
    updatedAt: overrides.updatedAt || daysAgo(1),
    contributesTo: overrides.contributesTo || [],
    dependencies: overrides.dependencies || [],
  };
}
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

describe("calculateEntropy", () => {
  it("does not count a recent ADR as stale even if last touched 170 days ago (lifecycle-aware)", () => {
    const asset = makeAsset({ type: "adr", updatedAt: daysAgo(170) });
    const result = calculateEntropy([asset], [], "governed");
    expect(result.staleAssets).toBe(0);
  });

  it("counts a stale doc using the 30-day default while an ADR with the same age is not stale", () => {
    const adr = makeAsset({ type: "adr", updatedAt: daysAgo(170) });
    const doc = makeAsset({ type: "doc", updatedAt: daysAgo(170) });
    const result = calculateEntropy([adr, doc], [], "governed");
    expect(result.staleAssets).toBe(1);
  });

  it("does not count an orphaned ADR or policy against entropy", () => {
    const adr = makeAsset({ type: "adr" });
    const policy = makeAsset({ type: "policy" });
    const result = calculateEntropy([adr, policy], [], "governed");
    expect(result.orphanedAssets).toBe(0);
  });

  it("weighs the same orphan more heavily in a mature (governed/evolved) project than in discovery", () => {
    const asset = makeAsset({ type: "runbook" }); // orphan, not exempt
    const discovered = calculateEntropy([asset], [], "discovered");
    const evolved = calculateEntropy([asset], [], "evolved");
    expect(evolved.score).toBeGreaterThan(discovered.score);
  });

  it("does not saturate the score for a small, realistic amount of entropy (regression for the *100 scaling bug)", () => {
    // 1 orphan in 20 assets = 5% ratio
    const assets = Array.from({ length: 20 }, (_, i) => makeAsset({ id: `a${i}`, type: "doc" }));
    assets[0] = makeAsset({ id: assets[0]!.id, type: "runbook" }); // 1 non-exempt orphan
    const result = calculateEntropy(assets, [], "assessed");
    expect(result.score).toBeLessThan(50);
  });
});
