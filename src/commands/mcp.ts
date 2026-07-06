/**
 * mcp.ts — MCP Server CLI Command
 *
 * The `nexus mcp` command. Starts an MCP server over stdio
 * for AI agents to consume project context.
 *
 * Usage:
 *   nexus mcp                    # Start MCP server
 *   nexus mcp install            # Install MCP Filesystem server globally
 *   nexus mcp install --check    # Check installation status
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { startMcpServer } from "../mcp-server.js";
import { installMcpServer, updateOpenCodeJsonTimeout } from "../mcp-install.js";
import { guardNotInitialized } from "../shared.js";
import { outputJson } from "../formatting.js";

export function mcpCommand(): Command {
  const cmd = new Command("mcp")
    .description(
      "MCP server for AI agents (Model Context Protocol)"
    )
    .option("-d, --dir <path>", "Project root directory")
    .action(async (options: Record<string, unknown>) => {
      const projectRoot = (options.dir as string) ?? process.cwd();
      const nexusDir = join(projectRoot, "nexus-system");

      if (!existsSync(nexusDir)) {
        console.error(
          chalk.red(
            `  Error: Nexus not initialized in ${projectRoot}. Run 'nexus init' first.`
          )
        );
        process.exitCode = 1;
        return;
      }

      console.error(
        chalk.gray("  nexus-mcp: Starting MCP server over stdio...")
      );
      console.error(
        chalk.gray(
          "  Tools: getBriefing, getRiskMap, getRules"
        )
      );
      console.error("");

      try {
        await startMcpServer(projectRoot, nexusDir);
      } catch (error) {
        console.error(
          chalk.red(
            `  MCP server error: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        process.exitCode = 1;
      }
    });

  const installCmd = new Command("install")
    .description(
      "Install MCP Filesystem server globally and configure opencode.json timeout"
    )
    .option("-d, --dir <path>", "Project root directory")
    .option("--check", "Check installation status without installing")
    .option("--upgrade", "Upgrade to latest version if already installed")
    .option("--json", "Output results as JSON")
    .action(async (subOptions: Record<string, unknown>) => {
      const isJson = subOptions.json === true;

      if (!isJson) {
        console.log("");
        console.log(
          chalk.bold.cyan("  ╔════════════════════════════════════════════╗")
        );
        console.log(
          chalk.bold.cyan("  ║  nexus mcp install — MCP Filesystem Server ║")
        );
        console.log(
          chalk.bold.cyan("  ╚════════════════════════════════════════════╝")
        );
        console.log("");
      }

      const ctx = guardNotInitialized({ dir: subOptions.dir as string | undefined }, isJson);
      if (!ctx) return;

      // Check-only mode
      if (subOptions.check) {
        const result = installMcpServer({ check: true });

        if (isJson) {
          outputJson({
            installed: result.installed,
            version: result.version,
            upgrade: result.upgrade || false,
            error: result.error,
            latestVersionCheckFailed: result.latestVersionCheckFailed || false,
          });
          return;
        }

        if (result.installed) {
          console.log(
            chalk.green(`  ✔ MCP Filesystem Server is installed`)
          );
          if (result.version) {
            console.log(chalk.gray(`    Version: ${result.version}`));
          }
          if (result.upgrade) {
            console.log(
              chalk.yellow("    ⚠ New version available. Run 'nexus mcp install --upgrade'")
            );
          }
          if (result.latestVersionCheckFailed) {
            console.log(
              chalk.yellow("    ⚠ Could not check latest version (offline or registry unavailable)")
            );
          }
        } else {
          console.log(
            chalk.yellow("  ⚠ MCP Filesystem Server is NOT installed")
          );
          if (result.error) {
            console.log(chalk.gray(`    ${result.error}`));
          }
          console.log(
            chalk.gray("    Run 'nexus mcp install' to install it.")
          );
        }
        console.log("");
        return;
      }

      // Install
      if (!isJson) {
        console.log(chalk.gray("  Installing @modelcontextprotocol/server-filesystem globally..."));
        console.log("");
      }

      const result = installMcpServer({
        upgrade: !!subOptions.upgrade,
      });

      if (!result.installed) {
        if (isJson) {
          outputJson({
            installed: false,
            error: result.error,
            errorCode: result.errorCode,
          });
          return;
        }

        console.log(chalk.red("  ✘ Installation failed"));
        if (result.error) {
          console.log("");
          console.log(chalk.red(`    ${result.error}`));
          console.log("");
        }
        return;
      }

      // Configure opencode.json timeout
      const timeoutUpdate = updateOpenCodeJsonTimeout(ctx.projectRoot, 15000);

      if (isJson) {
        outputJson({
          installed: true,
          version: result.version,
          previousVersion: result.previousVersion,
          opencodeJsonUpdated: timeoutUpdate.changed,
          timeoutMs: timeoutUpdate.changed ? 15000 : undefined,
          latestVersionCheckFailed: result.latestVersionCheckFailed || false,
        });
        return;
      }

      const action = result.upgrade ? "upgraded" : "installed";
      console.log(
        chalk.green(
          `  ✔ MCP Filesystem Server ${action} successfully`
        )
      );
      console.log(
        chalk.gray(`    Version: ${result.version}`)
      );
      if (result.previousVersion) {
        console.log(
          chalk.gray(`    Previous: ${result.previousVersion}`)
        );
      }
      if (result.latestVersionCheckFailed) {
        console.log(
          chalk.yellow("    ⚠ Could not check latest version (offline or registry unavailable)")
        );
      }
      console.log("");

      if (timeoutUpdate.changed) {
        console.log(
          chalk.green("  ✔ opencode.json updated with MCP timeout (15000ms)")
        );
      } else if (timeoutUpdate.error) {
        console.log(
          chalk.yellow(`  ⚠ ${timeoutUpdate.error}`)
        );
      } else {
        console.log(
          chalk.gray("  MCP timeout already configured in opencode.json")
        );
      }
      console.log("");
      console.log(
        chalk.gray("  The opencode session may need to be restarted for changes to take effect.")
      );
      console.log("");
    });

  cmd.addCommand(installCmd);

  return cmd;
}
