#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

import { initCommand } from "../src/commands/init.js";
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
import { docsAuditCommand } from "../src/commands/docs-audit.js";
import { updateCommand } from "../src/commands/update.js";
import { mcpCommand } from "../src/commands/mcp.js";
import { syncCommand } from "../src/commands/sync.js";
import { remindersCommand } from "../src/commands/reminders.js";
import { historyCommand } from "../src/commands/history.js";
import { eventsCommand } from "../src/commands/events.js";
import { contextCommand } from "../src/commands/context.js";
import { handbookCommand } from "../src/commands/handbook.js";
import { watchCommand } from "../src/commands/watch.js";
import { hooksCommand } from "../src/commands/hooks.js";
import { internalScheduledCheckCommand } from "../src/commands/scheduled-check.js";

import { getEventBus, enableEventPersistence } from "../src/event-bus.js";
import { initializeRuleEngine, initializeRules } from "../src/rule-engine.js";
import { initializeKnowledgeGraph } from "../src/knowledge-graph.js";
import { initializeCapabilityEngine } from "../src/capability-engine.js";
import { startSession, endSession } from "../src/session-tracker.js";
import { setSessionContext, clearSessionContext } from "../src/session-context.js";
import { installMiddleware } from "../src/cli-middleware.js";
import { stopWatching } from "../src/file-watcher.js";
import { initPlanBacklogSync } from "../src/plan-backlog-sync.js";
import { initializeTaskPipeline } from "../src/task-pipeline.js";
import { initializeEngineeringState } from "../src/engineering-state.js";
import { initializeFromAnswers } from "../src/model-config.js";
import { registerDocSyncHook } from "../src/doc-sync-hook.js";
import { DocEngine } from "../src/doc-engine.js";
import { consolidateEngineeringState } from "../src/engineering-state.js";
import { initializeProactiveEngine } from "../src/proactive-engine.js";
import { COMMAND_CATEGORIES, findCommand } from "../src/help-data.js";
import { NEXUS_DIR_NAME } from "../src/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

// ── Event-Driven Bootstrap ──────────────────────────────────────────────────

const projectRoot = process.cwd();
const nexusDir = join(projectRoot, NEXUS_DIR_NAME);
const isInitialized = existsSync(nexusDir);

let currentSessionId: string | null = null;
let currentSessionStartedAt: string | null = null;

