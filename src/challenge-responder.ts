/**
 * challenge-responder.ts — Interactive Challenge Response
 *
 * Reads pending challenges from daemon state and provides
 * suggested actions. Enables the user to acknowledge, dismiss,
 * or act on challenges via the interactive briefing prompt.
 *
 * Storage: .shitenno/daemon/daemon-state.json (shared with daemon).
 *
 * PRINCIPLE: Close the interaction loop between proactive alerts and user action.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type ChallengeType =
  | "next_step"
  | "plan_completed"
  | "drift_detected"
  | "health_dip"
  | "knowledge_debt"
  | "unknown";

export type ChallengeSeverity = "high" | "medium" | "low";

export interface PendingChallenge {
  /** Unique identifier for the challenge (generated from index). */
  id: string;
  /** The challenge type. */
  type: ChallengeType;
  /** Severity level. */
  severity: ChallengeSeverity;
  /** Human-readable message. */
  message: string;
  /** When the challenge was generated. */
  generatedAt: string;
  /** Suggested actions the user can take. */
  suggestedActions: string[];
}

export interface ChallengeResolution {
  /** The challenge ID that was resolved. */
  challengeId: string;
  /** The action the user chose. */
  action: string;
  /** ISO timestamp of resolution. */
  resolvedAt: string;
}

// ── Storage ────────────────────────────────────────────────────────────────

const DAEMON_STATE_FILE = "daemon-state.json";

function getDaemonStatePath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", DAEMON_STATE_FILE);
}

