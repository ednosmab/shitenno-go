import { Command } from "commander";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { execSync } from "node:child_process";
import { outputJson, statusIcon, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import { output, outputBlank } from "../output.js";

interface ValidationResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export const validateCommand = new Command("validate")
  .description("Validate session integrity")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--fix", "Attempt to fix issues automatically")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    if (!isJson) {
      outputBlank();
      banner("nexus validate", "Session Check");
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("validate", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    const results = runValidationChecks(ctx.projectRoot);

    // Publish event
    const passCount = results.filter((r) => r.status === "pass").length;
    const warnCount = results.filter((r) => r.status === "warn").length;
    const failCount = results.filter((r) => r.status === "fail").length;
    const passed = failCount === 0;
    const issues = results
      .filter((r) => r.status !== "pass")
      .map((r) => `${r.name}: ${r.message}`);
    getEventBus().publish("validation.completed", {
      validatorType: "session",
      passed,
      issues,
      duration: 0,
    });

    // JSON output
    if (isJson) {
      outputJson({
        projectRoot: ctx.projectRoot,
        results: results.map((r) => ({ name: r.name, status: r.status, message: r.message })),
        passCount,
        warnCount,
        failCount,
        summary: `${passCount} passed, ${warnCount} warnings, ${failCount} failed`,
      });
      return;
    }

    displayValidationResults(results, options.fix, ctx.projectRoot);
  });

function runValidationChecks(targetDir: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const nexusDir = join(targetDir, NEXUS_DIR_NAME);

  // 1. Check context buffer
  results.push(checkContextBuffer(nexusDir));

  // 2. Check ADR directory
  results.push(checkAdrDirectory(nexusDir));

  // 3. Check opencode.json consistency
  results.push(checkOpencodeConsistency(targetDir));

  // 4. Check agent contracts
  results.push(checkAgentContracts(nexusDir));

  // 5. Check if session is in progress
  results.push(checkSessionStatus(nexusDir));

  // 6. Check git status
  results.push(checkGitStatus(targetDir));

  return results;
}

function checkContextBuffer(nexusDir: string): ValidationResult {
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return {
      name: "Context Buffer",
      status: "warn",
      message: "nexus-system/governance/context/context_buffer.yaml not found",
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

function checkAdrDirectory(nexusDir: string): ValidationResult {
  const adrDir = join(nexusDir, "docs", "adrs");

  if (!existsSync(adrDir)) {
    return {
      name: "ADR Directory",
      status: "warn",
      message: "nexus-system/docs/adrs/ not found",
    };
  }

  const adrFiles = readdirSync(adrDir).filter((f: string) =>
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

function checkAgentContracts(nexusDir: string): ValidationResult {
  const contractsDir = join(nexusDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: "nexus-system/governance/agents/ not found",
    };
  }

  const yamlFiles = readdirSync(contractsDir).filter((f: string) =>
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

function checkSessionStatus(nexusDir: string): ValidationResult {
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");

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

    const gitOutput = execSync("git status --porcelain", {
      cwd: targetDir,
      encoding: "utf-8",
      timeout: 5000,
    });

    const lines = gitOutput.trim().split("\n").filter((l) => l.length > 0);

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
  output(chalk.bold("  Validation Results:"));
  outputBlank();

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const result of results) {
    const { icon, color } = statusIcon(result.status);
    if (result.status === "pass") passCount++;
    else if (result.status === "warn") warnCount++;
    else failCount++;

    output(`    ${color(icon)} ${chalk.bold(result.name)}: ${color(result.message)}`);
  }

  outputBlank();
  output(chalk.bold("  Summary:"));
  output(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  outputBlank();

  if (failCount > 0 && fix) {
    output(chalk.yellow("  Attempting to fix issues..."));
    outputBlank();

    const fixResults = attemptFixes(targetDir, results);

    if (fixResults.length > 0) {
      output(chalk.green("  Fixed:"));
      for (const fix of fixResults) {
        output(chalk.green(`    ✔ ${fix}`));
      }
      outputBlank();
    }
  }

  if (failCount > 0) {
    output(chalk.red("  Some checks failed. Run 'nexus validate --fix' to attempt repairs."));
  } else if (warnCount > 0) {
    output(chalk.yellow("  Session is valid with warnings."));
  } else {
    output(chalk.green("  Session is valid!"));
  }

  outputBlank();
}

function attemptFixes(targetDir: string, results: ValidationResult[]): string[] {
  const fixes: string[] = [];
  const nexusDir = join(targetDir, NEXUS_DIR_NAME);

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

      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      fixes.push("Created default opencode.json");
    }

    // Fix missing context buffer
    if (result.name === "Context Buffer" && result.message.includes("not found")) {
      const bufferDir = join(nexusDir, "governance", "context");
      mkdirSync(bufferDir, { recursive: true });

      const defaultBuffer = `# CONTEXT_BUFFER — Memória RAM do Sistema

quick_board_required: true

quick_board:
  em_curso: null
  parado: []
  proximo: []
  p1_paralelas: []

reminders: []

milestone:
  status: "NO_SESSION"
  closed_at: null
  adr_reference: null
  commits: []
  next_phase: null

session:
  id: null
  branch: null
  operation_type: null
  last_commit: null
  status: "idle"
  closed_at: null
  reminder: null

current_task:
  id: null
  type: null
  description: null
  status: "idle"
  plan_file: null
  current_step: null
  model_assignments: []
  adr: null

adr:
  last: null
  created: null

blockers: []

next_steps: []

last_decision:
  adr: null
  description: null

technical_debt: []

documents_loaded: []
`;

      writeFileSync(join(bufferDir, "context_buffer.yaml"), defaultBuffer);
      fixes.push("Created default context_buffer.yaml in nexus-system/governance/context/");
    }
  }

  return fixes;
}
