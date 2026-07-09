/**
 * proactive-engine.ts — Proactive Engine for Nexus
 *
 * Subscribes to `engineering_state.consolidated` events and triggers
 * recommendations and challenges automatically.
 *
 * PRINCIPLE: Nexus should proactively suggest improvements,
 * not wait for the user to ask.
 */

import { getEventBus } from "./event-bus.js";
import { consolidateEngineeringState } from "./engineering-state.js";

/**
 * Initialize the Proactive Engine.
 * Subscribes to `engineering_state.consolidated` and triggers
 * recommendations and challenges based on the current state.
 * Returns an unsubscribe function for cleanup.
 */
export function initializeProactiveEngine(
  projectRoot: string,
  nexusDir: string
): () => void {
  const bus = getEventBus();

  const onStateConsolidated = () => {
    const state = consolidateEngineeringState(projectRoot, nexusDir);

    // Trigger challenges based on entropy
    if (state.entropy.score > 30) {
      bus.publish("challenge.generated", {
        type: "entropy_reduction",
        severity: state.entropy.score > 50 ? "high" : "medium",
        description: `Entropy score is ${state.entropy.score}/100`,
      });
    }

    // Trigger challenges based on knowledge debt
    if (state.knowledgeDebt && state.knowledgeDebt.totalGaps > 10) {
      bus.publish("challenge.generated", {
        type: "knowledge_gap",
        severity: state.knowledgeDebt.totalGaps > 20 ? "high" : "medium",
        description: `${state.knowledgeDebt.totalGaps} knowledge gaps detected`,
      });
    }

    // Trigger challenges based on capability drift
    if (state.capabilityDrift.detectedNotRegistered.length > 0) {
      bus.publish("challenge.generated", {
        type: "capability_stale",
        severity: "medium",
        description: `${state.capabilityDrift.detectedNotRegistered.length} capabilities detected but not registered`,
      });
    }
  };

  const unsubscribe = bus.subscribe("engineering_state.consolidated", onStateConsolidated);
  return unsubscribe;
}
