/**
 * Domain Entities — Barrel Export
 *
 * Central re-export of all domain types.
 * Import from here instead of individual entity files.
 */

export type {
  AssetType,
  EngineeringAsset,
  NexusLifecycleState,
  StateTransition,
  MaturityDimensions,
  Capability,
  CapabilityInfo,
  MaturityProfile,
  StaticMetric,
  BehavioralMetric,
  AreaScore,
  ComplexityReport,
  DetectedPattern,
  CandidateRule,
  PatternDetectionReport,
  RuleSeverity,
  DynamicRule,
  EngineeringState,
} from "./entities/engineering-state.js";

export type { ProjectProfile } from "./scoring/profile-loader.js";
export { loadProjectProfile } from "./scoring/profile-loader.js";

export type { AreaMetrics, PreReadHistory } from "./scoring/area-scorer.js";
export {
  collectStaticMetrics,
  collectBehavioralMetrics,
  batchScoreArea,
  batchGitChurn,
  countContextPressure,
} from "./scoring/area-scorer.js";

export { calculateAreaScores, scoreProject } from "./scoring/project-scorer.js";
