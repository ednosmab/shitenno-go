import { Command } from "commander";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import chalk from "chalk";
import fse from "fs-extra";
import { calculateComplexityScore, writeComplexityReport, type ComplexityReport } from "../scorer.js";
import { analyseProject, type ProjectAnalysis } from "../analyser.js";

interface StatusCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

function detectNexusProject(startDir: string): { root: string; nexusDir: string } | null {
  let current = startDir;

  while (true) {
    // Check for opencode.json at this level
    const hasOpencode = existsSync(join(current, "opencode.json"));

    // Check for nexus-system/ directory
    const hasNexusSystem = existsSync(join(current, "nexus-system"));

    if (hasOpencode || hasNexusSystem) {
      return {
        root: current,
        nexusDir: join(current, "nexus-system"),
      };
    }

    // Walk up
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export const statusCommand = new Command("status")
  .description("Check governance health status")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .action((options) => {
    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║      nexus status — Health Check     ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log("");

    // Auto-detect or use provided directory
    let projectRoot: string;
    let nexusDir: string;

    if (options.dir) {
      projectRoot = resolve(options.dir);
      nexusDir = join(projectRoot, "nexus-system");
    } else {
      const detected = detectNexusProject(process.cwd());
      if (!detected) {
        console.log(
          chalk.yellow(
            "  ⚠ This project is not initialized with nexus."
          )
        );
        console.log(
          chalk.gray("  Run 'nexus init' to initialize governance.")
        );
        console.log("");
        return;
      }
      projectRoot = detected.root;
      nexusDir = detected.nexusDir;
    }

    // Check if opencode.json exists at project root
    if (!existsSync(resolve(projectRoot, "opencode.json"))) {
      console.log(
        chalk.yellow(
          "  ⚠ opencode.json not found at project root."
        )
      );
      console.log(
        chalk.gray("  Run 'nexus init' to initialize governance.")
      );
      console.log("");
      return;
    }

    // Check if nexus-system/ exists
    if (!existsSync(nexusDir)) {
      console.log(
        chalk.yellow(
          "  ⚠ nexus-system/ directory not found."
        )
      );
      console.log(
        chalk.gray("  Run 'nexus init' to initialize governance.")
      );
      console.log("");
      return;
    }

    console.log(chalk.bold("  Project root:"));
    console.log(chalk.gray(`    ${projectRoot}`));
    console.log("");

    const checks = runHealthChecks(projectRoot, nexusDir);
    displayResults(checks);

    // Complexity analysis
    const analysis = analyseProject(projectRoot);
    const complexity = calculateComplexityScore(projectRoot, nexusDir, analysis);
    displayComplexityReport(complexity, analysis);

    // Write report to reports/
    const reportFile = writeComplexityReport(projectRoot, nexusDir, complexity);
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
    let icon: string;
    let color: typeof chalk.green;

    switch (check.status) {
      case "pass":
        icon = "✔";
        color = chalk.green;
        passCount++;
        break;
      case "warn":
        icon = "⚠";
        color = chalk.yellow;
        warnCount++;
        break;
      case "fail":
        icon = "✘";
        color = chalk.red;
        failCount++;
        break;
    }

    console.log(`    ${color(icon)} ${chalk.bold(check.name)}: ${color(check.message)}`);
  }

  console.log("");
  console.log(chalk.bold("  Summary:"));
  console.log(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  console.log("");

  if (failCount > 0) {
    console.log(
      chalk.red("  Run 'nexus init' to fix failed checks.")
    );
  } else if (warnCount > 0) {
    console.log(
      chalk.yellow("  Some optional components are missing. Run 'nexus upgrade' to add them.")
    );
  } else {
    console.log(
      chalk.green("  Governance is healthy!")
    );
  }

  console.log("");
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
  console.log(chalk.bold(`      Total score:   ${complexity.score}`));
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
    console.log(chalk.gray("      Area                    Score  Lvl     Files Churn Snsve  Viol  Deps  Age   Ctx"));
    console.log(chalk.gray("      ─────────────────────── ────── ─────── ───── ───── ────── ───── ───── ───── ─────"));

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

      console.log(`      ${areaColor(areaName)} ${chalk.bold(score)}  ${areaColor(level)} ${chalk.gray(files)} ${chalk.gray(churn)} ${chalk.gray(sensitive)} ${chalk.gray(violations)} ${chalk.gray(deps)} ${chalk.gray(age)} ${chalk.gray(ctx)}`);
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
