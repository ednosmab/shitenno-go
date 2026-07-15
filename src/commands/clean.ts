import { Command } from "commander";
import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { invalidateCache } from "../cache.js";
import { outputJson, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { logger } from "../logger.js";
import { output, outputBlank } from "../output.js";

export const cleanCommand = new Command("clean")
  .description("Clear nexus cache and temporary files")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("clean", ctx.projectRoot, ctx.nexusDir, isJson)) return;

    if (!isJson) {
      outputBlank();
      banner("nexus clean", "Clear Cache");
      outputBlank();
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
              logger.debug("clean", "Failed to remove:", filePath);
            }
          }
        }
      } catch {
        logger.debug("clean", "Failed to read directory:", ctx.projectRoot);
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
        output(chalk.green("  ✔ Cache is already clean."));
      } else {
        output(chalk.green(`  ✔ Removed ${itemsRemoved.length} item(s):`));
        for (const item of itemsRemoved) {
          output(chalk.gray(`    - ${item}`));
        }
      }
      outputBlank();
    }
  });
