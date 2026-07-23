/**
 * daemon-client.ts — Daemon Lifecycle Client
 *
 * Provides functions to start, stop, ping, and query the Shugo daemon.
 * Respects SHITENNO_NO_DAEMON and CI environment variables.
 *
 * PRINCIPLE: The daemon is opt-in. The CLI always works without it.
 */

import {
  existsSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const SOCKET_WAIT_MS = 3_000;      // Max wait for daemon socket to appear
const SOCKET_POLL_MS = 100;        // Polling interval
const DAEMON_SCRIPT = join(__dirname, "..", "src", "daemon.js");

// ── Env Checks ────────────────────────────────────────────────────────────────

/**
 * Returns true if the daemon should be bypassed.
 * Conditions: SHITENNO_NO_DAEMON=1, CI=true, or running as a child process.
 */
export function shouldSkipDaemon(): boolean {
  return (
    process.env["SHITENNO_NO_DAEMON"] === "1" ||
    process.env["CI"] === "true" ||
    process.env["SHITENNO_CHILD"] === "1"
  );
}

// ── PID / Socket Paths ───────────────────────────────────────────────────────

export function getPidPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "daemon.pid");
}

export function getSocketPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "daemon.sock");
}

export function getApprovedPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "daemon.approved");
}

// ── Running Check ─────────────────────────────────────────────────────────────

export function getDaemonPid(shitennoDir: string): string | null {
  const pidPath = getPidPath(shitennoDir);
  if (!existsSync(pidPath)) return null;
  try {
    return readFileSync(pidPath, "utf-8").trim();
  } catch {
    return null;
  }
}

export function isDaemonApproved(shitennoDir: string): boolean {
  return existsSync(getApprovedPath(shitennoDir));
}

/**
 * Returns true if a daemon process with a valid PID is running.
 */
export function isDaemonRunning(shitennoDir: string): boolean {
  const pidPath = getPidPath(shitennoDir);
  if (!existsSync(pidPath)) return false;

  try {
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid) || pid <= 0) return false;

    // Signal 0 checks if process exists without sending a real signal
    process.kill(pid, 0);
    return true;
  } catch {
    // ESRCH = process not found; EPERM = exists but no permission (counts as running)
    return false;
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

/**
 * Start the daemon as a detached background process.
 * Waits up to SOCKET_WAIT_MS for the socket to become available.
 * Rejects if the daemon script does not exist or socket never appears.
 */
export async function startDaemon(shitennoDir: string, projectRoot?: string): Promise<void> {
  if (isDaemonRunning(shitennoDir)) {
    logger.info("daemon-client", "Daemon already running, skipping start");
    return;
  }

  if (!existsSync(DAEMON_SCRIPT)) {
    throw new Error(
      `Daemon script not found: ${DAEMON_SCRIPT}. Run 'pnpm build' first.`
    );
  }

  const daemonDir = join(shitennoDir, "daemon");
  if (!existsSync(daemonDir)) {
    mkdirSync(daemonDir, { recursive: true });
  }

  const logPath = join(daemonDir, "daemon.log");
  const resolvedProjectRoot = projectRoot ?? join(shitennoDir, "..");

  // Spawn detached — process group leader, stdio to log file
  const child = spawn(process.execPath, [DAEMON_SCRIPT, shitennoDir, resolvedProjectRoot], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      SHITENNO_DAEMON_LOG: logPath,
      SHITENNO_CHILD: "1",
    },
  });

  child.unref(); // Allow parent CLI to exit immediately

  // Wait for socket to appear (daemon writes it on ready)
  const socketPath = getSocketPath(shitennoDir);
  const deadline = Date.now() + SOCKET_WAIT_MS;

  while (Date.now() < deadline) {
    if (existsSync(socketPath)) {
      logger.info("daemon-client", `Daemon started (pid ${child.pid})`);
      return;
    }
    await sleep(SOCKET_POLL_MS);
  }

  throw new Error("Daemon started but socket did not appear within timeout");
}

// ── Stop ──────────────────────────────────────────────────────────────────────

/**
 * Stop the daemon by sending SIGTERM to the recorded PID.
 */
