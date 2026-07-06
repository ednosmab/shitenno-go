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
