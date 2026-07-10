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
import { consolidateEngineeringState, type EngineeringState } from "./engineering-state.js";
import { generateForecast } from "./trend-engine.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Load historical engineering state snapshots for trend analysis.
 */
function loadHistoricalStates(nexusDir: string): EngineeringState[] {
  const snapshotsDir = join(nexusDir, "history", "snapshots");
  if (!existsSync(snapshotsDir)) return [];

  const files = readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(snapshotsDir, f), "utf-8")) as EngineeringState;
      } catch {
        return null;
      }
    })
    .filter((s): s is EngineeringState => s !== null);
}

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

    // Trend-aware challenge generation
    const historicalStates = loadHistoricalStates(nexusDir);
    const forecast = generateForecast(historicalStates);

    if (forecast) {
      const entropyTrend = forecast.trends.find((t) => t.metric === "entropy");
      const healthTrend = forecast.trends.find((t) => t.metric === "health");

      if (entropyTrend?.direction === "degrading") {
        bus.publish("challenge.generated", {
          type: "entropy_reduction",
          severity: entropyTrend.rate > 2 ? "high" : "medium",
          description: `Entropy is degrading at rate ${entropyTrend.rate.toFixed(1)}/snapshot`,
        });
      }

      if (healthTrend?.direction === "degrading") {
        bus.publish("challenge.generated", {
          type: "knowledge_gap",
          severity: healthTrend.rate > 3 ? "high" : "medium",
          description: `Health score is degrading at rate ${healthTrend.rate.toFixed(1)}/snapshot`,
        });
      }
    } else if (state.entropy.score > 30) {
      // Fallback: static threshold when insufficient history
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
