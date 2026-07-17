/**
 * Decision Core — Precedence Rules
 *
 * Implements ADR-008 human-over-autonomous precedence:
 *   - Tier 3 actions in autonomous mode require human confirmation
 *   - Tier 2 actions in autonomous mode defer if resource is in active use
 *   - "deliberate" mode (human-initiated) bypasses tier gates
 *
 * Used by invoke.ts as the second gate after policy-gate.
 */

import type { ActionType } from "../domain/rules/rule.js";
import { ACTION_TIER, type ActionTier } from "./tiers.js";
import { getEventBus } from "../event-bus.js";

export type InvokeMode = "autonomous" | "deliberate";

export interface PrecedenceResult {
  allowed: boolean;
  reason?: string;
  tier: ActionTier;
}

/** Resource ID derived from action params (for Tier 2 locking). */
export function getResourceId(actionType: ActionType, params: Record<string, unknown>): string | undefined {
  switch (actionType) {
    case "create_reminder":
    case "remove_reminder":
      return `reminder:${params.message ?? "default"}`;
    case "update_backlog_status":
      return `task:${params.taskId ?? "default"}`;
    case "update_backlog":
      return `task:${params.item ?? "default"}`;
    case "archive_plan":
      return `plan:${params.planId ?? "default"}`;
    case "create_adr":
      return `adr:${params.adrId ?? params.title ?? "default"}`;
    case "create_skill":
      return `skill:${params.skillId ?? params.name ?? "default"}`;
    case "create_file":
    case "update_file":
    case "remove_file":
      return `file:${params.path ?? params.file ?? "default"}`;
    case "auto_populate_next_p0":
      return `backlog:next-p0`;
    default:
      return undefined;
  }
}

/**
 * Checks ADR-008 precedence rules.
 * Returns whether the action is allowed to proceed.
 */
export function checkPrecedence(
  actionType: ActionType,
  mode: InvokeMode,
  opts: {
    ruleAutonomousFlag?: boolean;
    resourceClaimed?: (id: string) => boolean;
    params?: Record<string, unknown>;
  } = {}
): PrecedenceResult {
  const tier = ACTION_TIER[actionType];

  if (mode === "deliberate") {
    return { allowed: true, tier };
  }

  // autonomous mode — enforce ADR-008 precedence
  if (tier === 3 && !opts.ruleAutonomousFlag) {
    getEventBus().publish("challenge.generated", {
      severity: "medium",
      message: `Proposed "${actionType}" — confirm via shiten act`,
      actionType,
      tier,
      timestamp: new Date().toISOString(),
    });
    return {
      allowed: false,
      reason: "Tier 3 action requires human confirmation in autonomous mode",
      tier,
    };
  }

  if (tier === 2 && opts.resourceClaimed) {
    const resourceId = getResourceId(actionType, opts.params ?? {});
    if (resourceId && opts.resourceClaimed(resourceId)) {
      getEventBus().publish("challenge.generated", {
        severity: "low",
        message: `Deferred "${actionType}" — resource in active use`,
        actionType,
        tier,
        resourceId,
        timestamp: new Date().toISOString(),
      });
      return {
        allowed: false,
        reason: "Resource in active use — deferred",
        tier,
      };
    }
  }

  return { allowed: true, tier };
}
