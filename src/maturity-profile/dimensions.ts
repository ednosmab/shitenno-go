import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { MaturityDimensions } from "../domain/entities/engineering-state.js";

export interface MaturityAnswers {
  usedNexusBefore: boolean;
  isFirstProject: boolean;
  projectAge: "new" | "few_months" | "established" | "mature";
  teamSize: "solo" | "small" | "medium" | "large";
  hasDedicatedTeam: boolean;
  hasArchitectureDocs: boolean;
  hasADRs: boolean;
  hasTechnicalReviews: boolean;
  hasCICD: boolean;
  hasAutomatedTests: boolean;
  hasValidationPipeline: boolean;
  intendsToUseAI: boolean;
  aiWillImplement: boolean;
  requiresHumanReview: boolean;
  hasDefinedPatterns: boolean;
  hasReviewProcess: boolean;
  hasDecisionControl: boolean;
}

export interface ProjectAnalysis {
  monorepo: boolean;
  packageCount: number;
  hasTests: boolean;
  hasLinter: boolean;
  hasTypeScript: boolean;
  sourceFileCount: number;
}

export function calculateDimensions(
  answers: MaturityAnswers,
  analysis: ProjectAnalysis,
  nexusDir?: string
): MaturityDimensions {
  let architecture = 0;
  if (answers.hasArchitectureDocs) architecture += 30;
  if (answers.hasADRs) architecture += 25;
  if (answers.hasTechnicalReviews) architecture += 20;
  if (analysis.monorepo) architecture += 15;
  if (analysis.packageCount >= 3) architecture += 10;

  let governance = 0;
  if (nexusDir) {
    governance += detectGovernanceArtifactsScore(nexusDir);
  }
  if (answers.hasDefinedPatterns) governance += 25;
  if (answers.hasReviewProcess) governance += 25;
  if (answers.hasDecisionControl) governance += 25;
  if (answers.usedNexusBefore) governance += 15;
  if (answers.teamSize === "medium" || answers.teamSize === "large") governance += 10;

  let quality = 0;
  if (answers.hasAutomatedTests) quality += 30;
  if (answers.hasCICD) quality += 25;
  if (answers.hasValidationPipeline) quality += 20;
  if (analysis.hasTests) quality += 15;
  if (analysis.hasLinter) quality += 10;

  let automation = 0;
  if (answers.hasCICD) automation += 40;
  if (answers.hasValidationPipeline) automation += 30;
  if (answers.hasAutomatedTests) automation += 20;
  if (analysis.hasTypeScript) automation += 10;

  let ai = 0;
  if (answers.intendsToUseAI) ai += 30;
  if (answers.aiWillImplement) ai += 35;
  if (answers.requiresHumanReview) ai += 25;
  if (!answers.isFirstProject) ai += 10;

  let documentation = 0;
  if (answers.hasArchitectureDocs) documentation += 30;
  if (answers.hasADRs) documentation += 25;
  if (answers.hasDefinedPatterns) documentation += 20;
  if (answers.usedNexusBefore) documentation += 15;
  if (analysis.sourceFileCount >= 100) documentation += 10;

  let observability = 0;
  if (answers.hasCICD) observability += 25;
  if (answers.hasValidationPipeline) observability += 25;
  if (answers.hasAutomatedTests) observability += 20;
  if (answers.teamSize === "medium" || answers.teamSize === "large") observability += 15;
  if (analysis.monorepo) observability += 15;

  return {
    architecture: Math.min(100, Math.max(0, architecture)),
    governance: Math.min(100, Math.max(0, governance)),
    quality: Math.min(100, Math.max(0, quality)),
    automation: Math.min(100, Math.max(0, automation)),
    ai: Math.min(100, Math.max(0, ai)),
    documentation: Math.min(100, Math.max(0, documentation)),
    observability: Math.min(100, Math.max(0, observability)),
  };
}

export function detectGovernanceArtifactsScore(nexusDir: string): number {
  if (!existsSync(nexusDir)) return 0;

  let score = 0;

  if (existsSync(join(nexusDir, "governance", "WORKFLOW.md"))) score += 10;
  if (existsSync(join(nexusDir, "governance", "SYSTEM_MAP.md"))) score += 5;
  if (existsSync(join(nexusDir, "governance", "context", "context_buffer.yaml"))) score += 5;
  if (existsSync(join(nexusDir, "docs", "FORBIDDEN_OPERATIONS.md"))) score += 5;
  if (existsSync(join(nexusDir, "docs", "DESDO.md"))) score += 5;
  if (existsSync(join(nexusDir, "docs", "adrs"))) score += 5;

  const agentsDir = join(nexusDir, "governance", "agents");
  if (existsSync(agentsDir)) {
    try {
      const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith(".yaml"));
      if (agentFiles.length >= 3) score += 5;
      else if (agentFiles.length >= 1) score += 3;
    } catch (error) {
      logger.debug("maturity-profile", "Suppressed error", { error });
    }
  }

  const rulesDir = join(nexusDir, "governance", "rules");
  if (existsSync(rulesDir)) {
    try {
      const ruleFiles = readdirSync(rulesDir).filter(f => f.endsWith(".json"));
      if (ruleFiles.length >= 2) score += 5;
      else if (ruleFiles.length >= 1) score += 3;
    } catch (error) {
      logger.debug("maturity-profile", "Suppressed error", { error });
    }
  }

  const policiesDir = join(nexusDir, "governance", "policies");
  if (existsSync(policiesDir)) {
    try {
      const policyFiles = readdirSync(policiesDir).filter(f => f.endsWith(".md") && f !== "POLICY-TEMPLATE.md");
      if (policyFiles.length >= 3) score += 10;
      else if (policyFiles.length >= 1) score += 5;
    } catch (error) {
      logger.debug("maturity-profile", "Suppressed error", { error });
    }
  }

  return score;
}

export function calculateOverallScore(dimensions: MaturityDimensions): number {
  const weights: Record<keyof MaturityDimensions, number> = {
    architecture: 0.18,
    governance: 0.12,
    quality: 0.18,
    automation: 0.15,
    ai: 0.12,
    documentation: 0.15,
    observability: 0.10,
  };

  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += dimensions[key as keyof MaturityDimensions] * weight;
    weightSum += weight;
  }

  return Math.round(total / weightSum);
}
