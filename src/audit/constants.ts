/**
 * Audit module — Constants
 *
 * All shared constants for the health audit system.
 */

import type { AuditLevel } from "./types.js";

// ── Engineering Audit Constants ───────────────────────────────────────────────

export const ORPHAN_SEVERITY_THRESHOLD = 200;
export const OVERSIZED_WARNING_THRESHOLD = 1000;
export const OVERSIZED_INFO_THRESHOLD = 500;
export const MISSING_TEST_WARNING_THRESHOLD = 10;
export const ANY_TYPE_SEVERITY_THRESHOLD = 10;

// ── Source File Patterns ─────────────────────────────────────────────────────

export const SOURCE_SKIP_PATTERNS = [/\.test\.ts$/, /\.bench\.ts$/, /index\.ts$/];

// ── Violation Keywords ───────────────────────────────────────────────────────

export const VIOLATION_KEYWORDS = ["erro", "bug", "corrigi", "falhou", "rollback", "violação", "violated", "revert", "broken", "regression", "incidente", "problema"];

// ── Blocked Licenses ─────────────────────────────────────────────────────────

export const BLOCKED_LICENSES = ["GPL-3.0", "AGPL-3.0", "SSPL-1.0", "EUPL-1.1"];

// ── Security Detector Self-Paths ─────────────────────────────────────────────

export const SECURITY_DETECTOR_SELF_PATHS = ["src/health-auditor.ts", "src/audit/taint/", "src/audit/engineering-detectors.ts"];

// ── Complexity Thresholds ────────────────────────────────────────────────────

export const COMPLEXITY_WARNING_THRESHOLD = 15;
export const COMPLEXITY_CRITICAL_THRESHOLD = 25;

// ── Placeholder Names ────────────────────────────────────────────────────────

export const PLACEHOLDER_NAMES = new Set(["TEMPLATE.md", "RULE-TEMPLATE.json", ".gitkeep", "README.md"]);

// ── Detectors by Audit Level ─────────────────────────────────────────────────

