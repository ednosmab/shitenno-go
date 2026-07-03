import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
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

export const docsAuditCommand = new Command("docs-audit")
  .description("Audit documentation lifecycle (Plans + ADRs) and propose organization")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--apply", "Apply proposed moves (requires confirmation)")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║  nexus docs-audit — Plans + ADRs    ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("docs-audit", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const spinner = isJson ? null : ora("Auditing Plans + ADRs lifecycle...").start();

    try {
      const report = auditDocLifecycle(ctx.projectRoot, ctx.nexusDir);
      const reportFile = writeDocLifecycleReport(ctx.nexusDir, report);

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

      // Human-readable output
      console.log(chalk.bold("  📊 Documentation Lifecycle Report:"));
      console.log(chalk.gray("     Scoped to Plans + ADRs only"));
      console.log("");

      const statusCounts = getStatusCounts(report);
      console.log(chalk.gray(`    Plans:          ${report.totalPlans}`));
      console.log(chalk.gray(`    ADRs:           ${report.totalAdrs}`));
      console.log(chalk.gray(`    Active:         ${statusCounts.planned + statusCounts.in_progress}`));
      console.log(chalk.gray(`    Completed:      ${statusCounts.completed}`));
      console.log(chalk.gray(`    Superseded:     ${statusCounts.superseded}`));
      console.log(chalk.gray(`    Stale:          ${statusCounts.stale}`));
      console.log("");

      // Proposed moves
      if (report.proposedMoves.length > 0) {
        const mode = options.apply ? chalk.green("Apply") : chalk.yellow("Proposed Moves (dry-run)");
        console.log(chalk.bold(`  🔍 ${mode}:`));
        console.log("");

        // Group moves by type
        const planMoves = report.proposedMoves.filter((m) => m.docType === "plan");
        const adrMoves = report.proposedMoves.filter((m) => m.docType === "adr");

        if (planMoves.length > 0) {
          console.log(chalk.bold("    Plans:"));
          for (const move of planMoves) {
            printMove(move, report);
          }
        }

        if (adrMoves.length > 0) {
          console.log(chalk.bold("    ADRs:"));
          for (const move of adrMoves) {
            printMove(move, report);
          }
        }
      } else {
        console.log(chalk.green("  ✔ No moves proposed. Plans and ADRs are well organized."));
        console.log("");
      }

      // Apply moves if requested
      if (options.apply && report.proposedMoves.length > 0) {
        console.log(chalk.bold("  📁 Applying moves..."));
        console.log("");

        const result = applyMoves(report, ctx.nexusDir, false);

        if (result.movesApplied > 0) {
          console.log(chalk.green(`    ✔ ${result.movesApplied} move(s) applied successfully`));
        }
        if (result.movesSkipped > 0) {
          console.log(chalk.yellow(`    ⊘ ${result.movesSkipped} move(s) skipped`));
        }
        if (result.errors.length > 0) {
          console.log(chalk.red("    Errors:"));
          for (const error of result.errors) {
            console.log(chalk.red(`      - ${error}`));
          }
        }
        console.log("");
      }

      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

      if (reportFile) {
        console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
        console.log("");
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
        console.log(chalk.red(`  Error: ${error}`));
        console.log("");
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

  console.log(chalk.cyan(`    ${icon} ${move.source}`));
  console.log(chalk.gray(`      → ${move.destination}`));
  console.log(chalk.gray(`      Status: ${statusColor(move.status)} (confidence: ${confidence})`));
  console.log(chalk.gray(`      Reason: ${move.reason}`));
  console.log("");
}
