/**
 * upgrade.ts — Capability-based Upgrade (thin router)
 *
 * Sub-commands are extracted to src/commands/upgrade/*.ts for maintainability.
 */

import { Command } from "commander";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import { invalidateCache } from "../cache.js";
import { outputJson } from "../formatting.js";
import { CAPABILITIES, detectCapabilitySignalsFromFilesystem, loadMaturityProfile, type Capability } from "../maturity-profile.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { recordFeedback } from "../feedback-loops.js";
import { readManifest, writeManifest, updateManifest } from "../manifest.js";
import { logger } from "../logger.js";
import { output, outputBlank, outputSection, outputSuccess, outputError, outputWarning } from "../output.js";
import { installCapabilities } from "./upgrade/helpers.js";
import { updateSystemMapStatus } from "./upgrade/system-map.js";
import { updateAgentsMdWithCapabilities } from "./upgrade/agents-md.js";

// ── Main command ───────────────────────────────────────────────────────────

export const upgradeCommand = new Command("upgrade")
  .description("Add capabilities to your governance ecosystem")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("-c, --capability <cap>", "Capability to add")
  .option("--list", "List all capabilities and their status")
  .option("--accept-recommended", "Install all recommended capabilities")
  .option("--json", "Output results as JSON")
  .option("--dry-run", "Show what would be installed without writing files")
  .action(async (options) => {
    const isJson = options.json === true;
    const isDryRun = options.dryRun === true;
    const targetDir = resolve(options.dir || ".");

    if (!isJson) { output(""); outputSection(isDryRun ? "shiten upgrade — Dry Run" : "shiten upgrade — Add Capabilities"); outputBlank(); }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;
    if (!checkLifecycleGate("upgrade", ctx.projectRoot, ctx.shitenDir, isJson)) return;

    const installed = detectCapabilitySignalsFromFilesystem(ctx.shitenDir);

    if (isDryRun) return handleDryRun(ctx.shitenDir, installed, isJson);
    if (options.list) return handleList(ctx.projectRoot, installed, isJson);
    if (options.acceptRecommended) return handleAcceptRecommended(ctx, targetDir, installed, isJson);
    return handleInstallCapability(ctx, targetDir, options.capability, installed, isJson);
  });

// ── Handlers ───────────────────────────────────────────────────────────────

async function handleDryRun(shitenDir: string, installed: string[], isJson: boolean) {
  const profile = loadMaturityProfile(shitenDir);
  const toInstall = (profile?.recommendedCapabilities ?? []).filter((cap) => !installed.includes(cap));
  const allCaps = CAPABILITIES.map((cap) => ({ id: cap.id, name: cap.name, status: installed.includes(cap.id) ? "installed" : toInstall.includes(cap.id) ? "would install" : "available" }));

  if (isJson) { outputJson({ dryRun: true, installed, wouldInstall: toInstall, capabilities: allCaps }); return; }

  outputSection("Dry Run — No files will be modified.");
  outputBlank();
  outputSection("Currently installed:");
  for (const cap of installed) { const info = CAPABILITIES.find((c) => c.id === cap); outputSuccess(`    ✔ ${info?.name || cap}`); }
  if (toInstall.length > 0) { outputBlank(); outputSection("Would install:"); for (const cap of toInstall) { const info = CAPABILITIES.find((c) => c.id === cap); output(chalk.cyan(`    → ${info?.name || cap}`)); } }
  outputBlank();
  output(chalk.gray("  Run without --dry-run to apply changes."));
}

function handleList(projectRoot: string, installed: string[], isJson: boolean) {
  if (isJson) {
    const capabilities = CAPABILITIES.map((cap) => ({ id: cap.id, name: cap.name, description: cap.description, status: installed.includes(cap.id) ? "installed" : "available", alwaysInstalled: cap.alwaysInstalled }));
    outputJson({ projectRoot, installed, capabilities });
  } else {
    outputSection("Capabilities Status:");
    outputBlank();
    for (const cap of CAPABILITIES) {
      const isInstalled = installed.includes(cap.id);
      const icon = isInstalled ? chalk.green("✔") : chalk.gray("□");
      const name = isInstalled ? chalk.bold(cap.name) : chalk.gray(cap.name);
      const status = isInstalled ? chalk.green("installed") : chalk.gray("available");
      output(`    ${icon} ${name} — ${chalk.gray(cap.description)} [${status}]`);
    }
    outputBlank();
    output(chalk.gray("  Use 'shiten upgrade --capability <name>' to add a capability."));
    output(chalk.gray("  Use 'shiten upgrade --accept-recommended' to install all recommended."));
    outputBlank();
  }
}

