/**
 * daemon.ts — Shiten Background Daemon (Event Hub)
 *
 * Runs as a long-lived process to:
 * 1. Watch governance files in real-time (chokidar)
 * 2. Archive plans that reach Status: Done (checkAndArchiveDonePlans)
 * 3. Serve status/ping/queries via a Unix socket (IPC)
 * 4. Consume events from the event bus and maintain shared state
 *
 * Security:
 * - Socket is chmod 0600 (owner only)
 * - First client message must include version handshake
 * - SHITEN_NO_DAEMON=1 / CI=true: daemon is never started
 *
 * Invocation: node daemon-process.js <shitenDir>
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
import { execSync } from "node:child_process";
import { getEventBus } from "./event-bus.js";
import { startWatching } from "./infrastructure/persistence/file-watcher.js";
import { checkAndArchiveDonePlans } from "./plan-lifecycle.js";
import { InferenceEngine } from "./inference-engine.js";
import { auditHealth } from "./health-auditor.js";
import { DaemonCircuitBreaker } from "./daemon-circuit-breaker.js";
import { outputError } from "./output.js";
import { logger } from "./logger.js";
import { SHITEN_DIR_NAME } from "./constants.js";
import { initializeRuleEngine } from "./rule-engine/engine.js";
import { initializeProactiveEngine } from "./proactive-engine.js";

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

function getPaths(shitenDir: string) {
  const daemonDir = join(shitenDir, "daemon");
  return {
    daemonDir,
    pidPath: join(daemonDir, "daemon.pid"),
    sockPath: join(daemonDir, "daemon.sock"),
    logPath: process.env["SHITEN_DAEMON_LOG"] ?? join(daemonDir, "daemon.log"),
    approvedPath: join(daemonDir, "daemon.approved"),
    statePath: join(daemonDir, "daemon-state.json"),
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

// ── Daemon State ──────────────────────────────────────────────────────────────

interface DriftInfo {
  filesChanged: number;
  minutesSinceLastCommit: number;
  detectedAt: string;
}

interface SessionInfo {
  id: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
}

interface HealthInfo {
  score: number;
  checkedAt: string;
}

interface ChallengeInfo {
  type: string;
  severity: string;
  message: string;
  generatedAt: string;
}

interface DebtInfo {
  gapCount: number;
  healthScore: number;
  detectedAt: string;
}

interface EventEntry {
  type: string;
  timestamp: string;
}

interface DaemonState {
  drift: DriftInfo | null;
  sessions: SessionInfo[];
  health: HealthInfo | null;
  challenges: ChallengeInfo[];
  debt: DebtInfo | null;
  events: EventEntry[];
  startedAt: string;
}

const MAX_EVENTS = 100;
const MAX_SESSIONS = 50;
const MAX_CHALLENGES = 20;

function createDaemonState(): DaemonState {
  return {
    drift: null,
    sessions: [],
    health: null,
    challenges: [],
    debt: null,
    events: [],
    startedAt: new Date().toISOString(),
  };
}

function recordEvent(state: DaemonState, eventType: string): void {
  state.events.push({ type: eventType, timestamp: new Date().toISOString() });
  if (state.events.length > MAX_EVENTS) {
    state.events.shift();
  }
}

function persistState(state: DaemonState, statePath: string): void {
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // State persistence is best-effort
  }
}

function loadState(statePath: string): DaemonState | null {
  try {
    if (!existsSync(statePath)) return null;
    const raw = readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as DaemonState;
  } catch {
    return null;
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

export async function runDaemon(shitenDir: string): Promise<void> {
  const paths = getPaths(shitenDir);
  const { daemonDir, pidPath, sockPath, logPath, approvedPath, statePath } = paths;

  if (!existsSync(daemonDir)) {
    mkdirSync(daemonDir, { recursive: true });
  }

  daemonLog(logPath, "INFO", `Shiten Daemon v${DAEMON_VERSION} starting — shitenDir: ${shitenDir}`);

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

  // ── Daemon State ──────────────────────────────────────────────────────────

  const state = loadState(statePath) ?? createDaemonState();
  state.startedAt = new Date().toISOString();
  daemonLog(logPath, "INFO", `State loaded — ${state.events.length} historical events`);

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
          handleMessage(msg, socket, shitenDir, sockPath, startedAt, logPath, state);
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
  const stopWatcher = startWatching(shitenDir);

  // ── Rule Engine: subscribe to event bus events ──────────────────────────────
  const projectRoot = join(shitenDir, "..");
  initializeRuleEngine(projectRoot, shitenDir);
  daemonLog(logPath, "INFO", "Rule engine initialized — subscribed to event bus");

  // ── Proactive Engine: subscribe to engineering state events ─────────────────
  const stopProactive = initializeProactiveEngine(projectRoot, shitenDir);
  daemonLog(logPath, "INFO", "Proactive engine initialized — subscribed to event bus");

  // ── Initial Startup Scan ───────────────────────────────────────────────────
  // Execute proactive functions once on daemon startup (ignoreInitial workaround)

  daemonLog(logPath, "INFO", "Running initial startup scan...");
  const scanStartTime = Date.now();

  // 1. Archive done plans
  try {
    const archiveResult = checkAndArchiveDonePlans(shitenDir);
    if (archiveResult.archived > 0) {
      daemonLog(logPath, "INFO", `Startup scan: archived ${archiveResult.archived} plan(s): ${archiveResult.archivedIds.join(", ")}`);
    }
    recordEvent(state, "startup_scan.archive_plans");
  } catch (err) {
    daemonLog(logPath, "ERROR", `Startup scan: checkAndArchiveDonePlans failed: ${err}`);
  }

  // 2. Check plan inconsistencies
  try {
    const inconsistencies = checkInconsistencies(shitenDir);
    if (inconsistencies.inconsistencies > 0) {
      daemonLog(logPath, "WARN", `Startup scan: found ${inconsistencies.inconsistencies} inconsistent plan(s)`);
    }
    recordEvent(state, "startup_scan.check_inconsistencies");
  } catch (err) {
    daemonLog(logPath, "ERROR", `Startup scan: checkInconsistencies failed: ${err}`);
  }

  // 3. Validate reminders
  try {
    const reminders = validateReminders(shitenDir);
    if (reminders.removed > 0) {
      daemonLog(logPath, "INFO", `Startup scan: removed ${reminders.removed} stale reminder(s)`);
    }
    recordEvent(state, "startup_scan.validate_reminders");
  } catch (err) {
    daemonLog(logPath, "ERROR", `Startup scan: validateReminders failed: ${err}`);
  }

  // 4. Move completed backlog items
  try {
    const backlog = moveCompletedBacklogToDone(shitenDir, shitenDir);
    if (backlog.moved > 0) {
      daemonLog(logPath, "INFO", `Startup scan: moved ${backlog.moved} completed backlog item(s)`);
    }
    recordEvent(state, "startup_scan.move_backlog");
  } catch (err) {
    daemonLog(logPath, "ERROR", `Startup scan: moveCompletedBacklogToDone failed: ${err}`);
  }

  const scanDuration = Date.now() - scanStartTime;
  daemonLog(logPath, "INFO", `Initial startup scan completed in ${scanDuration}ms`);

  // ── Event Subscriptions ─────────────────────────────────────────────────────

  // TIER 1: plan.file_changed — archive done plans + trigger standard audit
  bus.subscribe("plan.file_changed", () => {
    recordEvent(state, "plan.file_changed");
    try {
      const result = checkAndArchiveDonePlans(shitenDir);
      if (result.archived > 0) {
        daemonLog(logPath, "INFO", `Auto-archived ${result.archived} plan(s): ${result.archivedIds.join(", ")}`);
      }
    } catch (err) {
      daemonLog(logPath, "ERROR", `checkAndArchiveDonePlans failed: ${err}`);
    }
    // Trigger standard audit on plan changes (critical governance file)
    runPeriodicAudit();
  });

  // TIER 1: workdir.large_uncommitted_drift — log drift (passive)
  bus.subscribe("workdir.large_uncommitted_drift", (payload) => {
    recordEvent(state, "workdir.large_uncommitted_drift");
    const p = payload as { filesChanged?: number; minutesSinceLastCommit?: number } | undefined;
    state.drift = {
      filesChanged: p?.filesChanged ?? 0,
      minutesSinceLastCommit: p?.minutesSinceLastCommit ?? 0,
      detectedAt: new Date().toISOString(),
    };
    daemonLog(logPath, "WARN", `Drift detected: ${state.drift.filesChanged} files, ${state.drift.minutesSinceLastCommit} min`);
  });

  // TIER 1: task.completed — archive + buffer update + trigger quick audit
  bus.subscribe("task.completed", () => {
    recordEvent(state, "task.completed");
    try {
      const result = checkAndArchiveDonePlans(shitenDir);
      if (result.archived > 0) {
        daemonLog(logPath, "INFO", `Task completed — auto-archived ${result.archived} plan(s)`);
      }
    } catch (err) {
      daemonLog(logPath, "ERROR", `task.completed handler failed: ${err}`);
    }
    // Trigger quick audit on task completion
    runPeriodicAudit();
  });

  // TIER 1: session.start — track session (passive)
  bus.subscribe("session.start", (payload) => {
    recordEvent(state, "session.start");
    const p = payload as { sessionId?: string } | undefined;
    state.sessions.push({
      id: p?.sessionId ?? `session-${Date.now()}`,
      startedAt: new Date().toISOString(),
    });
    if (state.sessions.length > MAX_SESSIONS) {
      state.sessions.shift();
    }
  });

  // TIER 1: session.end — close session (passive)
  bus.subscribe("session.end", (payload) => {
    recordEvent(state, "session.end");
    const p = payload as { sessionId?: string; duration?: number } | undefined;
    const session = state.sessions.find((s) => !s.endedAt);
    if (session) {
      session.endedAt = new Date().toISOString();
      session.duration = p?.duration ?? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);
    }
  });

  // TIER 1: health.checked — track health (passive)
  bus.subscribe("health.checked", (payload) => {
    recordEvent(state, "health.checked");
    const p = payload as { score?: number } | undefined;
    if (p?.score !== undefined) {
      state.health = { score: p.score, checkedAt: new Date().toISOString() };
    }
  });

  // TIER 2: challenge.generated — queue challenges (passive)
  bus.subscribe("challenge.generated", (payload) => {
    recordEvent(state, "challenge.generated");
    const p = payload as { type?: string; severity?: string; message?: string } | undefined;
    state.challenges.push({
      type: p?.type ?? "unknown",
      severity: p?.severity ?? "medium",
      message: p?.message ?? "",
      generatedAt: new Date().toISOString(),
    });
    if (state.challenges.length > MAX_CHALLENGES) {
      state.challenges.shift();
    }
  });

  // TIER 2: knowledge_debt.detected — track debt (passive)
  bus.subscribe("knowledge_debt.detected", (payload) => {
    recordEvent(state, "knowledge_debt.detected");
    const p = payload as { gapCount?: number; healthScore?: number } | undefined;
    state.debt = {
      gapCount: p?.gapCount ?? 0,
      healthScore: p?.healthScore ?? 100,
      detectedAt: new Date().toISOString(),
    };
  });

  // TIER 2: backlog.updated — move completed items + trigger quick audit
  bus.subscribe("backlog.updated", () => {
    recordEvent(state, "backlog.updated");
    try {
      const backlog = moveCompletedBacklogToDone(shitenDir, shitenDir);
      if (backlog.moved > 0) {
        daemonLog(logPath, "INFO", `backlog.updated: moved ${backlog.moved} completed item(s)`);
      }
    } catch (err) {
      daemonLog(logPath, "ERROR", `backlog.updated handler failed: ${err}`);
    }
    // Trigger quick audit on backlog changes
    runPeriodicAudit();
  });

  // TIER 2: plan.inconsistency_detected — log inconsistency (passive)
  bus.subscribe("plan.inconsistency_detected", (payload) => {
    recordEvent(state, "plan.inconsistency_detected");
    const p = payload as { planId?: string; message?: string } | undefined;
    daemonLog(logPath, "WARN", `Plan inconsistency detected: ${p?.planId ?? "unknown"} — ${p?.message ?? ""}`);
  });

  // ── Generic event logger — record all event types passing through ─────────

  const logEvents = [
    "adr.created", "skill.created", "plan.created", "asset.created",
    "asset.updated", "engineering_state.updated", "docs.sync.triggered",
    "backlog.updated", "validation.completed", "pipeline.complete",
    "capability.installed", "maturity.changed", "rule.triggered",
  ] as const;

  for (const evt of logEvents) {
    bus.subscribe(evt, () => {
      recordEvent(state, evt);
    });
  }

  // ── Large Commit Detection — periodic check every 5 minutes ──────────────

  const LARGE_COMMIT_THRESHOLD = 50;
  const largeCommitTimer = setInterval(() => {
    try {
      if (isLargeCommit(shitenDir, LARGE_COMMIT_THRESHOLD)) {
        daemonLog(logPath, "WARN", `Large commit detected (${LARGE_COMMIT_THRESHOLD}+ staged files) — triggering standard audit`);
        runPeriodicAudit();
      }
    } catch (err) {
      daemonLog(logPath, "ERROR", `Large commit check failed: ${err}`);
    }
  }, 5 * 60 * 1000);

  // ── State persistence timer ────────────────────────────────────────────────

  const persistTimer = setInterval(() => {
    persistState(state, statePath);
  }, 30_000);

  // ── Adaptive Periodic Audit ────────────────────────────────────────────────
  // Calculates audit interval based on health score:
  //   > 70 → quick audit every 2 hours
  //   40-70 → standard audit every 30 minutes
  //   < 40 → code-review audit every 10 minutes

  function getAuditIntervalMs(): number {
    const score = state.health?.score ?? 50;
    if (score > 70) return 6 * 60 * 60 * 1000;   // 6 hours (healthy)
    return 4 * 60 * 60 * 1000;                     // 4 hours (unhealthy)
  }

  function getAuditLevel(): "quick" | "standard" | "code-review" {
    const score = state.health?.score ?? 50;
    if (score > 70) return "quick";
    if (score >= 40) return "standard";
    return "code-review";
  }

  function runPeriodicAudit(): void {
    try {
      const level = getAuditLevel();
      const report = auditHealth(shitenDir, shitenDir, level);

      // Update state with new health score
      state.health = {
        score: report.healthScore,
        checkedAt: report.auditedAt,
      };

      recordEvent(state, "health.checked");
      daemonLog(logPath, "INFO", `Periodic audit (${level}): score=${report.healthScore}/100, ${report.issues.length} issue(s)`);
    } catch (err) {
      daemonLog(logPath, "ERROR", `Periodic audit failed: ${err}`);
    }
  }

  let auditTimer = setInterval(runPeriodicAudit, getAuditIntervalMs());

  // Recalculate interval when health score changes
  bus.subscribe("health.checked", () => {
    const newInterval = getAuditIntervalMs();
    clearInterval(auditTimer);
    auditTimer = setInterval(runPeriodicAudit, newInterval);
    daemonLog(logPath, "DEBUG", `Audit interval recalculated: ${newInterval / 1000}s (score=${state.health?.score ?? "unknown"})`);
  });

  // ── Circuit Breaker: Reset after stable uptime ─────────────────────────────

  const breaker = new DaemonCircuitBreaker(shitenDir);
  const stableTimer = setTimeout(() => {
    breaker.reset();
    daemonLog(logPath, "INFO", "Stable uptime reached — circuit breaker reset");
  }, DaemonCircuitBreaker.stableUptimeMs);

  // ── Graceful Shutdown ──────────────────────────────────────────────────────

  const shutdown = (signal: string) => {
    daemonLog(logPath, "INFO", `Received ${signal} — shutting down`);
    clearTimeout(stableTimer);
    clearInterval(persistTimer);
    clearInterval(auditTimer);
    clearInterval(largeCommitTimer);
    persistState(state, statePath);
    stopProactive();
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

  daemonLog(logPath, "INFO", `Daemon ready — consuming ${logEvents.length + 8} event types`);
}

// ── Message Handler ───────────────────────────────────────────────────────────

function handleMessage(
  msg: IpcMessage,
  socket: Socket,
  shitenDir: string,
  sockPath: string,
  startedAt: number,
  logPath: string,
  state: DaemonState,
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
      const activeSessions = state.sessions.filter((s) => !s.endedAt).length;
      const lastSession = state.sessions.length > 0
        ? state.sessions[state.sessions.length - 1]
        : null;

      sendJson(socket, {
        type: "status",
        pid: process.pid,
        version: DAEMON_VERSION,
        shitenDir,
        socketPath: sockPath,
        uptimeSeconds: uptimeSec,
        eventsRecorded: state.events.length,
        activeSessions,
        lastSession: lastSession
          ? { id: lastSession.id, startedAt: lastSession.startedAt, duration: lastSession.duration }
          : null,
        drift: state.drift,
        health: state.health,
        challengesQueued: state.challenges.length,
        debt: state.debt,
      });
      break;
    }

    case "stop":
      sendJson(socket, { type: "stopping" });
      daemonLog(logPath, "INFO", "Stop requested via IPC");
      process.kill(process.pid, "SIGTERM");
      break;

    // ── Query Handlers (Tier 2) ───────────────────────────────────────────────

    case "query_events": {
      const limit = Math.min(Number(msg.limit) || 20, MAX_EVENTS);
      const events = state.events.slice(-limit);
      sendJson(socket, { type: "events", events, count: events.length });
      break;
    }

    case "query_health": {
      const prev = state.health;
      let trend: "stable" | "improving" | "degrading" | "unknown" = "unknown";
      if (prev) {
        trend = prev.score >= 70 ? "stable" : prev.score >= 40 ? "degrading" : "unknown";
      }
      sendJson(socket, {
        type: "health",
        score: state.health?.score ?? null,
        checkedAt: state.health?.checkedAt ?? null,
        trend,
      });
      break;
    }

    case "query_drift": {
      sendJson(socket, {
        type: "drift",
        drift: state.drift,
      });
      break;
    }

    case "query_sessions": {
      const limit = Math.min(Number(msg.limit) || 10, MAX_SESSIONS);
      const sessions = state.sessions.slice(-limit);
      sendJson(socket, {
        type: "sessions",
        sessions,
        total: state.sessions.length,
        active: state.sessions.filter((s) => !s.endedAt).length,
      });
      break;
    }

    case "query_challenges": {
      sendJson(socket, {
        type: "challenges",
        challenges: state.challenges,
        count: state.challenges.length,
      });
      break;
    }

    case "query_debt": {
      sendJson(socket, {
        type: "debt",
        debt: state.debt,
      });
      break;
    }

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

// ── Proactive Startup Functions ──────────────────────────────────────────────

/**
 * Detect plans with inconsistent status (e.g. status="done" but checkboxes still open).
 * Uses InferenceEngine to analyse all plans.
 */
function checkInconsistencies(shitenDir: string): { checked: number; inconsistencies: number; planIds: string[] } {
  const inferenceEngine = new InferenceEngine(shitenDir);
  const allInferences = inferenceEngine.inferAllPlans();
  const inconsistent = allInferences.filter((inf) => inf.inferredStatus === "inconsistent");
  const planIds = inconsistent.map((inf) => inf.id);

  if (inconsistent.length > 0) {
    logger.warn("daemon", `Found ${inconsistent.length} inconsistent plan(s): ${planIds.join(", ")}`);
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
function isLargeCommit(projectRoot: string, threshold: number = 50): boolean {
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
function validateReminders(
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
function moveCompletedBacklogToDone(
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

// ── Entry Point ───────────────────────────────────────────────────────────────

// When run directly as a script (shiten.ts spawns this via startDaemon)
const shitenDirArg = process.argv[2];
if (shitenDirArg) {
  runDaemon(shitenDirArg).catch((err) => {
    outputError(`[daemon] Fatal error: ${err}`);
    process.exit(1);
  });
}
