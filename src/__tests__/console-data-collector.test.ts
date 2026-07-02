/**
 * console-data-collector.test.ts — Tests for console data collection
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { collectConsoleData, type ConsoleData } from "../console/data-collector.js";
import { execSync } from "child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("collectConsoleData", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "nexus-console-test-"));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return an object with all required fields", () => {
    const nexusDir = join(tempDir, "nexus-system");
    mkdirSync(nexusDir, { recursive: true });

    const data = collectConsoleData(tempDir, nexusDir);

    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("projectRoot");
    expect(data).toHaveProperty("nexusDir");
    expect(data).toHaveProperty("lifecycle");
    expect(data).toHaveProperty("engineering");
    expect(data).toHaveProperty("maturity");
    expect(data).toHaveProperty("graph");
    expect(data).toHaveProperty("debt");
    expect(data).toHaveProperty("capabilities");
    expect(data).toHaveProperty("capabilityEntities");
    expect(data).toHaveProperty("goals");
    expect(data).toHaveProperty("decisions");
    expect(data).toHaveProperty("session");
    expect(data).toHaveProperty("recentEvents");
    expect(data).toHaveProperty("growth");
    expect(data).toHaveProperty("entropy");
    expect(data).toHaveProperty("health");
    expect(data).toHaveProperty("stats");
  });

  it("should return valid timestamp", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    const timestamp = new Date(data.timestamp);
    expect(timestamp.getTime()).not.toBeNaN();
  });

  it("should return correct projectRoot and nexusDir", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.projectRoot).toBe(tempDir);
    expect(data.nexusDir).toBe(nexusDir);
  });

  it("should return engineering state with maturity", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.engineering).toBeDefined();
    // maturity can be null if no profile exists
    if (data.engineering.maturity) {
      expect(data.engineering.maturity.dimensions).toBeDefined();
      expect(typeof data.engineering.maturity.overallScore).toBe("number");
    }
  });

  it("should return health scores between 0 and 100", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.health.overall).toBeGreaterThanOrEqual(0);
    expect(data.health.overall).toBeLessThanOrEqual(100);
    expect(data.health.knowledgeDebt).toBeGreaterThanOrEqual(0);
    expect(data.health.knowledgeDebt).toBeLessThanOrEqual(100);
    expect(data.health.knowledgeGraph).toBeGreaterThanOrEqual(0);
    expect(data.health.knowledgeGraph).toBeLessThanOrEqual(100);
    expect(data.health.entropy).toBeGreaterThanOrEqual(0);
    expect(data.health.entropy).toBeLessThanOrEqual(100);
  });

  it("should return graph with required fields", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.graph).toBeDefined();
    expect(typeof data.graph.totalArtifacts).toBe("number");
    expect(typeof data.graph.totalRelations).toBe("number");
    expect(typeof data.graph.healthScore).toBe("number");
    expect(Array.isArray(data.graph.orphanArtifacts)).toBe(true);
    expect(Array.isArray(data.graph.hubArtifacts)).toBe(true);
    expect(Array.isArray(data.graph.cycles)).toBe(true);
  });

  it("should return session with required fields", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.session).toBeDefined();
    expect(typeof data.session.totalSessions).toBe("number");
    expect(typeof data.session.avgDuration).toBe("number");
    expect(typeof data.session.totalCommands).toBe("number");
    expect(typeof data.session.challengingRatio).toBe("number");
  });

  it("should return arrays for goals and decisions", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(Array.isArray(data.goals)).toBe(true);
    expect(Array.isArray(data.decisions)).toBe(true);
  });

  it("should return entropy with required fields", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.entropy).toBeDefined();
    expect(typeof data.entropy.orphanedAssets).toBe("number");
    expect(typeof data.entropy.staleAssets).toBe("number");
    expect(typeof data.entropy.missingDependencies).toBe("number");
    expect(typeof data.entropy.score).toBe("number");
  });

  it("should return stats with required fields", () => {
    const nexusDir = join(tempDir, "nexus-system");
    const data = collectConsoleData(tempDir, nexusDir);

    expect(data.stats).toBeDefined();
    expect(typeof data.stats.totalAssets).toBe("number");
    expect(typeof data.stats.totalRules).toBe("number");
    expect(typeof data.stats.totalSkills).toBe("number");
    expect(typeof data.stats.totalAdrs).toBe("number");
  });

  it("should handle non-existent directory gracefully", () => {
    const fakeDir = join(tempDir, "non-existent");
    const fakeNexus = join(fakeDir, "nexus-system");

    const data = collectConsoleData(fakeDir, fakeNexus);

    expect(data).toBeDefined();
    expect(data.projectRoot).toBe(fakeDir);
    expect(data.lifecycle).toBeDefined();
  });
});