async function handleAcceptRecommended(ctx: { shitenDir: string; projectRoot: string }, targetDir: string, installed: string[], isJson: boolean) {
  const profile = loadMaturityProfile(ctx.shitenDir);
  if (!profile) {
    if (isJson) outputJson({ error: "no_profile", message: "No maturity profile found. Run 'shiten init' first." });
    else { outputWarning("  ⚠ No maturity profile found."); output(chalk.gray("  Run 'shiten init' first.")); outputBlank(); }
    return;
  }

  const toInstall = profile.recommendedCapabilities.filter((cap) => !installed.includes(cap));
  if (toInstall.length === 0) {
    if (isJson) outputJson({ message: "All recommended capabilities already installed", installed });
    else { outputSuccess("  ✔ All recommended capabilities are already installed!"); outputBlank(); }
    return;
  }

  const spinner = ora(`Installing ${toInstall.length} capability(ies)...`).start();
  const result = installCapabilities(targetDir, toInstall as Capability[]);
  spinner.succeed(`Installed ${result.filesInstalled} file(s) in ${result.directoriesCreated} directory(ies)`);

  const allInstalled = [...installed, ...toInstall] as Capability[];
  updateAgentsMdWithCapabilities(targetDir, allInstalled);
  updateSystemMapStatus(targetDir, allInstalled);

  const currentManifest = readManifest(ctx.shitenDir);
  const { readFileSync: readFS } = await import("node:fs");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  let cliVersion = "unknown";
  try { const pkg = JSON.parse(readFS(join(__dirname, "..", "..", "package.json"), "utf-8")); cliVersion = pkg.version || "unknown"; } catch { /* fallback */ }
  const updatedManifest = updateManifest(currentManifest, cliVersion, ctx.shitenDir, [...installed, ...toInstall] as Capability[], profile?.overallScore ?? 0);
  writeManifest(ctx.shitenDir, updatedManifest);
  invalidateCache(targetDir);

  for (const cap of toInstall) {
    const capInfo = CAPABILITIES.find((c) => c.id === cap);
    getEventBus().publish("capability.installed", { capabilityId: cap, capabilityName: capInfo?.name ?? cap, version: cliVersion });
    recordFeedback(ctx.shitenDir, { recommendationId: `cap-${cap}`, action: "accepted", context: { maturityScore: 0, installedCapabilities: installed, knowledgeDebt: 0 } });
  }

  if (isJson) outputJson({ installed: toInstall, filesInstalled: result.filesInstalled, directoriesCreated: result.directoriesCreated });
  else { outputBlank(); outputSuccess("  ✔ Capabilities installed!"); outputBlank(); for (const cap of toInstall) { const info = CAPABILITIES.find((c) => c.id === cap); output(chalk.cyan(`    ✓ ${info?.name || cap}`)); } outputBlank(); }
}

