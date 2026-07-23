/**
 * index.ts — Semantic Layer Barrel Export
 *
 * Re-exports all public types and functions from the semantic layer.
 */

export type {
  SemanticDomain,
  SubdomainMap,
  SignalType,
  SemanticClassification,
  ClassificationRule,
  DomainInfo,
  SubdomainMap as Subdomains,
} from "./taxonomy.js";

export {
  SUBDOMAINS,
  DOMAIN_INFO,
} from "./taxonomy.js";

export {
  SORTED_RULES,
  getRulesForSignal,
  getRulesByDomain,
  getRuleCount,
} from "./rules.js";

export type {
  JournalEntry,
  JournalFilter,
  JournalStats,
} from "./change-journal.js";

export {
  ChangeJournal,
  getChangeJournal,
  resetChangeJournal,
} from "./change-journal.js";

export type {
  PatternType,
  DetectedPattern,
  PatternRule,
} from "./pattern-rules.js";

export {
  PATTERN_RULES,
  getPatternRule,
  getPatternTypes,
} from "./pattern-rules.js";

export type {
  PatternMatcher,
  PatternDetectionRun,
} from "./pattern-matcher.js";

export {
  getPatternMatcher,
  resetPatternMatcher,
  detectPatterns,
} from "./pattern-matcher.js";

export type {
  SemanticPathChoice,
  SemanticGrowthProfile,
} from "./growth-profile.js";

export {
  loadSemanticGrowthProfile,
  saveSemanticGrowthProfile,
  recordSemanticPathChoice,
  getDomainChallengeLevel,
  getMostFrequentPattern,
  isDomainChallenging,
} from "./growth-profile.js";

export type {
  SemanticPathOption,
  SemanticDualPath,
} from "./dual-path-presenter.js";

export {
  createSemanticDualPath,
  formatSemanticDualPath,
  formatSemanticDualPathJson,
} from "./dual-path-presenter.js";

export type {
  InsightType,
  SemanticInsight,
  Evidence,
  ReasonerContext,
} from "./reasoner.js";

export {
  getSemanticReasoner,
  resetSemanticReasoner,
  generateInsights,
} from "./reasoner.js";

export type {
  Correlation,
  CorrelationType,
  CorrelationSignal,
  CorrelatorContext,
} from "./correlator.js";

export {
  getSemanticCorrelator,
  resetSemanticCorrelator,
  detectCorrelations,
} from "./correlator.js";

export type {
  SignalClassifier,
  ClassifierStats,
} from "./signal-classifier.js";

export {
  getSignalClassifier,
  resetSignalClassifier,
  classifyEvent,
  classifyEvents,
} from "./signal-classifier.js";
