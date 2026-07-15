import { Command } from "commander";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { calculateComplexityScore, writeComplexityReport, type ComplexityReport } from "../scorer.js";
import { analyseProject, type ProjectAnalysis } from "../analyser.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { healthBar, miniBar, outputJson, statusIcon, banner } from "../formatting.js";
import { loadMaturityProfile, CAPABILITIES, type MaturityProfile } from "../maturity-profile.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";
import { logger, muteLogs } from "../logger.js";
import { output, outputBlank } from "../output.js";

interface StatusCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export const statusCommand = new Command("status")
  .description("Check governance health status")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--fix", "Auto-fix governance issues (like doctor)")
  .action(async (options) => {
    const isJson = options.json === true;
    if (isJson) muteLogs();

    if (!isJson) {
      outputBlank();        banner("shiten status", "Health Check");
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("status", ctx.projectRoot, ctx.shitenDir, isJson)) return;

    const checks = runHealthChecks(ctx.projectRoot, ctx.shitenDir);

    // Complexity analysis (with cache)
    const analysis = analyseProject(ctx.projectRoot);
    let complexity: ComplexityReport;
    let cacheHit = false;

    if (options.cache !== false) {
      const cached = getCached<ComplexityReport>(ctx.projectRoot, ctx.shitenDir, "complexity",
        () => computeKeyChecksums(ctx.projectRoot, ctx.shitenDir));
      if (cached) {
        complexity = cached;
        cacheHit = true;
      } else {
        complexity = await calculateComplexityScore(ctx.projectRoot, ctx.shitenDir, analysis);
        setCache(ctx.projectRoot, ctx.shitenDir, "complexity", complexity,
          computeKeyChecksums(ctx.projectRoot, ctx.shitenDir));
      }
    } else {
      complexity = await calculateComplexityScore(ctx.projectRoot, ctx.shitenDir, analysis);
    }

    // Write report to reports/
    const reportFile = writeComplexityReport(ctx.projectRoot, ctx.shitenDir, complexity);

    // Load maturity profile
    const maturityProfile = loadMaturityProfile(ctx.shitenDir);
    const installedCapabilities = maturityProfile?.installedCapabilities ?? ["core"];

    // Load growth profile (needed for both JSON and human output)
    const growthProfile = loadGrowthProfile(ctx.shitenDir);

    // JSON output
    if (isJson) {
      outputJson({
        projectRoot: ctx.projectRoot,
        checks: checks.map((c) => ({ name: c.name, status: c.status, message: c.message })),
        complexity: {
          score: complexity.score,
          level: complexity.level,
          staticScore: complexity.staticScore,
          behaviorScore: complexity.behaviorScore,
          reasons: complexity.reasons,
          suggestions: complexity.suggestions,
          areaScores: complexity.areaScores,
        },
        maturity: maturityProfile ? {
          overallScore: maturityProfile.overallScore,
          dimensions: maturityProfile.dimensions,
          installedCapabilities: maturityProfile.installedCapabilities,
          recommendedCapabilities: maturityProfile.recommendedCapabilities,
        } : null,
        installedCapabilities,
        analysis: {
          packageCount: analysis.packageCount,
          appCount: analysis.appCount,
          sourceFileCount: analysis.sourceFileCount,
          dependencyCount: analysis.dependencyCount,
          monorepo: analysis.monorepo,
          hasTypeScript: analysis.hasTypeScript,
          hasTests: analysis.hasTests,
        },
        cacheHit,
        reportFile: reportFile || null,
        computedAt: complexity.computedAt,
        growthProfile: {
          growthCapacity: growthProfile.growthCapacity,
          challengeLevel: growthProfile.challengeLevel,
          pattern: growthProfile.patterns[0]?.type || "balanced",
          totalChoices: growthProfile.pathHistory.length,
        },
      });
      return;
    }

    // Human-readable output
    output(chalk.bold("  Project root:"));
    output(chalk.gray(`    ${ctx.projectRoot}`));
    outputBlank();

    displayResults(checks);

    // 3.26: --fix mode: run auto-fix suggestions
    if (options.fix) {
      const failCount = checks.filter((c) => c.status === "fail").length;
      const warnCount = checks.filter((c) => c.status === "warn").length;
      if (!isJson) {
        output(chalk.bold("  🔧 Auto-fix Mode:"));
        outputBlank();
        if (failCount > 0) {
          output(chalk.gray("  Attempting fixes for failed checks..."));
          output(chalk.gray("  → Run 'shiten init' to fix failed governance checks"));
          output(chalk.gray("  → Run 'shiten upgrade --accept-recommended' to add missing capabilities"));
        }
        if (warnCount > 0) {
          output(chalk.gray("  Attempting fixes for warnings..."));
          output(chalk.gray("  → Run 'shiten upgrade' to add optional components"));
          output(chalk.gray("  → Run 'shiten sync' to synchronize documentation"));
        }
        if (failCount === 0 && warnCount === 0) {
          output(chalk.green("  ✔ No fixes needed — governance is healthy!"));
        }
        outputBlank();
      }
    }

    displayMaturityProfile(maturityProfile, installedCapabilities);
    displayComplexityReport(complexity, analysis);

    // Display project fingerprint
    const { loadFingerprint, isFingerprintStale, generateProjectFingerprint, saveFingerprint } = await import("../project-fingerprint.js");
    const staleFingerprint = isFingerprintStale(ctx.shitenDir);
    let fingerprint = loadFingerprint(ctx.shitenDir);
    if (!fingerprint || staleFingerprint) {
      fingerprint = generateProjectFingerprint(ctx.projectRoot, analysis, maturityProfile?.overallScore);
      saveFingerprint(ctx.shitenDir, fingerprint);
    }
    if (fingerprint) {
      output(chalk.bold("  🔍 Project Fingerprint:"));
      output(chalk.gray(`    Domain:    ${fingerprint.domain}`));
      output(chalk.gray(`    Scale:     ${fingerprint.scale}`));
      output(chalk.gray(`    Stack:     ${fingerprint.stack.slice(0, 5).join(", ")}${fingerprint.stack.length > 5 ? ` (+${fingerprint.stack.length - 5})` : ""}`));
      output(chalk.gray(`    Hash:      ${fingerprint.hash}`));
      outputBlank();
    }

    // Display context pipeline summary via collectContext()
    try {
      const { collectContext } = await import("../context-collector.js");
      const { computeInputHash, getCachedBriefing } = await import("../briefing-cache.js");

      const snapshot = collectContext(ctx.projectRoot, ctx.shitenDir);
      const inputHash = computeInputHash({
        fingerprintHash: snapshot.fingerprint.hash,
        riskMapHash: snapshot.riskMap.generatedAt,
        contextRuleCount: snapshot.contextRules.length,
        dynamicRuleCount: snapshot.dynamicRules.length,
        maturityScore: snapshot.maturityProfile?.overallScore ?? null,
      });
      const cached = getCachedBriefing(ctx.shitenDir, inputHash);
      const briefing = cached?.briefing ?? snapshot.briefing;

      output(chalk.bold("  📋 Pre-Session Briefing:"));
      output(chalk.gray(`    Domain: ${briefing.project.domain} | Scale: ${briefing.project.scale} | Risk: ${briefing.risks.overall}`));
      if (cached?.cacheHit) {
        output(chalk.gray("    Cache: hit"));
      }
      if (briefing.risks.criticalAreas.length > 0) {
        output(chalk.red(`    ⚠ Critical areas: ${briefing.risks.criticalAreas.join(", ")}`));
      }
      if (briefing.tests.areasWithoutTests.length > 0) {
        output(chalk.yellow(`    🧪 Areas without tests: ${briefing.tests.areasWithoutTests.length}`));
      }
      for (const rec of briefing.recommendations.slice(0, 2)) {
        output(chalk.cyan(`    → ${rec}`));
      }
      outputBlank();
    } catch (error) {
      logger.debug("status", "Suppressed error", { error });
    }

    // Display capability engine summary
    try {
      const { evaluateCapabilities } = await import("../capability-engine.js");
      const { subscribeToEngineeringState } = await import("../engineering-state-subscription.js");
      const { getState, unsubscribe } = subscribeToEngineeringState(ctx.projectRoot, ctx.shitenDir);
      const state = getState();
      unsubscribe();
      const engineResult = evaluateCapabilities(state, ctx.shitenDir);

      output(chalk.bold("  ⚙ Capability Engine:"));
      output(chalk.gray(`    Overall: ${engineResult.overallScore}% | Installed: ${engineResult.byMaturity.installed.length + engineResult.byMaturity.configured.length + engineResult.byMaturity.active.length + engineResult.byMaturity.optimized.length} | Dormant: ${engineResult.byMaturity.dormant.length}`));

      const activeCaps = [...engineResult.byMaturity.active, ...engineResult.byMaturity.optimized];
      if (activeCaps.length > 0) {
        output(chalk.green(`    Active: ${activeCaps.join(", ")}`));
      }
      outputBlank();
    } catch (error) {
      logger.debug("status", "Suppressed error", { error });
    }

    // Growth profile
    output(formatGrowthProgress(growthProfile));
    outputBlank();

    if (cacheHit) {
      output(chalk.gray("  📦 Used cached results"));
      outputBlank();
    }

    if (reportFile) {
      output(chalk.gray(`  📄 Report saved: shitenno-go/reports/${reportFile}`));
      outputBlank();
    }

    // Publish event
    getEventBus().publish("analysis.complete", {
      projectId: ctx.projectRoot,
      maturityScore: maturityProfile?.overallScore ?? complexity.score,
      dimensions: maturityProfile?.dimensions ?? {},
      recommendations: complexity.suggestions,
    });
  });

