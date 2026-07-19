/**
 * frontend-detector-scope.ts — Scope classification for frontend detectors
 *
 * HOST_SAFE: runs in any project the Shitenno audits
 * SHITENNO_SELF_ONLY: only runs when auditing the Shitenno repository itself
 */

export type FrontendDetectorScope = "host-safe" | "shitenno-self-only";

export const FRONTEND_DETECTOR_SCOPE: Record<string, FrontendDetectorScope> = {
  detectAccessibilityGaps: "host-safe",
};
