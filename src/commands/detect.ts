import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { detectPatterns, writePatternReport, type PatternDetectionReport } from "../pattern-detector.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { outputJson, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";
import { checkAndArchiveDonePlans } from "../plan-lifecycle.js";
import { output, outputBlank, outputSection, outputSuccess, outputError } from "../output.js";
import { logger, muteLogs } from "../logger.js";
// Semantic layer imports
import { runSemanticAnalysis, createSemanticDualPath, formatSemanticDualPath, formatSemanticDualPathJson } from "../semantic/index.js";
import type { SemanticInsight } from "../semantic/reasoner.js";
import type { Correlation } from "../semantic/correlator.js";
import type { DetectedPattern } from "../semantic/pattern-rules.js";

function handleApproveReject(
  options: { approve?: string; reject?: string },
  isJson: boolean,
  projectRoot: string,
  shitennoDir: string,
): boolean {
  if (!options.approve && !options.reject) return false;
  const ruleId = options.approve || options.reject!;
  const action = options.approve ? "approve" : "reject";
  const cached = getCached<PatternDetectionReport>({ projectRoot, key: "patterns",
    computeChecksumsFn: () => computeKeyChecksums(projectRoot, shitennoDir) });
  if (!cached) {
    if (isJson) {
      outputJson({ error: "no_report", message: "No detection report found. Run 'shugo detect' first." });
    } else {
      outputError("No detection report found.");
      output(chalk.gray("    Run 'shugo detect' first."));
    }
    return true;
  }
  const rule = cached.candidateRules.find((r) => r.id === ruleId);
  if (!rule) {
    if (isJson) {
      outputJson({ error: "rule_not_found", message: `Rule '${ruleId}' not found in candidate rules.` });
    } else {
      outputError(`Rule '${ruleId}' not found.`);
      output(chalk.gray("    Available rules:"));
      for (const r of cached.candidateRules) {
        output(chalk.gray(`      • ${r.id}: ${r.title}`));
      }
    }
    return true;
  }
  recordFeedback(shitennoDir, { recommendationId: `rule-${ruleId}`, action: action === "approve" ? "accepted" : "rejected", context: { maturityScore: 0, installedCapabilities: [], knowledgeDebt: 0 } });
  if (isJson) {
    outputJson({ type: "rule_decision", ruleId, action, rule });
  } else {
    const icon = action === "approve" ? "✅" : "❌";
    const color = action === "approve" ? chalk.green : chalk.red;
    output("");
    output(`${icon} ${color(`Rule ${ruleId} ${action}d`)}`);
    output(chalk.gray(`   Title: ${rule.title}`));
    output(chalk.gray(`   Target: ${rule.target}`));
    outputBlank();
  }
  return true;
}

function runDetection(projectRoot: string, shitennoDir: string, cacheEnabled: boolean): { report: PatternDetectionReport; reportFile: string | null; cacheHit: boolean } {
  let report: PatternDetectionReport;
  let cacheHit = false;
  if (cacheEnabled) {
    const cached = getCached<PatternDetectionReport>({ projectRoot, key: "patterns",
      computeChecksumsFn: () => computeKeyChecksums(projectRoot, shitennoDir) });
    if (cached) {
      report = cached;
      cacheHit = true;
    } else {
      report = detectPatterns(projectRoot, shitennoDir);
      setCache({ projectRoot, shitennoDir, key: "patterns", data: report,
        checksums: computeKeyChecksums(projectRoot, shitennoDir) });
    }
  } else {
    report = detectPatterns(projectRoot, shitennoDir);
  }
  const reportFile = writePatternReport(shitennoDir, report);
  return { report, reportFile, cacheHit };
}

function outputJsonReport(projectRoot: string, report: PatternDetectionReport, detectionResult: { cacheHit: boolean; reportFile: string | null }, shitennoDir: string): void {
  const growthProfile = loadGrowthProfile(shitennoDir);

  // Semantic layer data
  let semanticData: Record<string, unknown> = {};
  try {
    const { profile: semanticProfile, patterns: semanticPatterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);

    semanticData = {
      patterns: semanticPatterns.map((p) => ({
        id: p.id, type: p.type, domain: p.domain,
        confidence: p.confidence, description: p.description,
      })),
      insights: insights.map((i) => ({
        id: i.id, type: i.type, priority: i.priority,
        description: i.description, domains: i.domains,
      })),
      correlations: correlations.map((c) => ({
        id: c.id, type: c.type, strength: c.strength,
        description: c.description, confidence: c.confidence,
      })),
      dualPaths: semanticPatterns.slice(0, 3).map((p) =>
        formatSemanticDualPathJson(createSemanticDualPath(p as DetectedPattern, semanticProfile))
      ),
      growthProfile: {
        growthCapacity: semanticProfile.growthCapacity,
        challengeLevel: semanticProfile.challengeLevel,
        domainChallengeLevels: semanticProfile.domainChallengeLevels,
      },
    };
  } catch (err) {
    logger.warn("detect", `Semantic analysis failed for JSON: ${err}`);
  }

  outputJson({
    projectRoot,
    historyEntriesAnalyzed: report.historyEntriesAnalyzed,
    reportsAnalyzed: report.reportsAnalyzed,
    patterns: report.patterns,
    candidateRules: report.candidateRules,
    summary: report.summary,
    cacheHit: detectionResult.cacheHit,
    reportFile: detectionResult.reportFile || null,
    detectedAt: report.detectedAt,
    growthProfile: {
      growthCapacity: growthProfile.growthCapacity,
      challengeLevel: growthProfile.challengeLevel,
      pattern: growthProfile.patterns[0]?.type || "balanced",
      totalChoices: growthProfile.pathHistory.length,
    },
    semantic: semanticData,
  });
}

