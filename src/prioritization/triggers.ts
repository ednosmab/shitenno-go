/**
 * proactive-engine.ts — Proactive Engine for Shugo
 *
 * Subscribes to multiple event types and triggers
 * recommendations and challenges automatically.
 *
 * PRINCIPLE: Shugo should proactively suggest improvements,
 * not wait for the user to ask.
 */

import { getEventBus } from "../event-bus.js";
import { consolidateEngineeringState, type EngineeringState } from "../engineering-state.js";
import { generateForecast } from "../trend-engine.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";

/**
 * Load historical engineering state snapshots for trend analysis.
 */
function loadHistoricalStates(shitennoDir: string): EngineeringState[] {
  const snapshotsDir = join(shitennoDir, "history", "snapshots");
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
 * Subscribes to multiple event types and triggers
 * recommendations and challenges based on incoming events.
 * Returns an unsubscribe function for cleanup.
 */
export function initializeProactiveEngine(
  projectRoot: string,
  shitennoDir: string
): () => void {
  const bus = getEventBus();
  const unsubscribers: (() => void)[] = [];

  // ── engineering_state.consolidated — trend-aware challenges ─────────────────
  const onStateConsolidated = () => {
    const state = consolidateEngineeringState(projectRoot, shitennoDir);

    const historicalStates = loadHistoricalStates(shitennoDir);
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
      bus.publish("challenge.generated", {
        type: "entropy_reduction",
        severity: state.entropy.score > 50 ? "high" : "medium",
        description: `Entropy score is ${state.entropy.score}/100`,
      });
    }

    if (state.knowledgeDebt && state.knowledgeDebt.totalGaps > 10) {
      bus.publish("challenge.generated", {
        type: "knowledge_gap",
        severity: state.knowledgeDebt.totalGaps > 20 ? "high" : "medium",
        description: `${state.knowledgeDebt.totalGaps} knowledge gaps detected`,
      });
    }

    if (state.capabilityDrift.detectedNotRegistered.length > 0) {
      bus.publish("challenge.generated", {
        type: "capability_stale",
        severity: "medium",
        description: `${state.capabilityDrift.detectedNotRegistered.length} capabilities detected but not registered`,
      });
    }
  };
  unsubscribers.push(bus.subscribe("engineering_state.consolidated", onStateConsolidated));

  // ── knowledge_debt.detected — generate challenge on new debt ────────────────
  const onDebtDetected = (payload: unknown) => {
    const p = payload as { gapCount?: number; healthScore?: number } | undefined;
    const gapCount = p?.gapCount ?? 0;
    if (gapCount > 5) {
      bus.publish("challenge.generated", {
        type: "knowledge_gap",
        severity: gapCount > 15 ? "high" : "medium",
        description: `knowledge_debt.detected: ${gapCount} gaps — consider addressing critical items`,
      });
    }
  };
  unsubscribers.push(bus.subscribe("knowledge_debt.detected", onDebtDetected));

  // ── plan.status_changed — recommend next steps on completion ────────────────
  const onPlanStatusChanged = (payload: unknown) => {
    const p = payload as { planId?: string; newStatus?: string; oldStatus?: string } | undefined;
    if (p?.newStatus === "done" && p?.oldStatus !== "done") {
      logger.info("proactive-engine", `Plan "${p.planId}" completed — recommending next steps`);
      bus.publish("challenge.generated", {
        type: "next_step",
        severity: "low",
        description: `Plan "${p?.planId}" completed. Consider running health audit or starting next P0.`,
      });
    }
  };
  unsubscribers.push(bus.subscribe("plan.status_changed", onPlanStatusChanged));

  // ── capability.installed — recommend skill activation ───────────────────────
  const onCapabilityInstalled = (payload: unknown) => {
    const p = payload as { capabilityId?: string } | undefined;
    if (p?.capabilityId) {
      bus.publish("challenge.generated", {
        type: "capability_stale",
        severity: "low",
        description: `New capability "${p.capabilityId}" installed — verify governance rules are updated`,
      });
    }
  };
  unsubscribers.push(bus.subscribe("capability.installed", onCapabilityInstalled));

  // ── health.checked — alert on low health ────────────────────────────────────
  const onHealthChecked = (payload: unknown) => {
    const p = payload as { score?: number } | undefined;
    if (p?.score !== undefined && p.score < 40) {
      bus.publish("challenge.generated", {
        type: "health_critical",
        severity: "high",
        description: `Health score critically low: ${p.score}/100 — immediate action required`,
      });
    }
  };
  unsubscribers.push(bus.subscribe("health.checked", onHealthChecked));

  // ── maturity.changed — alert on regression ──────────────────────────────────
  const onMaturityChanged = (payload: unknown) => {
    const p = payload as { previousLevel?: string; newLevel?: string } | undefined;
    if (p?.previousLevel && p?.newLevel && p.previousLevel !== p.newLevel) {
      const severity = p.newLevel < p.previousLevel ? "high" : "low";
      bus.publish("challenge.generated", {
        type: "maturity_regression",
        severity,
        description: `Maturity changed: ${p.previousLevel} → ${p.newLevel}`,
      });
    }
  };
  unsubscribers.push(bus.subscribe("maturity.changed", onMaturityChanged));

  logger.info("proactive-engine", `Initialized — ${unsubscribers.length} event subscriptions`);

  return () => {
    for (const unsub of unsubscribers) unsub();
    unsubscribers.length = 0;
  };
}