if (isInitialized) {
  enableEventPersistence(nexusDir);
  getEventBus().enableDeadLetterQueue(nexusDir);
  initializeRules(nexusDir);
  initializeRuleEngine(projectRoot, nexusDir);
  initializeKnowledgeGraph(nexusDir);
  initializeCapabilityEngine(projectRoot, nexusDir);
  initializeTaskPipeline({ projectRoot, nexusDir });
  initializeEngineeringState(projectRoot, nexusDir);
  initializeProactiveEngine(projectRoot, nexusDir);
  initializeFromAnswers(nexusDir);
  registerDocSyncHook({ projectRoot, enableAutoSync: true });

  const docEngine = new DocEngine(nexusDir);
  const bus = getEventBus();
  bus.subscribe("engineering_state.consolidated", () => {
    const state = consolidateEngineeringState(projectRoot, nexusDir);
    docEngine.generateAll(state);
  });

  const session = startSession(nexusDir);
  currentSessionId = session.id;
  currentSessionStartedAt = session.startedAt;
  setSessionContext(session.id, session.startedAt);

  // Skip watcher + briefing in child processes (avoids deadlock via rule engine)
  if (!process.env.NEXUS_CHILD) {
    let branch: string | undefined;
    try {
      branch = execSync("git branch --show-current", {
        encoding: "utf-8",
        timeout: 2000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // not a git repo or git not available — skip
    }

    getEventBus().publish("session.start", {
      sessionId: session.id,
      projectRoot,
      agentName: branch,
    });

    // Register sync subscribers (watcher started by watch command or other long-running commands)
    initPlanBacklogSync(projectRoot, nexusDir);

    showBriefingSummary(projectRoot, nexusDir);
  }
}

/**
 * Show Quick Board in the terminal from context_buffer.yaml.
 * Regenerates BRIEFING.md if stale (> 1 day old) for other consumers.
 */
function showBriefingSummary(projectRoot: string, nexusDir: string): void {
  try {
    // Auto-regenerate BRIEFING.md if stale (> 1 day old) — feeds audit detectors, opencode.json
    const briefingPath = join(nexusDir, "BRIEFING.md");
    if (existsSync(briefingPath)) {
      const stat = require("node:fs").statSync(briefingPath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > 86400000) {
        try {
          const { collectContext } = require("../src/context-collector.js");
          const { briefingToMarkdown } = require("../src/briefing.js");
          const snapshot = collectContext(projectRoot, nexusDir);
          const md = briefingToMarkdown(snapshot.briefing);
          require("node:fs").writeFileSync(briefingPath, md, "utf-8");
        } catch {
          // Regeneration failed — continue with stale file
        }
      }
    }

    // Read Quick Board from context_buffer.yaml
    const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
    if (!existsSync(bufferPath)) return;

    const { parse: parseYaml } = require("yaml");
    const data = parseYaml(readFileSync(bufferPath, "utf-8")) || {};

    const currentTask = data?.current_task?.description
      ? `${data.current_task.description} (${data.current_task.status})`
      : "Nenhuma";

    const sessionStatus = data?.session?.status === "completed"
      ? "Concluída"
      : data?.session?.status === "in_progress" || data?.session?.status === "active"
        ? "Em curso"
        : "Desconhecido";

    let p1Debts = "Nenhuma";
    try {
      if (data?.technical_debt?.length > 0) {
        p1Debts = data.technical_debt
          .filter((d: { priority?: string; severity?: string }) => d.priority === "P1" || d.severity === "high")
          .map((d: { description: string }) => d.description)
          .join(", ") || "Nenhuma";
      }
    } catch {
      // Ignore parse errors
    }

    let nextP0 = data?.next_p0 || "Definir";
    try {
      const backlogPath = join(nexusDir, "docs", "BACKLOG.md");
      if (existsSync(backlogPath)) {
        const backlog = readFileSync(backlogPath, "utf-8");
        const p0Section = backlog.split(/^## P0 /m)?.[1]?.split(/^## P1 /m)?.[0] ?? "";
        const p0Items = p0Section.split(/^### /m).slice(1);
        for (const item of p0Items) {
          const title = item.split("\n")[0]?.trim();
          if (title && item.includes("| **Status** | In Progress")) {
            nextP0 = title;
            break;
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    console.log("");
    console.log(chalk.gray("  📋 Quick Board:"));
    console.log(chalk.gray(`     Tarefa: ${currentTask} | P0: ${nextP0}`));
    console.log(chalk.gray(`     Dívidas P1: ${p1Debts} | Estado: ${sessionStatus}`));
    console.log("");
  } catch {
    // Quick Board not available — skip silently
  }
}

// ── CLI Program ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("nexus")
  .description("AI governance ecosystem that grows with your project")
  .version(version)
  .option("--quiet", "Suppress informational output (errors only)")
  .option("--no-color", "Disable colored output")
  .hook("preAction", () => {
    const globalOpts = program.opts();
    if (globalOpts.quiet) {
      process.env.NEXUS_QUIET = "1";
    }
    if (globalOpts.color === false) {
      chalk.level = 0;
    }
  });

// ── Custom Help Formatting ──────────────────────────────────────────────────

program.configureHelp({
  sortSubcommands: false,
  formatHelp(_cmd, _helper) {
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
program.addCommand(docsAuditCommand);
program.addCommand(updateCommand);
program.addCommand(mcpCommand());
program.addCommand(syncCommand);
program.addCommand(remindersCommand());
program.addCommand(historyCommand);
program.addCommand(eventsCommand);
program.addCommand(contextCommand);
program.addCommand(handbookCommand);
program.addCommand(watchCommand());
program.addCommand(hooksCommand);
program.addCommand(internalScheduledCheckCommand);

// ── Middleware Pipeline ──────────────────────────────────────────────────────

installMiddleware(program, {
  projectRoot,
  nexusDir,
  sessionId: currentSessionId,
});

await program.parseAsync();

// ── Post-Execution: Session End ─────────────────────────────────────────────

if (isInitialized && currentSessionId) {
  const bus = getEventBus();
  const endedAt = new Date();
  const duration = currentSessionStartedAt
    ? Math.round((endedAt.getTime() - new Date(currentSessionStartedAt).getTime()) / 60000)
    : 0;
  bus.publish("session.end", {
    sessionId: currentSessionId,
    duration,
    outcome: "success",
  });
  endSession(nexusDir, currentSessionId);
  clearSessionContext();
  if (!process.env.NEXUS_CHILD) {
    stopWatching();
  }
}
