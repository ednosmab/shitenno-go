/**
 * Action execution for the rule engine.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { NEXUS_DIR_NAME } from "../constants.js";
import { logger } from "../logger.js";
import { escapeRegex } from "../validation.js";
import { transitionTask, type BacklogState } from "../backlog-state-machine.js";
import { replaceSectionField, updateNextP0 } from "../context-buffer-writer.js";
import type { RuleAction, RuleContext } from "../domain/rules/rule.js";
import { isScriptAllowed, isNexusCommandAllowed, getAllowedScriptCommand, getAllowedNexusCommand } from "./security.js";
import { resolveField } from "./conditions.js";

/** Resolve template variables in action params (e.g., "${eventData.planId}" → actual value). */
function resolveParam(value: unknown, context: RuleContext): string {
  if (typeof value !== "string") return String(value ?? "");
  const templateMatch = value.match(/^\$\{(.+)\}$/);
  if (templateMatch && templateMatch[1]) {
    const resolved = resolveField(templateMatch[1], context);
    return String(resolved ?? "");
  }
  return value;
}

/** Garante que governance/context/context_buffer.yaml existe, criando-o se necessário. */
function ensureContextBuffer(nexusDir: string): string {
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    const contextDir = join(nexusDir, "governance", "context");
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true });
    }
    writeFileSync(bufferPath, "reminders:\n\nproximo:\n\nsession:\n  id: \"auto-created\"\n  status: \"in_progress\"\n", "utf-8");
  }
  return bufferPath;
}

