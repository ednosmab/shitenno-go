/**
 * Decision Core — RunScript Executor
 *
 * Migrated from rule-engine/actions.ts (run_script / run_local_script / run_shiten_command).
 * Executes whitelisted scripts with security allowlist enforcement.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isScriptAllowed, isShitenCommandAllowed, getAllowedScriptCommand, getAllowedShitenCommand } from "../../rule-engine/security.js";
import type { ActionExecutor } from "./types.js";

export class RunScriptExecutor implements ActionExecutor {
  name = "run_script" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const script = String(params.script ?? "");
    if (!script) return { executed: false, message: "No script specified" };

    if (!isScriptAllowed(script)) {
      return {
        executed: false,
        message: `Script "${script}" not in allowlist`,
      };
    }

    const command = getAllowedScriptCommand(script);
    if (!command) {
      return { executed: false, message: `No command mapping for script: ${script}` };
    }

    try {
      const output = execSync(command, {
        cwd: context.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { executed: true, script, output: output.slice(0, 2000) };
    } catch (error) {
      return { executed: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

export class RunLocalScriptExecutor implements ActionExecutor {
  name = "run_local_script" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const script = String(params.script ?? "");
    if (!script) return { executed: false, message: "No script specified" };

    if (!isScriptAllowed(script)) {
      return {
        executed: false,
        message: `Script "${script}" not in allowlist`,
      };
    }

    const command = getAllowedScriptCommand(script);
    if (!command) {
      return { executed: false, message: `No command mapping for script: ${script}` };
    }

    try {
      const output = execSync(command, {
        cwd: context.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { executed: true, script, output: output.slice(0, 2000) };
    } catch (error) {
      return { executed: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

export class RunShitenCommandExecutor implements ActionExecutor {
  name = "run_shiten_command" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const command = String(params.command ?? "");
    if (!command) return { executed: false, message: "No shiten command specified" };

    if (!isShitenCommandAllowed(command)) {
      return {
        executed: false,
        message: `Shiten command "${command}" not in allowlist`,
      };
    }

    const shitenCommand = getAllowedShitenCommand(command);
    if (!shitenCommand) {
      return { executed: false, message: `No command mapping for: ${command}` };
    }

    const assessBin = join(context.projectRoot, "dist", "shiten.js");
    if (!existsSync(assessBin)) {
      return { executed: true, message: "Shiten binary not found (dev environment)" };
    }

    try {
      const output = execSync(`SHITEN_CHILD=1 node dist/shiten.js ${shitenCommand}`, {
        cwd: context.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { executed: true, command, output: output.slice(0, 2000) };
    } catch (error) {
      return { executed: false, message: `Shiten command failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
