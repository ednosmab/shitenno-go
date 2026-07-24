/**
 * briefing.ts — Context Pipeline: CLI Command
 *
 * The `shugo briefing` command. Orchestrates the full pipeline:
 * Collect → Cache → Generate → Output → Feedback
 *
 * Usage:
 *   shugo briefing                  # Cached briefing (standard depth)
 *   shugo briefing basic            # Quick briefing (~200 tokens)
 *   shugo briefing full             # Full briefing (~1000 tokens)
 *   shugo briefing --json           # JSON output
 *   shugo briefing --write          # Write shitenno/BRIEFING.md
 *   shugo briefing --diff           # Show diff since last briefing
 *   shugo briefing --invalidate     # Force cache invalidation
 *   shugo briefing --summary        # One-line summary
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { collectContext, type ContextSnapshot } from "../context-collector.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { computeInputHash, setCachedBriefing, invalidateBriefingCache, readCache } from "../briefing-cache.js";
import { briefingToMarkdown, briefingToJson, generateDiff, type Briefing } from "../briefing.js";
import { compressedSummary, differentialBriefing, generateOptimizationHints, suggestDepth, type BriefingDepth } from "../token-optimizer.js";

import { outputJson, banner } from "../formatting.js";
import { getEventBus } from "../event-bus.js";
import { output, outputBlank, outputSection } from "../output.js";
import { logger } from "../logger.js";
import { queryDaemon, isDaemonRunning } from "../daemon-client.js";
import { getPendingChallenges, markChallengeResolved, undoChallengeResolution, getActionCommand, type PendingChallenge } from "../challenge-responder.js";

// ── Output Helpers ─────────────────────────────────────────────────────────

function displayPendingChallenges(challenges: PendingChallenge[]): void {
  if (challenges.length === 0) return;
  outputBlank();
  outputSection("⚠️ Pending Challenges");
  for (const c of challenges) {
    const sevIcon = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
    output(`     ${sevIcon} ${c.id}: ${c.message || c.type} (${c.suggestedActions[0]})`);
  }
  outputBlank();
}

function writeBriefingMarkdown(projectRoot: string, briefing: Briefing): string {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  if (!existsSync(shitennoDir)) {
    mkdirSync(shitennoDir, { recursive: true });
  }

  const filePath = join(shitennoDir, "BRIEFING.md");
  const content = briefingToMarkdown(briefing);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function displayProjectIdentity(briefing: Briefing, depth: BriefingDepth): void {
  outputSection("Project Identity");
  output(`     Domain:   ${chalk.cyan(briefing.project.domain)}`);
  output(`     Scale:    ${chalk.cyan(briefing.project.scale)}`);
  output(`     Stack:    ${briefing.project.stack.join(", ")}`);
  if (depth !== "minimal") output(`     Maturity: ${briefing.project.maturityScore}/100`);
  outputBlank();
}

function displayRiskStatus(briefing: Briefing, depth: BriefingDepth): void {
  const riskColor = briefing.risks.overall === "critical" ? chalk.red :
                    briefing.risks.overall === "high" ? chalk.yellow :
                    briefing.risks.overall === "medium" ? chalk.hex("#FFA500") : chalk.green;
  outputSection("Risk Status");
  output(`     Overall:  ${riskColor(briefing.risks.overall)}`);
  if (briefing.risks.criticalAreas.length > 0) output(chalk.red(`     Critical: ${briefing.risks.criticalAreas.join(", ")}`));
  if (depth !== "minimal" && briefing.risks.highAreas.length > 0) output(chalk.yellow(`     High:     ${briefing.risks.highAreas.join(", ")}`));
  outputBlank();
}

function displayTestCoverage(briefing: Briefing): void {
  outputSection("Test Coverage");
  output(`     Has Tests: ${briefing.tests.hasTests ? chalk.green("Yes") : chalk.red("No")}`);
  if (briefing.tests.areasWithoutTests.length > 0) output(chalk.yellow(`     Without Tests: ${briefing.tests.areasWithoutTests.length} area(s)`));
  outputBlank();
}

function displayRecentActivity(briefing: Briefing): void {
  if (!briefing.recentActivity || briefing.recentActivity.events.length === 0) return;
  outputSection("Actividade Recente (24h)");
  for (const event of briefing.recentActivity.events.slice(0, 5)) {
    const time = event.timestamp.slice(11, 16);
    const color = event.type.includes("error") || event.type.includes("warning") ? chalk.red : chalk.gray;
    output(color(`     ${time} ${event.type}: ${event.summary}`));
  }
  output(chalk.gray(`     ${briefing.recentActivity.syncCount} sincronizações, ${briefing.recentActivity.errorCount} erros`));
  outputBlank();
}

function displayRules(briefing: Briefing, depth: BriefingDepth): void {
  if (depth === "minimal") return;
  if (briefing.contextRules.length > 0) {
    outputSection(depth === "full" ? "Context Rules (Top)" : "Context Rules");
    for (const rule of briefing.contextRules) output(chalk.gray(`     • ${rule.rule}`));
    outputBlank();
  }
  if (depth === "full" && briefing.dynamicRules.length > 0) {
    outputSection("Dynamic Rules (From History)");
    for (const rule of briefing.dynamicRules) {
      const icon = rule.severity === "critical" ? "🚨" : rule.severity === "high" ? "⚠️" : "ℹ️";
      output(chalk.gray(`     ${icon} [${rule.severity}] ${rule.rule}`));
    }
    outputBlank();
  }
}

function displayPatterns(briefing: Briefing): void {
  if (briefing.patterns.recurringErrors.length > 0) {
    outputSection("Recurring Error Hotspots");
    for (const area of briefing.patterns.recurringErrors) output(chalk.red(`     • ${area}`));
    outputBlank();
  }
  if (briefing.patterns.detected.length > 0) {
    outputSection("Detected Patterns");
    for (const p of briefing.patterns.detected) {
      const icon = p.severity >= 4 ? "🚨" : p.severity >= 2 ? "⚠️" : "ℹ️";
      output(chalk.gray(`     ${icon} [${p.type}] ${p.description}`));
    }
    outputBlank();
  }
}

function displayRecommendations(briefing: Briefing, depth: BriefingDepth): void {
  const maxRecs = depth === "minimal" ? 1 : depth === "standard" ? 3 : briefing.recommendations.length;
  outputSection("Recommendations");
  for (const rec of briefing.recommendations.slice(0, maxRecs)) output(chalk.cyan(`     → ${rec}`));
  outputBlank();
}

function displayTokenEconomy(briefing: Briefing, depth: BriefingDepth, cacheHit: boolean): void {
  if (depth === "minimal") {
    if (cacheHit) { output(chalk.gray("  Cached")); outputBlank(); }
    return;
  }
  if (cacheHit) { output(chalk.gray("  Used cached briefing")); outputBlank(); }
  outputSection("Token Economy");
  output(chalk.green(`     Saved: ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()} tokens vs manual discovery`));
  outputBlank();
}

function displayBriefingByDepth(briefing: Briefing, cacheHit: boolean, depth: BriefingDepth): void {
  outputBlank();
  banner("shugo briefing", "Context Pipeline");
  outputBlank();
  const tokenLabel = depth === "minimal" ? "~200" : depth === "standard" ? "~500" : "~1000";
  output(chalk.gray(`  Depth: ${depth} (${tokenLabel} tokens)`));
  outputBlank();

  displayProjectIdentity(briefing, depth);
  displayRiskStatus(briefing, depth);
  if (depth !== "minimal") displayTestCoverage(briefing);
  if (depth !== "minimal") displayRecentActivity(briefing);
  displayRules(briefing, depth);
  if (depth === "full") displayPatterns(briefing);
  displayRecommendations(briefing, depth);
  displayTokenEconomy(briefing, depth, cacheHit);

  output(chalk.gray(`  Generated: ${briefing.generatedAt}`));
  outputBlank();
}

// ── Interactive Challenge Prompt ────────────────────────────────────────────

function buildChallengeChoices(challenges: PendingChallenge[]): Array<{ name: string; value: { challengeIndex: number; action: string; execute?: boolean } }> {
  const choices: Array<{ name: string; value: { challengeIndex: number; action: string; execute?: boolean } }> = [];
  for (let idx = 0; idx < challenges.length; idx++) {
    const c = challenges[idx]!;
    const sevIcon = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
    for (const action of c.suggestedActions) {
      const cmd = getActionCommand(action);
      choices.push({ name: `${sevIcon} [${c.id}] ${action}`, value: { challengeIndex: idx, action, execute: false } });
      if (cmd) choices.push({ name: `   ↳ Execute now: ${cmd}`, value: { challengeIndex: idx, action, execute: true } });
    }
  }
  choices.push({ name: "   Skip all challenges", value: { challengeIndex: -1, action: "skip", execute: false } });
  choices.push({ name: "   ↩ Undo last resolution", value: { challengeIndex: -2, action: "undo", execute: false } });
  return choices;
}

async function handleChallengeSelection(
  shitennoDir: string,
  selection: { challengeIndex: number; action: string; execute?: boolean },
): Promise<void> {
  if (selection.execute) {
    const cmd = getActionCommand(selection.action);
    if (!cmd) return;
    const inquirer = await import("inquirer");
    const { confirm } = await inquirer.default.prompt([{ type: "confirm", name: "confirm", message: `Execute: ${cmd}?`, default: false }]);
    if (!confirm) { output(chalk.gray("  Skipped.")); return; }
    const { execSync } = await import("node:child_process");
    try {
      output(chalk.gray(`  Running: ${cmd}`));
      execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
      output(chalk.green(`  ✓ Command completed`));
    } catch (error) { output(chalk.red(`  ✗ Command failed: ${error}`)); }
  } else {
    markChallengeResolved(shitennoDir, selection.challengeIndex, selection.action);
    output(chalk.green(`  ✓ Challenge resolved: ${selection.action}`));
  }
  outputBlank();
}

function findLastResolvedChallenge(shitennoDir: string): number {
  try {
    const stateRaw = readFileSync(join(shitennoDir, "daemon", "daemon-state.json"), "utf-8");
    const state = JSON.parse(stateRaw) as Record<string, unknown>;
    const chs = state.challenges as Array<Record<string, unknown>>;
    for (let i = chs.length - 1; i >= 0; i--) { if (chs[i]?.resolved === true) return i; }
  } catch (err) {
    logger.debug("briefing", `Failed to read daemon state for challenge count: ${err}`);
  }
  return -1;
}

async function promptForChallenges(shitennoDir: string, noInteractive: boolean): Promise<void> {
  const challenges = getPendingChallenges(shitennoDir);
  if (challenges.length === 0 || noInteractive) return;
  const inquirer = await import("inquirer");
  const choices = buildChallengeChoices(challenges);
  const { selection } = await inquirer.default.prompt([{ type: "list", name: "selection", message: "Pending challenges — what would you like to do?", choices, pageSize: 30 }]);

  if (selection.challengeIndex >= 0) {
    await handleChallengeSelection(shitennoDir, selection);
  } else if (selection.action === "undo") {
    const resolvedIdx = findLastResolvedChallenge(shitennoDir);
    if (resolvedIdx < 0) { output(chalk.gray("  No resolved challenges to undo.")); } else {
      const undone = undoChallengeResolution(shitennoDir, resolvedIdx);
      output(undone ? chalk.yellow(`  ↩ Undone: ${undone.type} (${undone.id})`) : chalk.red("  Failed to undo resolution."));
    }
    outputBlank();
  }
}

interface BriefingOptions {
  dir?: string;
  json?: boolean;
  write?: boolean;
  diff?: boolean;
  compact?: boolean;
  invalidate?: boolean;
  summary?: boolean;
  profile?: string;
  noInteractive?: boolean;
}

async function collectBriefingData(
  projectRoot: string,
  shitennoDir: string
): Promise<{ briefing: Briefing; snapshot: ReturnType<typeof collectContext> }> {
  if (isDaemonRunning(shitennoDir)) {
    const daemonResult = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    if (daemonResult?.data) {
      const briefing = daemonResult.data;
      const snapshot = { briefing, contextRules: [], dynamicRules: [], fingerprint: { hash: "" }, riskMap: { generatedAt: "" }, collectedAt: new Date().toISOString(), inputHash: "", maturityProfile: null } as unknown as ContextSnapshot;
      return { briefing, snapshot };
    }
  }
  const snapshot = collectContext(projectRoot, shitennoDir);
  return { briefing: snapshot.briefing, snapshot };
}

function cacheBriefing(
  shitennoDir: string,
  briefing: Briefing,
  snapshot: ReturnType<typeof collectContext>,
  invalidate: boolean
): { briefing: Briefing; cacheHit: boolean; inputHash: string; previousBriefing: Briefing | null } {
  const newInputHash = computeInputHash({
    fingerprintHash: snapshot.fingerprint.hash,
    riskMapHash: snapshot.riskMap.generatedAt,
    contextRuleCount: snapshot.contextRules.length,
    dynamicRuleCount: snapshot.dynamicRules.length,
    maturityScore: snapshot.maturityProfile?.overallScore ?? null,
  });

  const oldCache = readCache(shitennoDir);
  const previousBriefing = oldCache?.entry?.briefing ?? null;

  if (invalidate) {
    invalidateBriefingCache(shitennoDir);
  }

  let cacheHit = false;

  if (!invalidate && oldCache?.entry && oldCache.entry.inputHash === newInputHash) {
    briefing = oldCache.entry.briefing;
    cacheHit = true;
  }

  if (!cacheHit) {
    setCachedBriefing(shitennoDir, briefing, newInputHash);
  }

  return { briefing, cacheHit, inputHash: newInputHash, previousBriefing };
}

function displayCompactBriefing(
  previousBriefing: Briefing,
  briefing: Briefing,
  isJson: boolean
): void {
  const compactDiff = differentialBriefing(previousBriefing, briefing);
  if (isJson) {
    outputJson({
      type: "diff",
      format: "compact",
      oldTimestamp: previousBriefing.generatedAt,
      newTimestamp: briefing.generatedAt,
      diff: compactDiff,
    });
  } else {
    output(chalk.cyan(`  Compact diff: ${compactDiff}`));
  }
}

function handleDiffMode(
  briefing: Briefing,
  previousBriefing: Briefing | null,
  isJson: boolean,
  compact: boolean
): boolean {
  if (!previousBriefing || previousBriefing.generatedAt === briefing.generatedAt) {
    const msg = "No previous briefing to diff against.";
    if (isJson) {
      outputJson({ type: "diff", message: msg });
    } else {
      output(chalk.gray(`  ${msg}`));
    }
    return true;
  }

  if (compact) {
    displayCompactBriefing(previousBriefing, briefing, isJson);
  } else {
    const diff = generateDiff(previousBriefing, briefing);
    if (isJson) {
      outputJson({
        type: "diff",
        oldTimestamp: previousBriefing.generatedAt,
        newTimestamp: briefing.generatedAt,
        diff,
      });
    } else {
      output(diff);
    }
  }
  return true;
}

function handleSummaryMode(
  briefing: Briefing,
  isJson: boolean,
  cacheHit: boolean
): boolean {
  const summary = compressedSummary(briefing);
  if (isJson) {
    outputJson({ type: "summary", summary, cacheHit });
  } else {
    output(summary);
  }
  return true;
}

function determineBriefingDepth(
  briefing: Briefing,
  forcedDepth: BriefingDepth | undefined,
  profile: string | undefined
): BriefingDepth {
  if (forcedDepth) {
    return forcedDepth;
  }
  if (profile === "minimal" || profile === "standard" || profile === "full") {
    return profile;
  }
  return suggestDepth(
    briefing.risks.overall,
    briefing.risks.criticalAreas.length > 0,
    briefing.risks.criticalAreas.length + briefing.risks.highAreas.length
  );
}

interface DisplayFullBriefingOptions {
  briefing: Briefing;
  isJson: boolean;
  cacheHit: boolean;
  inputHash: string;
  depth: BriefingDepth;
  projectRoot: string;
  write: boolean;
  noInteractive?: boolean;
  shitennoDir?: string;
}

function displayFullBriefing(options: DisplayFullBriefingOptions): void {
  const { briefing, isJson, cacheHit, inputHash, depth, projectRoot, write, shitennoDir } = options;
  const hints = generateOptimizationHints(briefing);

  if (isJson) {
    const jsonData: Record<string, unknown> = {
      ...briefingToJson(briefing),
      cacheHit,
      inputHash,
      optimization: {
        depth,
        suggestedDepth: hints.suggestedDepth,
        tokenEstimates: hints.tokenEstimates,
        skipSections: hints.skipSections,
        compressSections: hints.compressSections,
      },
    };

    // Include challenges in JSON output
    if (shitennoDir) {
      const challenges = getPendingChallenges(shitennoDir);
      if (challenges.length > 0) {
        jsonData.pendingChallenges = challenges.map((c) => ({
          id: c.id,
          type: c.type,
          severity: c.severity,
          message: c.message,
          generatedAt: c.generatedAt,
          suggestedActions: c.suggestedActions,
          suggestedCommand: getActionCommand(c.suggestedActions[0] ?? ""),
        }));
        jsonData.pendingChallengeCount = challenges.length;
      }
    }

    outputJson(jsonData);
    return;
  }

  if (write) {
    const filePath = writeBriefingMarkdown(projectRoot, briefing);
    output(chalk.green(`  Briefing written to ${filePath}`));
    outputBlank();
  }

  displayBriefingByDepth(briefing, cacheHit, depth);

  // Display challenges section (non-interactive listing)
  if (shitennoDir) {
    const challenges = getPendingChallenges(shitennoDir);
    if (challenges.length > 0) {
      displayPendingChallenges(challenges);
    }
  }
}

async function runBriefing(options: BriefingOptions, forcedDepth?: BriefingDepth): Promise<void> {
  const isJson = options.json === true;
  if (!isJson) { output(""); outputSection("shugo briefing — Context Pipeline"); outputBlank(); }
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return;
  if (!checkLifecycleGate("briefing", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
  const spinner = ora({ spinner: "dots" }).start(isJson ? "Generating" : "Collecting context...");
  try {
    const { briefing: initialBriefing, snapshot } = await collectBriefingData(ctx.projectRoot, ctx.shitennoDir);
    const { briefing, cacheHit, inputHash, previousBriefing } = cacheBriefing(ctx.shitennoDir, initialBriefing, snapshot, options.invalidate === true);
    if (options.invalidate) spinner.text = "Cache invalidated, using fresh briefing...";
    spinner.stop();
    if (options.diff) { handleDiffMode(briefing, previousBriefing, isJson, options.compact === true); return; }
    if (options.summary) { handleSummaryMode(briefing, isJson, cacheHit); return; }
    const depth = determineBriefingDepth(briefing, forcedDepth, options.profile as string | undefined);
    displayFullBriefing({ briefing, isJson, cacheHit, inputHash, depth, projectRoot: ctx.projectRoot, write: options.write === true, noInteractive: options.noInteractive === true, shitennoDir: ctx.shitennoDir });
    await promptForChallenges(ctx.shitennoDir, options.noInteractive === true);
    getEventBus().publish("analysis.complete", { type: "briefing", cacheHit, risk: briefing.risks.overall, domain: briefing.project.domain });
  } catch (error) {
    spinner.fail("Failed to generate briefing");
    if (isJson) outputJson({ error: "briefing_failed", message: String(error) });
    else logger.error("briefing", `Error: ${error}`);
  }
}

// ── Command ────────────────────────────────────────────────────────────────

export function briefingCommand(): Command {
  const cmd = new Command("briefing")
    .description("Pre-session briefing for AI agents (Context Pipeline)")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write shitenno/BRIEFING.md")
    .option("--diff", "Show diff since last briefing")
    .option("--compact", "Use compact diff format (fewer tokens)")
    .option("--invalidate", "Force cache invalidation")
    .option("--summary", "One-line summary")
    .option("--no-interactive", "Disable interactive challenge prompt")
    .option("--profile <depth>", "Briefing depth: minimal, standard, full (default: auto)")
    .option("--watch [seconds]", "Regenerate briefing periodically (default: 30s)")
    .action((options: Record<string, unknown>) => {
      return runBriefing(options as BriefingOptions);
    });

  // ── basic subcommand ───────────────────────────────────────────────────
  cmd
    .command("basic")
    .description("Quick briefing (~200 tokens): project, risk, 1 recommendation")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write shitenno/BRIEFING.md")
    .action((options: Record<string, unknown>) => {
      return runBriefing(options as BriefingOptions, "minimal");
    });

  // ── full subcommand ────────────────────────────────────────────────────
  cmd
    .command("full")
    .description("Full briefing (~1000 tokens): everything including recent activity")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write shitenno/BRIEFING.md")
    .option("--diff", "Show diff since last briefing")
    .option("--invalidate", "Force cache invalidation")
    .action((options: Record<string, unknown>) => {
      return runBriefing(options as BriefingOptions, "full");
    });

  return cmd;
}
