/**
 * Decision Core — barrel export.
 *
 * Single import point for the unified execution core.
 */

export { invokeAction, type InvokeActionParams, type InvokeResult } from "./invoke.js";
export { ACTION_TIER, isTier3, isTier1, type ActionTier } from "./tiers.js";
export { checkPrecedence, type InvokeMode, type PrecedenceResult } from "./precedence.js";
export { checkPolicyGate, type PolicyGateResult } from "./policy-gate.js";
