/**
 * health-auditor.ts — Thin orchestrator for health audit
 *
 * All types, constants, shared utilities, detectors, scoring, and optimization
 * proposals are now in src/audit/*. This file contains ONLY the orchestrator
 * logic (auditHealth, writeHealthReport) and re-exports for backward compatibility.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TaintAnalyzer } from "./audit/taint/index.js";
import type { TaintIssue } from "./audit/taint/types.js";

// ── Re-exports for backward compatibility ────────────────────────────────────

export type { AuditLevel, HealthIssue, GovernanceOptimization, HealthAuditReport, SourceFileInfo } from "./audit/types.js";
export { collectSourceFiles } from "./audit/shared.js";

// Re-export security detectors for backward compatibility (tests import them from here)
export {
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
} from "./audit/engineering-detectors.js";

// ── Internal imports from audit modules ──────────────────────────────────────

import type { AuditLevel, HealthIssue, HealthAuditReport } from "./audit/types.js";
import { DETECTORS_BY_LEVEL } from "./audit/constants.js";
import { collectSourceFiles, readHistory, readRules, deduplicateIssues } from "./audit/shared.js";
import { calculateHealthScore } from "./audit/health-score.js";
import { proposeOptimizations } from "./audit/optimization-proposer.js";

import {
  detectDeadRules,
  detectViolationHotspots,
  detectMissingDocs,
  detectOrphanDirs,
  detectStaleBuffer,
  detectDatePlaceholders,
  detectEmptyDirs,
  detectBrokenRefs,
  detectBrokenDirRefs,
  detectNonBacktickFileRefs,
  detectMissingGitignore,
  detectMissingPackageJson,
  detectMaturityInconsistency,
  detectAdrCoverage,
  detectUnreferencedDirs,
  detectReportNaming,
  detectBareWordRefs,
  detectTemplateDirRefs,
  detectExtensionMismatch,
  detectSystemMapMismatch,
  detectBrokenCommands,
  detectP0Inconsistency,
  detectTripleMaturityScore,
  detectEmptyStack,
  detectScriptWiring,
  detectAgentContractRefs,
  detectBufferSchemaMismatch,
  detectRuleTypo,
  detectNumberingGap,
  detectPhantomRuleRefs,
  detectDocCountMismatch,
  detectCrossDocP0Contradiction,
  detectEmptyDataFiles,
} from "./audit/governance-detectors.js";

import {
  detectOrphanModules,
  detectComplexityHotspots,
  detectTestCoverageGaps,
  detectConsoleUsage,
  detectEmptyCatchBlocks,
  detectHighComplexity,
  detectCircularDeps,
  detectUnusedExports,
  detectDeadCodePatterns,
  detectTestHealth,
  detectLintIssues,
  detectTypeSafetyIssues,
  detectUnpinnedVersions,
  detectMissingLockFile,
  detectLockFileDrift,
  detectPhantomDependencies,
  detectDeprecatedPackages,
  detectDependencyVulnerabilities,
  detectIncompatibleLicenses,
  detectConfigSecrets,
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
} from "./audit/engineering-detectors.js";

import {
  detectCommitFormat,
  detectBranchNaming,
  detectDirectMainCommits,
  detectForcePushes,
  detectOrphanBranches,
  detectCommitLanguage,
  detectSecretsInGitHistory,
  detectCommitWithoutGating,
} from "./audit/git-detectors.js";

import {
  detectIncompleteSessionClose,
  detectMissingFeedback,
  detectInvalidBacklogStates,
  detectPlanFormat,
  detectRuleExecutionCompliance,
  detectPolicyStructure,
  detectMissingPremortem,
  detectMissingAdrForChanges,
} from "./audit/governance-enforcement-detectors.js";

import {
  detectJSDocCoverage,
  detectUnsafeTypeAssertions,
  detectUnreachableCode,
  detectUnusedImports,
  detectMagicNumbers,
  detectLongParams,
  detectDeepNesting,
  detectDuplicateCode,
  detectGodFunctions,
  detectCoverageThreshold,
} from "./audit/code-quality-detectors.js";

import {
  detectCleanArchitectureLayers,
  detectSRPViolations,
  detectDependencyInversion,
  detectBarrelFileCycles,
  detectModuleCoupling,
  detectImportConsistency,
  detectTestStructure,
} from "./audit/architecture-detectors.js";

import {
  detectVisionAlignment,
  detectRoadmapConsistency,
  detectKPICoverage,
  detectOrphanRequirements,
  detectRequirementTraceability,
  detectAmbiguityPatterns,
} from "./audit/product-detectors.js";

import {
  detectSchemaConsistency,
  detectDataOwnership,
  detectMissingMigrations,
  detectIndexCoverage,
} from "./audit/data-architecture-detectors.js";

import {
  detectCircuitBreaker,
  detectRetryPolicy,
  detectTimeoutConfig,
  detectHealthChecks,
  detectGracefulDegradation,
  detectRaceConditions,
  detectDeadlockRisk,
} from "./audit/reliability-detectors.js";

import {
  detectNPlusOne,
  detectMissingCaching,
  detectStatefulServices,
  detectMissingRateLimiting,
  detectMissingTimeouts,
} from "./audit/performance-detectors.js";

import {
  detectMissingTracing,
  detectLogStructure,
  detectAlertCoverage,
  detectMetricEndpoints,
  detectMissingDashboard,
  detectLogRetention,
  detectDistributedLogging,
  detectSLODefinitions,
} from "./audit/observability-detectors.js";

import {
  detectPipelineGaps,
  detectRollbackCapability,
  detectMissingRunbooks,
  detectMonitoringGaps,
  detectIncidentResponse,
  detectDisasterRecovery,
  detectCapacityPlanning,
  detectChangeManagement,
} from "./audit/operations-detectors.js";

import {
  detectOWASPTop10,
  detectCWEMapping,
  detectSOC2Controls,
  detectNISTAlignment,
  detectLGPDCompliance,
  detectDataRetention,
  detectConsentTracking,
  detectSecretsInConfig,
  detectEncryptionAtRest,
  detectAccessControls,
  detectAuditLogging,
  detectComplianceReport,
} from "./audit/compliance-detectors.js";

import {
  detectSBOMCoverage,
  detectDependencyProvenance,
  detectTyposquatting,
  detectLicenseConflicts,
  detectTransitiveVulns,
  detectMalwarePatterns,
} from "./audit/security-advanced-detectors.js";

import {
  detectTechDebtCost,
  detectTDR,
  detectRemediationEffort,
  detectDebtTrend,
  detectHotspotFiles,
  detectDebtByDomain,
  detectROIRefactoring,
  detectDebtAccumulationRate,
} from "./audit/tech-debt-detectors.js";

import {
  detectSBOMExists,
  detectSBOMCompleteness,
  detectOutdatedDeps,
  detectUnusedDeps,
  detectLockFileSync,
  detectDuplicateDeps,
  detectDepAuditStatus,
} from "./audit/supply-chain-detectors.js";

// ── Main Audit Function ──────────────────────────────────────────────────────

/**
 * Executa auditoria de saúde do sistema Nexus.
 * SÓ SUGERE — nunca aplica optimizações.
 */
