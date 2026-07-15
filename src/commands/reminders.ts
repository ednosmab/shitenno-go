/**
 * reminders.ts — Reminders Management Command
 *
 * The `nexus reminders` command. List, add, remove, and manage reminders
 * with priority levels and categories.
 *
 * Usage:
 *   nexus reminders                                  # List all active reminders
 *   nexus reminders add "msg"                        # Add reminder (default: medium, feature)
 *   nexus reminders add "msg" --priority high        # Add with priority
 *   nexus reminders add "msg" --category bug         # Add with category
 *   nexus reminders add "msg" --notify               # Add with desktop notification
 *   nexus reminders rm <index>                       # Remove by index
 *   nexus reminders rm --message "partial match"     # Remove by message
 *   nexus reminders clear                            # Remove all
 *   nexus reminders --json                           # Output as JSON
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { execSync } from "node:child_process";
import { guardNotInitialized } from "../shared.js";
import { outputJson } from "../formatting.js";
import { output, outputBlank } from "../output.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import type { Reminder, ReminderPriority, ReminderCategory } from "../briefing.js";

// ── Constants ─────────────────────────────────────────────────────────────

const VALID_PRIORITIES: ReminderPriority[] = ["high", "medium", "low"];
const VALID_CATEGORIES: ReminderCategory[] = ["bug", "feature", "debt", "security", "docs", "infra"];

const PRIORITY_ICONS: Record<ReminderPriority, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const CATEGORY_ICONS: Record<ReminderCategory, string> = {
  bug: "🐛",
  feature: "✨",
  debt: "🔧",
  security: "🔒",
  docs: "📝",
  infra: "⚙️",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getBufferPath(projectRoot: string): string {
  return join(projectRoot, NEXUS_DIR_NAME, "governance", "context", "context_buffer.yaml");
}

function ensureBuffer(projectRoot: string): string {
  const bufferPath = getBufferPath(projectRoot);
  const dir = join(projectRoot, NEXUS_DIR_NAME, "governance", "context");

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(bufferPath)) {
    writeFileSync(bufferPath, "reminders: []\n", "utf-8");
  }

  return bufferPath;
}

function loadReminders(projectRoot: string): Reminder[] {
  const bufferPath = getBufferPath(projectRoot);

  if (!existsSync(bufferPath)) {
    return [];
  }

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const data = parseYaml(content);

    if (Array.isArray(data?.reminders)) {
      return data.reminders.map((r: string | Reminder) => {
        // Handle old format (string) - migrate to new format
        if (typeof r === "string") {
          return {
            message: r,
            priority: "medium" as ReminderPriority,
            category: "feature" as ReminderCategory,
            createdAt: new Date().toISOString(),
          };
        }
        // Handle new format (Reminder object)
        return {
          message: r.message || "",
          priority: (r.priority as ReminderPriority) || "medium",
          category: (r.category as ReminderCategory) || "feature",
          createdAt: r.createdAt || new Date().toISOString(),
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

function saveReminders(projectRoot: string, reminders: Reminder[]): void {
  const bufferPath = ensureBuffer(projectRoot);
  const content = readFileSync(bufferPath, "utf-8");
  let data: Record<string, unknown>;

  try {
    data = parseYaml(content) || {};
  } catch {
    data = {};
  }

  data.reminders = reminders;
  writeFileSync(bufferPath, stringifyYaml(data, { indent: 2, lineWidth: 0 }), "utf-8");
}

function sendDesktopNotification(title: string, message: string, priority: ReminderPriority): void {
  try {
    const urgency = priority === "high" ? "critical" : "normal";
    execSync(`notify-send "${title}" "${message}" --urgency=${urgency}`, {
      stdio: "pipe",
      timeout: 2000,
    });
  } catch {
    // notify-send not available or failed - silent fail
  }
}

// ── Command ────────────────────────────────────────────────────────────────

export function remindersCommand(): Command {
  const cmd = new Command("reminders")
    .description("List, add, remove, and manage reminders with priority and category")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON");

  // ── Default action: list reminders ──────────────────────────────────────
  cmd.action((opts: Record<string, unknown>) => {
    const isJson = opts.json === true;
    const ctx = guardNotInitialized(opts, isJson);
    if (!ctx) return;

    const reminders = loadReminders(ctx.projectRoot);

    if (isJson) {
      outputJson({ reminders, count: reminders.length });
      return;
    }

    outputBlank();
    if (reminders.length === 0) {
      output(chalk.dim("  No active reminders."));
      output(chalk.dim("  Use 'nexus reminders add \"message\"' to create one."));
    } else {
      output(chalk.bold(`  Active Reminders (${reminders.length})`));
      output(chalk.dim("  " + "─".repeat(60)));

      // Sort by priority: high → medium → low
      const priorityOrder: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };
      const sortedReminders = [...reminders].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      for (let i = 0; i < sortedReminders.length; i++) {
        const r = sortedReminders[i]!;
        const icon = PRIORITY_ICONS[r.priority];
        const categoryIcon = CATEGORY_ICONS[r.category];
        output(`  ${chalk.cyan(`${i + 1}.`)} ${icon} ${r.message} ${chalk.dim(`${categoryIcon} ${r.category}`)}`);
      }
    }
    outputBlank();
  });

  // ── add ─────────────────────────────────────────────────────────────────
  cmd
    .command("add")
    .description("Add a new reminder with optional priority and category")
    .argument("<message>", "Reminder message")
    .option("--priority <level>", "Priority level: high, medium, low", "medium")
    .option("--category <type>", "Category: bug, feature, debt, security, docs, infra", "feature")
    .option("--notify", "Send desktop notification")
    .option("--json", "Output as JSON")
    .action((message: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const priority = String(opts.priority) as ReminderPriority;
      const category = String(opts.category) as ReminderCategory;

      // Validate priority
      if (!VALID_PRIORITIES.includes(priority)) {
        if (isJson) {
          outputJson({ error: `Invalid priority: ${priority}. Must be: ${VALID_PRIORITIES.join(", ")}` });
        } else {
          output(chalk.red(`  Invalid priority: ${priority}. Must be: ${VALID_PRIORITIES.join(", ")}`));
        }
        return;
      }

      // Validate category
      if (!VALID_CATEGORIES.includes(category)) {
        if (isJson) {
          outputJson({ error: `Invalid category: ${category}. Must be: ${VALID_CATEGORIES.join(", ")}` });
        } else {
          output(chalk.red(`  Invalid category: ${category}. Must be: ${VALID_CATEGORIES.join(", ")}`));
        }
        return;
      }

      const reminders = loadReminders(ctx.projectRoot);

      // Deduplication: skip if reminder with same message already exists
      const exists = reminders.some((r) => r.message === message);
      if (exists) {
        if (isJson) {
          outputJson({ skipped: true, message: `Reminder already exists: ${message}` });
        } else {
          output(chalk.yellow(`  ⚠ Reminder already exists: ${message} — skipped`));
        }
        return;
      }

      const newReminder: Reminder = {
        message,
        priority,
        category,
        createdAt: new Date().toISOString(),
      };
      reminders.push(newReminder);
      saveReminders(ctx.projectRoot, reminders);

      // Send desktop notification if requested
      if (opts.notify) {
        sendDesktopNotification("Nexus Reminder Added", message, priority);
      }

      if (isJson) {
        outputJson({ added: newReminder, count: reminders.length });
      } else {
        const icon = PRIORITY_ICONS[priority];
        const categoryIcon = CATEGORY_ICONS[category];
        output(chalk.green(`  ✓ Reminder added: ${icon} ${message} ${chalk.dim(`${categoryIcon} ${category}`)}`));
        output(chalk.dim(`  Total reminders: ${reminders.length}`));
      }
    });

  // ── rm ──────────────────────────────────────────────────────────────────
  cmd
    .command("rm")
    .description("Remove a reminder by index or message")
    .argument("[index]", "Reminder index (1-based)")
    .option("--message <text>", "Remove by partial message match")
    .option("--json", "Output as JSON")
    .action((index: string | undefined, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const reminders = loadReminders(ctx.projectRoot);

      if (reminders.length === 0) {
        if (isJson) {
          outputJson({ error: "No reminders to remove" });
        } else {
          output(chalk.red("  No reminders to remove."));
        }
        return;
      }

      let removedIndex = -1;
      let removedReminder: Reminder | null = null;

      if (opts.message) {
        // Remove by message match
        const message = String(opts.message);
        removedIndex = reminders.findIndex(r => r.message.includes(message));
        if (removedIndex === -1) {
          if (isJson) {
            outputJson({ error: `Reminder not found: ${message}` });
          } else {
            output(chalk.red(`  Reminder not found: ${message}`));
          }
          return;
        }
      } else if (index) {
        // Remove by index
        removedIndex = parseInt(index, 10) - 1;
        if (removedIndex < 0 || removedIndex >= reminders.length) {
          if (isJson) {
            outputJson({ error: `Invalid index: ${index}` });
          } else {
            output(chalk.red(`  Invalid index: ${index}. Must be 1-${reminders.length}`));
          }
          return;
        }
      } else {
        if (isJson) {
          outputJson({ error: "Specify index or --message" });
        } else {
          output(chalk.red("  Specify index or --message to remove a reminder."));
        }
        return;
      }

      removedReminder = reminders[removedIndex]!;
      reminders.splice(removedIndex, 1);
      saveReminders(ctx.projectRoot, reminders);

      if (isJson) {
        outputJson({ removed: removedReminder, index: removedIndex + 1, count: reminders.length });
      } else {
        const icon = PRIORITY_ICONS[removedReminder.priority];
        output(chalk.green(`  ✓ Reminder removed: ${icon} ${removedReminder.message}`));
        output(chalk.dim(`  Remaining reminders: ${reminders.length}`));
      }
    });

  // ── clear ───────────────────────────────────────────────────────────────
  cmd
    .command("clear")
    .description("Remove all reminders")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const reminders = loadReminders(ctx.projectRoot);
      const count = reminders.length;

      saveReminders(ctx.projectRoot, []);

      if (isJson) {
        outputJson({ cleared: count });
      } else {
        if (count === 0) {
          output(chalk.dim("  No reminders to clear."));
        } else {
          output(chalk.green(`  ✓ Cleared ${count} reminder(s).`));
        }
      }
    });

  return cmd;
}
