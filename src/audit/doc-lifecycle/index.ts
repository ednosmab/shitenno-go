export type {
  DocType,
  DocLifecycleStatus,
  StatusMarkerResult,
  CrossReference,
  GitCorrelation,
  StalenessSignals,
  DetectionSignals,
  SupersessionSignals,
  DocumentInfo,
  DocumentClassification,
  ProposedMove,
  DocLifecycleReport,
  MoveResult,
} from "./types.js";

export {
  detectStatusMarkers,
  detectCrossReferences,
  detectSupersession,
} from "./detectors.js";

export { classifyDocument } from "./classifier.js";

export {
  auditDocLifecycle,
  applyMoves,
  writeDocLifecycleReport,
} from "./auditor.js";