function runHealthChecks(projectRoot: string, shitenDir: string): StatusCheck[] {
  const checks: StatusCheck[] = [];

  // 1. Check opencode.json at project root
  checks.push(checkOpencodeConfig(projectRoot));

  // 2. Check AGENTS.md in shitenno-go/docs/
  checks.push(checkAgentsFile(shitenDir));

  // 3. Check skills directory in shitenno-go/docs/skills/
  checks.push(checkSkillsDirectory(shitenDir));

  // 4. Check governance directory in shitenno-go/governance/
  checks.push(checkGovernanceDirectory(shitenDir));

  // 5. Check context buffer in shitenno-go/governance/context/
  checks.push(checkContextBuffer(shitenDir));

  // 6. Check scripts in shitenno-go/scripts/
  checks.push(checkScripts(shitenDir));

  // 7. Check agent contracts in shitenno-go/governance/agents/
  checks.push(checkAgentContracts(shitenDir));

  return checks;
}

function checkOpencodeConfig(projectRoot: string): StatusCheck {
  const configPath = join(projectRoot, "opencode.json");

  if (!existsSync(configPath)) {
    return { name: "opencode.json", status: "fail", message: "File not found" };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    if (!config.model) {
      return { name: "opencode.json", status: "warn", message: "Missing 'model' field" };
    }

    if (!config.agent) {
      return { name: "opencode.json", status: "warn", message: "Missing 'agent' configuration" };
    }

    const agentCount = Object.keys(config.agent).length;
    return {
      name: "opencode.json",
      status: "pass",
      message: `Configured with ${agentCount} agents`,
    };
  } catch {
    return { name: "opencode.json", status: "fail", message: "Invalid JSON" };
  }
}