export const DETECTORS_BY_LEVEL: Record<AuditLevel, string[]> = {
  quick: [
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
  ],
  standard: [
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
    "detectBrokenRefs",
    "detectBrokenDirRefs",
    "detectNonBacktickFileRefs",
    "detectEmptyDirs",
    "detectOrphanDirs",
    "detectBareWordRefs",
    "detectExtensionMismatch",
    "detectReportNaming",
    "detectTemplateDirRefs",
    "detectAdrCoverage",
    "detectUnreferencedDirs",
    "detectP0Inconsistency",
    "detectViolationHotspots",
    "detectOrphanModules",
    "detectComplexityHotspots",
    "detectTestCoverageGaps",
    "detectConsoleUsage",
    "detectEmptyCatchBlocks",
    "detectHighComplexity",
    "detectUnusedExports",
    "detectDeadCodePatterns",
  ],
  full: [
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
    "detectBrokenRefs",
    "detectBrokenDirRefs",
    "detectNonBacktickFileRefs",
    "detectEmptyDirs",
    "detectOrphanDirs",
    "detectBareWordRefs",
    "detectExtensionMismatch",
    "detectReportNaming",
    "detectTemplateDirRefs",
    "detectAdrCoverage",
    "detectUnreferencedDirs",
    "detectP0Inconsistency",
    "detectDeadRules",
    "detectViolationHotspots",
    "detectSystemMapMismatch",
    "detectBrokenCommands",
    "detectTripleMaturityScore",
    "detectEmptyStack",
    "detectScriptWiring",
    "detectAgentContractRefs",
    "detectBufferSchemaMismatch",
    "detectRuleTypo",
    "detectNumberingGap",
    "detectDocCountMismatch",
    "detectCrossDocP0Contradiction",
    "detectEmptyDataFiles",
    "detectPhantomRuleRefs",
    "detectOrphanModules",
    "detectComplexityHotspots",
    "detectTestCoverageGaps",
    "detectConsoleUsage",
    "detectEmptyCatchBlocks",
    "detectHighComplexity",
    "detectUnusedExports",
    "detectDeadCodePatterns",
    "detectCircularDeps",
    "detectTestHealth",
    "detectLintIssues",
    "detectTypeSafetyIssues",
    // Supply chain detectors
    "detectUnpinnedVersions",
    "detectMissingLockFile",
    "detectLockFileDrift",
    "detectPhantomDependencies",
    "detectDeprecatedPackages",
    // Taint analysis
    "detectTaintFlow",
    // Security patterns (SEC-*)
    "detectHardcodedSecrets",
    "detectSQLInjection",
    "detectXSS",
    "detectUnsafeEval",
    "detectConsoleSecrets",
    "detectWeakCrypto",
    "detectInsecureHTTP",
    "detectPrototypePollution",
    "detectPathTraversal",
    "detectRegexDos",
    "detectUnsafeDeserialization",
    "detectDependencyConfusion",
    // Dependency & license detectors (DEND-*, LIC-*)
    "detectDependencyVulnerabilities",
    "detectIncompatibleLicenses",
    // Environment config (ENV-*)
    "detectConfigSecrets",
    // Git Intelligence (GIT-*)
    "detectCommitFormat",
    "detectBranchNaming",
    "detectDirectMainCommits",
    "detectForcePushes",
    "detectOrphanBranches",
    "detectCommitLanguage",
    "detectSecretsInGitHistory",
    "detectCommitWithoutGating",
    // Governance Enforcement (GOV-*)
    "detectIncompleteSessionClose",
    "detectMissingFeedback",
    "detectInvalidBacklogStates",
    "detectPlanFormat",
    "detectRuleExecutionCompliance",
    "detectPolicyStructure",
    "detectMissingPremortem",
    "detectMissingAdrForChanges",
    // Code Quality Intelligence (CQ-*)
    "detectJSDocCoverage",
    "detectUnsafeTypeAssertions",
    "detectUnreachableCode",
    "detectUnusedImports",
    "detectMagicNumbers",
    "detectLongParams",
    "detectDeepNesting",
    "detectDuplicateCode",
    "detectGodFunctions",
    "detectCoverageThreshold",
    // Architecture Validation (ARCH-*)
    "detectCleanArchitectureLayers",
    "detectSRPViolations",
    "detectDependencyInversion",
    "detectBarrelFileCycles",
    "detectModuleCoupling",
    "detectImportConsistency",
    "detectTestStructure",
  ],
  "code-review": [
    // All full-level detectors
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
    "detectBrokenRefs",
    "detectBrokenDirRefs",
    "detectNonBacktickFileRefs",
    "detectEmptyDirs",
    "detectOrphanDirs",
    "detectBareWordRefs",
    "detectExtensionMismatch",
    "detectReportNaming",
    "detectTemplateDirRefs",
    "detectAdrCoverage",
    "detectUnreferencedDirs",
    "detectP0Inconsistency",
    "detectDeadRules",
    "detectViolationHotspots",
    "detectSystemMapMismatch",
    "detectBrokenCommands",
    "detectTripleMaturityScore",
    "detectEmptyStack",
    "detectScriptWiring",
    "detectAgentContractRefs",
    "detectBufferSchemaMismatch",
    "detectRuleTypo",
    "detectNumberingGap",
    "detectDocCountMismatch",
    "detectCrossDocP0Contradiction",
    "detectEmptyDataFiles",
    "detectPhantomRuleRefs",
    "detectOrphanModules",
    "detectComplexityHotspots",
    "detectTestCoverageGaps",
    "detectConsoleUsage",
    "detectEmptyCatchBlocks",
    "detectHighComplexity",
    "detectUnusedExports",
    "detectDeadCodePatterns",
    "detectCircularDeps",
    "detectTestHealth",
    "detectLintIssues",
    "detectTypeSafetyIssues",
    "detectUnpinnedVersions",
    "detectMissingLockFile",
    "detectLockFileDrift",
    "detectPhantomDependencies",
    "detectDeprecatedPackages",
    "detectTaintFlow",
    "detectHardcodedSecrets",
    "detectSQLInjection",
    "detectXSS",
    "detectUnsafeEval",
    "detectConsoleSecrets",
    "detectWeakCrypto",
    "detectInsecureHTTP",
    "detectPrototypePollution",
    "detectPathTraversal",
    "detectRegexDos",
    "detectUnsafeDeserialization",
    "detectDependencyConfusion",
    "detectDependencyVulnerabilities",
    "detectIncompatibleLicenses",
    "detectConfigSecrets",
    // Git Intelligence (GIT-*)
    "detectCommitFormat",
    "detectBranchNaming",
    "detectDirectMainCommits",
    "detectForcePushes",
    "detectOrphanBranches",
    "detectCommitLanguage",
    "detectSecretsInGitHistory",
    "detectCommitWithoutGating",
    // Governance Enforcement (GOV-*)
    "detectIncompleteSessionClose",
    "detectMissingFeedback",
    "detectInvalidBacklogStates",
    "detectPlanFormat",
    "detectRuleExecutionCompliance",
    "detectPolicyStructure",
    "detectMissingPremortem",
    "detectMissingAdrForChanges",
    // Code Quality Intelligence (CQ-*)
    "detectJSDocCoverage",
    "detectUnsafeTypeAssertions",
    "detectUnreachableCode",
    "detectUnusedImports",
    "detectMagicNumbers",
    "detectLongParams",
    "detectDeepNesting",
    "detectDuplicateCode",
    "detectGodFunctions",
    "detectCoverageThreshold",
    // Architecture Validation (ARCH-*)
    "detectCleanArchitectureLayers",
    "detectSRPViolations",
    "detectDependencyInversion",
    "detectBarrelFileCycles",
    "detectModuleCoupling",
    "detectImportConsistency",
    "detectTestStructure",
  ],
};
