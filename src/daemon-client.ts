/**
 * daemon-client.ts — Daemon Lifecycle Client
 *
 * Provides functions to start, stop, ping, and query the Shiten daemon.
 * Respects SHITEN_NO_DAEMON and CI environment variables.
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
 * Conditions: SHITEN_NO_DAEMON=1, CI=true, or running as a child process.
 */
export function shouldSkipDaemon(): boolean {
  return (
    process.env["SHITEN_NO_DAEMON"] === "1" ||
    process.env["CI"] === "true" ||
    process.env["SHITEN_CHILD"] === "1"
  );
}

// ── PID / Socket Paths ───────────────────────────────────────────────────────

export function getPidPath(shitenDir: string): string {
  return join(shitenDir, "daemon", "daemon.pid");
}

export function getSocketPath(shitenDir: string): string {
  return join(shitenDir, "daemon", "daemon.sock");
}

export function getApprovedPath(shitenDir: string): string {
  return join(shitenDir, "daemon", "daemon.approved");
}

// ── Running Check ─────────────────────────────────────────────────────────────

export function getDaemonPid(shitenDir: string): string | null {
  const pidPath = getPidPath(shitenDir);
  if (!existsSync(pidPath)) return null;
  try {
    return readFileSync(pidPath, "utf-8").trim();
  } catch {
    return null;
  }
}

export function isDaemonApproved(shitenDir: string): boolean {
  return existsSync(getApprovedPath(shitenDir));
}

/**
 * Returns true if a daemon process with a valid PID is running.
 */
export function isDaemonRunning(shitenDir: string): boolean {
  const pidPath = getPidPath(shitenDir);
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
export async function startDaemon(shitenDir: string): Promise<void> {
  if (!existsSync(DAEMON_SCRIPT)) {
    throw new Error(
      `Daemon script not found: ${DAEMON_SCRIPT}. Run 'pnpm build' first.`
    );
  }

  const daemonDir = join(shitenDir, "daemon");
  if (!existsSync(daemonDir)) {
    mkdirSync(daemonDir, { recursive: true });
  }

  const logPath = join(daemonDir, "daemon.log");

  // Spawn detached — process group leader, stdio to log file
  const child = spawn(process.execPath, [DAEMON_SCRIPT, shitenDir], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      SHITEN_DAEMON_LOG: logPath,
      SHITEN_CHILD: "1",
    },
  });

  child.unref(); // Allow parent CLI to exit immediately

  // Wait for socket to appear (daemon writes it on ready)
  const socketPath = getSocketPath(shitenDir);
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
export function stopDaemon(shitenDir: string): boolean {
  const pidPath = getPidPath(shitenDir);
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
export async function pingDaemon(shitenDir: string): Promise<boolean> {
  const result = await queryDaemon<{ type: string }>(shitenDir, { type: "ping" }, 2_000);
  return result?.type === "pong";
}

// ── Query: Status ────────────────────────────────────────────────────────────

export interface DaemonStatusResponse {
  type: string;
  pid: number;
  version: string;
  shitenDir: string;
  socketPath: string;
  uptimeSeconds: number;
  eventsRecorded: number;
  activeSessions: number;
  lastSession: { id: string; startedAt: string; duration?: number } | null;
  drift: { filesChanged: number; minutesSinceLastCommit: number; detectedAt: string } | null;
  health: { score: number; checkedAt: string } | null;
  challengesQueued: number;
  debt: { gapCount: number; healthScore: number; detectedAt: string } | null;
}

/**
 * Query the daemon for its full status via IPC.
 * Returns the expanded status response or null on failure.
 */
export async function queryDaemonStatus(shitenDir: string): Promise<DaemonStatusResponse | null> {
  return queryDaemon<DaemonStatusResponse>(shitenDir, { type: "status" }, 2_000);
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
export async function queryDaemonHealth(shitenDir: string): Promise<DaemonHealthResponse | null> {
  return queryDaemon<DaemonHealthResponse>(shitenDir, { type: "query_health" }, 2_000);
}

// ── Generic IPC Query ────────────────────────────────────────────────────────

const DEFAULT_QUERY_TIMEOUT_MS = 1_500;

/**
 * Generic IPC query against the running daemon.
 * Returns null on any failure (daemon down, timeout, malformed response) —
 * callers must always have a disk-based fallback, never throw here.
 */
export function queryDaemon<T extends { type: string }>(
  shitenDir: string,
  message: Record<string, unknown> & { type: string },
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<T | null> {
  return new Promise((resolve) => {
    const socketPath = getSocketPath(shitenDir);
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