function checkAgentsFile(shitenDir: string): StatusCheck {
  const agentsPath = join(shitenDir, "docs", "AGENTS.md");

  if (!existsSync(agentsPath)) {
    return { name: "shitenno-go/docs/AGENTS.md", status: "fail", message: "File not found" };
  }

  const content = readFileSync(agentsPath, "utf-8");
  const ruleCount = (content.match(/^\d+\./gm) || []).length;

  if (ruleCount < 10) {
    return {
      name: "shitenno-go/docs/AGENTS.md",
      status: "warn",
      message: `Only ${ruleCount} rules found (expected 22+)`,
    };
  }

  return {
    name: "shitenno-go/docs/AGENTS.md",
    status: "pass",
    message: `${ruleCount} rules configured`,
  };
}

function checkSkillsDirectory(shitenDir: string): StatusCheck {
  const skillsDir = join(shitenDir, "docs", "skills");

  if (!existsSync(skillsDir)) {
    return { name: "shitenno-go/docs/skills/", status: "warn", message: "Directory not found" };
  }

  const skillFiles = readdirSync(skillsDir).filter((f: string) =>
    f.endsWith(".md")
  );

  if (skillFiles.length === 0) {
    return { name: "shitenno-go/docs/skills/", status: "warn", message: "No skills found" };
  }

  return {
    name: "shitenno-go/docs/skills/",
    status: "pass",
    message: `${skillFiles.length} skills installed`,
  };
}