function outputMarkdownReport(report: PatternDetectionReport): void {
  const lines: string[] = [];
  lines.push(`# Pattern Detection Report`);
  lines.push(``);
  lines.push(`**Date:** ${report.detectedAt}`);
  lines.push(`**History entries:** ${report.historyEntriesAnalyzed}`);
  lines.push(`**Reports analyzed:** ${report.reportsAnalyzed}`);
  lines.push(``);
  if (report.patterns.length === 0) {
    lines.push(`✔ No significant patterns detected. System is healthy.`);
  } else {
    lines.push(`## Patterns (${report.patterns.length})`);
    lines.push(``);
    for (const p of report.patterns) {
      lines.push(`### ${p.description}`);
      lines.push(`- **Type:** ${p.type}`);
      lines.push(`- **Severity:** ${p.severity}/5`);
      lines.push(`- **Occurrences:** ${p.occurrences}`);
      lines.push(`- **Affected:** ${p.affectedArea}`);
      if (p.evidence.length > 0) {
        lines.push(`- **Evidence:**`);
        for (const ev of p.evidence) {
          lines.push(`  - ${ev}`);
        }
      }
      lines.push(``);
    }
  }
  if (report.candidateRules.length > 0) {
    lines.push(`## Candidate Rules (${report.candidateRules.length})`);
    lines.push(``);
    for (const r of report.candidateRules) {
      lines.push(`- **${r.id}:** ${r.title}`);
      lines.push(`  - Target: ${r.target}`);
      lines.push(`  - ${r.description}`);
    }
    lines.push(``);
  }
  lines.push(`## Summary`);
  lines.push(`${report.summary}`);
  lines.push(``);
  output(lines.join("\n"));
}

function displayPattern(pattern: PatternDetectionReport["patterns"][number]): void {
  const severityColor = pattern.severity >= 4 ? chalk.red : pattern.severity >= 2 ? chalk.yellow : chalk.gray;
  const icon = pattern.type === "recurring_error" ? "🔴" :
               pattern.type === "reverted_decision" ? "🟡" :
               pattern.type === "hot_area" ? "🟠" : "⚪";
  output(`    ${icon} ${chalk.bold(pattern.description)}`);
  output(chalk.gray(`       Type: ${pattern.type} | Severity: ${severityColor(pattern.severity + "/5")} | Occurrences: ${pattern.occurrences}`));
  output(chalk.gray(`       Affected: ${pattern.affectedArea}`));
  for (const ev of pattern.evidence.slice(0, 3)) {
    output(chalk.gray(`         • ${ev}`));
  }
  if (pattern.evidence.length > 3) {
    output(chalk.gray(`         ... and ${pattern.evidence.length - 3} more`));
  }
  outputBlank();
}

function displayCandidateRules(rules: PatternDetectionReport["candidateRules"]): void {
  if (rules.length === 0) return;
  outputSection("Candidate Rules (require Tech Lead approval):");
  outputBlank();
  for (const rule of rules) {
    output(chalk.cyan(`    ${rule.id}: ${rule.title}`));
    output(chalk.gray(`      Target: ${rule.target}`));
    output(chalk.gray(`      ${rule.description}`));
    output(chalk.gray(`      Rule: ${rule.ruleText}`));
    outputBlank();
  }
  output(chalk.yellow("  ⚠ These rules are PROPOSALS only. Aprovação manual do Tech Lead necessária."));
}

