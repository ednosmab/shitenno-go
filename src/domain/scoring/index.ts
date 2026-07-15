export type { ProjectProfile } from "./profile-loader.js";
export { loadProjectProfile } from "./profile-loader.js";

export type { AreaMetrics, PreReadHistory } from "./area-scorer.js";
export {
  batchScoreArea,
  batchGitChurn,
  preReadHistory,
  countContextPressure,
  collectStaticMetrics,
  collectBehavioralMetrics,
} from "./area-scorer.js";

export { calculateAreaScores, scoreProject } from "./project-scorer.js";
