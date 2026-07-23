/**
 * notify.ts — Cross-Platform Desktop Notifications for Shugo
 *
 * Supports: Linux (notify-send), macOS (osascript), Windows (PowerShell/msg.exe).
 * Falls back to persistent log when no desktop notification is available.
 *
 * All notifications (sent or throttled) are logged to notifications.jsonl
 * for audit via `shugo daemon notifications`.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";
import type { ReminderPriority } from "./briefing.js";
import { logger } from "./logger.js";

let warnedUnsupportedPlatform = false;

// ── Notification Log ──────────────────────────────────────────────────────

const MAX_LOG_BYTES = 500_000; // 500KB
const MAX_LOG_FILES = 3;

function getLogPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "notifications.jsonl");
}

function rotateLogIfNeeded(logPath: string): void {
  try {
    if (!existsSync(logPath)) return;
    const stat = statSync(logPath);
    if (stat.size < MAX_LOG_BYTES) return;

    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (existsSync(src)) {
        if (i === MAX_LOG_FILES - 1 && existsSync(dst)) {
          try { unlinkSync(dst); } catch {}
        }
        renameSync(src, dst);
      }
    }
    renameSync(logPath, `${logPath}.1`);
  } catch {
    // Silent — log rotation failure should not break notifications
  }
}

export function logNotification(
  shitennoDir: string,
  title: string,
  message: string,
  severity: string,
  delivered: boolean,
  channel: string,
): void {
  try {
    const daemonDir = join(shitennoDir, "daemon");
    if (!existsSync(daemonDir)) mkdirSync(daemonDir, { recursive: true });
    const logPath = getLogPath(shitennoDir);
    rotateLogIfNeeded(logPath);
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      title,
      message,
      severity,
      delivered,
      channel,
    });
    appendFileSync(logPath, entry + "\n", "utf-8");
  } catch {
    // Silent — logging failure should not break notifications
  }
}

// ── Platform Detection ────────────────────────────────────────────────────

type PlatformNotifier = "linux" | "macos" | "windows" | "none";

function detectPlatform(): PlatformNotifier {
  const p = platform();
  if (p === "linux") return "linux";
  if (p === "darwin") return "macos";
  if (p === "win32") return "windows";
  return "none";
}

// ── Send Functions ────────────────────────────────────────────────────────

function sendLinux(title: string, message: string, urgency: string): boolean {
  try {
    execFileSync(
      "notify-send",
      [title, message, `--urgency=${urgency}`],
      { stdio: "pipe", timeout: 2000 },
    );
    return true;
  } catch {
    return false;
  }
}

function sendMacOS(title: string, message: string): boolean {
  try {
    const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
    execFileSync("osascript", ["-e", script], { stdio: "pipe", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function sendWindows(title: string, message: string): boolean {
  try {
    const psScript = `[System.Windows.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')`;
    execFileSync("powershell", ["-NoProfile", "-Command", psScript], { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    try {
      execFileSync("msg", ["*", `${title}: ${message}`], { stdio: "pipe", timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ── Main Entry ────────────────────────────────────────────────────────────

/**
 * Send a desktop notification with cross-platform support.
 * Falls back to persistent log when desktop notifications are unavailable.
 *
 * @param shitennoDir - Project's .shitenno directory for notification log
 * @param title - Notification title
 * @param message - Notification message body
 * @param priority - Priority level (affects urgency on supported platforms)
 * @returns true if a desktop notification was sent
 */
export function sendDesktopNotification(
  shitennoDir: string,
  title: string,
  message: string,
  priority: ReminderPriority = "medium",
): boolean {
  const notifier = detectPlatform();
  const urgency = priority === "high" ? "critical" : priority === "low" ? "low" : "normal";
  let delivered = false;
  let channel = "log";

  if (notifier === "linux") {
    delivered = sendLinux(title, message, urgency);
    if (delivered) channel = "notify-send";
  } else if (notifier === "macos") {
    delivered = sendMacOS(title, message);
    if (delivered) channel = "osascript";
  } else if (notifier === "windows") {
    delivered = sendWindows(title, message);
    if (delivered) channel = "powershell";
  } else if (!warnedUnsupportedPlatform) {
    logger.debug(
      "notify",
      `Desktop notifications not available on platform: ${platform()}. Notifications logged to disk.`,
    );
    warnedUnsupportedPlatform = true;
  }

  // Always log to persistent log for audit
  logNotification(shitennoDir, title, message, priority, delivered, channel);

  return delivered;
}

/**
 * Read notification history from the persistent log.
 * Used by `shugo daemon notifications`.
 */
export function readNotificationLog(
  shitennoDir: string,
  options: { last?: number; severity?: string } = {},
): Array<Record<string, unknown>> {
  const logPath = getLogPath(shitennoDir);
  if (!existsSync(logPath)) return [];

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    let entries = lines.map((line) => {
      try { return JSON.parse(line) as Record<string, unknown>; }
      catch { return null; }
    }).filter((e): e is Record<string, unknown> => e !== null);

    if (options.severity) {
      entries = entries.filter((e) => e.severity === options.severity);
    }

    if (options.last && options.last > 0) {
      entries = entries.slice(-options.last);
    }

    return entries;
  } catch {
    return [];
  }
}
