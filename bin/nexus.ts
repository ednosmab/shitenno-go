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

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

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

program.parse();