function checkGovernanceDirectory(shitenDir: string): StatusCheck {
  const govDir = join(shitenDir, "governance");

  if (!existsSync(govDir)) {
    return { name: "shitenno-go/governance/", status: "warn", message: "Directory not found" };
  }

  const hasContext = existsSync(join(govDir, "context"));
  const hasAgents = existsSync(join(govDir, "agents"));

  const parts: string[] = [];
  if (hasContext) parts.push("context");
  if (hasAgents) parts.push("agents");

  return {
    name: "shitenno-go/governance/",
    status: "pass",
    message: `Contains: ${parts.join(", ") || "empty"}`,
  };
}

function checkContextBuffer(shitenDir: string): StatusCheck {
  const bufferPath = join(shitenDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return { name: "context_buffer.yaml", status: "warn", message: "Not found" };
  }

  const content = readFileSync(bufferPath, "utf-8");

  if (!content.includes("current_task:")) {
    return { name: "context_buffer.yaml", status: "warn", message: "Missing 'current_task' section" };
  }

  return { name: "context_buffer.yaml", status: "pass", message: "Valid" };
}

function checkScripts(shitenDir: string): StatusCheck {
  const scriptsDir = join(shitenDir, "scripts");

  if (!existsSync(scriptsDir)) {
    return { name: "shitenno-go/scripts/", status: "warn", message: "Directory not found" };
  }

  const scriptFiles = readdirSync(scriptsDir).filter((f: string) =>
    f.endsWith(".ts") || f.endsWith(".js")
  );

  if (scriptFiles.length === 0) {
    return { name: "shitenno-go/scripts/", status: "warn", message: "No scripts found" };
  }

  return {
    name: "shitenno-go/scripts/",
    status: "pass",
    message: `${scriptFiles.length} scripts installed`,
  };
}

function checkAgentContracts(shitenDir: string): StatusCheck {
  const contractsDir = join(shitenDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return { name: "agent contracts", status: "warn", message: "Not found" };
  }

  const yamlFiles = readdirSync(contractsDir).filter((f: string) =>
    f.endsWith(".yaml") || f.endsWith(".yml")
  );

  if (yamlFiles.length === 0) {
    return { name: "agent contracts", status: "warn", message: "No contracts found" };
  }

  return {
    name: "agent contracts",
    status: "pass",
    message: `${yamlFiles.length} contracts defined`,
  };
}

function displayResults(checks: StatusCheck[]): void {
  output(chalk.bold("  Governance Health:"));
  outputBlank();

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const check of checks) {
    const { icon, color } = statusIcon(check.status);
    if (check.status === "pass") passCount++;
    else if (check.status === "warn") warnCount++;
    else failCount++;

    output(`    ${color(icon)} ${chalk.bold(check.name)}: ${color(check.message)}`);
  }

  outputBlank();
  output(chalk.bold("  Summary:"));
  output(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  outputBlank();

  if (failCount > 0) {
    output(chalk.red("  Run 'shiten init' to fix failed checks."));
  } else if (warnCount > 0) {
    output(chalk.yellow("  Some optional components are missing. Run 'shiten upgrade' to add them."));
  } else {
    output(chalk.green("  Governance is healthy!"));
  }

  outputBlank();
}

function displayMaturityProfile(
  profile: MaturityProfile | null,
  installedCapabilities: string[]
): void {
  output(chalk.bold("  🎯 Maturity Profile:"));
  outputBlank();

  if (!profile) {
    output(chalk.gray("    No maturity profile found. Run 'shiten init' to create one."));
    outputBlank();
    return;
  }

  // Overall score
  const color = profile.overallScore >= 65 ? chalk.green : profile.overallScore >= 35 ? chalk.yellow : chalk.red;
  output(`    Overall Score: ${color(String(profile.overallScore))}/100 ${healthBar(profile.overallScore, 100)}`);
  outputBlank();

  // Dimensions
  const dimLabels: Record<string, string> = {
    architecture: "Arquitetura",
    governance: "Governança",
    quality: "Qualidade",
    automation: "Automação",
    ai: "IA",
    documentation: "Documentação",
    observability: "Observabilidade",
  };

  const barWidth = 16;
  for (const [key, label] of Object.entries(dimLabels)) {
    const value = profile.dimensions[key as keyof typeof profile.dimensions];
    const filled = Math.round((value / 100) * barWidth);
    const empty = barWidth - filled;
    const dimColor = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
    const bar = dimColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    output(`    ${label.padEnd(16)} ${bar} ${String(value).padStart(3)}%`);
  }
  outputBlank();

  // Capabilities
  output(chalk.bold("    Installed Capabilities:"));
  for (const cap of installedCapabilities) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    output(chalk.green(`      ✓ ${info?.name || cap}`));
  }
  outputBlank();

  // Recommendations
  if (profile.recommendedCapabilities.length > 0) {
    output(chalk.bold("    🎯 Recommended:"));
    for (const cap of profile.recommendedCapabilities) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.cyan(`      → ${info?.name || cap}`));
    }
    outputBlank();
  }
}

