import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

import { output, outputBlank } from "../output.js";

import {
  auditDocLifecycle,
  applyMoves,
  writeDocLifecycleReport,
  type DocLifecycleReport,
  type DocLifecycleStatus,
  type DocType,
} from "../doc-lifecycle-auditor.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { printDaemonBanner } from "../daemon-context-banner.js";

export const docsAuditCommand = new Command("docs-audit")
  .description("Audit documentation lifecycle (Plans + ADRs) and propose organization")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--apply", "Apply proposed moves (requires confirmation)")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      outputBlank();
      output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      output(chalk.bold.cyan("  ║  shiten docs-audit — Plans + ADRs    ║"));
      output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitenDir, isJson);

    if (!checkLifecycleGate("docs-audit", ctx.projectRoot, ctx.shitenDir, isJson)) return;

    const spinner = isJson ? null : ora("Auditing Plans + ADRs lifecycle...").start();

    try {
      const report = auditDocLifecycle(ctx.projectRoot, ctx.shitenDir);
      const reportFile = writeDocLifecycleReport(ctx.shitenDir, report);

      if (spinner) {
        spinner.succeed(`Audit complete — ${report.totalPlans} plan(s), ${report.totalAdrs} ADR(s)`);
      }

      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          totalPlans: report.totalPlans,
          totalAdrs: report.totalAdrs,
          statusCounts: getStatusCounts(report),
          proposedMoves: report.proposedMoves,
          summary: report.summary,
          reportFile,
          auditedAt: report.auditedAt,
        });
        return;
      }

      output(chalk.bold("  📊 Documentation Lifecycle Report:"));
      output(chalk.gray("     Scoped to Plans + ADRs only"));
      outputBlank();

      const statusCounts = getStatusCounts(report);
      output(chalk.gray(`    Plans:          ${report.totalPlans}`));
      output(chalk.gray(`    ADRs:           ${report.totalAdrs}`));
      output(chalk.gray(`    Active:         ${statusCounts.planned + statusCounts.in_progress}`));
      output(chalk.gray(`    Completed:      ${statusCounts.completed}`));
      output(chalk.gray(`    Superseded:     ${statusCounts.superseded}`));
      output(chalk.gray(`    Stale:          ${statusCounts.stale}`));
      outputBlank();

      // Proposed moves
      if (report.proposedMoves.length > 0) {
        const mode = options.apply ? chalk.green("Apply") : chalk.yellow("Proposed Moves (dry-run)");
        output(chalk.bold(`  🔍 ${mode}:`));
        outputBlank();

        // Group moves by type
        const planMoves = report.proposedMoves.filter((m) => m.docType === "plan");
        const adrMoves = report.proposedMoves.filter((m) => m.docType === "adr");

        if (planMoves.length > 0) {
          output(chalk.bold("    Plans:"));
          for (const move of planMoves) {
            printMove(move, report);
          }
        }

        if (adrMoves.length > 0) {
          output(chalk.bold("    ADRs:"));
          for (const move of adrMoves) {
            printMove(move, report);
          }
        }
      } else {
        output(chalk.green("  ✔ No moves proposed. Plans and ADRs are well organized."));
        outputBlank();
      }

      // Apply moves if requested
      if (options.apply && report.proposedMoves.length > 0) {
        output(chalk.bold("  📁 Applying moves..."));
        outputBlank();

        const result = applyMoves(report, ctx.shitenDir, false);

        if (result.movesApplied > 0) {
          output(chalk.green(`    ✔ ${result.movesApplied} move(s) applied successfully`));
        }
        if (result.movesSkipped > 0) {
          output(chalk.yellow(`    ⊘ ${result.movesSkipped} move(s) skipped`));
        }
        if (result.errors.length > 0) {
          output(chalk.red("    Errors:"));
          for (const error of result.errors) {
            output(chalk.red(`      - ${error}`));
          }
        }
        outputBlank();
      }

      output(chalk.bold("  📝 Summary:"));
      output(chalk.gray(`    ${report.summary}`));
      outputBlank();

      if (reportFile) {
        output(chalk.gray(`  📄 Report saved: shitenno-go/reports/${reportFile}`));
        outputBlank();
      }

      getEventBus().publish("doc.lifecycle.audited", {
        totalDocuments: report.totalPlans + report.totalAdrs,
        classified: getStatusCounts(report),
        clustersDetected: 0,
        movesProposed: report.proposedMoves.length,
      });

    } catch (error) {
      if (isJson) {
        outputJson({ error: "docs_audit_failed", message: String(error) });
      } else {
        if (spinner) spinner.fail("Documentation lifecycle audit failed");
        output(chalk.red(`  Error: ${error}`));
        outputBlank();
      }
    }
  });

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusCounts(report: DocLifecycleReport): Record<DocLifecycleStatus, number> {
  const counts: Record<DocLifecycleStatus, number> = {
    planned: 0,
    in_progress: 0,
    completed: 0,
    superseded: 0,
    stale: 0,
  };

  for (const classification of report.classifications) {
    counts[classification.status]++;
  }

  return counts;
}

function getStatusColor(status: DocLifecycleStatus) {
  switch (status) {
    case "completed":
      return chalk.green;
    case "in_progress":
      return chalk.blue;
    case "planned":
      return chalk.yellow;
    case "superseded":
      return chalk.gray;
    case "stale":
      return chalk.red;
    default:
      return chalk.white;
  }
}

function getDocTypeIcon(docType: DocType) {
  return docType === "plan" ? "📋" : "📐";
}

function printMove(move: { source: string; destination: string; docType: DocType; status: DocLifecycleStatus; reason: string }, report: DocLifecycleReport) {
  const statusColor = getStatusColor(move.status);
  const icon = getDocTypeIcon(move.docType);
  const classification = report.classifications.find((c) => c.path.endsWith(move.source));
  const confidence = classification ? `${Math.round(classification.confidence * 100)}%` : "unknown";

  output(chalk.cyan(`    ${icon} ${move.source}`));
  output(chalk.gray(`      → ${move.destination}`));
  output(chalk.gray(`      Status: ${statusColor(move.status)} (confidence: ${confidence})`));
  output(chalk.gray(`      Reason: ${move.reason}`));
  outputBlank();
}
