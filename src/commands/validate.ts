import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import { execSync } from "node:child_process";

interface ValidationResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export const validateCommand = new Command("validate")
  .description("Validate session integrity")
  .option("-d, --dir <path>", "Project directory (default: current)", ".")
  .option("--fix", "Attempt to fix issues automatically")
  .action((options) => {
    const targetDir = resolve(options.dir);

    console.log("");
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║    nexus validate — Session Check    ║"));
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
        chalk.gray("  Run 'nexus init' first.")
      );
      console.log("");
      return;
    }

    const results = runValidationChecks(targetDir);
    displayValidationResults(results, options.fix, targetDir);
  });

function runValidationChecks(targetDir: string): ValidationResult[] {
  const results: ValidationResult[] = [];

  // 1. Check context buffer
  results.push(checkContextBuffer(targetDir));

  // 2. Check ADR directory
  results.push(checkAdrDirectory(targetDir));

  // 3. Check opencode.json consistency
  results.push(checkOpencodeConsistency(targetDir));

  // 4. Check agent contracts
  results.push(checkAgentContracts(targetDir));

  // 5. Check if session is in progress
  results.push(checkSessionStatus(targetDir));

  // 6. Check git status
  results.push(checkGitStatus(targetDir));

  return results;
}

function checkContextBuffer(targetDir: string): ValidationResult {
  const bufferPath = join(targetDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return {
      name: "Context Buffer",
      status: "warn",
      message: "context_buffer.yaml not found (optional)",
    };
  }

  try {
    const content = readFileSync(bufferPath, "utf-8");

    if (!content.includes("session:")) {
      return {
        name: "Context Buffer",
        status: "warn",
        message: "Missing 'session' section",
      };
    }

    if (!content.includes("current_task:")) {
      return {
        name: "Context Buffer",
        status: "warn",
        message: "Missing 'current_task' section",
      };
    }

    return {
      name: "Context Buffer",
      status: "pass",
      message: "Valid structure",
    };
  } catch {
    return {
      name: "Context Buffer",
      status: "fail",
      message: "Error reading file",
    };
  }
}

function checkAdrDirectory(targetDir: string): ValidationResult {
  const adrDir = join(targetDir, "docs", "adrs");

  if (!existsSync(adrDir)) {
    return {
      name: "ADR Directory",
      status: "warn",
      message: "docs/adrs/ not found",
    };
  }

  const adrFiles = require("fs").readdirSync(adrDir).filter((f: string) =>
    f.endsWith(".md")
  );

  if (adrFiles.length === 0) {
    return {
      name: "ADR Directory",
      status: "warn",
      message: "No ADRs found",
    };
  }

  return {
    name: "ADR Directory",
    status: "pass",
    message: `${adrFiles.length} ADRs exist`,
  };
}

function checkOpencodeConsistency(targetDir: string): ValidationResult {
  const configPath = join(targetDir, "opencode.json");

  if (!existsSync(configPath)) {
    return {
      name: "opencode.json",
      status: "fail",
      message: "File not found",
    };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    const issues: string[] = [];

    if (!config.model) {
      issues.push("missing 'model'");
    }

    if (!config.agent) {
      issues.push("missing 'agent'");
    } else {
      const agents = Object.keys(config.agent);
      if (agents.length === 0) {
        issues.push("no agents configured");
      }

      // Check for required agent roles
      const requiredRoles = ["plan", "build", "review"];
      for (const role of requiredRoles) {
        if (!agents.includes(role)) {
          issues.push(`missing '${role}' agent`);
        }
      }
    }

    if (issues.length > 0) {
      return {
        name: "opencode.json",
        status: "warn",
        message: `Issues: ${issues.join(", ")}`,
      };
    }

    return {
      name: "opencode.json",
      status: "pass",
      message: "Consistent configuration",
    };
  } catch {
    return {
      name: "opencode.json",
      status: "fail",
      message: "Invalid JSON",
    };
  }
}

function checkAgentContracts(targetDir: string): ValidationResult {
  const contractsDir = join(targetDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: "governance/agents/ not found",
    };
  }

  const yamlFiles = require("fs").readdirSync(contractsDir).filter((f: string) =>
    f.endsWith(".yaml") || f.endsWith(".yml")
  );

  if (yamlFiles.length === 0) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: "No contracts found",
    };
  }

  // Validate each contract
  const invalidContracts: string[] = [];
  for (const file of yamlFiles) {
    const content = readFileSync(join(contractsDir, file), "utf-8");
    if (!content.includes("agent:") || !content.includes("name:")) {
      invalidContracts.push(file);
    }
  }

  if (invalidContracts.length > 0) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: `Invalid contracts: ${invalidContracts.join(", ")}`,
    };
  }

  return {
    name: "Agent Contracts",
    status: "pass",
    message: `${yamlFiles.length} valid contracts`,
  };
}

