import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { auditHealth, writeHealthReport, type HealthAuditReport } from "../health-auditor.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { healthBar, outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { getHookBus } from "../plugin-system.js";
import { discoverArtifacts, discoverRelations, analyzeGraph, type GraphAnalysis } from "../knowledge-graph.js";

export const auditCommand = new Command("audit")
  .description("Audit Nexus System health (Phase 3)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║    nexus audit — Health Audit        ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("audit", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const spinner = isJson ? null : ora("Auditing governance health...").start();

    try {
      // Check cache first
      let report: HealthAuditReport;
      let cacheHit = false;
      if (options.cache !== false) {
        const cached = getCached<HealthAuditReport>(ctx.projectRoot, ctx.nexusDir, "health",
          () => computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));
        if (cached) {
          report = cached;
          cacheHit = true;
        } else {
          report = auditHealth(ctx.projectRoot, ctx.nexusDir);
          setCache(ctx.projectRoot, ctx.nexusDir, "health", report,
            computeKeyChecksums(ctx.projectRoot, ctx.nexusDir));
        }
      } else {
        report = auditHealth(ctx.projectRoot, ctx.nexusDir);
      }

      // Write report (always, even with 0 issues)
      const reportFile = writeHealthReport(ctx.nexusDir, report);

      // Knowledge graph analysis
      const artifacts = discoverArtifacts(ctx.nexusDir);
      const relations = discoverRelations(artifacts);
      const graphAnalysis = analyzeGraph(artifacts, relations);

      // Publish knowledge graph event
      getEventBus().publish("knowledge.analyzed", {
        totalArtifacts: graphAnalysis.totalArtifacts,
        totalRelations: graphAnalysis.totalRelations,
        healthScore: graphAnalysis.healthScore,
      });

      if (spinner) {
        spinner.succeed(`Audit complete — health score: ${report.healthScore}/100`);
      }

      // JSON output
      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          healthScore: report.healthScore,
          totalRules: report.totalRules,
          historyEntries: report.historyEntries,
          sessionsAnalyzed: report.sessionsAnalyzed,
          issues: report.issues,
          optimizations: report.optimizations,
          summary: report.summary,
          knowledgeGraph: {
            totalArtifacts: graphAnalysis.totalArtifacts,
            totalRelations: graphAnalysis.totalRelations,
            healthScore: graphAnalysis.healthScore,
            orphanCount: graphAnalysis.orphanArtifacts.length,
            hubCount: graphAnalysis.hubArtifacts.length,
            suggestions: graphAnalysis.suggestions,
          },
          cacheHit,
          reportFile: reportFile || null,
          auditedAt: report.auditedAt,
        });
        return;
      }

      // Human-readable output
      if (cacheHit) {
        console.log(chalk.gray("  📦 Used cached results"));
      }
      console.log("");
      console.log(chalk.bold("  🏥 Health Audit Results:"));
      console.log("");
      console.log(chalk.gray(`    Rules:           ${report.totalRules}`));
      console.log(chalk.gray(`    History entries:  ${report.historyEntries}`));
      console.log(chalk.gray(`    Issues found:    ${report.issues.length}`));
      console.log(chalk.gray(`    Optimizations:   ${report.optimizations.length}`));
      console.log("");

      // Health score with bar
      console.log(chalk.bold("    Health Score:"));
      console.log(`      ${report.healthScore}/100  ${healthBar(report.healthScore, 100)}`);
      console.log("");

      // Knowledge Graph section
      console.log(chalk.bold("  📊 Knowledge Graph:"));
      console.log("");
      const graphColor = graphAnalysis.healthScore >= 70 ? chalk.green
        : graphAnalysis.healthScore >= 40 ? chalk.yellow : chalk.red;
      console.log(`    Health:  ${graphColor(graphAnalysis.healthScore + "/100")}  ${healthBar(graphAnalysis.healthScore, 100)}`);
      console.log(`    Artifacts: ${graphAnalysis.totalArtifacts} | Relations: ${graphAnalysis.totalRelations}`);
      console.log("");

      if (graphAnalysis.orphanArtifacts.length > 0) {
        console.log(chalk.yellow(`    ⚠ ${graphAnalysis.orphanArtifacts.length} orphaned artifact(s):`));
        for (const orphan of graphAnalysis.orphanArtifacts.slice(0, 5)) {
          console.log(chalk.gray(`      - ${orphan.name} (${orphan.type})`));
        }
        console.log("");
      }

      if (graphAnalysis.hubArtifacts.length > 0) {
        console.log(chalk.cyan("    🔗 Top Hubs:"));
        for (const hub of graphAnalysis.hubArtifacts.slice(0, 5)) {
          console.log(chalk.gray(`      - ${hub.artifact.name}: ${hub.connectionCount} connection(s)`));
        }
        console.log("");
      }

      if (graphAnalysis.suggestions.length > 0) {
        console.log(chalk.blue("    💡 Suggestions:"));
        for (const suggestion of graphAnalysis.suggestions) {
          console.log(chalk.gray(`      - ${suggestion}`));
        }
        console.log("");
      }

      if (report.issues.length === 0) {
        console.log(chalk.green("  ✔ No issues found. Governance is healthy!"));
        console.log("");
      } else {
        // Display issues
        console.log(chalk.bold("  🔍 Issues Found:"));
        console.log("");

        for (const issue of report.issues) {
          const icon = issue.severity === 3 ? "🔴" : issue.severity === 2 ? "🟡" : "⚪";
          const sevLabel = issue.severity === 3 ? "CRITICAL" : issue.severity === 2 ? "WARNING" : "INFO";
          const sevColor = issue.severity === 3 ? chalk.red : issue.severity === 2 ? chalk.yellow : chalk.gray;

          console.log(`    ${icon} ${sevColor(`[${sevLabel}]`)} ${issue.description}`);
          console.log(chalk.gray(`       Location: ${issue.location}`));
          console.log(chalk.gray(`       Fix: ${issue.recommendation}`));
          console.log("");
        }

        // Display optimizations
        if (report.optimizations.length > 0) {
          console.log(chalk.bold("  🔧 Proposed Optimizations (require Tech Lead approval):"));
          console.log("");

          for (const opt of report.optimizations) {
            console.log(chalk.cyan(`    ${opt.id}: ${opt.title}`));
            console.log(chalk.gray(`      Action: ${opt.action}`));
            console.log(chalk.gray(`      ${opt.description}`));
            console.log("");
          }

          console.log(chalk.yellow("  ⚠ These are PROPOSALS only. Aprovação manual do Tech Lead necessária."));
        }

        console.log("");
      }

      if (reportFile) {
        console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
        console.log("");
      }

      // Summary
      console.log(chalk.bold("  📝 Summary:"));
      console.log(chalk.gray(`    ${report.summary}`));
      console.log("");

      // Publish event
      getEventBus().publish("health.checked", {
        projectRoot: ctx.projectRoot,
        healthScore: report.healthScore,
        issues: report.issues.length,
        optimizations: report.optimizations.length,
      });

      // Execute custom check hooks from plugins
      const hookBus = getHookBus();
      const customResults = await hookBus.collectHook("custom-check", async (plugin) => {
        if (plugin.hooks?.["custom-check"]) {
          return await plugin.hooks["custom-check"]({
            projectRoot: ctx.projectRoot,
            nexusDir: ctx.nexusDir,
            healthReport: report,
          });
        }
        return null;
      });
      if (customResults.length > 0 && !isJson) {
        console.log(chalk.bold("  🔌 Custom Checks:"));
        for (const result of customResults) {
          if (result) console.log(chalk.gray(`    ${result}`));
        }
        console.log("");
      }

    } catch (error) {
      if (isJson) {
        outputJson({ error: "audit_failed", message: String(error) });
      } else {
        if (spinner) spinner.fail("Health audit failed");
        console.log(chalk.red(`  Error: ${error}`));
        console.log("");
      }
    }
  });
