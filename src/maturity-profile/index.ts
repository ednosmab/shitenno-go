export type { CapabilityInfo } from "./capabilities.js";
export { CAPABILITIES } from "./capabilities.js";

export type { MaturityAnswers, ProjectAnalysis } from "./dimensions.js";
export { calculateDimensions, detectGovernanceArtifactsScore, calculateOverallScore } from "./dimensions.js";

export { detectCapabilitySignalsFromFilesystem } from "./detection.js";
export { recommendCapabilities, getFutureCapabilities } from "./recommendation.js";

export { calculateMaturityProfile, saveMaturityProfile, loadMaturityProfile, profileToLegacyLevel } from "./persistence.js";
export type { MaturitySnapshot } from "./telemetry.js";
export { recordMaturitySnapshot, readMaturityHistory } from "./telemetry.js";
