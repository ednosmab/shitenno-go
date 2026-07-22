import type { HealthIssue, SourceFileInfo, HistoryEntry } from "./types.js";
import { TaintAnalyzer } from "./taint/index.js";
import type { TaintIssue } from "./taint/types.js";

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
  detectDocCountMismatch,
  detectCrossDocP0Contradiction,
  detectEmptyDataFiles,
  detectPhantomRuleRefs,
  detectOrphanSkills,
} from "../audit/governance-detectors.js";

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
  detectInsecureCORS,
  detectInsecureCookies,
  detectWeakRandomness,
} from "../audit/engineering-detectors.js";

import {
  detectCommitFormat,
  detectBranchNaming,
  detectDirectMainCommits,
  detectForcePushes,
  detectOrphanBranches,
  detectCommitLanguage,
  detectSecretsInGitHistory,
  detectCommitWithoutGating,
} from "../audit/git-detectors.js";

import {
  detectIncompleteSessionClose,
  detectMissingFeedback,
  detectInvalidBacklogStates,
  detectPlanFormat,
  detectRuleExecutionCompliance,
  detectPolicyStructure,
  detectMissingPremortem,
  detectMissingAdrForChanges,
  detectDonePlanIntegrity,
} from "../audit/governance-enforcement-detectors.js";

import {
  detectMisclassifiedTier,
  detectTierMismatches,
} from "../audit/context-tier-detectors.js";

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
} from "../audit/code-quality-detectors.js";

import {
  detectCleanArchitectureLayers,
  detectSRPViolations,
  detectDependencyInversion,
  detectBarrelFileCycles,
  detectModuleCoupling,
  detectImportConsistency,
  detectTestStructure,
} from "../audit/architecture-detectors.js";

import {
  detectVisionAlignment,
  detectRoadmapConsistency,
  detectKPICoverage,
  detectOrphanRequirements,
  detectRequirementTraceability,
  detectAmbiguityPatterns,
} from "../audit/product-detectors.js";

import {
  detectSchemaConsistency,
  detectDataOwnership,
  detectMissingMigrations,
  detectIndexCoverage,
} from "../audit/data-architecture-detectors.js";

import {
  detectCircuitBreaker,
  detectRetryPolicy,
  detectTimeoutConfig,
  detectHealthChecks,
  detectGracefulDegradation,
  detectRaceConditions,
  detectDeadlockRisk,
} from "../audit/reliability-detectors.js";

import {
  detectNPlusOne,
  detectMissingCaching,
  detectStatefulServices,
  detectMissingRateLimiting,
  detectMissingTimeouts,
} from "../audit/performance-detectors.js";

import {
  detectMissingTracing,
  detectLogStructure,
  detectAlertCoverage,
  detectMetricEndpoints,
  detectMissingDashboard,
  detectLogRetention,
  detectDistributedLogging,
  detectSLODefinitions,
} from "../audit/observability-detectors.js";

import {
  detectPipelineGaps,
  detectRollbackCapability,
  detectMissingRunbooks,
  detectMonitoringGaps,
  detectIncidentResponse,
  detectDisasterRecovery,
  detectCapacityPlanning,
  detectChangeManagement,
} from "../audit/operations-detectors.js";

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
} from "../audit/compliance-detectors.js";

import {
  detectSBOMCoverage,
  detectDependencyProvenance,
  detectTyposquatting,
  detectLicenseConflicts,
  detectTransitiveVulns,
  detectMalwarePatterns,
} from "../audit/security-advanced-detectors.js";

import {
  detectTechDebtCost,
  detectTDR,
  detectRemediationEffort,
  detectDebtTrend,
  detectHotspotFiles,
  detectDebtByDomain,
  detectROIRefactoring,
  detectDebtAccumulationRate,
} from "../audit/tech-debt-detectors.js";

import {
  detectSBOMExists,
  detectSBOMCompleteness,
  detectOutdatedDeps,
  detectUnusedDeps,
  detectLockFileSync,
  detectDuplicateDeps,
  detectDepAuditStatus,
} from "../audit/supply-chain-detectors.js";

import { detectAccessibilityGaps } from "../audit/a11y-engine.js";

import { detectStaleVerification } from "../audit/detect-stale-verification.js";