export function stopDaemon(shitennoDir: string): boolean {
  const pidPath = getPidPath(shitennoDir);
  if (!existsSync(pidPath)) return false;

  try {
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid) || pid <= 0) return false;
    process.kill(pid, "SIGTERM");
    logger.info("daemon-client", `SIGTERM sent to daemon pid ${pid}`);
    return true;
  } catch (error) {
    logger.debug("daemon-client", "stopDaemon failed", { error });
    return false;
  }
}

// ── Ping ──────────────────────────────────────────────────────────────────────

/**
 * Send a ping to the daemon via its IPC socket.
 * Returns true if the daemon responds with a pong.
 */
export async function pingDaemon(shitennoDir: string): Promise<boolean> {
  const result = await queryDaemon<{ type: string }>(shitennoDir, { type: "ping" }, 2_000);
  return result?.type === "pong";
}

// ── Query: Status ────────────────────────────────────────────────────────────

export interface DaemonStatusResponse {
  type: string;
  pid: number;
  version: string;
  shitennoDir: string;
  socketPath: string;
  uptimeSeconds: number;
  eventsRecorded: number;
  activeSessions: number;
  lastSession: { id: string; startedAt: string; duration?: number } | null;
  drift: { filesChanged: number; minutesSinceLastCommit: number; detectedAt: string } | null;
  health: { score: number; checkedAt: string } | null;
  challengesQueued: number;
  debt: { gapCount: number; healthScore: number; detectedAt: string } | null;
  proactiveEngine: { lastCheck: string | null; challengesTriggered: number; cooldownUntil: string | null } | null;
  audit: { lastAuditTime: string | null; auditCount: number; notificationsSent: number } | null;
}

/**
 * Query the daemon for its full status via IPC.
 * Returns the expanded status response or null on failure.
 */
export async function queryDaemonStatus(shitennoDir: string): Promise<DaemonStatusResponse | null> {
  return queryDaemon<DaemonStatusResponse>(shitennoDir, { type: "status" }, 2_000);
}

// ── Query: Health ────────────────────────────────────────────────────────────

export interface DaemonHealthResponse {
  type: string;
  score: number | null;
  checkedAt: string | null;
  trend: "stable" | "improving" | "degrading" | "unknown";
}

/**
 * Query the daemon for health status via IPC.
 * Lightweight alternative to queryDaemonStatus when only health is needed.
 */
export async function queryDaemonHealth(shitennoDir: string): Promise<DaemonHealthResponse | null> {
  return queryDaemon<DaemonHealthResponse>(shitennoDir, { type: "query_health" }, 2_000);
}

// ── Generic IPC Query ────────────────────────────────────────────────────────

const DEFAULT_QUERY_TIMEOUT_MS = 1_500;

/**
 * Generic IPC query against the running daemon.
 * Returns null on any failure (daemon down, timeout, malformed response) —
 * callers must always have a disk-based fallback, never throw here.
 */
export function queryDaemon<T extends { type: string }>(
  shitennoDir: string,
  message: Record<string, unknown> & { type: string },
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<T | null> {
  return new Promise((resolve) => {
    const socketPath = getSocketPath(shitennoDir);
    if (!existsSync(socketPath)) {
      resolve(null);
      return;
    }

    const client = createConnection(socketPath);
    const timer = setTimeout(() => {
      client.destroy();
      resolve(null);
    }, timeoutMs);

    client.once("connect", () => {
      client.write(JSON.stringify(message) + "\n");
    });

    client.once("data", (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString().trim()) as T);
      } catch {
        resolve(null);
      }
      client.destroy();
    });

    client.once("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

// ── Graceful Degradation Helper ──────────────────────────────────────────────

/**
 * Query the daemon with automatic fallback to a disk-based value.
 * Returns the daemon response if available, otherwise returns the fallback.
 * Never throws — callers always get a valid value.
 */
export async function queryDaemonWithFallback<T extends { type: string }>(
  shitennoDir: string,
  message: Record<string, unknown> & { type: string },
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    if (!isDaemonRunning(shitennoDir)) return await fallback();
    const response = await queryDaemon<T>(shitennoDir, message);
    return (response as T) ?? await fallback();
  } catch {
    return await fallback();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
