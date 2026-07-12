/**
 * engineering-state-access.ts — Single point of access for Engineering State
 *
 * Guarantees that within the same CLI invocation, every command
 * (status, doctor, audit, run) sees exactly the same snapshot —
 * avoids recomputing N times and diverging due to mid-execution changes.
 *
 * Cross-process cache: loads engineering-state.json from disk before
 * recalculating. Uses file mtime in governance/ to detect staleness.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { consolidateEngineeringState, saveEngineeringState, loadEngineeringState, type EngineeringState } from "./engineering-state.js";

let cachedState: EngineeringState | null = null;

/** Maximum age (ms) for disk cache to be considered fresh. */
const CACHE_MAX_AGE_MS = 60_000; // 1 minute

/**
 * Check if the governance directory has been modified since the given timestamp.
 * This is a lightweight freshness check — much cheaper than full consolidation.
 */
function isDiskCacheFresh(nexusDir: string, consolidatedAt: string): boolean {
  const consolidatedTime = new Date(consolidatedAt).getTime();
  if (Number.isNaN(consolidatedTime)) return false;

  const governanceDir = join(nexusDir, "governance");
  if (!existsSync(governanceDir)) return true; // no governance dir = nothing can invalidate

  try {
    // Quick check: is the cache younger than CACHE_MAX_AGE_MS?
    const age = Date.now() - consolidatedTime;
    if (age < CACHE_MAX_AGE_MS) return true;

    // Deeper check: has any file in governance/ been modified since consolidation?
    return !hasFileChangedSince(governanceDir, consolidatedTime);
  } catch {
    return false; // on error, treat as stale (force recalculation)
  }
}

/**
 * Recursively check if any file under dir was modified after the given time.
 * Stops early on first hit.
 */
function hasFileChangedSince(dir: string, sinceMs: number): boolean {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (hasFileChangedSince(fullPath, sinceMs)) return true;
      } else if (entry.isFile()) {
        const stat = statSync(fullPath);
        if (stat.mtimeMs > sinceMs) return true;
      }
    }
  } catch {
    // on read error, assume changed (safe default)
    return true;
  }
  return false;
}

/**
 * Get the Engineering State for a project.
 * Uses module-level cache within a single CLI invocation.
 * Between invocations, loads from disk if still fresh (cross-process cache).
 * Pass `forceRefresh = true` to bypass all caches.
 */
export function getEngineeringState(
  projectRoot: string,
  nexusDir: string,
  forceRefresh = false
): EngineeringState {
  // Level 1: in-memory cache (within same CLI invocation)
  if (!forceRefresh && cachedState) return cachedState;

  // Level 2: disk cache (cross-process) — only if governance/ hasn't changed
  if (!forceRefresh) {
    const diskState = loadEngineeringState(nexusDir);
    if (diskState && isDiskCacheFresh(nexusDir, diskState.consolidatedAt)) {
      cachedState = diskState;
      return cachedState;
    }
  }

  // Level 3: full consolidation (expensive)
  cachedState = consolidateEngineeringState(projectRoot, nexusDir);
  saveEngineeringState(nexusDir, cachedState);
  return cachedState;
}

/** Clear the cached state (useful for tests). */
export function clearEngineeringStateCache(): void {
  cachedState = null;
}
