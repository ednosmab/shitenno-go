/**
 * update.ts — Update Command with Change Detection
 *
 * Detects changes in templates since last install/upgrade.
 * Shows diff and optionally applies updates.
 */

import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import {
  readManifest,
  writeManifest,
  scanTemplateHashes,
  diffManifests,
  updateManifest,
  type Manifest,
  type ManifestDiff,
} from "../manifest.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";

const { copySync, ensureDirSync, removeSync } = fse;

// ── Types ────────────────────────────────────────────────────────────────────

interface UpdateOptions {
  dir?: string;
  apply?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  force?: boolean;
  json?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTemplatesDir(): string {
  // Templates are in src/templates/base/ relative to the CLI package
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "templates", "base");
}

function displayDiff(diff: ManifestDiff, isJson: boolean): void {
  if (isJson) {
    outputJson(diff as unknown as Record<string, unknown>);
    return;
  }

  console.log(chalk.bold("  Changes detected:"));

  if (diff.added.length > 0) {
    console.log(chalk.green(`    + ${diff.added.length} file(s) added`));
    for (const f of diff.added.slice(0, 10)) {
      console.log(chalk.green(`      + ${f}`));
    }
    if (diff.added.length > 10) {
      console.log(chalk.gray(`      ... and ${diff.added.length - 10} more`));
    }
  }

  if (diff.removed.length > 0) {
    console.log(chalk.red(`    - ${diff.removed.length} file(s) removed`));
    for (const f of diff.removed.slice(0, 10)) {
      console.log(chalk.red(`      - ${f}`));
    }
    if (diff.removed.length > 10) {
      console.log(chalk.gray(`      ... and ${diff.removed.length - 10} more`));
    }
  }

  if (diff.changed.length > 0) {
    console.log(chalk.yellow(`    ~ ${diff.changed.length} file(s) changed`));
    for (const f of diff.changed.slice(0, 10)) {
      console.log(chalk.yellow(`      ~ ${f}`));
    }
    if (diff.changed.length > 10) {
      console.log(chalk.gray(`      ... and ${diff.changed.length - 10} more`));
    }
  }

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    console.log(chalk.green("    No changes detected. Everything is up to date."));
  }

  console.log("");
}

function applyUpdates(
  targetDir: string,
  diff: ManifestDiff,

  options: UpdateOptions
): void {
  const templatesDir = getTemplatesDir();
  const nexusDir = join(targetDir, "nexus-system");

  // Create backup if requested
  if (options.backup) {
    const backupDir = join(nexusDir, "backups", new Date().toISOString().replace(/[:.]/g, "-"));
    ensureDirSync(backupDir);

    for (const file of [...diff.changed, ...diff.removed]) {
      const srcPath = join(nexusDir, file);
      if (existsSync(srcPath)) {
        const destPath = join(backupDir, file);
        ensureDirSync(join(destPath, ".."));
        copySync(srcPath, destPath);
      }
    }

    console.log(chalk.gray(`  Backup created at: ${backupDir.replace(targetDir + "/", "")}`));
  }

  // Apply changes
  let filesUpdated = 0;

  // Copy new/changed files
  for (const file of [...diff.added, ...diff.changed]) {
    const srcPath = join(templatesDir, file);
    const destPath = join(nexusDir, file);

    if (existsSync(srcPath)) {
      ensureDirSync(join(destPath, ".."));
      copySync(srcPath, destPath);
      filesUpdated++;
    }
  }

  // Remove deleted files
  for (const file of diff.removed) {
    const filePath = join(nexusDir, file);
    if (existsSync(filePath)) {
      removeSync(filePath);
      filesUpdated++;
    }
  }

  console.log(chalk.green(`  ✔ Updated ${filesUpdated} file(s)`));
}

// ── Command ──────────────────────────────────────────────────────────────────

