import { Command } from "commander";
import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { invalidateCache } from "../cache.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized } from "../shared.js";
import { getEventBus } from "../event-bus.js";

export const cleanCommand = new Command("clean")
  .description("Clear nexus cache and temporary files")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║     nexus clean — Clear Cache        ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const itemsRemoved: string[] = [];

    // 1. Remove .nexus-cache.json
    const cachePath = join(ctx.projectRoot, ".nexus-cache.json");
    if (existsSync(cachePath)) {
      try {
        unlinkSync(cachePath);
        itemsRemoved.push(".nexus-cache.json");
      } catch {
        // skip
      }
    }

    // 2. Remove *.tsbuildinfo
    if (existsSync(ctx.projectRoot)) {
      try {
        const files = readdirSync(ctx.projectRoot);
        for (const file of files) {
          if (file.endsWith(".tsbuildinfo")) {
            const filePath = join(ctx.projectRoot, file);
            try {
              unlinkSync(filePath);
              itemsRemoved.push(file);
            } catch {
              // skip
            }
          }
        }
      } catch {
        // skip
      }
    }

    // 3. Invalidate cache
    invalidateCache(ctx.projectRoot);

    // Publish event
    getEventBus().publish("analysis.complete", {
      projectRoot: ctx.projectRoot,
      itemsRemoved: itemsRemoved.length,
    });

    if (isJson) {
      outputJson({
        projectRoot: ctx.projectRoot,
        itemsRemoved,
        count: itemsRemoved.length,
      });
    } else {
      if (itemsRemoved.length === 0) {
        console.log(chalk.green("  ✔ Cache is already clean."));
      } else {
        console.log(chalk.green(`  ✔ Removed ${itemsRemoved.length} item(s):`));
        for (const item of itemsRemoved) {
          console.log(chalk.gray(`    - ${item}`));
        }
      }
      console.log("");
    }
  });
