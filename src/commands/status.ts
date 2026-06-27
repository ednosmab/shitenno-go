import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import fse from "fs-extra";
import { calculateComplexityScore, writeComplexityReport, type ComplexityReport } from "../scorer.js";
import { analyseProject, type ProjectAnalysis } from "../analyser.js";
import { detectNexusProject } from "../utils.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { healthBar, miniBar, outputJson, statusIcon } from "../formatting.js";
import { loadMaturityProfile, detectInstalledCapabilities, CAPABILITIES, type MaturityProfile } from "../maturity-profile.js";

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
  .action(async (options) => {
    const isJson = options.json === true;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║      nexus status — Health Check     ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    // Auto-detect or use provided directory
    let projectRoot: string;
    let nexusDir: string;

    if (options.dir) {
      projectRoot = resolve(options.dir);
      nexusDir = join(projectRoot, "nexus-system");
    } else {
      const detected = detectNexusProject(process.cwd());
      if (!detected) {
        if (isJson) {
          outputJson({ error: "not_initialized", message: "Run 'nexus init' to initialize governance." });
        } else {
          console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
          console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
          console.log("");
        }
        return;
      }
      projectRoot = detected.root;
      nexusDir = detected.nexusDir;
    }

    // Check if opencode.json exists at project root
    if (!existsSync(resolve(projectRoot, "opencode.json"))) {
      if (isJson) {
        outputJson({ error: "missing_config", message: "opencode.json not found at project root. Run 'nexus init'." });
      } else {
        console.log(chalk.yellow("  ⚠ opencode.json not found at project root."));
        console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
        console.log("");
      }
      return;
    }

    // Check if nexus-system/ exists
    if (!existsSync(nexusDir)) {
      if (isJson) {
        outputJson({ error: "missing_nexus_dir", message: "nexus-system/ directory not found. Run 'nexus init'." });
      } else {
        console.log(chalk.yellow("  ⚠ nexus-system/ directory not found."));
        console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
        console.log("");
      }
      return;
    }

    const checks = runHealthChecks(projectRoot, nexusDir);

    // Complexity analysis (with cache)
    const analysis = analyseProject(projectRoot);
    let complexity: ComplexityReport;
    let cacheHit = false;

    if (options.cache !== false) {
      const cached = getCached<ComplexityReport>(projectRoot, nexusDir, "complexity",
        () => computeKeyChecksums(projectRoot, nexusDir));
      if (cached) {
        complexity = cached;
        cacheHit = true;
      } else {
        complexity = await calculateComplexityScore(projectRoot, nexusDir, analysis);
        setCache(projectRoot, nexusDir, "complexity", complexity,
          computeKeyChecksums(projectRoot, nexusDir));
      }
    } else {
      complexity = await calculateComplexityScore(projectRoot, nexusDir, analysis);
    }

    // Write report to reports/
    const reportFile = writeComplexityReport(projectRoot, nexusDir, complexity);

    // Load maturity profile
    const maturityProfile = loadMaturityProfile(nexusDir);
    const installedCapabilities = detectInstalledCapabilities(nexusDir);

    // JSON output
    if (isJson) {
      outputJson({
        projectRoot,
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
      });
      return;
    }

    // Human-readable output
    console.log(chalk.bold("  Project root:"));
    console.log(chalk.gray(`    ${projectRoot}`));
    console.log("");

    displayResults(checks);
    displayMaturityProfile(maturityProfile, installedCapabilities);
    displayComplexityReport(complexity, analysis);

    if (cacheHit) {
      console.log(chalk.gray("  📦 Used cached results"));
      console.log("");
    }

    if (reportFile) {
      console.log(chalk.gray(`  📄 Report saved: nexus-system/reports/${reportFile}`));
      console.log("");
    }
  });