export const updateCommand = new Command("update")
  .description("Detect and apply updates to governance files")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--apply", "Apply detected updates (default: show diff only)")
  .option("--dry-run", "Show what would change without applying")
  .option("--backup", "Create backup before applying updates")
  .option("--force", "Apply updates even if CLI version matches")
  .option("--json", "Output results as JSON")
  .action(async (options: UpdateOptions) => {
    const isJson = options.json === true;
    const targetDir = resolve(options.dir || ".");

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║  nexus update — Change Detection         ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
      console.log("");
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("update", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    // Read current manifest
    const currentManifest = readManifest(ctx.nexusDir);

    if (!currentManifest) {
      if (isJson) {
        outputJson({ error: "no_manifest", message: "No manifest found. Run 'nexus init' or 'nexus upgrade' first." });
      } else {
        console.log(chalk.yellow("  ⚠ No manifest found."));
        console.log(chalk.gray("  Run 'nexus init' or 'nexus upgrade' to create a manifest."));
        console.log("");
      }
      return;
    }

    // Get current CLI version
    const packageJsonPath = join(__dirname, "..", "package.json");
    let currentCliVersion = "unknown";
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      currentCliVersion = pkg.version || "unknown";
    } catch {
      // Skip
    }

    // Scan current templates
    const spinner = ora("Scanning templates for changes...").start();
    const newHashes = scanTemplateHashes(ctx.nexusDir);
    spinner.succeed("Scan complete");

    // Create a "new" manifest with current hashes for comparison
    const newManifest: Manifest = {
      ...currentManifest,
      templateHashes: newHashes,
    };

    // Compare
    const diff = diffManifests(currentManifest, newManifest);

    const hasChanges =
      diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

    const versionMismatch = currentManifest.cliVersion !== currentCliVersion;

    // Display results
    if (!hasChanges && !versionMismatch) {
      if (isJson) {
        outputJson({
          status: "up_to_date",
          cliVersion: currentCliVersion,
          installedVersion: currentManifest.cliVersion,
          installedAt: currentManifest.installedAt,
        });
      } else {
        console.log(chalk.green("  ✔ Everything is up to date!"));
        console.log(chalk.gray(`  CLI version: ${currentCliVersion}`));
        console.log(chalk.gray(`  Last updated: ${currentManifest.installedAt}`));
        console.log("");
      }
      return;
    }

    // Show version info
    if (!isJson) {
      if (versionMismatch) {
        console.log(chalk.yellow(`  ℹ CLI version changed: ${currentManifest.cliVersion} → ${currentCliVersion}`));
        console.log("");
      }

      displayDiff(diff, false);
    }

    // Apply if requested
    if (options.apply || options.dryRun) {
      if (options.dryRun) {
        if (isJson) {
          outputJson({ dryRun: true, diff });
        } else {
          console.log(chalk.gray("  Dry run — no changes applied."));
          console.log("");
        }
        return;
      }

      // Apply updates
      const applySpinner = ora("Applying updates...").start();
      try {
        applyUpdates(targetDir, diff, options);

        // Update manifest
        const updatedManifest = updateManifest(
          currentManifest,
          currentCliVersion,
          ctx.nexusDir,
          currentManifest.capabilities,
          currentManifest.maturityScore
        );
        writeManifest(ctx.nexusDir, updatedManifest);

        // Publish event
        getEventBus().publish("system.updated", {
          filesChanged: diff.changed.length + diff.added.length + diff.removed.length,
          cliVersion: currentCliVersion,
        });

        applySpinner.succeed("Updates applied successfully!");

        if (isJson) {
          outputJson({
            status: "updated",
            cliVersion: currentCliVersion,
            filesChanged: diff.changed.length + diff.added.length + diff.removed.length,
          });
        } else {
          console.log(chalk.gray(`  CLI version: ${currentCliVersion}`));
          console.log(chalk.gray(`  Last updated: ${updatedManifest.installedAt}`));
          console.log("");
        }
      } catch (error) {
        applySpinner.fail("Failed to apply updates");
        if (isJson) {
          outputJson({ error: "apply_failed", message: String(error) });
        } else {
          console.error(chalk.red(`  Error: ${error}`));
        }
        return;
      }
    } else {
      // Just show the diff and suggest --apply
      if (isJson) {
        outputJson({
          status: "changes_detected",
          diff,
          hint: "Run 'nexus update --apply' to apply changes",
        });
      } else {
        console.log(chalk.gray("  Run 'nexus update --apply' to apply these changes."));
        console.log(chalk.gray("  Run 'nexus update --dry-run' to preview without applying."));
        console.log("");
      }
    }
  });
