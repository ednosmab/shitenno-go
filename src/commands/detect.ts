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

function outputHumanReadable(
  report: PatternDetectionReport,
  cacheHit: boolean,
  reportFile: string | null,
  shitennoDir: string,
): void {
  if (cacheHit) output(chalk.gray("  Used cached results"));
  output("");
  outputSection("Detection Results:");
  outputBlank();
  output(chalk.gray(`    History entries analyzed: ${report.historyEntriesAnalyzed}`));
  output(chalk.gray(`    Reports analyzed:        ${report.reportsAnalyzed}`));
  output(chalk.gray(`    Patterns detected:       ${report.patterns.length}`));
  output(chalk.gray(`    Candidate rules:         ${report.candidateRules.length}`));
  outputBlank();
  if (report.patterns.length === 0) { outputSuccess("No significant patterns detected. System is healthy."); outputBlank(); return; }
  outputSection("Patterns Found:");
  outputBlank();
  for (const pattern of report.patterns) displayPattern(pattern);
  displayCandidateRules(report.candidateRules);
  outputBlank();
  if (reportFile) { output(chalk.gray(`  Report saved: shitenno/reports/${reportFile}`)); outputBlank(); }
  outputSection("Summary:");
  output(chalk.gray(`    ${report.summary}`));
  outputBlank();
  const growthProfile = loadGrowthProfile(shitennoDir);
  output(formatGrowthProgress(growthProfile));
  outputBlank();
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

function recordCandidateRuleFeedback(report: PatternDetectionReport, shitennoDir: string): void {
  for (const rule of report.candidateRules) {
    recordFeedback(shitennoDir, {
      recommendationId: `rule-${rule.id}`,
      action: "deferred",
      context: { maturityScore: 0, installedCapabilities: [], knowledgeDebt: 0 },
    });
  }
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
      outputHumanReadable(report, cacheHit, reportFile, ctx.shitennoDir);
      publishDetectionEvent(report);
      recordCandidateRuleFeedback(report, ctx.shitennoDir);
    } catch (error) {
      handleDetectionError(error, isJson, isAuto, spinner);
    }
  });