interface DetectorContext {
  projectRoot: string;
  shitennoDir: string;
  sourceFiles: SourceFileInfo[];
  rules: string[];
  history: HistoryEntry[];
}

function buildTaintDetector(ctx: DetectorContext) {
  return () => {
    try {
      const analyzer = new TaintAnalyzer({ projectRoot: ctx.projectRoot });
      return analyzer.analyze().map((ti: TaintIssue) => ({
        type: "tainted_input" as const, severity: ti.severity, description: ti.description,
        location: ti.location, recommendation: ti.recommendation, confidence: 0.95,
      }));
    } catch (err) {
      return [{ type: "tainted_input" as const, severity: 2 as const,
        description: `Taint analysis não pôde ser executada — resultados de segurança incompletos: ${err instanceof Error ? err.message : String(err)}`,
        location: "taint-analyzer", recommendation: "Rodar com --debug para ver o erro completo" }] as HealthIssue[];
    }
  };
}

function buildGovernanceDetectors(ctx: DetectorContext) {
  return {
    detectDeadRules: () => detectDeadRules(ctx.rules, ctx.history),
    detectViolationHotspots: () => detectViolationHotspots(ctx.history),
    detectMissingDocs: () => detectMissingDocs(ctx.shitennoDir),
    detectOrphanDirs: () => detectOrphanDirs(ctx.shitennoDir),
    detectStaleBuffer: () => detectStaleBuffer(ctx.shitennoDir),
    detectDatePlaceholders: () => detectDatePlaceholders(ctx.shitennoDir),
    detectEmptyDirs: () => detectEmptyDirs(ctx.shitennoDir),
    detectBrokenRefs: () => detectBrokenRefs(ctx.shitennoDir),
    detectBrokenDirRefs: () => detectBrokenDirRefs(ctx.shitennoDir),
    detectNonBacktickFileRefs: () => detectNonBacktickFileRefs(ctx.shitennoDir),
    detectMissingGitignore: () => detectMissingGitignore(ctx.shitennoDir),
    detectMaturityInconsistency: () => detectMaturityInconsistency(ctx.shitennoDir),
    detectAdrCoverage: () => detectAdrCoverage(ctx.shitennoDir),
    detectMissingPackageJson: () => detectMissingPackageJson(ctx.shitennoDir),
    detectUnreferencedDirs: () => detectUnreferencedDirs(ctx.shitennoDir),
    detectReportNaming: () => detectReportNaming(ctx.shitennoDir),
    detectBareWordRefs: () => detectBareWordRefs(ctx.shitennoDir),
    detectTemplateDirRefs: () => detectTemplateDirRefs(ctx.shitennoDir),
    detectExtensionMismatch: () => detectExtensionMismatch(ctx.shitennoDir),
    detectSystemMapMismatch: () => detectSystemMapMismatch(ctx.shitennoDir),
    detectBrokenCommands: () => detectBrokenCommands(ctx.shitennoDir),
    detectP0Inconsistency: () => detectP0Inconsistency(ctx.shitennoDir),
    detectTripleMaturityScore: () => detectTripleMaturityScore(ctx.shitennoDir),
    detectEmptyStack: () => detectEmptyStack(ctx.shitennoDir),
    detectScriptWiring: () => detectScriptWiring(ctx.projectRoot, ctx.shitennoDir),
    detectAgentContractRefs: () => detectAgentContractRefs(ctx.shitennoDir),
    detectBufferSchemaMismatch: () => detectBufferSchemaMismatch(ctx.shitennoDir),
    detectRuleTypo: () => detectRuleTypo(ctx.shitennoDir),
    detectNumberingGap: () => detectNumberingGap(ctx.shitennoDir),
    detectDocCountMismatch: () => detectDocCountMismatch(ctx.shitennoDir),
    detectCrossDocP0Contradiction: () => detectCrossDocP0Contradiction(ctx.shitennoDir),
    detectEmptyDataFiles: () => detectEmptyDataFiles(ctx.shitennoDir),
    detectPhantomRuleRefs: () => detectPhantomRuleRefs(ctx.shitennoDir),
    detectOrphanSkills: () => detectOrphanSkills(ctx.shitennoDir),
  };
}