function displayComplexityReport(
  complexity: ComplexityReport,
  analysis: ProjectAnalysis
): void {
  const levelColors: Record<string, typeof chalk.green> = {
    junior: chalk.green,
    pleno: chalk.yellow,
    senior: chalk.red,
  };
  const levelNames: Record<string, string> = {
    junior: "Basic",
    pleno: "Moderate",
    senior: "Advanced",
  };

  const color = levelColors[complexity.level] || chalk.gray;

  output(chalk.bold("  📊 Complexity Analysis:"));
  outputBlank();
  output(chalk.gray("    Project Metrics:"));
  output(chalk.gray(`      Packages:      ${analysis.packageCount}`));
  output(chalk.gray(`      Apps:          ${analysis.appCount}`));
  output(chalk.gray(`      Source files:  ${analysis.sourceFileCount}`));
  output(chalk.gray(`      Dependencies:  ${analysis.dependencyCount}`));
  output(chalk.gray(`      Monorepo:      ${analysis.monorepo ? "yes" : "no"}`));
  outputBlank();
  output(chalk.gray("    Score Breakdown:"));
  output(chalk.gray(`      Static score:  ${complexity.staticScore}`));
  output(chalk.gray(`      Behavior score: ${complexity.behaviorScore}`));
  output(chalk.bold(`      Total score:   ${complexity.score}  ${healthBar(complexity.score, 20)}`));
  outputBlank();
  output(chalk.gray("    Current level:"));
  output(color(`      ${levelNames[complexity.level] || complexity.level}`));
  outputBlank();
  output(chalk.gray("    Factors:"));

  for (const reason of complexity.reasons) {
    output(chalk.gray(`      • ${reason}`));
  }

  // Per-area breakdown
  if (complexity.areaScores.length > 0) {
    outputBlank();
    output(chalk.bold("    📍 Area Breakdown:"));
    outputBlank();
    output(chalk.gray("      Area                    Score  Bar      Lvl     Files Churn Snsve  Viol  Deps  Age   Ctx"));
    output(chalk.gray("      ─────────────────────── ────── ──────── ─────── ───── ───── ────── ───── ───── ───── ─────"));

    for (const area of complexity.areaScores.sort((a, b) => b.score - a.score)) {
      const areaColor = levelColors[area.level] || chalk.gray;
      const areaName = area.area.padEnd(23);
      const score = String(area.score).padStart(5);
      const level = (area.level).padEnd(7);
      const files = String(area.fileCount).padStart(4);
      const churn = String(area.churn).padStart(4);
      const sensitive = String(area.sensitiveSurface).padStart(5);
      const violations = String(area.violations).padStart(4);
      const deps = String(area.dependencyDepth).padStart(4);
      const age = String(area.incidentFreeAge).padStart(4);
      const ctx = String(area.contextPressure).padStart(4);

      output(`      ${areaColor(areaName)} ${chalk.bold(score)} ${miniBar(area.score)} ${areaColor(level)} ${chalk.gray(files)} ${chalk.gray(churn)} ${chalk.gray(sensitive)} ${chalk.gray(violations)} ${chalk.gray(deps)} ${chalk.gray(age)} ${chalk.gray(ctx)}`);
    }
  }

  if (complexity.suggestions.length > 0) {
    outputBlank();
    output(chalk.bold("    💡 Suggestions:"));
    for (const suggestion of complexity.suggestions) {
      output(chalk.cyan(`      → ${suggestion}`));
    }
  }

  outputBlank();
}
