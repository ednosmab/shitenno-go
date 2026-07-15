/**
 * briefing-cache.ts — Context Pipeline: Smart Cache Layer
 *
 * Caches briefing results with SHA-256 hash invalidation.
 * Cache is stored at .nexus/briefing-cache.json.
 *
 * Cache invalidation triggers:
 * - Git HEAD changed (new commit)
 * - Fingerprint hash changed (stack/domain change)
 * - Risk map changed (new risk areas)
 *
 * PRINCIPLE: Regenerate only when inputs change.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Briefing } from "./briefing.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CacheEntry {
  /** SHA-256 hash of the inputs that generated this briefing. */
  inputHash: string;
  /** ISO timestamp of when the entry was computed. */
  computedAt: string;
  /** The cached briefing data. */
  briefing: Briefing;
}

export interface BriefingCache {
  /** Cache schema version. */
  version: 1;
  /** The cached entry (if valid). */
  entry: CacheEntry | null;
}

// ── Hash Helpers ───────────────────────────────────────────────────────────

/**
 * Compute a composite hash from briefing inputs.
 * Changes when any input changes → triggers cache invalidation.
 */
export function computeInputHash(inputs: {
  gitHeadHash?: string;
  fingerprintHash: string;
  riskMapHash: string;
  contextRuleCount: number;
  dynamicRuleCount: number;
  maturityScore: number | null;
}): string {
  const payload = JSON.stringify(inputs);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ── Cache Validation ───────────────────────────────────────────────────────

/**
 * Check if a cache entry is valid (hash matches current inputs).
 * Pure function — easy to test.
 */
export function isCacheValid(entry: CacheEntry, currentHash: string): boolean {
  return entry.inputHash === currentHash;
}

/**
 * Check if a cache entry has expired based on NEXUS_CACHE_TTL_MINUTES env var.
 * Pure function — only reads env var, no side effects.
 */
export function isCacheExpired(entry: CacheEntry, nowMs: number = Date.now()): boolean {
  const ttlMinutes = parseInt(process.env.NEXUS_CACHE_TTL_MINUTES || "", 10);
  if (ttlMinutes <= 0 || !entry.computedAt) return false;
  const ageMs = nowMs - new Date(entry.computedAt).getTime();
  return ageMs > ttlMinutes * 60 * 1000;
}

// ── Cache Storage ──────────────────────────────────────────────────────────

function getCachePath(nexusDir: string): string {
  return join(nexusDir, "briefing-cache.json");
}

function ensureDir(nexusDir: string): void {
  if (!existsSync(nexusDir)) {
    mkdirSync(nexusDir, { recursive: true });
  }
}

/**
 * Read the briefing cache from disk.
 * Returns null if cache doesn't exist or is corrupted.
 */
export function readCache(nexusDir: string): BriefingCache | null {
  const cachePath = getCachePath(nexusDir);
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(content) as BriefingCache;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write the briefing cache to disk (atomic: tmp + rename).
 */
function writeCache(nexusDir: string, cache: BriefingCache): void {
  ensureDir(nexusDir);
  const cachePath = getCachePath(nexusDir);
  const tmpPath = join(tmpdir(), `nexus-briefing-cache-${Date.now()}.json`);
  try {
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2), "utf-8");
    renameSync(tmpPath, cachePath);
  } catch {
    try { unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
  }
}

/**
 * Get a cached briefing if valid, or null on cache miss.
 */
export function getCachedBriefing(
  nexusDir: string,
  currentHash: string
): { briefing: Briefing; cacheHit: boolean } | null {
  const cache = readCache(nexusDir);
  if (!cache?.entry) return null;

  // Check hash validity + optional TTL expiration (3.27)
  if (isCacheValid(cache.entry, currentHash) && !isCacheExpired(cache.entry)) {
    return { briefing: cache.entry.briefing, cacheHit: true };
  }

  return null;
}

/**
 * Store a briefing in the cache.
 */
export function setCachedBriefing(
  nexusDir: string,
  briefing: Briefing,
  inputHash: string
): void {
  const cache: BriefingCache = {
    version: 1,
    entry: {
      inputHash,
      computedAt: new Date().toISOString(),
      briefing,
    },
  };
  writeCache(nexusDir, cache);
}

/**
 * Invalidate the briefing cache (force regeneration).
 */
export function invalidateBriefingCache(nexusDir: string): void {
  const cachePath = getCachePath(nexusDir);
  if (existsSync(cachePath)) {
    unlinkSync(cachePath);
  }
}