function buildEngineeringQualityDetectors(ctx: DetectorContext) {
  return {
    detectOrphanModules: () => detectOrphanModules(ctx.projectRoot, ctx.sourceFiles),
    detectComplexityHotspots: () => detectComplexityHotspots(ctx.projectRoot, ctx.sourceFiles),
    detectTestCoverageGaps: () => detectTestCoverageGaps(ctx.projectRoot, ctx.sourceFiles),
    detectConsoleUsage: () => detectConsoleUsage(ctx.projectRoot, ctx.sourceFiles),
    detectEmptyCatchBlocks: () => detectEmptyCatchBlocks(ctx.projectRoot, ctx.sourceFiles),
    detectHighComplexity: () => detectHighComplexity(ctx.projectRoot, ctx.sourceFiles),
    detectCircularDeps: () => detectCircularDeps(ctx.projectRoot, ctx.sourceFiles),
    detectUnusedExports: () => detectUnusedExports(ctx.projectRoot, ctx.sourceFiles),
    detectDeadCodePatterns: () => detectDeadCodePatterns(ctx.projectRoot, ctx.sourceFiles),
    detectTestHealth: () => detectTestHealth(ctx.projectRoot),
    detectLintIssues: () => detectLintIssues(ctx.projectRoot),
    detectTypeSafetyIssues: () => detectTypeSafetyIssues(ctx.projectRoot, ctx.sourceFiles),
    detectUnpinnedVersions: () => detectUnpinnedVersions(ctx.projectRoot),
    detectMissingLockFile: () => detectMissingLockFile(ctx.projectRoot),
    detectLockFileDrift: () => detectLockFileDrift(ctx.projectRoot),
    detectPhantomDependencies: () => detectPhantomDependencies(ctx.projectRoot, ctx.sourceFiles),
    detectDeprecatedPackages: () => detectDeprecatedPackages(ctx.projectRoot),
    detectDependencyVulnerabilities: () => detectDependencyVulnerabilities(ctx.projectRoot),
    detectIncompatibleLicenses: () => detectIncompatibleLicenses(ctx.projectRoot),
    detectConfigSecrets: () => detectConfigSecrets(ctx.projectRoot),
    detectHardcodedSecrets: () => detectHardcodedSecrets(ctx.projectRoot, ctx.sourceFiles),
    detectSQLInjection: () => detectSQLInjection(ctx.projectRoot, ctx.sourceFiles),
    detectXSS: () => detectXSS(ctx.projectRoot, ctx.sourceFiles),
    detectUnsafeEval: () => detectUnsafeEval(ctx.projectRoot, ctx.sourceFiles),
    detectConsoleSecrets: () => detectConsoleSecrets(ctx.projectRoot, ctx.sourceFiles),
    detectWeakCrypto: () => detectWeakCrypto(ctx.projectRoot, ctx.sourceFiles),
    detectInsecureHTTP: () => detectInsecureHTTP(ctx.projectRoot, ctx.sourceFiles),
    detectPrototypePollution: () => detectPrototypePollution(ctx.projectRoot, ctx.sourceFiles),
    detectPathTraversal: () => detectPathTraversal(ctx.projectRoot, ctx.sourceFiles),
    detectRegexDos: () => detectRegexDos(ctx.projectRoot, ctx.sourceFiles),
    detectUnsafeDeserialization: () => detectUnsafeDeserialization(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyConfusion: () => detectDependencyConfusion(ctx.projectRoot, ctx.sourceFiles),
    detectInsecureCORS: () => detectInsecureCORS(ctx.projectRoot, ctx.sourceFiles),
    detectInsecureCookies: () => detectInsecureCookies(ctx.projectRoot, ctx.sourceFiles),
    detectWeakRandomness: () => detectWeakRandomness(ctx.projectRoot, ctx.sourceFiles),
    detectTaintFlow: buildTaintDetector(ctx),
  };
}

function buildGitEnforcementDetectors(ctx: DetectorContext) {
  return {
    detectCommitFormat: () => detectCommitFormat(ctx.projectRoot),
    detectBranchNaming: () => detectBranchNaming(ctx.projectRoot),
    detectDirectMainCommits: () => detectDirectMainCommits(ctx.projectRoot),
    detectForcePushes: () => detectForcePushes(ctx.projectRoot),
    detectOrphanBranches: () => detectOrphanBranches(ctx.projectRoot),
    detectCommitLanguage: () => detectCommitLanguage(ctx.projectRoot),
    detectSecretsInGitHistory: () => detectSecretsInGitHistory(ctx.projectRoot),
    detectCommitWithoutGating: () => detectCommitWithoutGating(ctx.projectRoot),
    detectIncompleteSessionClose: () => detectIncompleteSessionClose(ctx.shitennoDir),
    detectMissingFeedback: () => detectMissingFeedback(ctx.shitennoDir),
    detectInvalidBacklogStates: () => detectInvalidBacklogStates(ctx.shitennoDir),
    detectPlanFormat: () => detectPlanFormat(ctx.shitennoDir),
    detectRuleExecutionCompliance: () => detectRuleExecutionCompliance(ctx.shitennoDir),
    detectPolicyStructure: () => detectPolicyStructure(ctx.shitennoDir),
    detectMissingPremortem: () => detectMissingPremortem(ctx.shitennoDir),
    detectMissingAdrForChanges: () => detectMissingAdrForChanges(ctx.shitennoDir),
    detectDonePlanIntegrity: () => detectDonePlanIntegrity(ctx.shitennoDir),
    detectMisclassifiedTier: () => detectMisclassifiedTier(ctx.shitennoDir),
    detectTierMismatches: () => detectTierMismatches(ctx.shitennoDir),
    detectJSDocCoverage: () => detectJSDocCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectUnsafeTypeAssertions: () => detectUnsafeTypeAssertions(ctx.projectRoot, ctx.sourceFiles),
    detectUnreachableCode: () => detectUnreachableCode(ctx.projectRoot, ctx.sourceFiles),
    detectUnusedImports: () => detectUnusedImports(ctx.projectRoot, ctx.sourceFiles),
    detectMagicNumbers: () => detectMagicNumbers(ctx.projectRoot, ctx.sourceFiles),
    detectLongParams: () => detectLongParams(ctx.projectRoot, ctx.sourceFiles),
    detectDeepNesting: () => detectDeepNesting(ctx.projectRoot, ctx.sourceFiles),
    detectDuplicateCode: () => detectDuplicateCode(ctx.projectRoot, ctx.sourceFiles),
    detectGodFunctions: () => detectGodFunctions(ctx.projectRoot, ctx.sourceFiles),
    detectCoverageThreshold: () => detectCoverageThreshold(ctx.projectRoot),
  };
}

function buildArchReliabilityDetectors(ctx: DetectorContext) {
  return {
    detectCleanArchitectureLayers: () => detectCleanArchitectureLayers(ctx.projectRoot, ctx.sourceFiles),
    detectSRPViolations: () => detectSRPViolations(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyInversion: () => detectDependencyInversion(ctx.projectRoot, ctx.sourceFiles),
    detectBarrelFileCycles: () => detectBarrelFileCycles(ctx.projectRoot, ctx.sourceFiles),
    detectModuleCoupling: () => detectModuleCoupling(ctx.projectRoot, ctx.sourceFiles),
    detectImportConsistency: () => detectImportConsistency(ctx.projectRoot, ctx.sourceFiles),
    detectTestStructure: () => detectTestStructure(ctx.projectRoot),
    detectVisionAlignment: () => detectVisionAlignment(ctx.projectRoot),
    detectRoadmapConsistency: () => detectRoadmapConsistency(ctx.projectRoot),
    detectKPICoverage: () => detectKPICoverage(ctx.projectRoot),
    detectOrphanRequirements: () => detectOrphanRequirements(ctx.projectRoot, ctx.sourceFiles),
    detectRequirementTraceability: () => detectRequirementTraceability(ctx.projectRoot, ctx.sourceFiles),
    detectAmbiguityPatterns: () => detectAmbiguityPatterns(ctx.projectRoot),
    detectSchemaConsistency: () => detectSchemaConsistency(ctx.projectRoot, ctx.sourceFiles),
    detectDataOwnership: () => detectDataOwnership(ctx.projectRoot),
    detectMissingMigrations: () => detectMissingMigrations(ctx.projectRoot, ctx.sourceFiles),
    detectIndexCoverage: () => detectIndexCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectCircuitBreaker: () => detectCircuitBreaker(ctx.projectRoot, ctx.sourceFiles),
    detectRetryPolicy: () => detectRetryPolicy(ctx.projectRoot, ctx.sourceFiles),
    detectTimeoutConfig: () => detectTimeoutConfig(ctx.projectRoot, ctx.sourceFiles),
    detectHealthChecks: () => detectHealthChecks(ctx.projectRoot),
    detectGracefulDegradation: () => detectGracefulDegradation(ctx.projectRoot, ctx.sourceFiles),
    detectRaceConditions: () => detectRaceConditions(ctx.projectRoot, ctx.sourceFiles),
    detectDeadlockRisk: () => detectDeadlockRisk(ctx.projectRoot, ctx.sourceFiles),
    detectNPlusOne: () => detectNPlusOne(ctx.projectRoot, ctx.sourceFiles),
    detectMissingCaching: () => detectMissingCaching(ctx.projectRoot, ctx.sourceFiles),
    detectStatefulServices: () => detectStatefulServices(ctx.projectRoot, ctx.sourceFiles),
    detectMissingRateLimiting: () => detectMissingRateLimiting(ctx.projectRoot, ctx.sourceFiles),
    detectMissingTimeouts: () => detectMissingTimeouts(ctx.projectRoot, ctx.sourceFiles),
  };
}

function buildOpsComplianceDetectors(ctx: DetectorContext) {
  return {
    detectMissingTracing: () => detectMissingTracing(ctx.projectRoot, ctx.sourceFiles),
    detectLogStructure: () => detectLogStructure(ctx.projectRoot, ctx.sourceFiles),
    detectAlertCoverage: () => detectAlertCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectMetricEndpoints: () => detectMetricEndpoints(ctx.projectRoot, ctx.sourceFiles),
    detectMissingDashboard: () => detectMissingDashboard(ctx.projectRoot, ctx.sourceFiles),
    detectLogRetention: () => detectLogRetention(ctx.projectRoot, ctx.sourceFiles),
    detectDistributedLogging: () => detectDistributedLogging(ctx.projectRoot, ctx.sourceFiles),
    detectSLODefinitions: () => detectSLODefinitions(ctx.projectRoot, ctx.sourceFiles),
    detectPipelineGaps: () => detectPipelineGaps(ctx.projectRoot, ctx.sourceFiles),
    detectRollbackCapability: () => detectRollbackCapability(ctx.projectRoot, ctx.sourceFiles),
    detectMissingRunbooks: () => detectMissingRunbooks(ctx.projectRoot, ctx.sourceFiles),
    detectMonitoringGaps: () => detectMonitoringGaps(ctx.projectRoot, ctx.sourceFiles),
    detectIncidentResponse: () => detectIncidentResponse(ctx.projectRoot, ctx.sourceFiles),
    detectDisasterRecovery: () => detectDisasterRecovery(ctx.projectRoot, ctx.sourceFiles),
    detectCapacityPlanning: () => detectCapacityPlanning(ctx.projectRoot, ctx.sourceFiles),
    detectChangeManagement: () => detectChangeManagement(ctx.projectRoot, ctx.sourceFiles),
    detectOWASPTop10: () => detectOWASPTop10(ctx.projectRoot, ctx.sourceFiles, []),
    detectCWEMapping: () => detectCWEMapping(ctx.projectRoot, ctx.sourceFiles, []),
    detectSOC2Controls: () => detectSOC2Controls(ctx.projectRoot, ctx.sourceFiles),
    detectNISTAlignment: () => detectNISTAlignment(ctx.projectRoot, ctx.sourceFiles),
    detectLGPDCompliance: () => detectLGPDCompliance(ctx.projectRoot, ctx.sourceFiles),
    detectDataRetention: () => detectDataRetention(ctx.projectRoot, ctx.sourceFiles),
    detectConsentTracking: () => detectConsentTracking(ctx.projectRoot, ctx.sourceFiles),
    detectSecretsInConfig: () => detectSecretsInConfig(ctx.projectRoot, ctx.sourceFiles),
    detectEncryptionAtRest: () => detectEncryptionAtRest(ctx.projectRoot, ctx.sourceFiles),
    detectAccessControls: () => detectAccessControls(ctx.projectRoot, ctx.sourceFiles),
    detectAuditLogging: () => detectAuditLogging(ctx.projectRoot, ctx.sourceFiles),
    detectComplianceReport: () => detectComplianceReport(ctx.projectRoot, ctx.sourceFiles),
  };
}

function buildSupplyChainTechDebtDetectors(ctx: DetectorContext) {
  return {
    detectSBOMCoverage: () => detectSBOMCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyProvenance: () => detectDependencyProvenance(ctx.projectRoot, ctx.sourceFiles),
    detectTyposquatting: () => detectTyposquatting(ctx.projectRoot, ctx.sourceFiles),
    detectLicenseConflicts: () => detectLicenseConflicts(ctx.projectRoot, ctx.sourceFiles),
    detectTransitiveVulns: () => detectTransitiveVulns(ctx.projectRoot, ctx.sourceFiles),
    detectMalwarePatterns: () => detectMalwarePatterns(ctx.projectRoot, ctx.sourceFiles),
    detectTechDebtCost: () => detectTechDebtCost(ctx.projectRoot, ctx.sourceFiles, []),
    detectTDR: () => detectTDR(ctx.projectRoot, ctx.sourceFiles, []),
    detectRemediationEffort: () => detectRemediationEffort(ctx.projectRoot, ctx.sourceFiles, []),
    detectDebtTrend: () => detectDebtTrend(ctx.projectRoot, ctx.sourceFiles),
    detectHotspotFiles: () => detectHotspotFiles(ctx.projectRoot, ctx.sourceFiles, []),
    detectDebtByDomain: () => detectDebtByDomain(ctx.projectRoot, ctx.sourceFiles, []),
    detectROIRefactoring: () => detectROIRefactoring(ctx.projectRoot, ctx.sourceFiles, []),
    detectDebtAccumulationRate: () => detectDebtAccumulationRate(ctx.projectRoot, ctx.sourceFiles),
    detectSBOMExists: () => detectSBOMExists(ctx.projectRoot, ctx.sourceFiles),
    detectSBOMCompleteness: () => detectSBOMCompleteness(ctx.projectRoot, ctx.sourceFiles),
    detectOutdatedDeps: () => detectOutdatedDeps(ctx.projectRoot, ctx.sourceFiles),
    detectUnusedDeps: () => detectUnusedDeps(ctx.projectRoot, ctx.sourceFiles),
    detectLockFileSync: () => detectLockFileSync(ctx.projectRoot, ctx.sourceFiles),
    detectDuplicateDeps: () => detectDuplicateDeps(ctx.projectRoot, ctx.sourceFiles),
    detectDepAuditStatus: () => detectDepAuditStatus(ctx.projectRoot, ctx.sourceFiles),
    detectAccessibilityGaps: () => detectAccessibilityGaps(ctx.projectRoot, ctx.sourceFiles),
    detectStaleVerification: () => detectStaleVerification(ctx.projectRoot, ctx.shitennoDir),
  };
}

function buildQualityDetectors(ctx: DetectorContext) {
  return {
    ...buildEngineeringQualityDetectors(ctx),
    ...buildGitEnforcementDetectors(ctx),
    ...buildArchReliabilityDetectors(ctx),
    ...buildOpsComplianceDetectors(ctx),
    ...buildSupplyChainTechDebtDetectors(ctx),
  };
}

interface BuildDetectorMapOptions {
  projectRoot: string;
  shitennoDir: string;
  sourceFiles: SourceFileInfo[];
  rules: string[];
  history: HistoryEntry[];
}

export function buildDetectorMap(
  options: BuildDetectorMapOptions
): Record<string, () => HealthIssue[] | Promise<HealthIssue[]>> {
  const { projectRoot, shitennoDir, sourceFiles, rules, history } = options;
  const ctx: DetectorContext = { projectRoot, shitennoDir, sourceFiles, rules, history };
  return { ...buildGovernanceDetectors(ctx), ...buildQualityDetectors(ctx) };
}
