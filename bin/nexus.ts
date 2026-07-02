#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
}

// ── CLI Program ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("nexus")
  .description("AI governance framework that grows with your project")
  .version(version);

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
