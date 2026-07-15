import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import { invalidateCache } from "../cache.js";
import { outputJson } from "../formatting.js";
import { checkLifecycleGate } from "../shared.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputError } from "../output.js";

const { copySync, ensureDirSync, writeFileSync } = fse;

interface FileChange {
  path: string;
  action: "create" | "update" | "skip";
  reason?: string;
}

export const syncCommand = new Command("sync")
  .description("Sync project governance files from nexus-system")
  .option("-d, --dir <path>", "Target project directory (default: current)", ".")
  .option("-n, --nexus-path <path>", "Path to nexus-system directory")
  .option("--dry-run", "Show what would be changed without making changes")
  .option("--force", "Overwrite all files without asking")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const targetDir = resolve(options.dir);
    const nexusPath = options.nexusPath || process.env.NEXUS_SYSTEM_PATH;
    const isJson = options.json === true;

    // Lifecycle gate check
    if (existsSync(resolve(targetDir, NEXUS_DIR_NAME))) {
      const gateNexusDir = resolve(targetDir, NEXUS_DIR_NAME);
      if (!checkLifecycleGate("sync", targetDir, gateNexusDir, isJson)) return;
    }

    if (!isJson) {
      outputBlank();
      output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
      output(chalk.bold.cyan("  ║      nexus sync — Update Project     ║"));
      output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
      outputBlank();
    }

    // Validate nexus-system path
    if (!nexusPath) {
      if (isJson) {
        outputJson({ error: "missing_path", message: "nexus-system path not specified. Use --nexus-path or NEXUS_SYSTEM_PATH env var." });
      } else {
        output(chalk.red("  ✘ nexus-system path not specified."));
        output(chalk.gray("  Use --nexus-path <path> or set NEXUS_SYSTEM_PATH environment variable."));
        output(chalk.gray("  Example: nexus sync --nexus-path /path/to/nexus-system"));
        output(chalk.gray("  Or: NEXUS_SYSTEM_PATH=/path/to/nexus-system nexus sync"));
      }
      return;
    }

    const nexusDir = resolve(nexusPath);
    if (!existsSync(nexusDir)) {
      if (isJson) {
        outputJson({ error: "missing_nexus_dir", message: `nexus-system directory not found: ${nexusDir}` });
      } else {
        output(chalk.red(`  ✘ nexus-system directory not found: ${nexusDir}`));
      }
      return;
    }

    // Check if target project has nexus-system/ (initialized)
    if (!existsSync(resolve(targetDir, NEXUS_DIR_NAME))) {
      if (isJson) {
        outputJson({ error: "not_initialized", message: "Run 'nexus init' first, then 'nexus sync' to update." });
      } else {
        output(chalk.yellow("  ⚠ This project doesn't seem to be initialized with nexus."));
        output(chalk.gray("  Run 'nexus init' first, then 'nexus sync' to update."));
      }
      return;
    }

    const spinner = ora("Analysing changes...").start();

    try {
      // Get list of files to sync
      const filesToSync = getFilesToSync(nexusDir, targetDir);
      const changes: FileChange[] = [];

      // Analyse each file
      for (const file of filesToSync) {
        const nexusFile = join(nexusDir, file);
        const targetFile = join(targetDir, file);

        if (!existsSync(targetFile)) {
          changes.push({ path: file, action: "create" });
        } else {
          const nexusContent = readFileSync(nexusFile, "utf-8");
          const targetContent = readFileSync(targetFile, "utf-8");

          if (nexusContent !== targetContent) {
            changes.push({ path: file, action: "update" });
          } else {
            changes.push({ path: file, action: "skip", reason: "identical" });
          }
        }
      }

      spinner.stop();

      // Display changes
      output(chalk.bold("  Changes to apply:"));
      outputBlank();

      const createCount = changes.filter((c) => c.action === "create").length;
      const updateCount = changes.filter((c) => c.action === "update").length;
      const skipCount = changes.filter((c) => c.action === "skip").length;

      if (createCount > 0) {
        output(chalk.green(`    + ${createCount} files to create`));
      }
      if (updateCount > 0) {
        output(chalk.yellow(`    ~ ${updateCount} files to update`));
      }
      if (skipCount > 0) {
        output(chalk.gray(`    - ${skipCount} files unchanged`));
      }
      outputBlank();

      // Show detailed changes
      for (const change of changes) {
        if (change.action === "create") {
          output(chalk.green(`    + ${change.path}`));
        } else if (change.action === "update") {
          output(chalk.yellow(`    ~ ${change.path}`));
        }
      }

      if (options.dryRun) {
        if (isJson) {
          outputJson({ dryRun: true, createCount, updateCount, skipCount, changes: changes.map((c) => ({ path: c.path, action: c.action })) });
        } else {
          outputBlank();
          output(chalk.gray("  Dry run complete. No files were modified."));
        }
        return;
      }

      // Ask for confirmation if not forced
      if (!options.force && (createCount > 0 || updateCount > 0)) {
        outputBlank();
        const { confirm } = await import("inquirer").then((mod) =>
          mod.default.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: "Apply these changes?",
              default: true,
            },
          ])
        );

        if (!confirm) {
          output(chalk.gray("  Sync cancelled."));
          return;
        }
      }

      // Apply changes
      const applySpinner = ora("Applying changes...").start();

      for (const change of changes) {
        if (change.action === "skip") continue;

        const nexusFile = join(nexusDir, change.path);
        const targetFile = join(targetDir, change.path);

        if (change.action === "create") {
          ensureDirSync(resolve(targetFile, ".."));
          copySync(nexusFile, targetFile);
        } else if (change.action === "update") {
          // Preserve project-specific customizations for certain files
          if (shouldPreserveCustomizations(change.path)) {
            const merged = mergeWithCustomizations(
              nexusFile,
              targetFile
            );
            writeFileSync(targetFile, merged, "utf-8");
          } else {
            copySync(nexusFile, targetFile);
          }
        }
      }

      applySpinner.stop();

      // Invalidate cache since nexus-system/ may have changed
      invalidateCache(targetDir);

      if (isJson) {
        outputJson({
          dryRun: false,
          createCount,
          updateCount,
          skipCount,
          updated: changes.filter((c) => c.action !== "skip").map((c) => c.path),
        });
      } else {
        outputBlank();
        output(chalk.green("  ✔ Sync complete!"));
        outputBlank();
        output(chalk.gray("  Updated files:"));
        for (const change of changes) {
          if (change.action !== "skip") {
            output(chalk.gray(`    - ${change.path}`));
          }
        }
        outputBlank();
      }
    } catch (error) {
      spinner.stop();
      outputError(chalk.red(`  ✘ Sync failed: ${error}`));
      return;
    }
  });

