import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeKeyChecksums, getCached, setCache, invalidateCache, type CacheEntry, type NexusCache } from "../cache.js";

let tempDir: string;
let nexusDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-cache-test-"));
  nexusDir = join(tempDir, "nexus-system");
  mkdirSync(nexusDir, { recursive: true });
  // Create a minimal package.json so computeKeyChecksums can hash it
  writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "test" }));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ── computeKeyChecksums ─────────────────────────────────────────────────────

describe("computeKeyChecksums", () => {
  it("returns a checksums object with expected keys", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    expect(checksums).toHaveProperty("nexus-system/");
    expect(checksums).toHaveProperty("package.json");
  });

  it("returns 'missing' for non-existent nexus-system/", () => {
    const missingDir = join(tempDir, "nonexistent");
    const checksums = computeKeyChecksums(tempDir, missingDir);
    expect(checksums["nexus-system/"]).toBe("missing");
  });

  it("returns consistent checksums for same content", () => {
    const c1 = computeKeyChecksums(tempDir, nexusDir);
    const c2 = computeKeyChecksums(tempDir, nexusDir);
    expect(c1).toEqual(c2);
  });

  it("changes checksum when nexus-system/ content changes", () => {
    const c1 = computeKeyChecksums(tempDir, nexusDir);
    writeFileSync(join(nexusDir, "new-file.md"), "# New file");
    const c2 = computeKeyChecksums(tempDir, nexusDir);
    expect(c1["nexus-system/"]).not.toBe(c2["nexus-system/"]);
  });
});

// ── setCache / getCached ────────────────────────────────────────────────────

describe("setCache and getCached", () => {
  it("stores and retrieves a cache entry", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    const data = { score: 85, level: "pleno" };

    setCache(tempDir, nexusDir, "complexity", data, checksums);
    const result = getCached<typeof data>(tempDir, nexusDir, "complexity", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );

    expect(result).toEqual(data);
  });

  it("returns null on cache miss (no cache file)", () => {
    const result = getCached(tempDir, nexusDir, "complexity", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );
    expect(result).toBeNull();
  });

  it("returns null when checksums changed", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);

    // Change the nexus-system/ content
    writeFileSync(join(nexusDir, "changed.md"), "changed");

    const result = getCached(tempDir, nexusDir, "complexity", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );
    expect(result).toBeNull();
  });

  it("returns null for different cache key", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);

    const result = getCached(tempDir, nexusDir, "health", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );
    expect(result).toBeNull();
  });

  it("overwrites existing entry for same key", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 50 }, checksums);
    setCache(tempDir, nexusDir, "complexity", { score: 90 }, checksums);

    const result = getCached(tempDir, nexusDir, "complexity", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );
    expect(result).toEqual({ score: 90 });
  });

  it("stores multiple keys independently", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);
    setCache(tempDir, nexusDir, "patterns", { patterns: [] }, checksums);
    setCache(tempDir, nexusDir, "health", { healthScore: 90 }, checksums);

    expect(getCached(tempDir, nexusDir, "complexity", () => computeKeyChecksums(tempDir, nexusDir))).toEqual({ score: 85 });
    expect(getCached(tempDir, nexusDir, "patterns", () => computeKeyChecksums(tempDir, nexusDir))).toEqual({ patterns: [] });
    expect(getCached(tempDir, nexusDir, "health", () => computeKeyChecksums(tempDir, nexusDir))).toEqual({ healthScore: 90 });
  });

  it("writes a valid cache file to disk", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);

    const cachePath = join(tempDir, ".nexus-cache.json");
    expect(existsSync(cachePath)).toBe(true);

    const raw = JSON.parse(readFileSync(cachePath, "utf-8")) as NexusCache;
    expect(raw.version).toBe(1);
    expect(raw.complexity).toBeDefined();
  });
});

// ── invalidateCache ─────────────────────────────────────────────────────────

describe("invalidateCache", () => {
  it("removes entire cache file when no key specified", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);
    expect(existsSync(join(tempDir, ".nexus-cache.json"))).toBe(true);

    invalidateCache(tempDir);
    expect(existsSync(join(tempDir, ".nexus-cache.json"))).toBe(false);
  });

  it("removes only the specified key", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);
    setCache(tempDir, nexusDir, "health", { score: 90 }, checksums);

    invalidateCache(tempDir, "complexity");

    expect(getCached(tempDir, nexusDir, "complexity", () => computeKeyChecksums(tempDir, nexusDir))).toBeNull();
    expect(getCached(tempDir, nexusDir, "health", () => computeKeyChecksums(tempDir, nexusDir))).toEqual({ score: 90 });
  });

  it("does nothing when no cache exists", () => {
    // Should not throw
    invalidateCache(tempDir);
    expect(existsSync(join(tempDir, ".nexus-cache.json"))).toBe(false);
  });

  it("does nothing when key does not exist in cache", () => {
    const checksums = computeKeyChecksums(tempDir, nexusDir);
    setCache(tempDir, nexusDir, "complexity", { score: 85 }, checksums);

    // Invalidate a key that was never set
    invalidateCache(tempDir, "health");

    // Complexity should still be there
    expect(getCached(tempDir, nexusDir, "complexity", () => computeKeyChecksums(tempDir, nexusDir))).toEqual({ score: 85 });
  });
});

// ── Corrupted cache ─────────────────────────────────────────────────────────

describe("corrupted cache handling", () => {
  it("returns null for corrupted JSON", () => {
    writeFileSync(join(tempDir, ".nexus-cache.json"), "not valid json {{{");
    const result = getCached(tempDir, nexusDir, "complexity", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );
    expect(result).toBeNull();
  });

  it("returns null for wrong version", () => {
    writeFileSync(
      join(tempDir, ".nexus-cache.json"),
      JSON.stringify({ version: 99, projectRoot: tempDir })
    );
    const result = getCached(tempDir, nexusDir, "complexity", () =>
      computeKeyChecksums(tempDir, nexusDir)
    );
    expect(result).toBeNull();
  });
});