function checkSessionStatus(targetDir: string): ValidationResult {
  const bufferPath = join(targetDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return {
      name: "Session Status",
      status: "warn",
      message: "No context buffer",
    };
  }

  const content = readFileSync(bufferPath, "utf-8");

  if (content.includes("in_progress")) {
    return {
      name: "Session Status",
      status: "pass",
      message: "Session in progress",
    };
  }

  if (content.includes("completed")) {
    return {
      name: "Session Status",
      status: "pass",
      message: "Session completed",
    };
  }

  return {
    name: "Session Status",
    status: "warn",
    message: "Unknown session status",
  };
}

function checkGitStatus(targetDir: string): ValidationResult {
  try {
    const gitDir = join(targetDir, ".git");
    if (!existsSync(gitDir)) {
      return {
        name: "Git Status",
        status: "warn",
        message: "Not a git repository",
      };
    }

    const output = execSync("git status --porcelain", {
      cwd: targetDir,
      encoding: "utf-8",
      timeout: 5000,
    });

    const lines = output.trim().split("\n").filter((l) => l.length > 0);

    if (lines.length === 0) {
      return {
        name: "Git Status",
        status: "pass",
        message: "Working tree clean",
      };
    }

    return {
      name: "Git Status",
      status: "warn",
      message: `${lines.length} uncommitted changes`,
    };
  } catch {
    return {
      name: "Git Status",
      status: "warn",
      message: "Could not check git status",
    };
  }
}

function displayValidationResults(
  results: ValidationResult[],
  fix: boolean,
  targetDir: string
): void {
  console.log(chalk.bold("  Validation Results:"));
  console.log("");

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const result of results) {
    let icon: string;
    let color: typeof chalk.green;

    switch (result.status) {
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

    console.log(`    ${color(icon)} ${chalk.bold(result.name)}: ${color(result.message)}`);
  }

  console.log("");
  console.log(chalk.bold("  Summary:"));
  console.log(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  console.log("");

  if (failCount > 0 && fix) {
    console.log(chalk.yellow("  Attempting to fix issues..."));
    console.log("");

    // Try to fix common issues
    const fixResults = attemptFixes(targetDir, results);

    if (fixResults.length > 0) {
      console.log(chalk.green("  Fixed:"));
      for (const fix of fixResults) {
        console.log(chalk.green(`    ✔ ${fix}`));
      }
      console.log("");
    }
  }

  if (failCount > 0) {
    console.log(
      chalk.red("  Some checks failed. Run 'nexus validate --fix' to attempt repairs.")
    );
  } else if (warnCount > 0) {
    console.log(
      chalk.yellow("  Session is valid with warnings.")
    );
  } else {
    console.log(
      chalk.green("  Session is valid!")
    );
  }

  console.log("");
}

function attemptFixes(targetDir: string, results: ValidationResult[]): string[] {
  const fixes: string[] = [];

  for (const result of results) {
    if (result.status !== "fail") continue;

    // Fix missing opencode.json
    if (result.name === "opencode.json" && result.message === "File not found") {
      const configPath = join(targetDir, "opencode.json");
      const defaultConfig = {
        $schema: "https://opencode.ai/config.json",
        model: "opencode/mimo-v2.5-free",
        default_agent: "plan",
        agent: {
          plan: { role: "planner", model: "opencode/mimo-v2.5-free" },
          build: { role: "executor", model: "opencode/deepseek-v4-flash-free" },
          review: { role: "auditor", model: "opencode/mimo-v2.5-free" },
        },
      };

      require("fs").writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      fixes.push("Created default opencode.json");
    }

    // Fix missing context buffer
    if (result.name === "Context Buffer" && result.message.includes("not found")) {
      const bufferDir = join(targetDir, "governance", "context");
      require("fs").mkdirSync(bufferDir, { recursive: true });

      const defaultBuffer = `session:
  id: "new"
  status: "initialized"

current_task:
  status: "pending"

blockers: []
next_steps: []
technical_debt: []
documents_loaded: []
`;

      require("fs").writeFileSync(join(bufferDir, "context_buffer.yaml"), defaultBuffer);
      fixes.push("Created default context_buffer.yaml");
    }
  }

  return fixes;
}
