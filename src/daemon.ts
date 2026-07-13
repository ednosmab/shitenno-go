/**
 * daemon.ts — Nexus Background Daemon
 *
 * Runs as a long-lived process to:
 * 1. Watch governance files in real-time (chokidar)
 * 2. Archive plans that reach Status: Done (checkAndArchiveDonePlans)
 * 3. Serve status/ping requests via a Unix socket (IPC)
 *
 * Security:
 * - Socket is chmod 0600 (owner only)
 * - First client message must include version handshake
 * - NEXUS_NO_DAEMON=1 / CI=true: daemon is never started
 *
 * Invocation: node daemon-process.js <nexusDir>
 * (Spawned by daemon-client.ts#startDaemon)
 *
 * PRINCIPLE: A process that can't be stopped safely should never be started.
 */

import { createServer, type Server, type Socket } from "node:net";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  appendFileSync,
  chmodSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { getEventBus } from "./event-bus.js";
import { startWatching } from "./file-watcher.js";
import { checkAndArchiveDonePlans } from "./plan-lifecycle.js";
import { DaemonCircuitBreaker } from "./daemon-circuit-breaker.js";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const __dirname_file = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname_file, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

const DAEMON_VERSION = getVersion();

// ── Paths ─────────────────────────────────────────────────────────────────────

function getPaths(nexusDir: string) {
  const daemonDir = join(nexusDir, "daemon");
  return {
    daemonDir,
    pidPath: join(daemonDir, "daemon.pid"),
    sockPath: join(daemonDir, "daemon.sock"),
    logPath: process.env["NEXUS_DAEMON_LOG"] ?? join(daemonDir, "daemon.log"),
    approvedPath: join(daemonDir, "daemon.approved"),
  };
}

// ── Logger ────────────────────────────────────────────────────────────────────

function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    appendFileSync(logPath, line, "utf-8");
  } catch {
    // If we can't log, we can't log — don't crash
  }
}

// ── IPC Protocol ──────────────────────────────────────────────────────────────

interface IpcMessage {
  type: string;
  version?: string;
  [key: string]: unknown;
}

function sendJson(socket: Socket, obj: object): void {
  try {
    socket.write(JSON.stringify(obj) + "\n");
  } catch {
    // Socket might have closed
  }
}

// ── Daemon ────────────────────────────────────────────────────────────────────