function displaySemanticPattern(pattern: DetectedPattern, idx: number): void {
  const confidence = Math.round(pattern.confidence * 100);
  const domainColors: Record<string, typeof chalk.green> = {
    security: chalk.red,
    authentication: chalk.red,
    architecture: chalk.cyan,
    performance: chalk.yellow,
    governance: chalk.magenta,
    documentation: chalk.blue,
  };
  const colorFn = domainColors[pattern.domain] ?? chalk.gray;
  const icon = pattern.type === "architectural_shift" ? "🏗️" :
               pattern.type === "scope_drift" ? "🔄" :
               pattern.type === "security_degradation" ? "🔒" :
               pattern.type === "tech_debt_accumulation" ? "📦" :
               pattern.type === "capability_gap" ? "🧩" :
               pattern.type === "maturity_regression" ? "📉" : "🔍";
  output(`    ${icon} ${chalk.bold(pattern.description)}`);
  output(chalk.gray(`       Domain: ${colorFn(pattern.domain)} | Confidence: ${chalk.cyan(confidence + "%")} | Type: ${pattern.type}`));
  if (pattern.suggestedActions.length > 0) {
    for (const action of pattern.suggestedActions.slice(0, 2)) {
      output(chalk.gray(`         → ${action}`));
    }
  }
  if (idx < 2) outputBlank(); // spacing between first few
}

function displayInsight(insight: SemanticInsight): void {
  const icon = insight.priority === "urgent" ? "🚨" :
               insight.priority === "high" ? "⚠️" :
               insight.priority === "medium" ? "💡" : "ℹ️";
  const priorityColor = insight.priority === "urgent" ? chalk.red :
                        insight.priority === "high" ? chalk.yellow : chalk.gray;
  output(`    ${icon} ${chalk.bold(insight.description)}`);
  output(chalk.gray(`       Priority: ${priorityColor(insight.priority)} | Domains: ${insight.domains.join(", ")}`));
  if (insight.suggestedActions.length > 0) {
    for (const action of insight.suggestedActions.slice(0, 2)) {
      output(chalk.gray(`         → ${action}`));
    }
  }
  outputBlank();
}

function displayCorrelation(corr: Correlation): void {
  const strengthIcon = corr.strength === "strong" ? "🔴" : corr.strength === "moderate" ? "🟡" : "🟢";
  output(`    ${strengthIcon} ${chalk.bold(corr.description)}`);
  output(chalk.gray(`       Type: ${corr.type} | Confidence: ${Math.round(corr.confidence * 100)}% | Strength: ${corr.strength}`));
  outputBlank();
}

