import type { Socket } from "node:net";
import { appendFileSync } from "node:fs";
import { logger } from "../logger.js";
import { type DaemonState, MAX_EVENTS, MAX_SESSIONS } from "./state.js";

// ── IPC Protocol ──────────────────────────────────────────────────────────────

export interface IpcMessage {
  type: string;
  version?: string;
  [key: string]: unknown;
}

export function sendJson(socket: Socket, obj: object): void {
  try {
    socket.write(JSON.stringify(obj) + "\n");
  } catch {
    logger.debug("daemon", "Failed to write to socket — may have closed");
  }
}

// ── Logger ────────────────────────────────────────────────────────────────────

function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    appendFileSync(logPath, line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}

// ── Message Handler ───────────────────────────────────────────────────────────

export async function handleMessage(
  msg: IpcMessage,
  socket: Socket,
  shitenDir: string,
  sockPath: string,
  startedAt: number,
  logPath: string,
  state: DaemonState,
  projectRoot: string,
  daemonVersion: string,
): Promise<void> {
  switch (msg.type) {
    case "ping":
      sendJson(socket, { type: "pong", version: daemonVersion });
      break;

    case "handshake":
      if (msg.version !== daemonVersion) {
        sendJson(socket, {
          type: "error",
          code: "VERSION_MISMATCH",
          daemonVersion,
          clientVersion: msg.version,
        });
      } else {
        sendJson(socket, { type: "handshake_ok", version: daemonVersion });
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
        version: daemonVersion,
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
      const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
      sendJson(socket, {
        type: "health",
        score: state.health?.score ?? null,
        checkedAt: state.health?.checkedAt ?? null,
        trend,
        uptimeSeconds,
        pid: process.pid,
        activeSessions: state.sessions.filter((s) => !s.endedAt).length,
        lastCommand: state.lastCommandName ?? null,
        lastCommandAt: state.lastCommandAt ?? null,
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

    // ── Cached Briefing & Risk Map ────────────────────────────────────────────

    case "query_briefing": {
      if (!state.briefingCache) {
        try {
          const { collectContext } = await import("../context-collector.js");
          const snapshot = collectContext(projectRoot, shitenDir);
          state.briefingCache = {
            computedAt: new Date().toISOString(),
            data: snapshot.briefing,
          };
          daemonLog(logPath, "INFO", "Briefing cache warmed via IPC query");
        } catch (err) {
          daemonLog(logPath, "ERROR", `Failed to compute briefing: ${err}`);
          sendJson(socket, { type: "error", message: "Failed to compute briefing" });
          return;
        }
      }
      sendJson(socket, { type: "briefing", ...state.briefingCache });
      break;
    }

    case "query_riskmap": {
      if (!state.riskMapCache) {
        try {
          const { generateRiskMap } = await import("../risk-map.js");
          const riskMap = generateRiskMap(projectRoot, shitenDir);
          state.riskMapCache = {
            computedAt: new Date().toISOString(),
            data: riskMap,
          };
          daemonLog(logPath, "INFO", "Risk map cache warmed via IPC query");
        } catch (err) {
          daemonLog(logPath, "ERROR", `Failed to compute risk map: ${err}`);
          sendJson(socket, { type: "error", message: "Failed to compute risk map" });
          return;
        }
      }
      sendJson(socket, { type: "riskmap", ...state.riskMapCache });
      break;
    }

    default:
      sendJson(socket, { type: "error", message: `Unknown message type: ${msg.type}` });
  }
}
