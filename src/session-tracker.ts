/**
 * session-tracker.ts — Session Tracking for User Performance
 *
 * Tracks session start/end, commands executed, and duration.
 * Persists to nexus-system/telemetry/sessions.jsonl (append-only).
 *
 * PRINCIPLE: To report on performance, we must first observe it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  /** Duration in minutes. */
  duration?: number;
  commands: string[];
  feedbackGiven: number;
  recommendationsAccepted: number;
  recommendationsRejected: number;
  pathChoices: { comfortable: number; challenging: number };
  branch?: string;
  commitCount?: number;
}

export interface SessionMetrics {
  totalSessions: number;
  avgDuration: number;
  totalCommands: number;
  commandFrequency: Record<string, number>;
  avgFeedbackPerSession: number;
  totalAccepts: number;
  totalRejects: number;
  challengingRatio: number;
}

// ── Storage ──────────────────────────────────────────────────────────────────

function getTelemetryDir(nexusDir: string): string {
  return join(nexusDir, "telemetry");
}

function getSessionsPath(nexusDir: string): string {
  return join(getTelemetryDir(nexusDir), "sessions.jsonl");
}

function ensureTelemetryDir(nexusDir: string): void {
  const dir = getTelemetryDir(nexusDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ── Core Functions ───────────────────────────────────────────────────────────

/** Start a new session. Returns the session record. */
export function startSession(nexusDir: string): SessionRecord {
  ensureTelemetryDir(nexusDir);

  const now = new Date();
  const session: SessionRecord = {
    id: `SES-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${now.toISOString().slice(11, 19).replace(/:/g, "")}`,
    startedAt: now.toISOString(),
    commands: [],
    feedbackGiven: 0,
    recommendationsAccepted: 0,
    recommendationsRejected: 0,
    pathChoices: { comfortable: 0, challenging: 0 },
  };

  appendSession(nexusDir, session);
  logger.debug("SessionTracker", `Session started: ${session.id}`);
  return session;
}

/** Track a command executed during the session. */
export function trackCommand(nexusDir: string, sessionId: string, command: string): void {
  const sessions = readAllSessions(nexusDir);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  session.commands.push(command);
  overwriteSessions(nexusDir, sessions);
}

/** Record a feedback event in the session. */
export function trackFeedback(
  nexusDir: string,
  sessionId: string,
  action: "accepted" | "rejected" | "deferred",
  pathChoice?: "comfortable" | "challenging"
): void {
  const sessions = readAllSessions(nexusDir);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  session.feedbackGiven++;
  if (action === "accepted") session.recommendationsAccepted++;
  if (action === "rejected") session.recommendationsRejected++;
  if (pathChoice === "comfortable") session.pathChoices.comfortable++;
  if (pathChoice === "challenging") session.pathChoices.challenging++;

  overwriteSessions(nexusDir, sessions);
}

/** End a session and calculate duration. */
export function endSession(nexusDir: string, sessionId: string): SessionRecord | null {
  const sessions = readAllSessions(nexusDir);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const endedAt = new Date();
  session.endedAt = endedAt.toISOString();

  const startedAt = new Date(session.startedAt);
  session.duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  overwriteSessions(nexusDir, sessions);
  logger.debug("SessionTracker", `Session ended: ${session.id} (${session.duration}min)`);
  return session;
}

/** Get all sessions, optionally filtered. */
export function getSessions(
  nexusDir: string,
  options?: { since?: string; limit?: number }
): SessionRecord[] {
  let sessions = readAllSessions(nexusDir);

  if (options?.since) {
    const sinceDate = new Date(options.since);
    sessions = sessions.filter((s) => new Date(s.startedAt) >= sinceDate);
  }

  if (options?.limit) {
    sessions = sessions.slice(-options.limit);
  }

  return sessions;
}

/** Get aggregated session metrics. */
export function getSessionMetrics(nexusDir: string, days?: number): SessionMetrics {
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const sessions = getSessions(nexusDir, { since });

  const commandFrequency: Record<string, number> = {};
  let totalCommands = 0;
  let totalFeedback = 0;
  let totalAccepts = 0;
  let totalRejects = 0;
  let totalComfortable = 0;
  let totalChallenging = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const session of sessions) {
    for (const cmd of session.commands) {
      commandFrequency[cmd] = (commandFrequency[cmd] || 0) + 1;
      totalCommands++;
    }
    totalFeedback += session.feedbackGiven;
    totalAccepts += session.recommendationsAccepted;
    totalRejects += session.recommendationsRejected;
    totalComfortable += session.pathChoices.comfortable;
    totalChallenging += session.pathChoices.challenging;
    if (session.duration) {
      totalDuration += session.duration;
      durationCount++;
    }
  }

  const totalPathChoices = totalComfortable + totalChallenging;

  return {
    totalSessions: sessions.length,
    avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    totalCommands,
    commandFrequency,
    avgFeedbackPerSession: sessions.length > 0 ? Math.round(totalFeedback / sessions.length * 10) / 10 : 0,
    totalAccepts,
    totalRejects,
    challengingRatio: totalPathChoices > 0 ? totalChallenging / totalPathChoices : 0.5,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

function readAllSessions(nexusDir: string): SessionRecord[] {
  const sessionsPath = getSessionsPath(nexusDir);
  if (!existsSync(sessionsPath)) return [];

  try {
    const content = readFileSync(sessionsPath, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function appendSession(nexusDir: string, session: SessionRecord): void {
  const sessionsPath = getSessionsPath(nexusDir);
  appendFileSync(sessionsPath, JSON.stringify(session) + "\n", "utf-8");
}

function overwriteSessions(nexusDir: string, sessions: SessionRecord[]): void {
  const sessionsPath = getSessionsPath(nexusDir);
  writeFileSync(sessionsPath, sessions.map((s) => JSON.stringify(s)).join("\n") + "\n", "utf-8");
}
