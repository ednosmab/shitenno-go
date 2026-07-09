/**
 * history.ts — History Command
 *
 * Shows historical snapshots of Engineering State.
 *
 * Usage: nexus history [--from <date>] [--to <date>] [--diff]
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized } from "../shared.js";
import { outputJson } from "../formatting.js";
import { listSnapshots, getSnapshotAt, diffSnapshots } from "../engineering-state-history.js";
import { join } from "node:path";

export const historyCommand = new Command("history")
  .description("Show engineering state history")
  .option("--from <date>", "Start date (ISO format)")
  .option("--to <date>", "End date (ISO format)")
  .option("--diff", "Show diff between consecutive snapshots")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const result = guardNotInitialized({}, options.json ?? false);
    if (result) return;

    const projectRoot = process.cwd();
    const nexusDir = join(projectRoot, "nexus-system");

    const range = options.from || options.to
      ? { from: options.from || "2000-01-01", to: options.to || new Date().toISOString() }
      : undefined;

    const snapshots = listSnapshots(nexusDir, range);

    if (snapshots.length === 0) {
      console.log(chalk.yellow("No snapshots found."));
      return;
    }

    if (options.json) {
      outputJson({
        snapshots: snapshots.map((s) => ({
          id: s.id,
          timestamp: s.timestamp,
        })),
        count: snapshots.length,
      });
      return;
    }

    console.log(chalk.bold(`\nEngineering State History (${snapshots.length} snapshots)\n`));

    for (const snapshot of snapshots) {
      console.log(`  ${chalk.cyan(snapshot.timestamp)}`);
    }

    if (options.diff && snapshots.length >= 2) {
      console.log(chalk.bold("\nDiffs:\n"));

      for (let i = 1; i < snapshots.length; i++) {
        const prevMeta = snapshots[i - 1];
        const currMeta = snapshots[i];
        if (!prevMeta || !currMeta) continue;

        const prev = getSnapshotAt(nexusDir, prevMeta.timestamp);
        const curr = getSnapshotAt(nexusDir, currMeta.timestamp);

        if (prev && curr) {
          const delta = diffSnapshots(prev, curr);
          const healthColor = delta.healthScoreChange >= 0 ? chalk.green : chalk.red;
          const entropyColor = delta.entropyChange <= 0 ? chalk.green : chalk.red;

          console.log(`  ${chalk.cyan(prevMeta.timestamp)} → ${chalk.cyan(currMeta.timestamp)}`);
          console.log(`    Health: ${healthColor(`${delta.healthScoreChange >= 0 ? "+" : ""}${delta.healthScoreChange}`)}`);
          console.log(`    Entropy: ${entropyColor(`${delta.entropyChange >= 0 ? "+" : ""}${delta.entropyChange}`)}`);
          console.log(`    Assets: +${delta.assetsAdded}/-${delta.assetsRemoved}`);
          if (delta.capabilitiesChanged) {
            console.log(`    ${chalk.yellow("Capabilities changed")}`);
          }
          console.log("");
        }
      }
    }
  });
