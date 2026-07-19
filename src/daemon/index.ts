import { createServer, type Server, type Socket } from "node:net";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  appendFileSync,
  chmodSync,
  readFileSync,
  renameSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getEventBus } from "../event-bus.js";
import { LRUCache } from "../daemon-resources.js";
import type { ResourceClaimedPayload, ResourceReleasedPayload } from "../event-payloads.js";
import { startWatching } from "../infrastructure/persistence/file-watcher.js";
import { checkAndArchiveDonePlans, runAutoVerification } from "../plan-lifecycle.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { auditHealth } from "../health-auditor.js";
import { DaemonCircuitBreaker } from "../daemon-circuit-breaker.js";
import { logger } from "../logger.js";
import { initializeRuleEngine } from "../rule-engine/engine.js";
import { initializeProactiveEngine } from "../prioritization/triggers.js";
import {
  createDaemonState,
  recordEvent,
  persistState,
  loadState,
} from "./state.js";
import { handleMessage, sendJson, type IpcMessage } from "./ipc.js";
import {
  checkInconsistencies,
  isLargeCommit,
  validateReminders,
  moveCompletedBacklogToDone,
} from "./startup-scan.js";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const __dirname_file = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname_file, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

const DAEMON_VERSION = getVersion();

// ── Paths ─────────────────────────────────────────────────────────────────────

export function getPaths(shitennoDir: string) {
  const daemonDir = join(shitennoDir, "daemon");
  return {
    daemonDir,
    pidPath: join(daemonDir, "daemon.pid"),
    sockPath: join(daemonDir, "daemon.sock"),
    logPath: process.env["SHITENNO_DAEMON_LOG"] ?? join(daemonDir, "daemon.log"),
    approvedPath: join(daemonDir, "daemon.approved"),
    statePath: join(daemonDir, "daemon-state.json"),
  };
}

// ── Logger ────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_ROTATED_FILES = 3;

let currentLogBytes = 0;

function getLogRotationConfig(): { maxBytes: number; maxFiles: number } {
  const maxBytes = Number(process.env["SHITENNO_DAEMON_LOG_MAX_BYTES"]) || DEFAULT_MAX_LOG_BYTES;
  const maxFiles = Number(process.env["SHITENNO_DAEMON_LOG_MAX_FILES"]) || DEFAULT_MAX_ROTATED_FILES;
  return { maxBytes, maxFiles };
}

function initLogByteCounter(logPath: string): void {
  try {
    currentLogBytes = existsSync(logPath) ? statSync(logPath).size : 0;
  } catch {
    currentLogBytes = 0;
  }
}

function rotateLogIfNeeded(logPath: string): void {
  const { maxBytes, maxFiles } = getLogRotationConfig();
  if (currentLogBytes < maxBytes) return;

  try {
    for (let i = maxFiles - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (existsSync(src)) {
        if (i === maxFiles - 1 && existsSync(dst)) unlinkSync(dst);
        renameSync(src, dst);
      }
    }
    renameSync(logPath, `${logPath}.1`);
    currentLogBytes = 0;
  } catch (err) {
    logger.debug("daemon", `Log rotation failed: ${err}`);
  }
}

