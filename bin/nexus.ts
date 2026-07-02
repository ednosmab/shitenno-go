#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

import { initCommand } from "../src/commands/init.js";
import { syncCommand } from "../src/commands/sync.js";
import { statusCommand } from "../src/commands/status.js";
import { upgradeCommand } from "../src/commands/upgrade.js";
import { validateCommand } from "../src/commands/validate.js";
import { detectCommand } from "../src/commands/detect.js";
import { auditCommand } from "../src/commands/audit.js";
import { cleanCommand } from "../src/commands/clean.js";
import { assessCommand } from "../src/commands/assess.js";
import { doctorCommand } from "../src/commands/doctor.js";
import { runCommand } from "../src/commands/run.js";
import { evolveCommand } from "../src/commands/evolve.js";
import { reportCommand } from "../src/commands/report.js";
import { digestCommand } from "../src/commands/digest.js";
import { briefingCommand } from "../src/commands/briefing.js";
import { feedbackCommand } from "../src/commands/feedback.js";
import { benchCommand } from "../src/commands/bench.js";
import { dashboardCommand } from "../src/commands/dashboard.js";
import { profileCommand } from "../src/commands/profile.js";
import { goalCommand } from "../src/commands/goal.js";
import { decideCommand } from "../src/commands/decide.js";
import { policyCommand } from "../src/commands/policy.js";
import { actCommand } from "../src/commands/act.js";
import { planCommand } from "../src/commands/plan.js";
import { shellInitCommand } from "../src/commands/shell-init.js";
import { consoleCommand } from "../src/commands/console.js";

import { getEventBus, enableEventPersistence } from "../src/event-bus.js";
import { initializeRuleEngine } from "../src/rule-engine.js";
import { initializeKnowledgeGraph } from "../src/knowledge-graph.js";
import { initializeCapabilityEngine } from "../src/capability-engine.js";
import { startSession, endSession } from "../src/session-tracker.js";
import { installMiddleware } from "../src/cli-middleware.js";
import { startWatching } from "../src/file-watcher.js";
import { registerDocSyncHook } from "../src/doc-sync-hook.js";
import { COMMAND_CATEGORIES, findCommand } from "../src/help-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

// ── Event-Driven Bootstrap ──────────────────────────────────────────────────

const projectRoot = process.cwd();
const nexusDir = join(projectRoot, "nexus-system");
const isInitialized =
  existsSync(join(projectRoot, "opencode.json")) && existsSync(nexusDir);

let currentSessionId: string | null = null;

if (isInitialized) {
  enableEventPersistence(nexusDir);
  initializeRuleEngine(projectRoot, nexusDir);
  initializeKnowledgeGraph(nexusDir);
  initializeCapabilityEngine(projectRoot, nexusDir);

  const session = startSession(nexusDir);
  currentSessionId = session.id;

  let branch: string | undefined;
  try {
    branch = execSync("git branch --show-current", {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    // not a git repo or git not available — skip
  }

  getEventBus().publish("session.start", {
    sessionId: session.id,
    projectRoot,
    agentName: branch,
  });

  // Start watching governance artifacts for changes
  startWatching(nexusDir);

  // Register doc sync hook for automatic documentation updates
  registerDocSyncHook({
    projectRoot,
    enableAutoSync: true,
    minSignificance: 0.3,
  });
}

// ── CLI Program ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("nexus")
  .description("AI governance ecosystem that grows with your project")
  .version(version);

// ── Custom Help Formatting ──────────────────────────────────────────────────

program.configureHelp({
  sortSubcommands: false,
  formatHelp(cmd, helper) {
    let output = "";
    output += `${chalk.bold.cyan("nexus")} ${chalk.gray("— AI governance ecosystem")}\n\n`;

    // Usage
    output += `${chalk.bold("Usage:")}\n`;
    output += `  nexus <command> [options]\n\n`;

    output += `${chalk.bold("Quick Start:")}\n`;
    output += `  nexus --help            ${chalk.gray("Show all commands")}\n`;
    output += `  nexus --help <command>  ${chalk.gray("Show help for a command")}\n`;
    output += `  nexus --version         ${chalk.gray("Show version")}\n\n`;

    // Command categories
    for (const category of COMMAND_CATEGORIES) {
      output += `${chalk.bold.green(category.name)}\n`;
      output += `${chalk.gray(`  ${category.description}`)}\n`;

      for (const cmd of category.commands) {
        const name = cmd.name.padEnd(14);
        output += `  ${chalk.cyan(name)} ${chalk.gray(cmd.description)}\n`;
      }
      output += "\n";
    }

    return output;
  },
});

// ── Help Command ─────────────────────────────────────────────────────────────

const helpCmd = new Command("help")
  .description("Show help for a specific command")
  .argument("[command]", "Command name to get help for")
  .action((cmdName: string | undefined) => {
    if (!cmdName) {
      program.help();
      return;
    }

    const cmd = findCommand(cmdName);
    if (!cmd) {
      console.log(chalk.red(`  Unknown command: ${cmdName}`));
      console.log(chalk.gray("  Run 'nexus --help' to see all available commands."));
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log(`${chalk.bold.cyan(`nexus ${cmd.name}`)} — ${cmd.description}`);
    console.log("");
    console.log(`${chalk.bold("Usage:")}`);
    console.log(`  ${cmd.usage}`);
    console.log("");

    if (cmd.examples.length > 0) {
      console.log(`${chalk.bold("Examples:")}`);
      for (const ex of cmd.examples) {
        console.log(`  ${chalk.gray(ex)}`);
      }
      console.log("");
    }

    if (cmd.tips && cmd.tips.length > 0) {
      console.log(`${chalk.bold("Tips:")}`);
      for (const tip of cmd.tips) {
        console.log(`  ${chalk.yellow("→")} ${tip}`);
      }
      console.log("");
    }

    // Show Commander.js help for options
    const registeredCmd = program.commands.find((c) => c.name() === cmdName);
    if (registeredCmd) {
      console.log(`${chalk.bold("Options:")}`);
      console.log(registeredCmd.helpInformation());
    }
  });

program.addCommand(helpCmd);

program.addCommand(initCommand);
program.addCommand(syncCommand);
program.addCommand(statusCommand);
program.addCommand(upgradeCommand);
program.addCommand(validateCommand);
program.addCommand(detectCommand);
program.addCommand(auditCommand);
program.addCommand(cleanCommand);
program.addCommand(assessCommand);
program.addCommand(doctorCommand);
program.addCommand(runCommand);
program.addCommand(evolveCommand);
program.addCommand(reportCommand());
program.addCommand(digestCommand());
program.addCommand(briefingCommand());
program.addCommand(feedbackCommand());
program.addCommand(benchCommand());
program.addCommand(dashboardCommand());
program.addCommand(profileCommand());
program.addCommand(goalCommand());
program.addCommand(decideCommand());
program.addCommand(policyCommand());
program.addCommand(actCommand());
program.addCommand(planCommand());
program.addCommand(consoleCommand());
program.addCommand(shellInitCommand);

// ── Middleware Pipeline ──────────────────────────────────────────────────────

installMiddleware(program, {
  projectRoot,
  nexusDir,
  sessionId: currentSessionId,
});

program.parse();

// ── Post-Execution: Session End ─────────────────────────────────────────────

if (isInitialized && currentSessionId) {
  const bus = getEventBus();
  bus.publish("session.end", {
    sessionId: currentSessionId,
    duration: 0,
    outcome: "success",
  });
  endSession(nexusDir, currentSessionId);
}
