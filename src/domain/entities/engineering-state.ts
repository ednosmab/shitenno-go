/**
 * Engineering State — Domain Entities
 *
 * Core types for the engineering state system.
 * Extracted from engineering-state.ts for reuse across modules.
 */

// ── Asset Types ─────────────────────────────────────────────────────────────

/** Engineering Asset types — the fundamental units Nexus organizes. */
export type AssetType =
  | "adr"
  | "skill"
  | "policy"
  | "rule"
  | "prompt"
  | "context"
  | "template"
  | "checklist"
  | "decision"
  | "contract"
  | "runbook"
  | "workflow"
  | "script"
  | "plan"
  | "sdr"
  | "doc"
  | "report"
  | "feedback";

/** An Engineering Asset — files are representations of these. */
export interface EngineeringAsset {
  id: string;
  type: AssetType;
  name: string;
  path: string;
  description: string;
  tags: string[];
  status: "active" | "archived" | "draft";
  createdAt: string;
  updatedAt: string;
  /** Maturity dimensions this asset contributes to. */
  contributesTo: string[];
  /** Dependencies on other assets. */
  dependencies: string[];
}

// ── Lifecycle State ─────────────────────────────────────────────────────────

export type NexusLifecycleState =
  | "uninitialized"
  | "discovered"
  | "assessed"
  | "governed"
  | "evolved";

export interface StateTransition {
  from: NexusLifecycleState;
  to: NexusLifecycleState;
  trigger: string;
  timestamp: string;
}

// ── Maturity ────────────────────────────────────────────────────────────────

/** Dimensões de maturidade do projeto (0-100 cada). */
export interface MaturityDimensions {
  architecture: number;
  governance: number;
  quality: number;
  automation: number;
  ai: number;
  documentation: number;
  observability: number;
}

/** Capacidades que o Nexus pode instalar. */
export type Capability =
  | "core"
  | "knowledge"
  | "architecture"
  | "governance"
  | "ai"
  | "quality"
  | "metrics"
  | "operations"
  | "compliance";

/** Informação sobre uma capacidade. */
export interface CapabilityInfo {
  id: Capability;
  name: string;
  description: string;
  dimensions: Partial<Record<keyof MaturityDimensions, number>>;
  alwaysInstalled: boolean;
  requires: Capability[];
}

/** Resultado do cálculo de maturidade. */
export interface MaturityProfile {
  dimensions: MaturityDimensions;
  overallScore: number;
  recommendedCapabilities: Capability[];
  installedCapabilities: Capability[];
  futureCapabilities: Capability[];
  computedAt: string;
}

// ── Complexity ──────────────────────────────────────────────────────────────

export interface StaticMetric {
  metric: string;
  value: number;
  score: number;
  evidence: string;
}

export interface BehavioralMetric {
  signal: string;
  value: number;
  score: number;
  evidence: string;
  suggestion?: string;
}

export interface AreaScore {
  area: string;
  score: number;
  level: "junior" | "pleno" | "senior";
  fileCount: number;
  churn: number;
  sensitiveSurface: number;
  violations: number;
  dependencyDepth: number;
  incidentFreeAge: number;
  contextPressure: number;
  evidence: string;
}

export interface ComplexityReport {
  score: number;
  level: "junior" | "pleno" | "senior";
  staticScore: number;
  behaviorScore: number;
  reasons: string[];
  suggestions: string[];
  staticMetrics: StaticMetric[];
  behavioralMetrics: BehavioralMetric[];
  computedAt: string;
  areaScores: AreaScore[];
}

// ── Pattern Detection ───────────────────────────────────────────────────────

export interface DetectedPattern {
  type: "recurring_error" | "repeated_violation" | "reverted_decision" | "hot_area";
  description: string;
  occurrences: number;
  evidence: string[];
  affectedArea: string;
  severity: number;
}

export interface CandidateRule {
  id: string;
  title: string;
  description: string;
  target: "FORBIDDEN_OPERATIONS" | "AGENTS.md";
  supportingPatterns: DetectedPattern[];
  ruleText: string;
  status: "proposed" | "accepted" | "rejected" | "modified";
}

export interface PatternDetectionReport {
  detectedAt: string;
  historyEntriesAnalyzed: number;
  reportsAnalyzed: number;
  patterns: DetectedPattern[];
  candidateRules: CandidateRule[];
  summary: string;
}

// ── Dynamic Rules ───────────────────────────────────────────────────────────

export type RuleSeverity = "critical" | "high" | "medium" | "low";

export interface DynamicRule {
  id: string;
  rule: string;
  source: "git-incident" | "history-analysis" | "pattern-detection";
  severity: RuleSeverity;
  evidence: string;
  generatedAt: string;
  incidentCount: number;
}

// ── Engineering State (top-level) ───────────────────────────────────────────

export interface EngineeringState {
  consolidatedAt: string;
  lifecycle: NexusLifecycleState;
  project: {
    name: string;
    root: string;
    stack: string[];
    hasGit: boolean;
    hasCI: boolean;
    hasTests: boolean;
    hasTypeScript: boolean;
    packageCount: number;
    sourceFileCount: number;
    monorepo: boolean;
  };
  maturity: MaturityProfile | null;
  capabilities: Capability[];
  capabilityDrift: {
    detectedNotRegistered: Capability[];
    registeredNotDetected: Capability[];
  };
  knowledgeDebt: {
    totalGaps: number;
    healthScore: number;
    detectedAt: string;
  } | null;
  knowledgeGraph: {
    totalArtifacts: number;
    totalRelations: number;
    healthScore: number;
  } | null;
  assets: EngineeringAsset[];
  assetsByType: Record<AssetType, number>;
  activeRules: number;
  activePolicies: number;
  healthScores: {
    knowledgeDebt: number;
    knowledgeGraph: number;
    overall: number;
  };
  entropy: {
    orphanedAssets: number;
    staleAssets: number;
    missingDependencies: number;
    score: number;
  };
  summary: string;
}