export function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    rotateLogIfNeeded(logPath);
    appendFileSync(logPath, line, "utf-8");
    currentLogBytes += Buffer.byteLength(line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanup(pidPath: string, sockPath: string): void {
  for (const p of [pidPath, sockPath]) {
    try { if (existsSync(p)) unlinkSync(p); } catch { logger.debug("daemon", `Failed to clean up ${p}`); }
  }
}

// ── Daemon ────────────────────────────────────────────────────────────────────

export async function runDaemon(shitennoDir: string, projectRoot?: string): Promise<void> {
  const paths = getPaths(shitennoDir);
  const { daemonDir, pidPath, sockPath, logPath, approvedPath, statePath } = paths;
  const resolvedProjectRoot = projectRoot ?? join(shitennoDir, "..");

  if (!existsSync(daemonDir)) {
    mkdirSync(daemonDir, { recursive: true });
  }

  daemonLog(logPath, "INFO", `Shugo Daemon v${DAEMON_VERSION} starting — shitennoDir: ${shitennoDir}`);

  // ── Initialize log byte counter for rotation ───────────────────────────────
  initLogByteCounter(logPath);

  // ── Duplicate daemon guard ─────────────────────────────────────────────────

  if (existsSync(pidPath)) {
    try {
      const existingPid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      if (!isNaN(existingPid) && existingPid > 0) {
        try {
          process.kill(existingPid, 0); // signal 0 = check if alive
          // Process is alive — another daemon is already running
          daemonLog(logPath, "WARN", `Daemon already running (pid ${existingPid}). Exiting.`);
          process.exit(0);
        } catch {
          // Process not found (ESRCH) — stale PID file, safe to continue
          daemonLog(logPath, "INFO", `Stale PID file (pid ${existingPid} not running). Overwriting.`);
        }
      }
    } catch {
      // Corrupt PID file — safe to continue
    }
  }

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
    try { unlinkSync(sockPath); } catch { logger.debug("daemon", "Failed to remove stale socket"); }
  }

  // ── Daemon State ──────────────────────────────────────────────────────────

  const state = loadState(statePath) ?? createDaemonState();
  state.startedAt = new Date().toISOString();
  daemonLog(logPath, "INFO", `State loaded — ${state.events.length} historical events`);

  // ── IPC Socket Server ──────────────────────────────────────────────────────

  const startedAt = Date.now();

  const server: Server = createServer((socket: Socket) => {
    let buffer = "";

    socket.on("data", async (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as IpcMessage;
          await handleMessage(msg, socket, shitennoDir, sockPath, startedAt, logPath, state, resolvedProjectRoot, DAEMON_VERSION);
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
  const stopWatcher = startWatching(shitennoDir);

  // ── Resource Arbitration: track resources claimed by active CLI sessions ────
  // TTL is short (5min) so a claim self-expires if the CLI crashes without releasing.
  const claimedResources = new LRUCache<string, { sessionId: string; claimedAt: string }>(200, 5 * 60_000);
  const isResourceClaimed = (resourceId: string): boolean => claimedResources.has(resourceId);

  bus.subscribe("resource.claimed", (payload) => {
    const p = payload as unknown as ResourceClaimedPayload;
    if (!p?.resourceId) return;
    claimedResources.set(p.resourceId, { sessionId: p.sessionId, claimedAt: p.timestamp ?? new Date().toISOString() });
    daemonLog(logPath, "INFO", `Resource claimed by session ${p.sessionId}: ${p.resourceId}`);
  });

  bus.subscribe("resource.released", (payload) => {
    const p = payload as unknown as ResourceReleasedPayload;
    if (!p?.resourceId) return;
    claimedResources.delete(p.resourceId);
    daemonLog(logPath, "INFO", `Resource released by session ${p.sessionId}: ${p.resourceId}`);
  });

  // ── Rule Engine: subscribe to event bus events ──────────────────────────────
  initializeRuleEngine(resolvedProjectRoot, shitennoDir, isResourceClaimed);
  daemonLog(logPath, "INFO", "Rule engine initialized — subscribed to event bus");

  // ── Proactive Engine: subscribe to engineering state events ─────────────────
  const stopProactive = initializeProactiveEngine(resolvedProjectRoot, shitennoDir);
  daemonLog(logPath, "INFO", "Proactive engine initialized — subscribed to event bus");

  // ── Initial Startup Scan (async — doesn't block daemon readiness) ─────────
  // Execute proactive functions once on daemon startup via setImmediate

  setImmediate(() => {
    daemonLog(logPath, "INFO", "Running initial startup scan...");
    const scanStartTime = Date.now();

    // 1. Archive done plans
    try {
      const archiveResult = checkAndArchiveDonePlans(shitennoDir);
      if (archiveResult.archived > 0) {
        daemonLog(logPath, "INFO", `Startup scan: archived ${archiveResult.archived} plan(s): ${archiveResult.archivedIds.join(", ")}`);
      }
      recordEvent(state, "startup_scan.archive_plans");
    } catch (err) {
      daemonLog(logPath, "ERROR", `Startup scan: checkAndArchiveDonePlans failed: ${err}`);
    }

    // 2. Check plan inconsistencies
    try {
      const inconsistencies = checkInconsistencies(shitennoDir);
      if (inconsistencies.inconsistencies > 0) {
        daemonLog(logPath, "WARN", `Startup scan: found ${inconsistencies.inconsistencies} inconsistent plan(s)`);
      }
      recordEvent(state, "startup_scan.check_inconsistencies");
    } catch (err) {
      daemonLog(logPath, "ERROR", `Startup scan: checkInconsistencies failed: ${err}`);
    }

    // 3. Validate reminders
    try {
      const reminders = validateReminders(shitennoDir);
      if (reminders.removed > 0) {
        daemonLog(logPath, "INFO", `Startup scan: removed ${reminders.removed} stale reminder(s)`);
      }
      recordEvent(state, "startup_scan.validate_reminders");
  } catch (err) {
    daemonLog(logPath, "ERROR", `Startup scan: validateReminders failed: ${err}`);
  }

  // 4. Move completed backlog items
  try {
    const backlog = moveCompletedBacklogToDone(shitennoDir, shitennoDir);
    if (backlog.moved > 0) {
      daemonLog(logPath, "INFO", `Startup scan: moved ${backlog.moved} completed backlog item(s)`);
    }
    recordEvent(state, "startup_scan.move_backlog");
  } catch (err) {
    daemonLog(logPath, "ERROR", `Startup scan: moveCompletedBacklogToDone failed: ${err}`);
  }

  const scanDuration = Date.now() - scanStartTime;
  daemonLog(logPath, "INFO", `Initial startup scan completed in ${scanDuration}ms`);
  bus.publish("daemon.ready", { pid: process.pid, uptimeMs: scanDuration });
  }); // end setImmediate

  // ── Event Subscriptions ─────────────────────────────────────────────────────

  // TIER 1: plan.file_changed — verify 'check' plans, archive done, + audit
  // Debounce per plan to avoid re-running the full verification suite on rapid saves
  // (e.g. autosave, format-on-save) — tests can legitimately take minutes.
  const verificationDebounce = new Map<string, NodeJS.Timeout>();
  const VERIFICATION_DEBOUNCE_MS = 3000;

  bus.subscribe("plan.file_changed", () => {
    recordEvent(state, "plan.file_changed");
    state.briefingCache = null;
    state.riskMapCache = null;
    try {
      const engine = new MarkdownPlanEngine(shitennoDir);
      const pendingCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");

      for (const plan of pendingCheck) {
        const existing = verificationDebounce.get(plan.id);
        if (existing) clearTimeout(existing);
        verificationDebounce.set(
          plan.id,
          setTimeout(() => {
            verificationDebounce.delete(plan.id);
            try {
              const record = runAutoVerification(shitennoDir, resolvedProjectRoot, plan.id);
              daemonLog(
                logPath,
                record.passed ? "INFO" : "WARN",
                `Auto-verification for ${plan.id}: ${record.passed ? "PASSED → done" : "FAILED → blocked"}`
              );
              const archiveResult = checkAndArchiveDonePlans(shitennoDir);
              if (archiveResult.archived > 0) {
                daemonLog(logPath, "INFO", `Auto-archived ${archiveResult.archived} plan(s)`);
              }
            } catch (err) {
              daemonLog(logPath, "ERROR", `Auto-verification for ${plan.id} failed: ${err}`);
            }
          }, VERIFICATION_DEBOUNCE_MS)
        );
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
      const result = checkAndArchiveDonePlans(shitennoDir);
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
    if (state.sessions.length > 50) {
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

  // TIER 1: command.completed — track last command activity
  bus.subscribe("command.completed", (payload) => {
    recordEvent(state, "command.completed");
    const p = payload as { command?: string } | undefined;
    state.lastCommandName = p?.command ?? null;
    state.lastCommandAt = new Date().toISOString();
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
    if (state.challenges.length > 20) {
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
    state.briefingCache = null;
    state.riskMapCache = null;
    try {
      const backlog = moveCompletedBacklogToDone(shitennoDir, shitennoDir);
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
      if (evt === "asset.updated" || evt === "engineering_state.updated" || evt === "docs.sync.triggered") {
        state.briefingCache = null;
        state.riskMapCache = null;
      }
    });
  }

  // ── Large Commit Detection — periodic check every 5 minutes ──────────────

  const LARGE_COMMIT_THRESHOLD = 50;
  const largeCommitTimer = setInterval(() => {
    try {
      if (isLargeCommit(shitennoDir, LARGE_COMMIT_THRESHOLD)) {
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

  async function runPeriodicAudit(): Promise<void> {
    try {
      const level = getAuditLevel();
      const report = await auditHealth(shitennoDir, shitennoDir, level);

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

  // ── Check-nag: periodic desktop notification for plans stuck in 'check' ──

  const { sendDesktopNotification } = await import("../notify.js").catch(() => ({ sendDesktopNotification: () => {} }));
  const CHECK_NAG_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  let checkNagTimer: NodeJS.Timeout;

  function scheduleCheckNag() {
    checkNagTimer = setTimeout(() => {
      try {
        const engine = new MarkdownPlanEngine(shitennoDir);
        const pending = engine.listAll().filter((p) => p.isActive && p.status === "check");
        if (pending.length > 0) {
          sendDesktopNotification(
            "Shugo — plano pendente",
            `${pending.length} plano(s) em 'check' aguardando verificacao: ${pending.map((p) => p.id).join(", ")}`,
            "medium"
          );
        }
      } catch (err) {
        daemonLog(logPath, "ERROR", `Check-nag failed: ${err}`);
      } finally {
        scheduleCheckNag();
      }
    }, CHECK_NAG_INTERVAL_MS);
  }
  scheduleCheckNag();

  // ── Circuit Breaker: Reset after stable uptime ─────────────────────────────

  const breaker = new DaemonCircuitBreaker(shitennoDir);
  const stableTimer = setTimeout(() => {
    breaker.reset();
    daemonLog(logPath, "INFO", "Stable uptime reached — circuit breaker reset");
  }, DaemonCircuitBreaker.stableUptimeMs);

  // ── Graceful Shutdown ──────────────────────────────────────────────────────

  const shutdown = (signal: string) => {
    daemonLog(logPath, "INFO", `Received ${signal} — shutting down`);
    clearTimeout(stableTimer);
    clearTimeout(checkNagTimer);
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