function runHealthChecks(projectRoot: string, nexusDir: string): StatusCheck[] {
  const checks: StatusCheck[] = [];

  // 1. Check opencode.json at project root
  checks.push(checkOpencodeConfig(projectRoot));

  // 2. Check AGENTS.md in nexus-system/docs/
  checks.push(checkAgentsFile(nexusDir));

  // 3. Check skills directory in nexus-system/docs/skills/
  checks.push(checkSkillsDirectory(nexusDir));

  // 4. Check governance directory in nexus-system/governance/
  checks.push(checkGovernanceDirectory(nexusDir));

  // 5. Check context buffer in nexus-system/governance/context/
  checks.push(checkContextBuffer(nexusDir));

  // 6. Check scripts in nexus-system/scripts/
  checks.push(checkScripts(nexusDir));

  // 7. Check agent contracts in nexus-system/governance/agents/
  checks.push(checkAgentContracts(nexusDir));

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

function checkAgentsFile(nexusDir: string): StatusCheck {
  const agentsPath = join(nexusDir, "docs", "AGENTS.md");

  if (!existsSync(agentsPath)) {
    return { name: "nexus-system/docs/AGENTS.md", status: "fail", message: "File not found" };
  }

  const content = readFileSync(agentsPath, "utf-8");
  const ruleCount = (content.match(/^\d+\./gm) || []).length;

  if (ruleCount < 10) {
    return {
      name: "nexus-system/docs/AGENTS.md",
      status: "warn",
      message: `Only ${ruleCount} rules found (expected 22+)`,
    };
  }

  return {
    name: "nexus-system/docs/AGENTS.md",
    status: "pass",
    message: `${ruleCount} rules configured`,
  };
}

function checkSkillsDirectory(nexusDir: string): StatusCheck {
  const skillsDir = join(nexusDir, "docs", "skills");

  if (!existsSync(skillsDir)) {
    return { name: "nexus-system/docs/skills/", status: "warn", message: "Directory not found" };
  }

  const skillFiles = fse.readdirSync(skillsDir).filter((f: string) =>
    f.endsWith(".md")
  );

  if (skillFiles.length === 0) {
    return { name: "nexus-system/docs/skills/", status: "warn", message: "No skills found" };
  }

  return {
    name: "nexus-system/docs/skills/",
    status: "pass",
    message: `${skillFiles.length} skills installed`,
  };
}

function checkGovernanceDirectory(nexusDir: string): StatusCheck {
  const govDir = join(nexusDir, "governance");

  if (!existsSync(govDir)) {
    return { name: "nexus-system/governance/", status: "warn", message: "Directory not found" };
  }

  const hasContext = existsSync(join(govDir, "context"));
  const hasAgents = existsSync(join(govDir, "agents"));

  const parts: string[] = [];
  if (hasContext) parts.push("context");
  if (hasAgents) parts.push("agents");

  return {
    name: "nexus-system/governance/",
    status: "pass",
    message: `Contains: ${parts.join(", ") || "empty"}`,
  };
}

function checkContextBuffer(nexusDir: string): StatusCheck {
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return { name: "context_buffer.yaml", status: "warn", message: "Not found" };
  }

  const content = readFileSync(bufferPath, "utf-8");

  if (!content.includes("current_task:")) {
    return { name: "context_buffer.yaml", status: "warn", message: "Missing 'current_task' section" };
  }

  return { name: "context_buffer.yaml", status: "pass", message: "Valid" };
}

function checkScripts(nexusDir: string): StatusCheck {
  const scriptsDir = join(nexusDir, "scripts");

  if (!existsSync(scriptsDir)) {
    return { name: "nexus-system/scripts/", status: "warn", message: "Directory not found" };
  }

  const scriptFiles = fse.readdirSync(scriptsDir).filter((f: string) =>
    f.endsWith(".ts") || f.endsWith(".js")
  );

  if (scriptFiles.length === 0) {
    return { name: "nexus-system/scripts/", status: "warn", message: "No scripts found" };
  }

  return {
    name: "nexus-system/scripts/",
    status: "pass",
    message: `${scriptFiles.length} scripts installed`,
  };
}

