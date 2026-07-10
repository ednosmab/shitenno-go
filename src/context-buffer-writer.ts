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
