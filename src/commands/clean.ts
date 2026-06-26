import { Command } from "commander";
import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import { detectNexusProject } from "../utils.js";
import { invalidateCache } from "../cache.js";
import { outputJson } from "../formatting.js";

export const cleanCommand = new Command("clean")
  .description("Clear nexus cache and temporary files")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    let projectRoot: string;
    let nexusDir: string;

    if (options.dir) {
      projectRoot = resolve(options.dir);
      nexusDir = join(projectRoot, "nexus-system");
    } else {
      const detected = detectNexusProject(process.cwd());
      if (!detected) {
        if (isJson) {
          outputJson({ error: "not_initialized", message: "Run 'nexus init' to initialize governance." });
        } else {
          console.log(chalk.yellow("  ⚠ This project is not initialized with nexus."));
          console.log(chalk.gray("  Run 'nexus init' to initialize governance."));
          console.log("");
        }
        return;
      }
      projectRoot = detected.root;
      nexusDir = detected.nexusDir;
    }

    if (!isJson) {
      console.log("");
      console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(chalk.bold.cyan("  ║     nexus clean — Clear Cache        ║"));
      console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    const itemsRemoved: string[] = [];

    // 1. Remove .nexus-cache.json
    const cachePath = join(projectRoot, ".nexus-cache.json");
    if (existsSync(cachePath)) {
      try {
        unlinkSync(cachePath);
        itemsRemoved.push(".nexus-cache.json");
      } catch {
        // skip
      }
    }

    // 2. Remove *.tsbuildinfo
    if (existsSync(projectRoot)) {
      try {
        const files = readdirSync(projectRoot);
        for (const file of files) {
          if (file.endsWith(".tsbuildinfo")) {
            const filePath = join(projectRoot, file);
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
    invalidateCache(projectRoot);

    if (isJson) {
      outputJson({
        projectRoot,
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
