/** Tipos de dívida de conhecimento. */
export type DebtType =
  | "adr_missing"
  | "runbook_missing"
  | "skill_missing"
  | "docs_missing"
  | "automation_missing"
  | "contract_missing"
  | "workflow_missing"
  | "review_missing"
  | "test_missing"
  | "adr_stale";

/** Severidade da dívida. */
export type DebtSeverity = "critical" | "high" | "medium" | "low";

/** Uma lacuna de conhecimento detectada. */
export interface KnowledgeGap {
  id: string;
  type: DebtType;
  severity: DebtSeverity;
  description: string;
  location: string;
  expectedArtifact: string;
  recommendation: string;
  detectedAt: string;
  addressed: boolean;
}

/** Relatório de dívida de conhecimento. */
export interface KnowledgeDebtReport {
  generatedAt: string;
  totalGaps: number;
  gapsBySeverity: Record<DebtSeverity, number>;
  gapsByType: Record<DebtType, number>;
  gaps: KnowledgeGap[];
  healthScore: number;
  summary: string;
  recommendations: string[];
}