function displaySemanticSection(projectRoot: string, shitennoDir: string): void {
  const { profile: semanticProfile, patterns: semanticPatterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
  if (semanticPatterns.length === 0 && insights.length === 0 && correlations.length === 0) return;

  outputSection("Semantic Analysis:");
  outputBlank();

  if (semanticPatterns.length > 0) {
    output(chalk.bold.cyan(`    📊 Semantic Patterns Detected (${semanticPatterns.length})`));
    outputBlank();
    for (let i = 0; i < Math.min(semanticPatterns.length, 5); i++) {
      const pattern = semanticPatterns[i];
      if (pattern) displaySemanticPattern(pattern, i);
    }
    if (semanticPatterns.length > 5) {
      output(chalk.gray(`       ... and ${semanticPatterns.length - 5} more`));
      outputBlank();
    }
    const firstPattern = semanticPatterns[0];
    if (firstPattern) {
      output(formatSemanticDualPath(createSemanticDualPath(firstPattern, semanticProfile)));
    }
  }

  for (const insight of insights.slice(0, 5)) displayInsight(insight);
  for (const corr of correlations.slice(0, 5)) displayCorrelation(corr);

  output(chalk.gray(`    Growth: capacity=${Math.round(semanticProfile.growthCapacity * 100)}% | challenge=${Math.round(semanticProfile.challengeLevel * 100)}% | choices=${semanticProfile.semanticChoices.length}`));
  outputBlank();
}

function displayDetectionSummary(report: PatternDetectionReport, reportFile: string | null): void {
  outputSection("Detection Results:");
  outputBlank();
  output(chalk.gray(`    History entries analyzed: ${report.historyEntriesAnalyzed}`));
  output(chalk.gray(`    Reports analyzed:        ${report.reportsAnalyzed}`));
  output(chalk.gray(`    Patterns detected:       ${report.patterns.length}`));
  output(chalk.gray(`    Candidate rules:         ${report.candidateRules.length}`));
  outputBlank();
  if (report.patterns.length === 0) {
    outputSuccess("No significant patterns detected. System is healthy.");
    outputBlank();
  } else {
    outputSection("Patterns Found:");
    outputBlank();
    for (const pattern of report.patterns) displayPattern(pattern);
    displayCandidateRules(report.candidateRules);
    outputBlank();
  }
  if (reportFile) { output(chalk.gray(`  Report saved: shitenno/reports/${reportFile}`)); outputBlank(); }
  outputSection("Summary:");
  output(chalk.gray(`    ${report.summary}`));
  outputBlank();
}

interface DetectHumanOutput {
  report: PatternDetectionReport;
  cacheHit: boolean;
  reportFile: string | null;
  shitennoDir: string;
  projectRoot: string;
}

function outputHumanReadable(ctx: DetectHumanOutput): void {
  const { report, cacheHit, reportFile, shitennoDir, projectRoot } = ctx;
  if (cacheHit) output(chalk.gray("  Used cached results"));
  output("");
  displayDetectionSummary(report, reportFile);
  output(formatGrowthProgress(loadGrowthProfile(shitennoDir)));
  outputBlank();
  try {
    displaySemanticSection(projectRoot, shitennoDir);
  } catch (err) {
    logger.warn("detect", `Semantic analysis failed: ${err}`);
  }
}

function publishDetectionEvent(report: PatternDetectionReport): void {
  const avgConfidence = report.patterns.length > 0
    ? report.patterns.reduce((sum, p) => sum + (p.severity / 5), 0) / report.patterns.length
    : 0;
  getEventBus().publish("pattern.detected", {
    patternType: report.patterns[0]?.type ?? "unknown",
    confidence: avgConfidence,
    patterns: report.patterns.map((p) => ({
      type: p.type,
      description: p.description,
      severity: p.severity,
    })),
  });
}

function recordCandidateRuleFeedback(_report: PatternDetectionReport, _shitennoDir: string): void {
  // Don't record automatic deferred feedback for candidate rules
  // Rules should only be recorded when the user explicitly approves/rejects them
  // via `shugo detect --approve <ruleId>` or `shugo detect --reject <ruleId>`
}

function handleAutoPlanArchiving(shitennoDir: string): void {
  try {
    const result = checkAndArchiveDonePlans(shitennoDir);
    if (result.archived > 0) logger.error("detect", `[shugo detect --auto] Archived ${result.archived} plan(s): ${result.archivedIds.join(", ")}`);
  } catch (err) {
    logger.error("detect", `[shugo detect --auto] Plan archiving failed: ${err}`);
  }
}

function handleDetectionError(error: unknown, isJson: boolean, isAuto: boolean, spinner: ReturnType<typeof ora> | null): void {
  if (isJson) outputJson({ error: "detection_failed", message: String(error) });
  else if (!isAuto) { spinner?.fail("Pattern detection failed"); outputError(`Error: ${error}`); outputBlank(); }
}

function initializeDetection(
  options: { json?: boolean; auto?: boolean; format?: string; dir?: string; approve?: string; reject?: string },
) {
  const isJson = options.json === true;
  if (isJson) muteLogs();
  const isAuto = options.auto === true;
  const format = isJson ? "json" : String(options.format || "text");
  if (!isJson && !isAuto) { output(""); banner("shugo detect", "Pattern Detection"); outputBlank(); }
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return null;
  if (!checkLifecycleGate("detect", ctx.projectRoot, ctx.shitennoDir, isJson)) return null;
  if (handleApproveReject(options, isJson, ctx.projectRoot, ctx.shitennoDir)) return null;
  if (isAuto) handleAutoPlanArchiving(ctx.shitennoDir);
  const spinner = isAuto ? null : ora("Analyzing history and reports...").start();
  return { ctx, isJson, isAuto, format, spinner };
}

export const detectCommand = new Command("detect")
  .description("Detect patterns in history and propose candidate rules (Phase 2)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--format <type>", "Output format: text, json, or markdown (default: text)")
  .option("--approve <ruleId>", "Approve a candidate rule by ID")
  .option("--reject <ruleId>", "Reject a candidate rule by ID")
  .option("--auto", "Non-interactive mode for git hooks (suppresses banner and spinner)")
  .action(async (options) => {
    const init = initializeDetection(options);
    if (!init) return;
    const { ctx, isJson, isAuto, format, spinner } = init;
    try {
      const { report, reportFile, cacheHit } = runDetection(ctx.projectRoot, ctx.shitennoDir, options.cache !== false);
      if (!isJson && !isAuto) spinner?.succeed(`Analyzed ${report.historyEntriesAnalyzed} history entries, ${report.reportsAnalyzed} reports`);
      if (format === "json") { outputJsonReport(ctx.projectRoot, report, { cacheHit, reportFile }, ctx.shitennoDir); return; }
      if (format === "markdown") { outputMarkdownReport(report); return; }
      outputHumanReadable({ report, cacheHit, reportFile, shitennoDir: ctx.shitennoDir, projectRoot: ctx.projectRoot });
      publishDetectionEvent(report);
      recordCandidateRuleFeedback(report, ctx.shitennoDir);
    } catch (error) {
      handleDetectionError(error, isJson, isAuto, spinner);
    }
  });
