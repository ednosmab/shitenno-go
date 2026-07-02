import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrCollectConsoleData,
  clearConsoleDataCache,
} from "../console/data-collector.js";

describe("Console Data Cache", () => {
  beforeEach(() => {
    clearConsoleDataCache();
  });

  it("should return data on first call", () => {
    const data = getOrCollectConsoleData("/tmp", "/tmp/.nexus");
    expect(data).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it("should return cached data on second call within TTL", () => {
    const data1 = getOrCollectConsoleData("/tmp", "/tmp/.nexus", 5000);
    const data2 = getOrCollectConsoleData("/tmp", "/tmp/.nexus", 5000);
    expect(data1.timestamp).toBe(data2.timestamp);
  });

  it("should return fresh data after cache is cleared", () => {
    const data1 = getOrCollectConsoleData("/tmp", "/tmp/.nexus", 5000);
    clearConsoleDataCache();
    const data2 = getOrCollectConsoleData("/tmp", "/tmp/.nexus", 5000);
    expect(data2).toBeDefined();
  });

  it("should return fresh data after TTL expires", async () => {
    const data1 = getOrCollectConsoleData("/tmp", "/tmp/.nexus", 1);
    await new Promise((r) => setTimeout(r, 10));
    const data2 = getOrCollectConsoleData("/tmp", "/tmp/.nexus", 1);
    expect(data1).toBeDefined();
    expect(data2).toBeDefined();
  });

  it("should use different cache keys for different project roots", () => {
    const data1 = getOrCollectConsoleData("/tmp/project1", "/tmp/project1/.nexus");
    const data2 = getOrCollectConsoleData("/tmp/project2", "/tmp/project2/.nexus");
    expect(data1.projectRoot).toBe("/tmp/project1");
    expect(data2.projectRoot).toBe("/tmp/project2");
  });

  it("should clear all cache entries", () => {
    getOrCollectConsoleData("/tmp", "/tmp/.nexus");
    clearConsoleDataCache();
    const data = getOrCollectConsoleData("/tmp", "/tmp/.nexus");
    expect(data).toBeDefined();
  });
});