function readDaemonState(shitennoDir: string): Record<string, unknown> | null {
  const statePath = getDaemonStatePath(shitennoDir);
  if (!existsSync(statePath)) {
    logger.debug("challenge-responder", `Daemon state file not found: ${statePath}`);
    return null;
  }
  try {
    const content = readFileSync(statePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    logger.warn("challenge-responder", `Failed to parse daemon state: ${error}`);
    return null;
  }
}

function writeDaemonState(shitennoDir: string, state: Record<string, unknown>): void {
  const statePath = getDaemonStatePath(shitennoDir);
  const dir = join(shitennoDir, "daemon");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

// ── Action Mapping ─────────────────────────────────────────────────────────

function getSuggestedActions(type: ChallengeType, severity: ChallengeSeverity): string[] {
  const actionsByType: Record<ChallengeType, string[]> = {
    plan_completed: ["Run health audit", "Start next P0", "Dismiss"],
    drift_detected: ["Review changes", "Commit now", "Dismiss"],
    health_dip: ["Run doctor", "Dismiss"],
    knowledge_debt: ["Review debt items", "Create ADR", "Dismiss"],
    next_step: ["View recommendations", "Dismiss"],
    unknown: ["Acknowledge", "Dismiss"],
  };

  const actions = actionsByType[type] ?? actionsByType.unknown;

  if (severity === "high") {
    return ["Take action now", ...actions];
  }

  return actions;
}

function normalizeChallengeType(rawType: string): ChallengeType {
  const validTypes: ChallengeType[] = [
    "next_step", "plan_completed", "drift_detected",
    "health_dip", "knowledge_debt",
  ];
  if (validTypes.includes(rawType as ChallengeType)) {
    return rawType as ChallengeType;
  }
  return "unknown";
}

function normalizeSeverity(raw: string): ChallengeSeverity {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "medium";
}

/**
 * Map action names to executable shell commands.
 * Returns null if the action has no direct command equivalent.
 */
export function getActionCommand(action: string): string | null {
  const commandMap: Record<string, string> = {
    "Run health audit": "shugo audit",
    "Run doctor": "shugo doctor",
    "Start next P0": "shugo backlog list --priority P0",
    "View recommendations": "shugo briefing --profile full",
    "Review changes": "git status",
    "Commit now": "git add -A && git commit",
    "Review debt items": "shugo debt list",
    "Create ADR": "shugo adr create",
    "Take action now": "shugo briefing --profile full",
  };
  return commandMap[action] ?? null;
}

// ── Core Functions ─────────────────────────────────────────────────────────

/**
 * Get all pending (unresolved) challenges from daemon state.
 * Returns empty array if no challenges or state file missing.
 */
export function getPendingChallenges(shitennoDir: string): PendingChallenge[] {
  const state = readDaemonState(shitennoDir);
  if (!state) return [];

  const challenges = state.challenges;
  if (!Array.isArray(challenges)) return [];

  return challenges
    .filter((c: Record<string, unknown>) => {
      if (typeof c !== "object" || c === null) return false;
      // Challenge is pending if it has no resolved field or resolved is false
      return c.resolved !== true;
    })
    .map((c: Record<string, unknown>, index: number) => {
      const type = normalizeChallengeType(String(c.type ?? "unknown"));
      const severity = normalizeSeverity(String(c.severity ?? "medium"));
      const message = String(c.message ?? "");
      const generatedAt = String(c.generatedAt ?? new Date().toISOString());
      const id = `CHL-${generatedAt.slice(0, 10).replace(/-/g, "")}-${index}`;

      return {
        id,
        type,
        severity,
        message,
        generatedAt,
        suggestedActions: getSuggestedActions(type, severity),
      };
    });
}

/**
 * Mark a challenge as resolved and record the user's action.
 *
 * Since challenges don't have stable IDs (no id field in state),
 * we identify by index in the challenges array. The caller should
 * pass the index of the challenge in the pending list.
 */
export function markChallengeResolved(
  shitennoDir: string,
  challengeIndex: number,
  action: string,
): ChallengeResolution | null {
  const state = readDaemonState(shitennoDir);
  if (!state) return null;

  const challenges = state.challenges;
  if (!Array.isArray(challenges) || challengeIndex >= challenges.length) {
    return null;
  }

  // Mark the challenge as resolved
  const challenge = challenges[challengeIndex] as Record<string, unknown>;
  challenge.resolved = true;
  challenge.resolvedAt = new Date().toISOString();
  challenge.resolutionAction = action;

  // Write updated state back
  writeDaemonState(shitennoDir, state);

  // Record in session feedback
  try {
    const feedbackDir = join(shitennoDir, "session-feedback");
    if (!existsSync(feedbackDir)) {
      mkdirSync(feedbackDir, { recursive: true });
    }
    const recordsPath = join(feedbackDir, "records.jsonl");
    const record = {
      id: `SF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      outcome: "success",
      briefingHash: "",
      briefingTimestamp: "",
      notes: `Challenge resolved: ${String(challenge.type ?? "unknown")} → ${action}`,
      modifiedAreas: ["daemon-state"],
      followedRecommendations: true,
    };
    appendFileSync(recordsPath, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Feedback recording is non-critical
  }

  // Publish event
  try {
    const bus = getEventBus();
    bus.publish("challenge.resolved" as never, {
      challengeType: String(challenge.type ?? "unknown"),
      action,
      resolvedAt: new Date().toISOString(),
    });
  } catch {
    // Event publishing is non-critical
  }

  return {
    challengeId: `CHL-${challengeIndex}`,
    action,
    resolvedAt: new Date().toISOString(),
  };
}

function recordUndoFeedback(shitennoDir: string, challengeType: string): void {
  try {
    const feedbackDir = join(shitennoDir, "session-feedback");
    if (!existsSync(feedbackDir)) mkdirSync(feedbackDir, { recursive: true });
    const record = {
      id: `SF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      outcome: "success",
      briefingHash: "",
      briefingTimestamp: "",
      notes: `Challenge resolution undone: ${challengeType}`,
      modifiedAreas: ["daemon-state"],
      followedRecommendations: true,
    };
    appendFileSync(join(feedbackDir, "records.jsonl"), JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Feedback recording is non-critical
  }
}

/**
 * Undo a challenge resolution — mark it as pending again.
 * Returns the challenge if successful, null otherwise.
 */
export function undoChallengeResolution(
  shitennoDir: string,
  challengeIndex: number,
): PendingChallenge | null {
  const state = readDaemonState(shitennoDir);
  if (!state) return null;

  const challenges = state.challenges;
  if (!Array.isArray(challenges) || challengeIndex >= challenges.length) {
    return null;
  }

  const challenge = challenges[challengeIndex] as Record<string, unknown>;
  if (challenge.resolved !== true) {
    return null;
  }

  // Remove resolution fields
  delete challenge.resolved;
  delete challenge.resolvedAt;
  delete challenge.resolutionAction;

  // Write updated state back
  writeDaemonState(shitennoDir, state);

  const challengeType = String(challenge.type ?? "unknown");
  recordUndoFeedback(shitennoDir, challengeType);

  try {
    getEventBus().publish("challenge.resolution_undone" as never, {
      challengeType,
      undoneAt: new Date().toISOString(),
    });
  } catch {
    // Event publishing is non-critical
  }

  // Return the challenge as pending
  const type = normalizeChallengeType(String(challenge.type ?? "unknown"));
  const severity = normalizeSeverity(String(challenge.severity ?? "medium"));
  const message = String(challenge.message ?? "");
  const generatedAt = String(challenge.generatedAt ?? new Date().toISOString());
  const id = `CHL-${generatedAt.slice(0, 10).replace(/-/g, "")}-${challengeIndex}`;

  return {
    id,
    type,
    severity,
    message,
    generatedAt,
    suggestedActions: getSuggestedActions(type, severity),
  };
}
