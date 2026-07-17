import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { InferenceEngine } from "../inference-engine.js";
import { getEventBus } from "../event-bus.js";
import { logger } from "../logger.js";
import { SHITEN_DIR_NAME } from "../constants.js";

// ── Proactive Startup Functions ──────────────────────────────────────────────

/**
 * Detect plans with inconsistent status (e.g. status="done" but checkboxes still open).
 * Uses InferenceEngine to analyse all plans.
 */
export function checkInconsistencies(shitenDir: string): { checked: number; inconsistencies: number; planIds: string[] } {
  const inferenceEngine = new InferenceEngine(shitenDir);
  const allInferences = inferenceEngine.inferAllPlans();
  const inconsistent = allInferences.filter((inf) => inf.inferredStatus === "inconsistent");
  const planIds = inconsistent.map((inf) => inf.id);

  if (inconsistent.length > 0) {
    logger.warn("daemon", `Found ${inconsistent.length} inconsistent plan(s): ${planIds.join(", ")}`);
    const bus = getEventBus();
    for (const inf of inconsistent) {
      bus.publish("plan.inconsistency_detected", {
        planId: inf.id,
        message: `Plan "${inf.title}" has inferred status "inconsistent"`,
      });
    }
  }

  return {
    checked: allInferences.length,
    inconsistencies: inconsistent.length,
    planIds,
  };
}

/**
 * Check if there are very large staged changes (potential large commit).
 * Returns true if staged files exceed threshold.
 */
export function isLargeCommit(projectRoot: string, threshold: number = 50): boolean {
  try {
    const output = execSync("git diff --cached --name-only | wc -l", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5000,
    });
    const count = parseInt(output.trim(), 10);
    return count > threshold;
  } catch {
    return false;
  }
}

function parseReminderEntries(
  lines: string[],
  remindersStart: number,
  remindersEnd: number
): string[][] {
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
  return entries;
}

function isReminderStale(entry: string[], now: number, maxAgeMs: number): boolean {
  const createdAtLine = entry.find((l) => l.includes("createdAt:"));
  if (!createdAtLine) return false;
  const match = createdAtLine.match(/createdAt:\s*"(.+?)"/);
  if (!match?.[1]) return false;
  const createdAt = new Date(match[1]).getTime();
  return now - createdAt > maxAgeMs;
}

/**
 * Validate reminders in context_buffer.yaml.
 * Removes stale reminders (> 7 days) and invalid ones.
 */
export function validateReminders(
  shitenDir: string
): { validated: number; removed: number; kept: number } {
  const bufferPath = join(shitenDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    return { validated: 0, removed: 0, kept: 0 };
  }

  const content = readFileSync(bufferPath, "utf-8");
  const lines = content.split("\n");

  const remindersStart = lines.findIndex((l) => /^reminders:\s*$/.test(l));
  if (remindersStart === -1) {
    return { validated: 0, removed: 0, kept: 0 };
  }

  // Find reminders section end
  let remindersEnd = lines.length;
  for (let i = remindersStart + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
      remindersEnd = i;
      break;
    }
  }

  const entries = parseReminderEntries(lines, remindersStart, remindersEnd);
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  const keptEntries = entries.filter((entry) => !isReminderStale(entry, now, SEVEN_DAYS_MS));
  const removed = entries.length - keptEntries.length;

  if (removed === 0) {
    return { validated: entries.length, removed: 0, kept: entries.length };
  }

  // Rebuild the file with kept entries
  const keptBlock = keptEntries.length > 0
    ? keptEntries.map((e) => e.join("\n")).join("\n") + "\n"
    : "[]\n";

  const before = lines.slice(0, remindersStart + 1).join("\n");
  const after = lines.slice(remindersEnd).join("\n");
  const updated = before + "\n" + keptBlock + (after.startsWith("\n") ? after.slice(1) : after);

  try {
    writeFileSync(bufferPath, updated, "utf-8");
    logger.info("daemon", `Validated ${entries.length} reminders: removed ${removed}, kept ${keptEntries.length}`);
  } catch (err) {
    logger.error("daemon", `Failed to update reminders: ${err}`);
  }

  return { validated: entries.length, removed, kept: keptEntries.length };
}

/**
 * Move completed backlog items (checkboxes [x]) from BACKLOG.md to done/ directory.
 */
export function moveCompletedBacklogToDone(
  shitenDir: string,
  projectRoot: string
): { checked: number; moved: number; archivedPath: string | null } {
  const backlogPath = join(projectRoot, SHITEN_DIR_NAME, "docs", "BACKLOG.md");
  if (!existsSync(backlogPath)) {
    // Try alternative paths
    const altPath = join(projectRoot, "docs", "BACKLOG.md");
    if (!existsSync(altPath)) {
      return { checked: 0, moved: 0, archivedPath: null };
    }
    return moveFromBacklog(altPath, shitenDir);
  }
  return moveFromBacklog(backlogPath, shitenDir);
}

function moveFromBacklog(
  backlogPath: string,
  shitenDir: string
): { checked: number; moved: number; archivedPath: string | null } {
  const content = readFileSync(backlogPath, "utf-8");
  const lines = content.split("\n");

  // Find completed items (lines with [x])
  const completedLines: string[] = [];
  const remainingLines: string[] = [];

  for (const line of lines) {
    if (/^- \[x\]/.test(line)) {
      completedLines.push(line);
    } else {
      remainingLines.push(line);
    }
  }

  if (completedLines.length === 0) {
    return { checked: lines.length, moved: 0, archivedPath: null };
  }

  // Create done directory if it doesn't exist
  const doneDir = join(shitenDir, "governance", "plans", "done");
  if (!existsSync(doneDir)) {
    mkdirSync(doneDir, { recursive: true });
  }

  // Archive completed items to a dated file
  const date = new Date().toISOString().slice(0, 10);
  const archivePath = join(doneDir, `${date}-completed-backlog.md`);
  const archiveContent = `# Completed Backlog Items\n\nArchived: ${new Date().toISOString()}\n\n${completedLines.join("\n")}\n`;

  try {
    writeFileSync(archivePath, archiveContent, "utf-8");
    logger.info("daemon", `Archived ${completedLines.length} completed backlog items to ${archivePath}`);
  } catch (err) {
    logger.error("daemon", `Failed to archive backlog items: ${err}`);
    return { checked: lines.length, moved: 0, archivedPath: null };
  }

  // Rewrite BACKLOG.md without completed items
  try {
    writeFileSync(backlogPath, remainingLines.join("\n"), "utf-8");
    logger.info("daemon", `Removed ${completedLines.length} completed items from BACKLOG.md`);
  } catch (err) {
    logger.error("daemon", `Failed to update BACKLOG.md: ${err}`);
    return { checked: lines.length, moved: 0, archivedPath: null };
  }

  return {
    checked: lines.length,
    moved: completedLines.length,
    archivedPath: archivePath,
  };
}