export function auditHealth(
  projectRoot: string,
  nexusDir: string,
  level: AuditLevel = "standard"
): HealthAuditReport {
  const history = readHistory(nexusDir);
  const rules = readRules(nexusDir);
  const activeDetectors = new Set(DETECTORS_BY_LEVEL[level]);

  // Collect source files once — shared across all engineering detectors
  const sourceFiles = collectSourceFiles(projectRoot);

  // Detector registry: name → function
  const detectorMap: Record<string, () => HealthIssue[]> = {
    detectDeadRules: () => detectDeadRules(rules, history),
    detectViolationHotspots: () => detectViolationHotspots(history),
    detectMissingDocs: () => detectMissingDocs(nexusDir),
    detectOrphanDirs: () => detectOrphanDirs(nexusDir),
    detectStaleBuffer: () => detectStaleBuffer(nexusDir),
    detectDatePlaceholders: () => detectDatePlaceholders(nexusDir),
    detectEmptyDirs: () => detectEmptyDirs(nexusDir),
    detectBrokenRefs: () => detectBrokenRefs(nexusDir),
    detectBrokenDirRefs: () => detectBrokenDirRefs(nexusDir),
    detectNonBacktickFileRefs: () => detectNonBacktickFileRefs(nexusDir),
    detectMissingGitignore: () => detectMissingGitignore(nexusDir),
    detectMaturityInconsistency: () => detectMaturityInconsistency(nexusDir),
    detectAdrCoverage: () => detectAdrCoverage(nexusDir),
    detectMissingPackageJson: () => detectMissingPackageJson(nexusDir),
    detectUnreferencedDirs: () => detectUnreferencedDirs(nexusDir),
    detectReportNaming: () => detectReportNaming(nexusDir),
    detectBareWordRefs: () => detectBareWordRefs(nexusDir),
    detectTemplateDirRefs: () => detectTemplateDirRefs(nexusDir),
    detectExtensionMismatch: () => detectExtensionMismatch(nexusDir),
    detectSystemMapMismatch: () => detectSystemMapMismatch(nexusDir),
    detectBrokenCommands: () => detectBrokenCommands(nexusDir),
    detectP0Inconsistency: () => detectP0Inconsistency(nexusDir),
    // Full-level detectors
    detectTripleMaturityScore: () => detectTripleMaturityScore(nexusDir),
    detectEmptyStack: () => detectEmptyStack(nexusDir),
    detectScriptWiring: () => detectScriptWiring(projectRoot, nexusDir),
    detectAgentContractRefs: () => detectAgentContractRefs(nexusDir),
    detectBufferSchemaMismatch: () => detectBufferSchemaMismatch(nexusDir),
    detectRuleTypo: () => detectRuleTypo(nexusDir),
    detectNumberingGap: () => detectNumberingGap(nexusDir),
    detectDocCountMismatch: () => detectDocCountMismatch(nexusDir),
    detectCrossDocP0Contradiction: () => detectCrossDocP0Contradiction(nexusDir),
    detectEmptyDataFiles: () => detectEmptyDataFiles(nexusDir),
    detectPhantomRuleRefs: () => detectPhantomRuleRefs(nexusDir),
    // Engineering audit detectors (Dimensions 1-7) — use shared sourceFiles
    detectOrphanModules: () => detectOrphanModules(projectRoot, sourceFiles),
    detectComplexityHotspots: () => detectComplexityHotspots(projectRoot, sourceFiles),
    detectTestCoverageGaps: () => detectTestCoverageGaps(projectRoot, sourceFiles),
    detectConsoleUsage: () => detectConsoleUsage(projectRoot, sourceFiles),
    detectEmptyCatchBlocks: () => detectEmptyCatchBlocks(projectRoot, sourceFiles),
    detectHighComplexity: () => detectHighComplexity(projectRoot, sourceFiles),
    detectCircularDeps: () => detectCircularDeps(projectRoot, sourceFiles),
    detectUnusedExports: () => detectUnusedExports(projectRoot, sourceFiles),
    detectDeadCodePatterns: () => detectDeadCodePatterns(projectRoot, sourceFiles),
    detectTestHealth: () => detectTestHealth(projectRoot),
    detectLintIssues: () => detectLintIssues(projectRoot),
    detectTypeSafetyIssues: () => detectTypeSafetyIssues(projectRoot, sourceFiles),
    // Supply chain detectors
    detectUnpinnedVersions: () => detectUnpinnedVersions(projectRoot),
    detectMissingLockFile: () => detectMissingLockFile(projectRoot),
    detectLockFileDrift: () => detectLockFileDrift(projectRoot),
    detectPhantomDependencies: () => detectPhantomDependencies(projectRoot, sourceFiles),
    detectDeprecatedPackages: () => detectDeprecatedPackages(projectRoot),
    detectDependencyVulnerabilities: () => detectDependencyVulnerabilities(projectRoot),
    detectIncompatibleLicenses: () => detectIncompatibleLicenses(projectRoot),
    detectConfigSecrets: () => detectConfigSecrets(projectRoot),
    // Security pattern detectors (SEC-*)
    detectHardcodedSecrets: () => detectHardcodedSecrets(projectRoot, sourceFiles),
    detectSQLInjection: () => detectSQLInjection(projectRoot, sourceFiles),
    detectXSS: () => detectXSS(projectRoot, sourceFiles),
    detectUnsafeEval: () => detectUnsafeEval(projectRoot, sourceFiles),
    detectConsoleSecrets: () => detectConsoleSecrets(projectRoot, sourceFiles),
    detectWeakCrypto: () => detectWeakCrypto(projectRoot, sourceFiles),
    detectInsecureHTTP: () => detectInsecureHTTP(projectRoot, sourceFiles),
    detectPrototypePollution: () => detectPrototypePollution(projectRoot, sourceFiles),
    detectPathTraversal: () => detectPathTraversal(projectRoot, sourceFiles),
    detectRegexDos: () => detectRegexDos(projectRoot, sourceFiles),
    detectUnsafeDeserialization: () => detectUnsafeDeserialization(projectRoot, sourceFiles),
    detectDependencyConfusion: () => detectDependencyConfusion(projectRoot, sourceFiles),
    // Taint analysis detector
    detectTaintFlow: () => {
      try {
        const analyzer = new TaintAnalyzer({ projectRoot });
        const taintIssues = analyzer.analyze();
        return taintIssues.map((ti: TaintIssue) => ({
          type: ("tainted_input" as const),
          severity: ti.severity,
          description: ti.description,
          location: ti.location,
          recommendation: ti.recommendation,
        }));
      } catch {
        return [] as HealthIssue[];
      }
    },
    // Git Intelligence detectors (GIT-*)
    detectCommitFormat: () => detectCommitFormat(projectRoot),
    detectBranchNaming: () => detectBranchNaming(projectRoot),
    detectDirectMainCommits: () => detectDirectMainCommits(projectRoot),
    detectForcePushes: () => detectForcePushes(projectRoot),
    detectOrphanBranches: () => detectOrphanBranches(projectRoot),
    detectCommitLanguage: () => detectCommitLanguage(projectRoot),
    detectSecretsInGitHistory: () => detectSecretsInGitHistory(projectRoot),
    detectCommitWithoutGating: () => detectCommitWithoutGating(projectRoot),
    // Governance Enforcement detectors (GOV-*)
    detectIncompleteSessionClose: () => detectIncompleteSessionClose(nexusDir),
    detectMissingFeedback: () => detectMissingFeedback(nexusDir),
    detectInvalidBacklogStates: () => detectInvalidBacklogStates(nexusDir),
    detectPlanFormat: () => detectPlanFormat(nexusDir),
    detectRuleExecutionCompliance: () => detectRuleExecutionCompliance(nexusDir),
    detectPolicyStructure: () => detectPolicyStructure(nexusDir),
    detectMissingPremortem: () => detectMissingPremortem(nexusDir),
    detectMissingAdrForChanges: () => detectMissingAdrForChanges(nexusDir),
    // Code Quality Intelligence detectors (CQ-*)
    detectJSDocCoverage: () => detectJSDocCoverage(projectRoot, sourceFiles),
    detectUnsafeTypeAssertions: () => detectUnsafeTypeAssertions(projectRoot, sourceFiles),
    detectUnreachableCode: () => detectUnreachableCode(projectRoot, sourceFiles),
    detectUnusedImports: () => detectUnusedImports(projectRoot, sourceFiles),
    detectMagicNumbers: () => detectMagicNumbers(projectRoot, sourceFiles),
    detectLongParams: () => detectLongParams(projectRoot, sourceFiles),
    detectDeepNesting: () => detectDeepNesting(projectRoot, sourceFiles),
    detectDuplicateCode: () => detectDuplicateCode(projectRoot, sourceFiles),
    detectGodFunctions: () => detectGodFunctions(projectRoot, sourceFiles),
    detectCoverageThreshold: () => detectCoverageThreshold(projectRoot),
    // Architecture Validation detectors (ARCH-*)
    detectCleanArchitectureLayers: () => detectCleanArchitectureLayers(projectRoot, sourceFiles),
    detectSRPViolations: () => detectSRPViolations(projectRoot, sourceFiles),
    detectDependencyInversion: () => detectDependencyInversion(projectRoot, sourceFiles),
    detectBarrelFileCycles: () => detectBarrelFileCycles(projectRoot, sourceFiles),
    detectModuleCoupling: () => detectModuleCoupling(projectRoot, sourceFiles),
    detectImportConsistency: () => detectImportConsistency(projectRoot, sourceFiles),
    detectTestStructure: () => detectTestStructure(projectRoot),
    // Enterprise: Product Strategy & Requirements (ENT-*)
    detectVisionAlignment: () => detectVisionAlignment(projectRoot),
    detectRoadmapConsistency: () => detectRoadmapConsistency(projectRoot),
    detectKPICoverage: () => detectKPICoverage(projectRoot),
    detectOrphanRequirements: () => detectOrphanRequirements(projectRoot, sourceFiles),
    detectRequirementTraceability: () => detectRequirementTraceability(projectRoot, sourceFiles),
    detectAmbiguityPatterns: () => detectAmbiguityPatterns(projectRoot),
    // Enterprise: Data Architecture & Persistence (ENT-DATA-*)
    detectSchemaConsistency: () => detectSchemaConsistency(projectRoot, sourceFiles),
    detectDataOwnership: () => detectDataOwnership(projectRoot),
    detectMissingMigrations: () => detectMissingMigrations(projectRoot, sourceFiles),
    detectIndexCoverage: () => detectIndexCoverage(projectRoot, sourceFiles),
    // Enterprise: Reliability, Resilience & Concurrency (ENT-REL-*)
    detectCircuitBreaker: () => detectCircuitBreaker(projectRoot, sourceFiles),
    detectRetryPolicy: () => detectRetryPolicy(projectRoot, sourceFiles),
    detectTimeoutConfig: () => detectTimeoutConfig(projectRoot, sourceFiles),
    detectHealthChecks: () => detectHealthChecks(projectRoot),
    detectGracefulDegradation: () => detectGracefulDegradation(projectRoot, sourceFiles),
    detectRaceConditions: () => detectRaceConditions(projectRoot, sourceFiles),
    detectDeadlockRisk: () => detectDeadlockRisk(projectRoot, sourceFiles),
    // Enterprise: Performance & Scalability (ENT-PERF-*)
    detectNPlusOne: () => detectNPlusOne(projectRoot, sourceFiles),
    detectMissingCaching: () => detectMissingCaching(projectRoot, sourceFiles),
    detectStatefulServices: () => detectStatefulServices(projectRoot, sourceFiles),
    detectMissingRateLimiting: () => detectMissingRateLimiting(projectRoot, sourceFiles),
    detectMissingTimeouts: () => detectMissingTimeouts(projectRoot, sourceFiles),
    // Enterprise: Observability (ENT-OBS-*)
    detectMissingTracing: () => detectMissingTracing(projectRoot, sourceFiles),
    detectLogStructure: () => detectLogStructure(projectRoot, sourceFiles),
    detectAlertCoverage: () => detectAlertCoverage(projectRoot, sourceFiles),
    detectMetricEndpoints: () => detectMetricEndpoints(projectRoot, sourceFiles),
    detectMissingDashboard: () => detectMissingDashboard(projectRoot, sourceFiles),
    detectLogRetention: () => detectLogRetention(projectRoot, sourceFiles),
    detectDistributedLogging: () => detectDistributedLogging(projectRoot, sourceFiles),
    detectSLODefinitions: () => detectSLODefinitions(projectRoot, sourceFiles),
    // Enterprise: Operations (ENT-OPS-*)
    detectPipelineGaps: () => detectPipelineGaps(projectRoot, sourceFiles),
    detectRollbackCapability: () => detectRollbackCapability(projectRoot, sourceFiles),
    detectMissingRunbooks: () => detectMissingRunbooks(projectRoot, sourceFiles),
    detectMonitoringGaps: () => detectMonitoringGaps(projectRoot, sourceFiles),
    detectIncidentResponse: () => detectIncidentResponse(projectRoot, sourceFiles),
    detectDisasterRecovery: () => detectDisasterRecovery(projectRoot, sourceFiles),
    detectCapacityPlanning: () => detectCapacityPlanning(projectRoot, sourceFiles),
    detectChangeManagement: () => detectChangeManagement(projectRoot, sourceFiles),
    // Enterprise: Compliance (ENT-COMP-*)
    detectOWASPTop10: () => detectOWASPTop10(projectRoot, sourceFiles, []),
    detectCWEMapping: () => detectCWEMapping(projectRoot, sourceFiles, []),
    detectSOC2Controls: () => detectSOC2Controls(projectRoot, sourceFiles),
    detectNISTAlignment: () => detectNISTAlignment(projectRoot, sourceFiles),
    detectLGPDCompliance: () => detectLGPDCompliance(projectRoot, sourceFiles),
    detectDataRetention: () => detectDataRetention(projectRoot, sourceFiles),
    detectConsentTracking: () => detectConsentTracking(projectRoot, sourceFiles),
    detectSecretsInConfig: () => detectSecretsInConfig(projectRoot, sourceFiles),
    detectEncryptionAtRest: () => detectEncryptionAtRest(projectRoot, sourceFiles),
    detectAccessControls: () => detectAccessControls(projectRoot, sourceFiles),
    detectAuditLogging: () => detectAuditLogging(projectRoot, sourceFiles),
    detectComplianceReport: () => detectComplianceReport(projectRoot, sourceFiles),
    // Enterprise: Security Advanced (ENT-SEC-*)
    detectSBOMCoverage: () => detectSBOMCoverage(projectRoot, sourceFiles),
    detectDependencyProvenance: () => detectDependencyProvenance(projectRoot, sourceFiles),
    detectTyposquatting: () => detectTyposquatting(projectRoot, sourceFiles),
    detectLicenseConflicts: () => detectLicenseConflicts(projectRoot, sourceFiles),
    detectTransitiveVulns: () => detectTransitiveVulns(projectRoot, sourceFiles),
    detectMalwarePatterns: () => detectMalwarePatterns(projectRoot, sourceFiles),
    // Enterprise: Tech Debt (ENT-DEBT-*)
    detectTechDebtCost: () => detectTechDebtCost(projectRoot, sourceFiles, []),
    detectTDR: () => detectTDR(projectRoot, sourceFiles, []),
    detectRemediationEffort: () => detectRemediationEffort(projectRoot, sourceFiles, []),
    detectDebtTrend: () => detectDebtTrend(projectRoot, sourceFiles),
    detectHotspotFiles: () => detectHotspotFiles(projectRoot, sourceFiles, []),
    detectDebtByDomain: () => detectDebtByDomain(projectRoot, sourceFiles, []),
    detectROIRefactoring: () => detectROIRefactoring(projectRoot, sourceFiles, []),
    detectDebtAccumulationRate: () => detectDebtAccumulationRate(projectRoot, sourceFiles),
    // Enterprise: Supply Chain (ENT-SC-*)
    detectSBOMExists: () => detectSBOMExists(projectRoot, sourceFiles),
    detectSBOMCompleteness: () => detectSBOMCompleteness(projectRoot, sourceFiles),
    detectOutdatedDeps: () => detectOutdatedDeps(projectRoot, sourceFiles),
    detectUnusedDeps: () => detectUnusedDeps(projectRoot, sourceFiles),
    detectLockFileSync: () => detectLockFileSync(projectRoot, sourceFiles),
    detectDuplicateDeps: () => detectDuplicateDeps(projectRoot, sourceFiles),
    detectDepAuditStatus: () => detectDepAuditStatus(projectRoot, sourceFiles),
  };

  const issues: HealthIssue[] = [];
  for (const [name, fn] of Object.entries(detectorMap)) {
    if (activeDetectors.has(name)) {
      issues.push(...fn());
    }
  }

  const deduped = deduplicateIssues(issues);
  const healthScore = calculateHealthScore(deduped, sourceFiles.length);
  const optimizations = proposeOptimizations(deduped);

  const critical = deduped.filter((i) => i.severity === 3).length;
  const warnings = deduped.filter((i) => i.severity === 2).length;
  const info = deduped.filter((i) => i.severity === 1).length;

  const parts: string[] = [];
  parts.push(`Score de saúde: ${healthScore}/100`);
  parts.push(`Nível: ${level} (${activeDetectors.size} detectors).`);
  parts.push(`${rules.length} regras, ${history.length} sessões analisadas.`);
  if (critical > 0) parts.push(`${critical} crítico(s).`);
  if (warnings > 0) parts.push(`${warnings} aviso(s).`);
  if (info > 0) parts.push(`${info} info.`);
  if (optimizations.length > 0) parts.push(`${optimizations.length} optimização(ões) proposta(s).`);

  return {
    auditedAt: new Date().toISOString(),
    totalRules: rules.length,
    historyEntries: history.length,
    sessionsAnalyzed: history.length,
    issues: deduped,
    optimizations,
    healthScore,
    summary: parts.join(" "),
    level,
  };
}

// ── Report Writer ────────────────────────────────────────────────────────────

/**
 * Grava relatório de saúde em nexus-system/reports/.
 *
 * @param nexusDir - Directorio do nexus-system
 * @param report - Relatório de auditoria de saúde
 * @returns Nome do ficheiro criado ou null se reports/ não existir
 */
export function writeHealthReport(nexusDir: string, report: HealthAuditReport): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `health-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
