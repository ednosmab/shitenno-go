/**
 * context-buffer-writer.ts — Centralised, section-aware buffer updates.
 *
 * All writes to context_buffer.yaml MUST go through this module.
 * Regex operations are section-scoped to prevent cross-section collisions
 * (e.g. updating session.status instead of current_task.status).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

import { escapeRegex } from "./validation.js";

function getBufferPath(nexusDir: string): string {
  return join(nexusDir, "governance", "context", "context_buffer.yaml");
}

function readBuffer(nexusDir: string): string | null {
  const path = getBufferPath(nexusDir);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function writeBuffer(nexusDir: string, content: string): void {
  const path = getBufferPath(nexusDir);
  const dir = join(nexusDir, "governance", "context");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, content, "utf-8");
}

/**
 * Replace a scalar YAML value within a section.
 * For field "current_task.status", matches `status: "..."` only after
 * the `current_task:` block anchor — never touches session.status.
 */
export function replaceSectionField(
  content: string,
  fieldPath: string,
  newValue: string
): { updated: boolean; content: string } {
  const keys = fieldPath.split(".");
  if (keys.length < 2) {
    // Flat key — fallback to first match
    const lastKey = keys[keys.length - 1]!;
    const escaped = escapeRegex(lastKey);
    const pattern = new RegExp(`(${escaped}:\\s*").*?(")`);
    if (pattern.test(content)) {
      return { updated: true, content: content.replace(pattern, `$1${newValue}$2`) };
    }
    return { updated: false, content };
  }

  const parentKeys = keys.slice(0, -1);
  const leafKey = keys[keys.length - 1]!;
  const parentPattern = parentKeys.map(k => escapeRegex(k)).join("[\\s\\S]*?");
  const escapedLeaf = escapeRegex(leafKey);
  const pattern = new RegExp(`(${parentPattern}[\\s\\S]*?${escapedLeaf}:\\s*").*?(")`);

  if (pattern.test(content)) {
    return { updated: true, content: content.replace(pattern, `$1${newValue}$2`) };
  }
  return { updated: false, content };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface SessionUpdate {
  id?: string;
  started_at?: string;
  status?: string;
}

export interface CurrentTaskUpdate {
  id?: string;
  description?: string;
  status?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * Update session.* fields in context_buffer.yaml.
 * Called on session start and session end.
 */
export function updateSession(
  nexusDir: string,
  updates: SessionUpdate
): { success: boolean; message: string } {
  let content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const result = replaceSectionField(content, `session.${key}`, value);
    if (result.updated) {
      content = result.content;
      changed = true;
    } else {
      logger.warn("buffer-writer", `Field session.${key} not found in buffer`);
    }
  }

  if (changed) {
    writeBuffer(nexusDir, content);
    return { success: true, message: `Session updated: ${Object.keys(updates).join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

/**
 * Update current_task.* fields in context_buffer.yaml.
 * Called on task completion, task start, etc.
 */
export function updateCurrentTask(
  nexusDir: string,
  updates: CurrentTaskUpdate
): { success: boolean; message: string } {
  let content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const result = replaceSectionField(content, `current_task.${key}`, value);
    if (result.updated) {
      content = result.content;
      changed = true;
    } else {
      logger.warn("buffer-writer", `Field current_task.${key} not found in buffer`);
    }
  }

  if (changed) {
    writeBuffer(nexusDir, content);
    return { success: true, message: `Current task updated: ${Object.keys(updates).join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

/**
 * Update next_p0 field in context_buffer.yaml.
 */
export function updateNextP0(
  nexusDir: string,
  value: string
): { success: boolean; message: string } {
  let content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const escaped = escapeRegex("next_p0");
  const pattern = new RegExp(`(${escaped}:\\s*").*?(")`);
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1${value}$2`);
    writeBuffer(nexusDir, content);
    return { success: true, message: `next_p0 updated` };
  }

  // Field doesn't exist — append after current_task block
  const insertPattern = /(current_task:[\s\S]*?\n\n)/;
  if (insertPattern.test(content)) {
    content = content.replace(insertPattern, `$1next_p0: "${value}"\n\n`);
    writeBuffer(nexusDir, content);
    return { success: true, message: `next_p0 created` };
  }

  return { success: false, message: "Could not find insertion point for next_p0" };
}

/**
 * Append an entry to completed_tasks array.
 */
export function addCompletedTask(
  nexusDir: string,
  task: { id: string; description: string; completed_at: string; files_modified?: string[] }
): { success: boolean; message: string } {
  let content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const completedRegex = /(completed_tasks:\s*\n)/;
  if (!completedRegex.test(content)) {
    return { success: false, message: "completed_tasks section not found" };
  }

  let entry = `  - id: "${task.id}"\n    description: "${task.description}"\n    completed_at: "${task.completed_at}"`;
  if (task.files_modified && task.files_modified.length > 0) {
    entry += `\n    files_modified:\n${task.files_modified.map(f => `      - "${f}"`).join("\n")}`;
  }
  entry += "\n";

  content = content.replace(completedRegex, `$1${entry}`);
  writeBuffer(nexusDir, content);
  return { success: true, message: `Completed task added: ${task.id}` };
}

/**
 * Full session lifecycle update: set session + current_task in one write.
 * Used by bin/nexus.ts on session start/end.
 */
export function updateSessionLifecycle(
  nexusDir: string,
  session: SessionUpdate,
  task?: CurrentTaskUpdate
): { success: boolean; message: string } {
  let content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const messages: string[] = [];

  // Update session fields
  for (const [key, value] of Object.entries(session)) {
    if (value === undefined) continue;
    const result = replaceSectionField(content, `session.${key}`, value);
    if (result.updated) {
      content = result.content;
      messages.push(`session.${key}`);
    }
  }

  // Update task fields if provided
  if (task) {
    for (const [key, value] of Object.entries(task)) {
      if (value === undefined) continue;
      const result = replaceSectionField(content, `current_task.${key}`, value);
      if (result.updated) {
        content = result.content;
        messages.push(`current_task.${key}`);
      }
    }
  }

  if (messages.length > 0) {
    writeBuffer(nexusDir, content);
    return { success: true, message: `Updated: ${messages.join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

// ── Reminders ──────────────────────────────────────────────────────────────

import type { ReminderPriority, ReminderCategory } from "./briefing.js";

export interface ReminderInput {
  message: string;
  priority: ReminderPriority;
  category: ReminderCategory;
  createdAt: string;
}

/**
 * Add a reminder to context_buffer.yaml.
 * Appends to the `reminders` array. Deduplicates by message text —
 * skips if a reminder with the same message already exists.
 */
export function addReminder(
  nexusDir: string,
  reminder: ReminderInput
): { success: boolean; message: string; skipped?: boolean } {
  const content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  // Dedup: same message already present → skip
  if (content.includes(`message: "${reminder.message}"`)) {
    return { success: true, message: "Reminder already exists, skipped", skipped: true };
  }

  const entry = `  - message: "${reminder.message}"
    priority: "${reminder.priority}"
    category: "${reminder.category}"
    createdAt: "${reminder.createdAt}"
`;

  const remindersRegex = /^reminders:\s*\n/m;
  const match = remindersRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(nexusDir, updated);
    return { success: true, message: `Reminder added: ${reminder.message}` };
  }

  // reminders section doesn't exist — create at the beginning
  const updated = "reminders:\n" + entry + "\n" + content;
  writeBuffer(nexusDir, updated);
  return { success: true, message: `Reminder added (new section): ${reminder.message}` };
}

/**
 * Remove reminders that match a category.
 * Call after the agent resolves a reminder to prevent stale entries.
 */
export function clearRemindersByCategory(
  nexusDir: string,
  category: ReminderCategory
): { success: boolean; removed: number } {
  const content = readBuffer(nexusDir);
  if (content === null) return { success: false, removed: 0 };

  const lines = content.split("\n");
  const remindersStart = lines.findIndex((l) => /^reminders:\s*$/.test(l));
  if (remindersStart === -1) return { success: true, removed: 0 };

  // Find where reminders section ends (next non-indented line or EOF)
  let remindersEnd = lines.length;
  for (let i = remindersStart + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
      remindersEnd = i;
      break;
    }
  }

  // Collect entries: each entry starts with "  - " and may have continuation lines
  const entries: string[][] = [];
  let currentEntry: string[] | null = null;
  for (let i = remindersStart + 1; i < remindersEnd; i++) {
    const line = lines[i]!;
    if (/^\s+- /.test(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = [line];
    } else if (currentEntry) {
      currentEntry.push(line);
    }
  }
  if (currentEntry) entries.push(currentEntry);

  // Filter: keep entries that do NOT match the category
  const kept = entries.filter(
    (entry) => !entry.some((l) => l.includes(`category: "${category}"`))
  );
  const removed = entries.length - kept.length;

  if (removed === 0) return { success: true, removed: 0 };

  // Rebuild: reminders header + kept entries + rest of file
  const keptBlock = kept.length > 0 ? kept.map((e) => e.join("\n")).join("\n") + "\n" : "[]\n";
  const before = lines.slice(0, remindersStart + 1).join("\n");
  const after = lines.slice(remindersEnd).join("\n");
  const updated = before + "\n" + keptBlock + (after.startsWith("\n") ? after.slice(1) : after);
  writeBuffer(nexusDir, updated);
  return { success: true, removed };
}

// ── Impediments ──────────────────────────────────────────────────────────────

export interface Impediment {
  description: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  category?: string;
}

/**
 * Add an impediment to context_buffer.yaml.
 * Appends to the `impediments` array.
 */
export function addImpediment(
  nexusDir: string,
  impediment: Impediment
): { success: boolean; message: string } {
  const content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const entry = `  - description: "${impediment.description}"
    priority: "${impediment.priority}"
    createdAt: "${impediment.createdAt}"
${impediment.category ? `    category: "${impediment.category}"\n` : ""}`;

  const impedimentsRegex = /^impediments:\s*\n/m;
  const match = impedimentsRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(nexusDir, updated);
    return { success: true, message: `Impediment added: ${impediment.description}` };
  }

  // impediments section doesn't exist — add it at the end
  const updated = content.trimEnd() + "\n\nimpediments:\n" + entry;
  writeBuffer(nexusDir, updated);
  return { success: true, message: `Impediment added (new section): ${impediment.description}` };
}

/**
 * Clear impediments matching a pattern from context_buffer.yaml.
 * If pattern is omitted, clears ALL impediments.
 */
export function clearImpediments(
  nexusDir: string,
  pattern?: string
): { success: boolean; message: string; removed: number } {
  const content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found", removed: 0 };
  }

  const impedimentsRegex = /^impediments:\s*\n((?:\s+- .*\n)*)/m;
  const match = impedimentsRegex.exec(content);

  if (!match?.[1]) {
    return { success: true, message: "No impediments found", removed: 0 };
  }

  const block = match[1];
  const entries = block.split(/(?=^\s+- )/m).filter((e) => e.trim().length > 0);

  if (!pattern) {
    // Clear all impediments
    const updated = content.replace(impedimentsRegex, "impediments: []\n");
    writeBuffer(nexusDir, updated);
    return { success: true, message: `Cleared all ${entries.length} impediments`, removed: entries.length };
  }

  // Clear only matching impediments
  const kept = entries.filter((e) => !e.includes(pattern));
  const removed = entries.length - kept.length;

  if (removed === 0) {
    return { success: true, message: `No impediments matching "${pattern}"`, removed: 0 };
  }

  const newBlock = kept.length > 0 ? kept.join("") : "[]\n";
  const updated = content.replace(impedimentsRegex, `impediments:\n${newBlock}`);
  writeBuffer(nexusDir, updated);
  return { success: true, message: `Cleared ${removed} impediments matching "${pattern}"`, removed };
}
