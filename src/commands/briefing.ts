/**
 * briefing.ts — Context Pipeline: CLI Command
 *
 * The `nexus briefing` command. Orchestrates the full pipeline:
 * Collect → Cache → Generate → Output → Feedback
 *
 * Usage:
 *   nexus briefing                  # Cached briefing (markdown)
 *   nexus briefing --json           # JSON output
 *   nexus briefing --write          # Write .nexus/BRIEFING.md
 *   nexus briefing --diff           # Show diff since last briefing
 *   nexus briefing --invalidate     # Force cache invalidation
 *   nexus briefing --summary        # One-line summary
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { collectContext } from "../context-collector.js";
import { computeInputHash, setCachedBriefing, invalidateBriefingCache, readCache } from "../briefing-cache.js";
import { briefingToMarkdown, briefingToJson, generateDiff, type Briefing } from "../briefing.js";
import { compressedSummary, generateOptimizationHints, suggestDepth, type BriefingDepth } from "../token-optimizer.js";

import { outputJson, banner } from "../formatting.js";
import { getEventBus } from "../event-bus.js";

// ── Output Helpers ─────────────────────────────────────────────────────────

function writeBriefingMarkdown(projectRoot: string, briefing: Briefing): string {
  const nexusDir = join(projectRoot, "nexus-system");
  if (!existsSync(nexusDir)) {
    mkdirSync(nexusDir, { recursive: true });
  }

  const filePath = join(nexusDir, "BRIEFING.md");
  const content = briefingToMarkdown(briefing);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function displayBriefingByDepth(briefing: Briefing, cacheHit: boolean, depth: BriefingDepth): void {
  console.log("");
  banner("nexus briefing", "Context Pipeline");
  console.log("");
  const tokenLabel = depth === "minimal" ? "~200" : depth === "standard" ? "~500" : "~1000";
  console.log(chalk.gray(`  Depth: ${depth} (${tokenLabel} tokens)`));
  console.log("");

  // ── Project identity (always shown) ──
  console.log(chalk.bold("  📁 Project Identity"));
  console.log(`     Domain:   ${chalk.cyan(briefing.project.domain)}`);
  console.log(`     Scale:    ${chalk.cyan(briefing.project.scale)}`);
  if (depth !== "minimal") {
    console.log(`     Stack:    ${briefing.project.stack.join(", ")}`);
    console.log(`     Maturity: ${briefing.project.maturityScore}/100`);
  } else {
    console.log(`     Stack:    ${briefing.project.stack.join(", ")}`);
  }
  console.log("");

  // ── Risk status (always shown) ──
  const riskColor = briefing.risks.overall === "critical" ? chalk.red :
                    briefing.risks.overall === "high" ? chalk.yellow :
                    briefing.risks.overall === "medium" ? chalk.hex("#FFA500") : chalk.green;
  console.log(chalk.bold("  ⚠ Risk Status"));
  console.log(`     Overall:  ${riskColor(briefing.risks.overall)}`);
  if (briefing.risks.criticalAreas.length > 0) {
    console.log(chalk.red(`     Critical: ${briefing.risks.criticalAreas.join(", ")}`));
  }
  if (depth !== "minimal" && briefing.risks.highAreas.length > 0) {
    console.log(chalk.yellow(`     High:     ${briefing.risks.highAreas.join(", ")}`));
  }
  console.log("");

  // ── Test coverage (standard+ only) ──
  if (depth !== "minimal") {
    console.log(chalk.bold("  🧪 Test Coverage"));
    console.log(`     Has Tests: ${briefing.tests.hasTests ? chalk.green("Yes") : chalk.red("No")}`);
    if (briefing.tests.areasWithoutTests.length > 0) {
      console.log(chalk.yellow(`     Without Tests: ${briefing.tests.areasWithoutTests.length} area(s)`));
    }
    console.log("");
  }

  // ── Context rules (standard: text, minimal: skip) ──
  if (depth === "standard" && briefing.contextRules.length > 0) {
    console.log(chalk.bold("  📏 Context Rules"));
    for (const rule of briefing.contextRules) {
      console.log(chalk.gray(`     • ${rule.rule}`));
    }
    console.log("");
  } else if (depth === "full" && briefing.contextRules.length > 0) {
    console.log(chalk.bold("  📏 Context Rules (Top)"));
    for (const rule of briefing.contextRules) {
      console.log(chalk.gray(`     • ${rule.rule}`));
    }
    console.log("");
  }

  // ── Dynamic rules (full only) ──
  if (depth === "full" && briefing.dynamicRules.length > 0) {
    console.log(chalk.bold("  📜 Dynamic Rules (From History)"));
    for (const rule of briefing.dynamicRules) {
      const icon = rule.severity === "critical" ? "🚨" : rule.severity === "high" ? "⚠️" : "ℹ️";
      console.log(chalk.gray(`     ${icon} [${rule.severity}] ${rule.rule}`));
    }
    console.log("");
  }

  // ── Recurring errors (full only) ──
  if (depth === "full" && briefing.patterns.recurringErrors.length > 0) {
    console.log(chalk.bold("  🔥 Recurring Error Hotspots"));
    for (const area of briefing.patterns.recurringErrors) {
      console.log(chalk.red(`     • ${area}`));
    }
    console.log("");
  }

  // ── Detected patterns (full only) ──
  if (depth === "full" && briefing.patterns.detected.length > 0) {
    console.log(chalk.bold("  🔍 Detected Patterns"));
    for (const p of briefing.patterns.detected) {
      const icon = p.severity >= 4 ? "🚨" : p.severity >= 2 ? "⚠️" : "ℹ️";
      console.log(chalk.gray(`     ${icon} [${p.type}] ${p.description}`));
    }
    console.log("");
  }

  // ── Recommendations (always at least top 1) ──
  const maxRecs = depth === "minimal" ? 1 : depth === "standard" ? 3 : briefing.recommendations.length;
  console.log(chalk.bold("  💡 Recommendations"));
  for (const rec of briefing.recommendations.slice(0, maxRecs)) {
    console.log(chalk.cyan(`     → ${rec}`));
  }
  console.log("");

  // ── Token economy (standard+ only) ──
  if (depth !== "minimal") {
    if (cacheHit) {
      console.log(chalk.gray("  📦 Used cached briefing"));
      console.log("");
    }
    console.log(chalk.bold("  💰 Token Economy"));
    console.log(chalk.green(`     Saved: ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()} tokens vs manual discovery`));
    console.log("");
  } else if (cacheHit) {
    console.log(chalk.gray("  📦 Cached"));
    console.log("");
  }

  console.log(chalk.gray(`  Generated: ${briefing.generatedAt}`));
  console.log("");
}

// ── Command ────────────────────────────────────────────────────────────────

export function briefingCommand(): Command {
  const cmd = new Command("briefing")
    .description("Pre-session briefing for AI agents (Context Pipeline)")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write .nexus/BRIEFING.md")
    .option("--diff", "Show diff since last briefing")
    .option("--invalidate", "Force cache invalidation")
    .option("--summary", "One-line summary")
    .option("--profile <depth>", "Briefing depth: minimal, standard, full (default: auto)")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;

      if (!isJson) {
        console.log("");
        console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
        console.log(chalk.bold.cyan("  ║    nexus briefing — Context Pipeline  ║"));
        console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
        console.log("");
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("briefing", ctx.projectRoot, ctx.nexusDir, isJson)) {
        return;
      }

      const spinner = ora({ spinner: "dots" }).start(isJson ? "Generating" : "Collecting context...");

      try {
        // ── Stage 1: Collect ──────────────────────────────────────────
        const snapshot = collectContext(ctx.projectRoot, ctx.nexusDir);

        // ── Stage 2: Cache ───────────────────────────────────────────
        // Compute new hash from fresh data
        const newInputHash = computeInputHash({
          fingerprintHash: snapshot.fingerprint.hash,
          riskMapHash: snapshot.riskMap.generatedAt,
          contextRuleCount: snapshot.contextRules.length,
          dynamicRuleCount: snapshot.dynamicRules.length,
          maturityScore: snapshot.maturityProfile?.overallScore ?? null,
        });

        // Read old cache BEFORE checking against new hash (for diff)
        const oldCache = readCache(ctx.nexusDir);
        const previousBriefing = oldCache?.entry?.briefing ?? null;

        if (options.invalidate) {
          invalidateBriefingCache(ctx.nexusDir);
          spinner.text = "Cache invalidated, using fresh briefing...";
        }

        let briefing = snapshot.briefing;
        let cacheHit = false;

        // Check cache validity against new hash
        if (!options.invalidate && oldCache?.entry && oldCache.entry.inputHash === newInputHash) {
          briefing = oldCache.entry.briefing;
          cacheHit = true;
        }

        // Cache the briefing if not a cache hit
        if (!cacheHit) {
          setCachedBriefing(ctx.nexusDir, briefing, newInputHash);
        }

        // ── Stage 3: Output ──────────────────────────────────────────
        spinner.stop();

        // Diff mode
        if (options.diff) {
          if (previousBriefing && previousBriefing.generatedAt !== briefing.generatedAt) {
            const diff = generateDiff(previousBriefing, briefing);
            if (isJson) {
              outputJson({
                type: "diff",
                oldTimestamp: previousBriefing.generatedAt,
                newTimestamp: briefing.generatedAt,
                diff,
              });
            } else {
              console.log(diff);
            }
          } else {
            const msg = "No previous briefing to diff against.";
            if (isJson) {
              outputJson({ type: "diff", message: msg });
            } else {
              console.log(chalk.gray(`  ${msg}`));
            }
          }
          return;
        }

        // Summary mode — use compressedSummary from token-optimizer (~200 tokens)
        if (options.summary) {
          const summary = compressedSummary(briefing);
          if (isJson) {
            outputJson({ type: "summary", summary, cacheHit });
          } else {
            console.log(summary);
          }
          return;
        }

        // Determine briefing depth (adaptive or explicit)
        const profile = options.profile as string | undefined;
        let depth: BriefingDepth;
        if (profile === "minimal" || profile === "standard" || profile === "full") {
          depth = profile;
        } else {
          // Auto-detect based on risk level
          depth = suggestDepth(
            briefing.risks.overall,
            briefing.risks.criticalAreas.length > 0,
            briefing.risks.criticalAreas.length + briefing.risks.highAreas.length
          );
        }
        const hints = generateOptimizationHints(briefing);

        // JSON mode
        if (isJson) {
          outputJson({
            ...briefingToJson(briefing),
            cacheHit,
            inputHash: newInputHash,
            optimization: {
              depth,
              suggestedDepth: hints.suggestedDepth,
              tokenEstimates: hints.tokenEstimates,
              skipSections: hints.skipSections,
              compressSections: hints.compressSections,
            },
          });
          return;
        }

        // Write mode
        if (options.write) {
          const filePath = writeBriefingMarkdown(ctx.projectRoot, briefing);
          console.log(chalk.green(`  ✓ Briefing written to ${filePath}`));
          console.log("");
        }

        // Default: display (depth-aware)
        displayBriefingByDepth(briefing, cacheHit, depth);

        // ── Event ────────────────────────────────────────────────────
        getEventBus().publish("analysis.complete", {
          type: "briefing",
          cacheHit,
          risk: briefing.risks.overall,
          domain: briefing.project.domain,
        });

      } catch (error) {
        spinner.fail("Failed to generate briefing");
        if (isJson) {
          outputJson({ error: "briefing_failed", message: String(error) });
        } else {
          console.error(chalk.red(`  Error: ${error}`));
        }
      }
    });

  return cmd;
}