export async function runDaemon(nexusDir: string): Promise<void> {
  const paths = getPaths(nexusDir);
  const { daemonDir, pidPath, sockPath, logPath, approvedPath } = paths;

  if (!existsSync(daemonDir)) {
    mkdirSync(daemonDir, { recursive: true });
  }

  daemonLog(logPath, "INFO", `Nexus Daemon v${DAEMON_VERSION} starting — nexusDir: ${nexusDir}`);

  // ── Write PID ──────────────────────────────────────────────────────────────

  writeFileSync(pidPath, String(process.pid), "utf-8");
  daemonLog(logPath, "INFO", `PID ${process.pid} written to ${pidPath}`);

  // ── Mark as approved (first successful start) ──────────────────────────────

  if (!existsSync(approvedPath)) {
    writeFileSync(approvedPath, new Date().toISOString(), "utf-8");
    daemonLog(logPath, "INFO", "Daemon marked as approved for auto-start");
  }

  // ── Cleanup stale socket ───────────────────────────────────────────────────

  if (existsSync(sockPath)) {
    try { unlinkSync(sockPath); } catch { /* ignore */ }
  }

  // ── IPC Socket Server ──────────────────────────────────────────────────────

  const startedAt = Date.now();

  const server: Server = createServer((socket: Socket) => {
    let buffer = "";

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as IpcMessage;
          handleMessage(msg, socket, nexusDir, sockPath, startedAt, logPath);
        } catch {
          sendJson(socket, { type: "error", message: "Invalid JSON" });
        }
      }
    });

    socket.on("error", () => socket.destroy());
  });

  server.listen(sockPath, () => {
    // chmod 0600 — owner-only access
    try {
      chmodSync(sockPath, 0o600);
    } catch (err) {
      daemonLog(logPath, "WARN", `chmod 0600 failed on socket: ${err}`);
    }
    daemonLog(logPath, "INFO", `IPC socket listening at ${sockPath}`);
  });

  // ── File Watcher & Reactive Logic ──────────────────────────────────────────

  const bus = getEventBus();
  const stopWatcher = startWatching(nexusDir);

  bus.subscribe("plan.file_changed", () => {
    try {
      const result = checkAndArchiveDonePlans(nexusDir);
      if (result.archived > 0) {
        daemonLog(logPath, "INFO", `Auto-archived ${result.archived} plan(s): ${result.archivedIds.join(", ")}`);
      }
    } catch (err) {
      daemonLog(logPath, "ERROR", `checkAndArchiveDonePlans failed: ${err}`);
    }
  });

  // ── Circuit Breaker: Reset after stable uptime ─────────────────────────────

  const breaker = new DaemonCircuitBreaker(nexusDir);
  const stableTimer = setTimeout(() => {
    breaker.reset();
    daemonLog(logPath, "INFO", "Stable uptime reached — circuit breaker reset");
  }, DaemonCircuitBreaker.stableUptimeMs);

  // ── Graceful Shutdown ──────────────────────────────────────────────────────

  const shutdown = (signal: string) => {
    daemonLog(logPath, "INFO", `Received ${signal} — shutting down`);
    clearTimeout(stableTimer);
    stopWatcher();
    server.close(() => {
      cleanup(pidPath, sockPath);
      daemonLog(logPath, "INFO", "Daemon stopped cleanly");
      process.exit(0);
    });
    // Force exit after 5s if cleanup hangs
    setTimeout(() => {
      cleanup(pidPath, sockPath);
      process.exit(1);
    }, 5_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ── Keep alive ─────────────────────────────────────────────────────────────

  daemonLog(logPath, "INFO", "Daemon ready");

  // Prevent the process from exiting (server + watcher keep the event loop alive)
  // No explicit `await` needed — the signal handlers will resolve the loop.
}

// ── Message Handler ───────────────────────────────────────────────────────────

function handleMessage(
  msg: IpcMessage,
  socket: Socket,
  nexusDir: string,
  sockPath: string,
  startedAt: number,
  logPath: string
): void {
  switch (msg.type) {
    case "ping":
      sendJson(socket, { type: "pong", version: DAEMON_VERSION });
      break;

    case "handshake":
      if (msg.version !== DAEMON_VERSION) {
        sendJson(socket, {
          type: "error",
          code: "VERSION_MISMATCH",
          daemonVersion: DAEMON_VERSION,
          clientVersion: msg.version,
        });
      } else {
        sendJson(socket, { type: "handshake_ok", version: DAEMON_VERSION });
      }
      break;

    case "status": {
      const uptimeSec = Math.round((Date.now() - startedAt) / 1000);
      sendJson(socket, {
        type: "status",
        pid: process.pid,
        version: DAEMON_VERSION,
        nexusDir,
        socketPath: sockPath,
        uptimeSeconds: uptimeSec,
      });
      break;
    }

    case "stop":
      sendJson(socket, { type: "stopping" });
      daemonLog(logPath, "INFO", "Stop requested via IPC");
      process.kill(process.pid, "SIGTERM");
      break;

    default:
      sendJson(socket, { type: "error", message: `Unknown message type: ${msg.type}` });
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanup(pidPath: string, sockPath: string): void {
  for (const p of [pidPath, sockPath]) {
    try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
  }
}

// ── Entry Point ───────────────────────────────────────────────────────────────

// When run directly as a script (nexus.ts spawns this via startDaemon)
const nexusDirArg = process.argv[2];
if (nexusDirArg) {
  runDaemon(nexusDirArg).catch((err) => {
    console.error("[daemon] Fatal error:", err);
    process.exit(1);
  });
}