export function getFilesToSync(nexusDir: string, _targetDir: string): string[] {
  const files: string[] = [];

  // Core files
  const coreFiles = [
    "docs/AGENTS.md",
    "docs/opencode-context.md",
    "docs/Nexus-System_GUIDE.md",
    "opencode.json",
    "scripts/validate-session.ts",
    "scripts/close-session.ts",
  ];

  for (const file of coreFiles) {
    if (existsSync(join(nexusDir, file))) {
      files.push(file);
    }
  }

  // Skills
  const skillsDir = join(nexusDir, "docs/skills");
  if (existsSync(skillsDir)) {
    const skillFiles = fse.readdirSync(skillsDir).filter((f: string) =>
      f.endsWith(".md")
    );
    for (const skill of skillFiles) {
      files.push(`docs/skills/${skill}`);
    }
  }

  return files;
}

export function shouldPreserveCustomizations(filePath: string): boolean {
  // Files that should preserve project-specific customizations
  const preserveList = [
    "docs/AGENTS.md",
    "docs/opencode-context.md",
    "docs/Nexus-System_GUIDE.md",
    "opencode.json",
  ];
  return preserveList.includes(filePath);
}

export function mergeWithCustomizations(
  nexusFile: string,
  targetFile: string
): string {
  const nexusContent = readFileSync(nexusFile, "utf-8");
  const targetContent = readFileSync(targetFile, "utf-8");

  // JSON files: merge preserving project-specific values
  if (nexusFile.endsWith(".json")) {
    return mergeJsonFiles(nexusContent, targetContent);
  }

  // Markdown files: preserve custom sections, update/add nexus sections
  if (nexusFile.endsWith(".md")) {
    return mergeMarkdownFiles(nexusContent, targetContent);
  }

  // For other files, use nexus content
  return nexusContent;
}

export function mergeJsonFiles(nexusContent: string, targetContent: string): string {
  try {
    const nexus = JSON.parse(nexusContent);
    const target = JSON.parse(targetContent);

    // Preserve project-specific models and permissions
    const preserved: Record<string, unknown> = {};

    // Preserve agent models and permissions from target
    if (target.agent && nexus.agent) {
      preserved.agent = { ...nexus.agent };
      for (const [agentName, agentConfig] of Object.entries(target.agent)) {
        if (preserved.agent && typeof preserved.agent === "object" && preserved.agent[agentName as keyof typeof preserved.agent]) {
          const preservedAgent = preserved.agent[agentName as keyof typeof preserved.agent] as Record<string, unknown>;
          const targetAgent = agentConfig as Record<string, unknown>;
          // Preserve user's model choices
          if (targetAgent.model) {
            preservedAgent.model = targetAgent.model;
          }
          // Preserve user's permission overrides
          if (targetAgent.permission) {
            preservedAgent.permission = targetAgent.permission;
          }
        }
      }
    }

    // Preserve MCP server configurations from target
    if (target.mcp) {
      preserved.mcp = target.mcp;
    }

    return JSON.stringify({ ...nexus, ...preserved }, null, 2);
  } catch {
    // If parsing fails, use nexus content
    return nexusContent;
  }
}

export function mergeMarkdownFiles(nexusContent: string, targetContent: string): string {
  // Extract sections from both files
  const nexusSections = extractSections(nexusContent);
  const targetSections = extractSections(targetContent);

  // Start with nexus content as base
  let result = nexusContent;

  // For each section in target, check if it's a custom section
  for (const [sectionTitle, sectionContent] of Object.entries(targetSections)) {
    // If section doesn't exist in nexus, it's custom - preserve it
    if (!nexusSections[sectionTitle]) {
      // Add custom section at the end
      result += `\n\n${sectionContent}`;
    }
    // If section exists but content differs, check if it's personalized
    else if (nexusSections[sectionTitle] !== sectionContent) {
      // Check if target section contains personalized content (not placeholders)
      if (!sectionContent.includes("[PERSONALIZAR:") && !sectionContent.includes("[Adicionar")) {
        // Preserve user's personalized content
        result = result.replace(nexusSections[sectionTitle], sectionContent);
      }
    }
  }

  return result;
}

export function extractSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split("\n");
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check if line is a heading (## or ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections[currentSection] = currentContent.join("\n");
      }
      // Start new section
      currentSection = headingMatch[2]?.trim() ?? "";
      currentContent = [line];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join("\n");
  }

  return sections;
}