async function handleInstallCapability(ctx: { shitenDir: string; projectRoot: string }, targetDir: string, targetCapability: string | undefined, installed: string[], isJson: boolean) {
  if (!targetCapability) {
    const available = CAPABILITIES.filter((cap) => !cap.alwaysInstalled && !installed.includes(cap.id));
    if (available.length === 0) {
      if (isJson) outputJson({ message: "All capabilities already installed", installed });
      else { outputSuccess("  ✔ All capabilities are already installed!"); outputBlank(); }
      return;
    }
    const { select } = await import("inquirer").then((mod) => mod.default.prompt([{ type: "list", name: "select", message: "Select capability to add:", choices: available.map((cap) => ({ name: `${cap.name} — ${cap.description}`, value: cap.id })) }]));
    targetCapability = select;
  }

  const capInfo = CAPABILITIES.find((c) => c.id === targetCapability);
  if (!capInfo) {
    if (isJson) outputJson({ error: "invalid_capability", message: `Invalid capability: ${targetCapability}. Valid: ${CAPABILITIES.map((c) => c.id).join(", ")}` });
    else { outputError(`  ✘ Invalid capability: ${targetCapability}`); output(chalk.gray(`  Valid: ${CAPABILITIES.map((c) => c.id).join(", ")}`)); }
    return;
  }

  if (installed.includes(targetCapability as Capability)) {
    if (isJson) outputJson({ error: "already_installed", message: `Capability '${targetCapability}' is already installed.`, installed });
    else { outputWarning(`  ⚠ Capability '${capInfo.name}' is already installed.`); outputBlank(); }
    return;
  }

  const depsMet = capInfo.requires.every((req) => installed.includes(req));
  if (!depsMet) {
    const missing = capInfo.requires.filter((req) => !installed.includes(req));
    if (isJson) outputJson({ error: "missing_dependencies", message: `Missing dependencies: ${missing.join(", ")}`, missing });
    else { outputError(`  ✘ Missing dependencies: ${missing.join(", ")}`); output(chalk.gray("  Install these capabilities first.")); }
    return;
  }

  const spinner = ora(`Installing ${capInfo.name}...`).start();
  try {
    const result = installCapabilities(targetDir, [targetCapability as Capability]);
    spinner.succeed(`Installed ${capInfo.name}`);

    updateAgentsMdWithCapabilities(targetDir, [...installed, targetCapability] as Capability[]);
    updateSystemMapStatus(targetDir, [...installed, targetCapability] as Capability[]);

    const currentManifest = readManifest(ctx.shitenDir);
    const { readFileSync: readFS } = await import("node:fs");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    let cliVersion = "unknown";
    try { const pkg = JSON.parse(readFS(join(__dirname, "..", "..", "package.json"), "utf-8")); cliVersion = pkg.version || "unknown"; } catch { /* fallback */ }
    const updatedManifest = updateManifest(currentManifest, cliVersion, ctx.shitenDir, [...installed, targetCapability as Capability], 0);
    writeManifest(ctx.shitenDir, updatedManifest);
    invalidateCache(targetDir);

    getEventBus().publish("capability.installed", { capabilityId: targetCapability, capabilityName: capInfo.name, version: cliVersion });
    recordFeedback(ctx.shitenDir, { recommendationId: `cap-${targetCapability}`, action: "accepted", context: { maturityScore: 0, installedCapabilities: installed, knowledgeDebt: 0 } });

    if (isJson) outputJson({ capability: targetCapability, filesInstalled: result.filesInstalled, directoriesCreated: result.directoriesCreated });
    else { outputBlank(); outputSuccess("  ✔ Capability installed!"); outputBlank(); outputSection("Changes:"); output(chalk.gray(`    Directories created: ${result.directoriesCreated}`)); output(chalk.gray(`    Files installed: ${result.filesInstalled}`)); outputBlank(); }

    try {
      const { generateProjectFingerprint, loadFingerprint } = await import("../project-fingerprint.js");
      const { generateRiskMap } = await import("../risk-map.js");
      const { generateContextRules } = await import("../context-rules.js");
      const analysis = (await import("../analyser.js")).analyseProject(targetDir);
      let fingerprint = loadFingerprint(ctx.shitenDir);
      if (!fingerprint) { const { saveFingerprint } = await import("../project-fingerprint.js"); fingerprint = generateProjectFingerprint(targetDir, analysis); saveFingerprint(ctx.shitenDir, fingerprint); }
      const riskMap = generateRiskMap(targetDir, ctx.shitenDir);
      const contextRules = generateContextRules(fingerprint, riskMap);
      if (contextRules.length > 0 && !isJson) { outputSection("Context-Aware Rules Generated:"); for (const rule of contextRules.slice(0, 3)) output(chalk.gray(`    • ${rule.rule}`)); outputBlank(); }
    } catch { /* non-critical */ }
  } catch (error) {
    if (isJson) outputJson({ error: "install_failed", message: String(error) });
    else { spinner.fail("Installation failed"); logger.error("upgrade", `Error: ${error}`); }
  }
}
