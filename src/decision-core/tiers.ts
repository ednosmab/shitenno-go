/**
 * Decision Core — Action Tier Classification
 *
 * Classifies every ActionType into a precedence tier:
 *   Tier 1: Read-only / observable (log_event, notify)
 *   Tier 2: Reversible mutations (create_reminder, update_context_buffer, etc.)
 *   Tier 3: Irreversible mutations (remove_file, run_script, apply_autofix)
 *
 * Used by invoke.ts to enforce ADR-008 precedence rules in autonomous mode.
 */

import type { ActionType } from "../domain/rules/rule.js";

export type ActionTier = 1 | 2 | 3;

/**
 * Maps each ActionType to its tier.
 * Tier 3 actions require human confirmation in autonomous mode.
 */
export const ACTION_TIER: Record<ActionType, ActionTier> = {
  log_event: 1,
  send_notification: 1,

  update_context_buffer: 2,
  create_reminder: 2,
  remove_reminder: 2,
  update_quick_board: 2,
  create_adr: 2,
  create_skill: 2,
  update_backlog: 2,
  update_backlog_status: 2,
  auto_populate_next_p0: 2,
  archive_plan: 2,
  trigger_assessment: 2,
  trigger_health_check: 2,

  run_local_script: 3,
  run_script: 3,
  run_shiten_command: 3,
  update_file: 3,
  create_file: 3,
  remove_file: 3,
  apply_autofix: 3,
};

/** Type guard: is this a Tier 3 (irreversible) action? */
export function isTier3(actionType: ActionType): boolean {
  return ACTION_TIER[actionType] === 3;
}

/** Type guard: is this a Tier 1 (read-only) action? */
export function isTier1(actionType: ActionType): boolean {
  return ACTION_TIER[actionType] === 1;
}
