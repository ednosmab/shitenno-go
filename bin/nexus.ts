#!/usr/bin/env node

import { Command } from "commander";
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

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

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

program.parse();
