/**
 * Decision Core — Generic Action Executor
 *
 * Wraps the remaining action types from rule-engine/actions.ts
 * (update_context_buffer, log_event, update_quick_board, trigger_assessment,
 *  trigger_health_check, update_backlog, update_backlog_status, archive_plan,
 *  auto_populate_next_p0) into the ActionExecutor interface.
 *
 * The actual logic lives in rule-engine/actions.ts — this is a thin adapter
 * that preserves the existing implementation while routing through invoke.ts.
 */

import { executeAction } from "../../rule-engine/actions.js";
import type { RuleAction, RuleContext } from "../../domain/rules/rule.js";
import type { ActionExecutor, ExecutorContext } from "./types.js";

export class GenericRuleActionExecutor implements ActionExecutor {
  name: string;

  constructor(actionType: string) {
    this.name = actionType;
  }

  async execute(params: Record<string, unknown>, context: ExecutorContext): Promise<Record<string, unknown>> {
    const action: RuleAction = {
      type: this.name as RuleAction["type"],
      params: params as RuleAction["params"],
    };

    const ruleContext: RuleContext = {
      trigger: "manual",
      eventData: {},
      projectRoot: context.projectRoot,
      shitenDir: context.shitenDir,
      timestamp: new Date().toISOString(),
    };

    const result = await executeAction(action, ruleContext);
    return { success: result.success, message: result.message };
  }
}