/** Executa uma acção. */
export async function executeAction(
  action: RuleAction,
  context: RuleContext
): Promise<{ success: boolean; message: string }> {
  switch (action.type) {
    case "update_context_buffer": {
      const field = String(action.params.field || "");
      const value = String(action.params.value || "");

      if (!field || !value) {
        return { success: false, message: "No field or value specified" };
      }

      const result = replaceSectionField(
        readFileSync(join(context.nexusDir, "governance", "context", "context_buffer.yaml"), "utf-8"),
        field,
        value
      );

      if (result.updated) {
        writeFileSync(join(context.nexusDir, "governance", "context", "context_buffer.yaml"), result.content, "utf-8");
        return { success: true, message: `Updated ${field} = ${value}` };
      }
      return { success: false, message: `Field "${field}" not found in buffer` };
    }

    case "create_reminder": {
      const bufferPath = ensureContextBuffer(context.nexusDir);

      try {
        let content = readFileSync(bufferPath, "utf-8");
        let reminder = String(action.params.message || "Reminder from rule engine");
        reminder = reminder
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .substring(0, 200);
        const priority = String(action.params.priority || "medium");
        const category = String(action.params.category || "feature");

        const escapedReminder = reminder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const dedupeRegex = new RegExp(`^\\s*- message: "${escapedReminder}"`, "m");
        if (dedupeRegex.test(content)) {
          return { success: true, message: `Reminder already exists: ${reminder} — skipped` };
        }

        const createdAt = new Date().toISOString();
        content = content.replace(
          /^reminders:\s*\n/,
          `reminders:\n  - message: "${reminder}"\n    priority: "${priority}"\n    category: "${category}"\n    createdAt: "${createdAt}"\n`
        );
        writeFileSync(bufferPath, content, "utf-8");
        return { success: true, message: `Created reminder: ${reminder} [${priority}/${category}]` };
      } catch {
        return { success: false, message: "Failed to create reminder" };
      }
    }

    case "update_quick_board": {
      const bufferPath = ensureContextBuffer(context.nexusDir);

      try {
        let content = readFileSync(bufferPath, "utf-8");
        const item = String(action.params.item || "");
        const section = String(action.params.section || "proximo");

        if (item) {
          content = content.replace(
            new RegExp(`(${escapeRegex(section)}:\\s*\\n)`),
            `$1    - "${item}"\n`
          );
          writeFileSync(bufferPath, content, "utf-8");
          return { success: true, message: `Updated quick board: ${section}` };
        }
        return { success: false, message: "No item specified" };
      } catch {
        return { success: false, message: "Failed to update quick board" };
      }
    }

    case "log_event": {
      const historyDir = join(context.nexusDir, "docs", "history");
      if (!existsSync(historyDir)) {
        mkdirSync(historyDir, { recursive: true });
      }

      try {
        const date = new Date().toISOString().slice(0, 10);
        const event = String(action.params.event || "rule_engine_event")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 50);
        const message = String(action.params.message || "");
        const filename = `${date}-rule-${event}.md`;
        const filepath = join(historyDir, filename);

        const content = `# ${event}\n\nDate: ${context.timestamp}\nRule: ${context.eventData.ruleId || "unknown"}\n\n${message}\n`;
        writeFileSync(filepath, content, "utf-8");
        return { success: true, message: `Logged event: ${event}` };
      } catch {
        return { success: false, message: "Failed to log event" };
      }
    }

    case "trigger_assessment": {
      const assessBin = join(context.projectRoot, "dist", "nexus.js");
      if (!existsSync(assessBin)) {
        return { success: true, message: "Assessment skipped: nexus binary not found (dev environment)" };
      }
      try {
        execSync("NEXUS_CHILD=1 node dist/nexus.js assess", {
          cwd: context.projectRoot,
          timeout: 60000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: "Assessment triggered successfully" };
      } catch (error) {
        return { success: false, message: `Assessment failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "trigger_health_check": {
      const doctorBin = join(context.projectRoot, "dist", "nexus.js");
      if (!existsSync(doctorBin)) {
        return { success: true, message: "Health check skipped: nexus binary not found (dev environment)" };
      }
      try {
        execSync("NEXUS_CHILD=1 node dist/nexus.js doctor", {
          cwd: context.projectRoot,
          timeout: 60000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: "Health check triggered successfully" };
      } catch (error) {
        return { success: false, message: `Health check failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "update_backlog": {
      const backlogPath = join(context.nexusDir, "docs", "BACKLOG.md");
      if (!existsSync(backlogPath)) return { success: false, message: "BACKLOG.md not found" };

      try {
        let content = readFileSync(backlogPath, "utf-8");
        const item = String(action.params.item || "");
        if (item) {
          content += `\n| ${item} | 🟡 Médio | Backlog | ${new Date().toISOString().slice(0, 10)} | unassigned |`;
          writeFileSync(backlogPath, content, "utf-8");
          return { success: true, message: `Updated backlog: ${item}` };
        }
        return { success: false, message: "No item specified" };
      } catch {
        return { success: false, message: "Failed to update backlog" };
      }
    }

    case "update_backlog_status": {
      const taskId = String(action.params.taskId || "");
      const fromState = String(action.params.fromState || "");
      const toState = String(action.params.toState || "");

      if (!taskId || !fromState || !toState) {
        return { success: false, message: "Missing required params: taskId, fromState, toState" };
      }

      try {
        const result = transitionTask(context.nexusDir, taskId, fromState as BacklogState, toState as BacklogState);
        return { success: result.success, message: result.message };
      } catch (error) {
        return { success: false, message: `Failed to transition backlog: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "archive_plan": {
      const planId = resolveParam(action.params.planId, context);
      if (!planId) {
        return { success: false, message: "No plan ID specified" };
      }

      try {
        execSync(`NEXUS_CHILD=1 node dist/nexus.js plan md done ${planId}`, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Plan archived: ${planId}` };
      } catch (error) {
        return { success: false, message: `Failed to archive plan: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "run_local_script": {
      const script = String(action.params.script || "");
      if (!script) return { success: false, message: "No script specified" };

      if (!isScriptAllowed(script)) {
        return {
          success: false,
          message: `Script "${script}" not in allowlist. Allowed: ${Object.keys({ "git-status": "", "git-diff": "", "git-log": "", "list-files": "" }).join(", ")}`,
        };
      }

      try {
        const command = getAllowedScriptCommand(script)!;
        execSync(command, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Script executed: ${script}` };
      } catch (error) {
        return { success: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "run_script": {
      logger.warn("rule-engine", "'run_script' is deprecated, use 'run_local_script'");
      const script = String(action.params.script || "");
      if (!script) return { success: false, message: "No script specified" };

      if (!isScriptAllowed(script)) {
        return {
          success: false,
          message: `Script "${script}" not in allowlist. Allowed: ${Object.keys({ "git-status": "", "git-diff": "", "git-log": "", "list-files": "" }).join(", ")}`,
        };
      }

      try {
        const command = getAllowedScriptCommand(script)!;
        execSync(command, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Script executed: ${script}` };
      } catch (error) {
        return { success: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "run_nexus_command": {
      const command = String(action.params.command || "");
      if (!command) return { success: false, message: "No nexus command specified" };

      if (!isNexusCommandAllowed(command)) {
        return {
          success: false,
          message: `Nexus command "${command}" not in allowlist. Allowed: ${Object.keys({ "briefing": "", "docs-audit": "", "status": "", "validate": "" }).join(", ")}`,
        };
      }

      try {
        const nexusCommand = getAllowedNexusCommand(command)!;
        const result = execSync(`NEXUS_CHILD=1 node dist/nexus.js ${nexusCommand}`, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Nexus command executed: ${command}\n${result.trim()}` };
      } catch (error) {
        return { success: false, message: `Nexus command failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "auto_populate_next_p0": {
      try {
        const nexusDir = join(context.projectRoot, NEXUS_DIR_NAME);
        const backlogPath = join(nexusDir, "docs", "BACKLOG.md");

        if (!existsSync(backlogPath)) {
          return { success: false, message: "BACKLOG.md not found" };
        }

        const backlogContent = readFileSync(backlogPath, "utf-8");

        const p0Match = backlogContent.match(/^- \[ \] \((P0|high)\)\s+(.+)/m);
        if (!p0Match) {
          return { success: true, message: "No P0 items in backlog to populate" };
        }

        const taskDesc = p0Match[2]!.trim();
        const result = updateNextP0(nexusDir, taskDesc);
        return { success: result.success, message: result.message };
      } catch (error) {
        return { success: false, message: `auto_populate_next_p0 failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}