function checkAgentContracts(nexusDir: string): StatusCheck {
  const contractsDir = join(nexusDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return { name: "agent contracts", status: "warn", message: "Not found" };
  }

  const yamlFiles = fse.readdirSync(contractsDir).filter((f: string) =>
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
  console.log(chalk.bold("  Governance Health:"));
  console.log("");

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const check of checks) {
    const { icon, color } = statusIcon(check.status);
    if (check.status === "pass") passCount++;
    else if (check.status === "warn") warnCount++;
    else failCount++;

    console.log(`    ${color(icon)} ${chalk.bold(check.name)}: ${color(check.message)}`);
  }

  console.log("");
  console.log(chalk.bold("  Summary:"));
  console.log(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  console.log("");

  if (failCount > 0) {
    console.log(chalk.red("  Run 'nexus init' to fix failed checks."));
  } else if (warnCount > 0) {
    console.log(chalk.yellow("  Some optional components are missing. Run 'nexus upgrade' to add them."));
  } else {
    console.log(chalk.green("  Governance is healthy!"));
  }

  console.log("");
}

function displayMaturityProfile(
  profile: MaturityProfile | null,
  installedCapabilities: string[]
): void {
  console.log(chalk.bold("  🎯 Maturity Profile:"));
  console.log("");

  if (!profile) {
    console.log(chalk.gray("    No maturity profile found. Run 'nexus init' to create one."));
    console.log("");
    return;
  }

  // Overall score
  const color = profile.overallScore >= 65 ? chalk.green : profile.overallScore >= 35 ? chalk.yellow : chalk.red;
  console.log(`    Overall Score: ${color(String(profile.overallScore))}/100 ${healthBar(profile.overallScore, 100)}`);
  console.log("");

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
    console.log(`    ${label.padEnd(16)} ${bar} ${String(value).padStart(3)}%`);
  }
  console.log("");

  // Capabilities
  console.log(chalk.bold("    Installed Capabilities:"));
  for (const cap of installedCapabilities) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    console.log(chalk.green(`      ✓ ${info?.name || cap}`));
  }
  console.log("");

  // Recommendations
  if (profile.recommendedCapabilities.length > 0) {
    console.log(chalk.bold("    🎯 Recommended:"));
    for (const cap of profile.recommendedCapabilities) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      console.log(chalk.cyan(`      → ${info?.name || cap}`));
    }
    console.log("");
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
    junior: "L1 (Base)",
    pleno: "L2 (Intermediária)",
    senior: "L3 (Completa)",
  };

  const color = levelColors[complexity.level] || chalk.gray;

  console.log(chalk.bold("  📊 Complexity Analysis:"));
  console.log("");
  console.log(chalk.gray("    Project Metrics:"));
  console.log(chalk.gray(`      Packages:      ${analysis.packageCount}`));
  console.log(chalk.gray(`      Apps:          ${analysis.appCount}`));
  console.log(chalk.gray(`      Source files:  ${analysis.sourceFileCount}`));
  console.log(chalk.gray(`      Dependencies:  ${analysis.dependencyCount}`));
  console.log(chalk.gray(`      Monorepo:      ${analysis.monorepo ? "yes" : "no"}`));
  console.log("");
  console.log(chalk.gray("    Score Breakdown:"));
  console.log(chalk.gray(`      Static score:  ${complexity.staticScore}`));
  console.log(chalk.gray(`      Behavior score: ${complexity.behaviorScore}`));
  console.log(chalk.bold(`      Total score:   ${complexity.score}  ${healthBar(complexity.score, 20)}`));
  console.log("");
  console.log(chalk.gray("    Current level:"));
  console.log(color(`      ${levelNames[complexity.level] || complexity.level}`));
  console.log("");
  console.log(chalk.gray("    Factors:"));

  for (const reason of complexity.reasons) {
    console.log(chalk.gray(`      • ${reason}`));
  }

  // Per-area breakdown
  if (complexity.areaScores.length > 0) {
    console.log("");
    console.log(chalk.bold("    📍 Area Breakdown:"));
    console.log("");
    console.log(chalk.gray("      Area                    Score  Bar      Lvl     Files Churn Snsve  Viol  Deps  Age   Ctx"));
    console.log(chalk.gray("      ─────────────────────── ────── ──────── ─────── ───── ───── ────── ───── ───── ───── ─────"));

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

      console.log(`      ${areaColor(areaName)} ${chalk.bold(score)} ${miniBar(area.score)} ${areaColor(level)} ${chalk.gray(files)} ${chalk.gray(churn)} ${chalk.gray(sensitive)} ${chalk.gray(violations)} ${chalk.gray(deps)} ${chalk.gray(age)} ${chalk.gray(ctx)}`);
    }
  }

  if (complexity.suggestions.length > 0) {
    console.log("");
    console.log(chalk.bold("    💡 Suggestions:"));
    for (const suggestion of complexity.suggestions) {
      console.log(chalk.cyan(`      → ${suggestion}`));
    }
  }

  console.log("");
}
