/**
 * desktop-notifier.ts — Smart Desktop Notifications for Shugo
 *
 * Subscribes to lifecycle events and sends desktop notifications
 * with intelligent rate limiting:
 *
 * 1. GLOBAL COOLDOWN: 60s between ANY notification (not per-key)
 * 2. RESTRICTED SCOPE: Only task.completed and session.end events
 * 3. IMMEDIATE DISPATCH: No batching — notifications fire instantly
 *
 * PRINCIPLE: Notifications inform, never interrupt.
 */

import { getEventBus } from "./event-bus.js";
import { sendDesktopNotification } from "./notify.js";
import { logger } from "./logger.js";

// ── Configuration ────────────────────────────────────────────────────────

const GLOBAL_COOLDOWN_MS = 60_000;    // 60s between ANY notification
const MIN_SESSION_DURATION_MS = 60_000; // Ignore sessions shorter than 60s
                                         // (shell hooks create ~5-15s sessions on every prompt)

// ── State ────────────────────────────────────────────────────────────────

let lastGlobalNotification = 0;        // Global cooldown tracker
let initialized = false;

// ── Helpers ──────────────────────────────────────────────────────────────

function canNotify(): boolean {
  const now = Date.now();
  return now - lastGlobalNotification >= GLOBAL_COOLDOWN_MS;
}

function getCooldownRemaining(): number {
  const now = Date.now();
  const elapsed = now - lastGlobalNotification;
  return Math.max(0, GLOBAL_COOLDOWN_MS - elapsed);
}

function throttledNotify(key: string, title: string, message: string, bypassCooldown = false): void {
  if (!bypassCooldown && !canNotify()) {
    const remaining = Math.round(getCooldownRemaining() / 1000);
    logger.debug("desktop-notifier", `Throttled: ${key} (${remaining}s remaining)`);
    return;
  }

  lastGlobalNotification = Date.now();
  sendDesktopNotification(title, message);
}

// ── Event Handlers ───────────────────────────────────────────────────────

function handleTaskCompleted(payload: Record<string, unknown>): void {
  const taskId = String(payload.taskId ?? "desconhecida");
  const gatesPassed = payload.gatesPassed ?? payload.gates ?? "?";
  const count = typeof gatesPassed === "number"
    ? gatesPassed
    : Array.isArray(gatesPassed)
      ? gatesPassed.length
      : "?";

  // Task completion is important — send immediately
  throttledNotify(
    `task:${taskId}:${Date.now()}`,
    "✅ Tarefa Concluída",
    `Tarefa ${taskId} finalizada com sucesso (${count} verificações OK)`
  );
}

function handleSessionEnd(payload: Record<string, unknown>): void {
  const outcome = String(payload.outcome ?? "unknown");
  const durationMs = Number(payload.duration ?? 0); // already in ms from cli-middleware

  // Filter out short sessions (shell hooks create ~5-15s sessions on every prompt)
  if (durationMs > 0 && durationMs < MIN_SESSION_DURATION_MS) {
    logger.debug("desktop-notifier", `Ignored short session: ${Math.round(durationMs / 1000)}s (< ${MIN_SESSION_DURATION_MS / 1000}s threshold)`);
    return;
  }

  const mins = Math.floor(durationMs / 60000);
  const secs = Math.round((durationMs % 60000) / 1000);
  const time = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;

  const statusMap: Record<string, string> = {
    success: "✅ Sessão encerrada",
    failed: "❌ Sessão encerrada com falha",
  };
  const title = statusMap[outcome] ?? "⚠️ Sessão encerrada";

  throttledNotify(`session:${outcome}:${Date.now()}`, title, `Duração: ${time}`, true);
}

// ── Initialization ───────────────────────────────────────────────────────

export function initDesktopNotifier(): void {
  if (initialized) return;
  initialized = true;

  const bus = getEventBus();

  // Only subscribe to task completion and session end
  // Plan status changes and validation completed are too noisy
  bus.subscribe("task.completed", handleTaskCompleted);
  bus.subscribe("session.end", handleSessionEnd);

  logger.debug("desktop-notifier", "Initialized — subscribed to task.completed, session.end");
}
