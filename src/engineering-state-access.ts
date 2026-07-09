/**
 * engineering-state-access.ts — Single point of access for Engineering State
 *
 * Guarantees that within the same CLI invocation, every command
 * (status, doctor, audit, run) sees exactly the same snapshot —
 * avoids recomputing N times and diverging due to mid-execution changes.
 */

import { consolidateEngineeringState, saveEngineeringState, type EngineeringState } from "./engineering-state.js";

let cachedState: EngineeringState | null = null;

/**
 * Get the Engineering State for a project.
 * Uses module-level cache within a single CLI invocation.
 * Pass `forceRefresh = true` to bypass cache (e.g. after writes).
 */
export function getEngineeringState(
  projectRoot: string,
  nexusDir: string,
  forceRefresh = false
): EngineeringState {
  if (!forceRefresh && cachedState) return cachedState;
  cachedState = consolidateEngineeringState(projectRoot, nexusDir);
  saveEngineeringState(nexusDir, cachedState);
  return cachedState;
}

/** Clear the cached state (useful for tests). */
export function clearEngineeringStateCache(): void {
  cachedState = null;
}
