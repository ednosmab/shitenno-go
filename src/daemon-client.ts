/**
 * daemon-client.ts — Daemon Lifecycle Client
 *
 * Provides functions to start, stop, ping, and query the Nexus daemon.
 * Respects NEXUS_NO_DAEMON and CI environment variables.
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

// ── Package Root Resolution ─────────────────────────────────────────────────

/**
 * Walk up from startDir to find the directory containing package.json.
 * Works in both dev (tsx) and bundled (dist/bin/) modes.
 */
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

// ── Config ────────────────────────────────────────────────────────────────────

const SOCKET_WAIT_MS = 3_000;      // Max wait for daemon socket to appear
const SOCKET_POLL_MS = 100;        // Polling interval
const packageRoot = findPackageRoot(__dirname);
const DAEMON_SCRIPT = join(packageRoot, "dist", "src", "daemon.js");

// ── Env Checks ────────────────────────────────────────────────────────────────

/**
 * Returns true if the daemon should be bypassed.
 * Conditions: NEXUS_NO_DAEMON=1, CI=true, or running as a child process.
 */
export function shouldSkipDaemon(): boolean {
  return (
    process.env["NEXUS_NO_DAEMON"] === "1" ||
    process.env["CI"] === "true" ||
    process.env["NEXUS_CHILD"] === "1"
  );
}

// ── PID / Socket Paths ───────────────────────────────────────────────────────

export function getPidPath(nexusDir: string): string {
  return join(nexusDir, "daemon", "daemon.pid");
}

export function getSocketPath(nexusDir: string): string {
  return join(nexusDir, "daemon", "daemon.sock");
}

export function getApprovedPath(nexusDir: string): string {
  return join(nexusDir, "daemon", "daemon.approved");
}

// ── Running Check ─────────────────────────────────────────────────────────────

export function getDaemonPid(nexusDir: string): string | null {
  const pidPath = getPidPath(nexusDir);
  if (!existsSync(pidPath)) return null;
  try {
    return readFileSync(pidPath, "utf-8").trim();
  } catch {
    return null;
  }
}

export function isDaemonApproved(nexusDir: string): boolean {
  return existsSync(getApprovedPath(nexusDir));
}

/**
 * Returns true if a daemon process with a valid PID is running.
 */
export function isDaemonRunning(nexusDir: string): boolean {
  const pidPath = getPidPath(nexusDir);
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
export async function startDaemon(nexusDir: string): Promise<void> {
  if (!existsSync(DAEMON_SCRIPT)) {
    throw new Error(
      `Daemon script not found: ${DAEMON_SCRIPT}. Run 'pnpm build' first.`
    );
  }

  const daemonDir = join(nexusDir, "daemon");
  if (!existsSync(daemonDir)) {
    mkdirSync(daemonDir, { recursive: true });
  }

  const logPath = join(daemonDir, "daemon.log");

  // Spawn detached — process group leader, stdio to log file
  const child = spawn(process.execPath, [DAEMON_SCRIPT, nexusDir], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      NEXUS_DAEMON_LOG: logPath,
      NEXUS_CHILD: "1",
    },
  });

  child.unref(); // Allow parent CLI to exit immediately

  // Wait for socket to appear (daemon writes it on ready)
  const socketPath = getSocketPath(nexusDir);
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
export function stopDaemon(nexusDir: string): boolean {
  const pidPath = getPidPath(nexusDir);
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
export function pingDaemon(nexusDir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socketPath = getSocketPath(nexusDir);
    if (!existsSync(socketPath)) {
      resolve(false);
      return;
    }

    const client = createConnection(socketPath);
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 2_000);

    client.once("connect", () => {
      client.write(JSON.stringify({ type: "ping" }) + "\n");
    });

    client.once("data", (data) => {
      clearTimeout(timer);
      try {
        const msg = JSON.parse(data.toString().trim()) as { type: string };
        resolve(msg.type === "pong");
      } catch {
        resolve(false);
      }
      client.destroy();
    });

    client.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
