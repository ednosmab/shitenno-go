/**
 * engineering-state-access.test.ts — Tests for engineering state access
 *
 * Validates caching and single-point-of-access guarantee.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getEngineeringState, clearEngineeringStateCache } from "../engineering-state-access.js";
import { saveEngineeringState, type EngineeringState } from "../engineering-state.js";

describe("engineering-state-access", () => {
  let tmpDir: string;

  beforeEach(() => {
    clearEngineeringStateCache();
    tmpDir = join(tmpdir(), `nexus-access-${Date.now()}`);
    mkdirSync(join(tmpDir, "nexus-system"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("clearEngineeringStateCache resets cache", () => {
    clearEngineeringStateCache();
    expect(() => clearEngineeringStateCache()).not.toThrow();
  });

  it("getEngineeringState returns an object with expected properties", () => {
    const state = getEngineeringState(tmpDir, join(tmpDir, "nexus-system"), true);
    expect(state).toBeDefined();
    expect(state).toHaveProperty("consolidatedAt");
    expect(state).toHaveProperty("healthScores");
    expect(state).toHaveProperty("entropy");
  });

  it("returns same reference when called twice without forceRefresh", () => {
    const state1 = getEngineeringState(tmpDir, join(tmpDir, "nexus-system"), false);
    const state2 = getEngineeringState(tmpDir, join(tmpDir, "nexus-system"), false);
    expect(state1).toBe(state2);
  });

  it("returns fresh state when forceRefresh=true", () => {
    const state1 = getEngineeringState(tmpDir, join(tmpDir, "nexus-system"), false);
    clearEngineeringStateCache();
    const state2 = getEngineeringState(tmpDir, join(tmpDir, "nexus-system"), true);
    expect(state1).not.toBe(state2);
  });
});

describe("engineering-state-access — cross-process cache", () => {
  let tmpDir: string;
  let nexusDir: string;

  beforeEach(() => {
    clearEngineeringStateCache();
    tmpDir = join(tmpdir(), `nexus-cross-${Date.now()}`);
    nexusDir = join(tmpDir, "nexus-system");
    mkdirSync(nexusDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads from disk cache when governance/ has not changed", () => {
    // Simulate another process saving state to disk
    const mockState: EngineeringState = {
      consolidatedAt: new Date().toISOString(),
      lifecycle: "evolved",
      project: { name: "test", root: tmpDir, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, overall: 100 },
      entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
      summary: "Test state from disk",
    };

    // Save to disk (simulating another process)
    saveEngineeringState(nexusDir, mockState);

    // Clear in-memory cache
    clearEngineeringStateCache();

    // Should load from disk, not reconsolidate
    const state = getEngineeringState(tmpDir, nexusDir, false);
    expect(state.summary).toBe("Test state from disk");
  });

  it("recalculates when governance/ file is modified after consolidation", () => {
    // Create governance dir with a file
    const govDir = join(nexusDir, "governance");
    mkdirSync(govDir, { recursive: true });
    writeFileSync(join(govDir, "test.md"), "# Test", "utf-8");

    // Save state with old timestamp
    const oldState: EngineeringState = {
      consolidatedAt: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago
      lifecycle: "evolved",
      project: { name: "test", root: tmpDir, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, overall: 100 },
      entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
      summary: "Old state from disk",
    };

    saveEngineeringState(nexusDir, oldState);
    clearEngineeringStateCache();

    // Modify governance file (newer than consolidatedAt)
    writeFileSync(join(govDir, "test.md"), "# Updated", "utf-8");

    // Should recalculate, not use old disk state
    const state = getEngineeringState(tmpDir, nexusDir, false);
    expect(state.summary).not.toBe("Old state from disk");
  });

  it("forceRefresh bypasses disk cache", () => {
    const mockState: EngineeringState = {
      consolidatedAt: new Date().toISOString(),
      lifecycle: "evolved",
      project: { name: "test", root: tmpDir, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, overall: 100 },
      entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
      summary: "Disk state that should be bypassed",
    };

    saveEngineeringState(nexusDir, mockState);
    clearEngineeringStateCache();

    // forceRefresh should ignore disk cache
    const state = getEngineeringState(tmpDir, nexusDir, true);
    expect(state.summary).not.toBe("Disk state that should be bypassed");
  });
});
