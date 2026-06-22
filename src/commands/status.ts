import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import fse from "fs-extra";

interface StatusCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export const statusCommand = new Command("status")
  .description("Check governance health status")
  .option("-d, --dir <path>", "Project directory (default: current)", ".")
  .action((options) => {
    const targetDir = resolve(options.dir);

    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║      nexus status — Health Check     ║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log("");

    // Check if project is initialized
    if (!existsSync(resolve(targetDir, "opencode.json"))) {
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

    const checks = runHealthChecks(targetDir);
    displayResults(checks);
  });

function runHealthChecks(targetDir: string): StatusCheck[] {
  const checks: StatusCheck[] = [];

  // 1. Check opencode.json
  checks.push(checkOpencodeConfig(targetDir));

  // 2. Check AGENTS.md
  checks.push(checkAgentsFile(targetDir));

  // 3. Check skills directory
  checks.push(checkSkillsDirectory(targetDir));

  // 4. Check governance directory
  checks.push(checkGovernanceDirectory(targetDir));

  // 5. Check context buffer
  checks.push(checkContextBuffer(targetDir));

  // 6. Check scripts
  checks.push(checkScripts(targetDir));

  // 7. Check agent contracts
  checks.push(checkAgentContracts(targetDir));

  return checks;
}

function checkOpencodeConfig(targetDir: string): StatusCheck {
  const configPath = join(targetDir, "opencode.json");

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

function checkAgentsFile(targetDir: string): StatusCheck {
  const agentsPath = join(targetDir, "docs", "AGENTS.md");

  if (!existsSync(agentsPath)) {
    return { name: "docs/AGENTS.md", status: "fail", message: "File not found" };
  }

  const content = readFileSync(agentsPath, "utf-8");
  const ruleCount = (content.match(/^\d+\./gm) || []).length;

  if (ruleCount < 10) {
    return {
      name: "docs/AGENTS.md",
      status: "warn",
      message: `Only ${ruleCount} rules found (expected 22+)`,
    };
  }

  return {
    name: "docs/AGENTS.md",
    status: "pass",
    message: `${ruleCount} rules configured`,
  };
}

function checkSkillsDirectory(targetDir: string): StatusCheck {
  const skillsDir = join(targetDir, "docs", "skills");

  if (!existsSync(skillsDir)) {
    return { name: "docs/skills/", status: "warn", message: "Directory not found" };
  }

  const skillFiles = fse.readdirSync(skillsDir).filter((f: string) =>
    f.endsWith(".md")
  );

  if (skillFiles.length === 0) {
    return { name: "docs/skills/", status: "warn", message: "No skills found" };
  }

  return {
    name: "docs/skills/",
    status: "pass",
    message: `${skillFiles.length} skills installed`,
  };
}

function checkGovernanceDirectory(targetDir: string): StatusCheck {
  const govDir = join(targetDir, "governance");

  if (!existsSync(govDir)) {
    return { name: "governance/", status: "warn", message: "Directory not found (optional)" };
  }

  const hasContext = existsSync(join(govDir, "context"));
  const hasAgents = existsSync(join(govDir, "agents"));

  const parts: string[] = [];
  if (hasContext) parts.push("context");
  if (hasAgents) parts.push("agents");

  return {
    name: "governance/",
    status: "pass",
    message: `Contains: ${parts.join(", ") || "empty"}`,
  };
}

function checkContextBuffer(targetDir: string): StatusCheck {
  const bufferPath = join(targetDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return { name: "context_buffer.yaml", status: "warn", message: "Not found (optional)" };
  }

  const content = readFileSync(bufferPath, "utf-8");

  if (!content.includes("current_task:")) {
    return { name: "context_buffer.yaml", status: "warn", message: "Missing 'current_task' section" };
  }

  return { name: "context_buffer.yaml", status: "pass", message: "Valid" };
}

function checkScripts(targetDir: string): StatusCheck {
  const scriptsDir = join(targetDir, "scripts");

  if (!existsSync(scriptsDir)) {
    return { name: "scripts/", status: "warn", message: "Directory not found" };
  }

  const scriptFiles = fse.readdirSync(scriptsDir).filter((f: string) =>
    f.endsWith(".ts") || f.endsWith(".js")
  );

  if (scriptFiles.length === 0) {
    return { name: "scripts/", status: "warn", message: "No scripts found" };
  }

  return {
    name: "scripts/",
    status: "pass",
    message: `${scriptFiles.length} scripts installed`,
  };
}

function checkAgentContracts(targetDir: string): StatusCheck {
  const contractsDir = join(targetDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return { name: "agent contracts", status: "warn", message: "Not found (optional)" };
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
