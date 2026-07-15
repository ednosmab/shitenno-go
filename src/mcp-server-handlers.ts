import { collectContext } from "./context-collector.js";
import { generateRiskMap, type RiskMap } from "./risk-map.js";
import {
  briefingToJson,
  briefingToSummary,
  briefingToMarkdown,
  type Briefing,
} from "./briefing.js";
import { loadRules } from "./rule-engine.js";
import { generateDynamicRules } from "./dynamic-rules.js";
import { getEngineeringState } from "./engineering-state-access.js";
import { parseBacklog } from "./backlog-parser.js";
import { readCache } from "./briefing-cache.js";
import { recordOutcome, createFileStorage } from "./session-feedback.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type ToolResponse = { content: Array<{ type: string; text: string }> };

export function handleGetBriefing(
  projectRoot: string,
  nexusDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "json";
  const depth = (args.depth as string) ?? "standard";

  const snapshot = collectContext(projectRoot, nexusDir);
  const briefing: Briefing = snapshot.briefing;

  if (format === "markdown") {
    return { content: [{ type: "text", text: briefingToMarkdown(briefing) }] };
  }

  if (format === "summary") {
    return { content: [{ type: "text", text: briefingToSummary(briefing) }] };
  }

  const json = briefingToJson(briefing);

  if (depth === "minimal") {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          project: briefing.project,
          risks: briefing.risks,
          recommendations: briefing.recommendations.slice(0, 1),
        }, null, 2),
      }],
    };
  }

  if (depth === "full") {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ...json,
          quickBoard: briefing.quickBoard,
          tokenEconomy: briefing.tokenEconomy,
        }, null, 2),
      }],
    };
  }

  return { content: [{ type: "text", text: JSON.stringify(json, null, 2) }] };
}

export function handleGetRiskMap(
  projectRoot: string,
  nexusDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "json";
  const riskMap: RiskMap = generateRiskMap(projectRoot, nexusDir);

  if (format === "summary") {
    const lines: string[] = [
      `Overall Risk: ${riskMap.overallRisk} (${riskMap.overallScore}/100)`,
      `Areas analysed: ${riskMap.areas.length}`,
      "",
    ];

    const critical = riskMap.areas.filter(
      (a) => a.riskLevel === "critical" || a.riskLevel === "high"
    );
    if (critical.length > 0) {
      lines.push("High/Critical areas:");
      for (const area of critical) {
        lines.push(`  - ${area.path}: ${area.riskLevel} (${area.score}/100, ${area.fileCount} files)`);
        for (const factor of area.factors.slice(0, 3)) {
          lines.push(`    • ${factor.description}`);
        }
      }
    } else {
      lines.push("All areas within acceptable risk levels.");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(riskMap, null, 2) }] };
}

export function handleGetRules(
  projectRoot: string,
  nexusDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const type = (args.type as string) ?? "all";
  const format = (args.format as string) ?? "json";

  const result: {
    contextRules: Array<{ id: string; rule: string; rationale: string; priority: number; area: string; basedOn: string }>;
    dynamicRules: Array<{ id: string; rule: string; severity: string; evidence: string; source: string }>;
    engineRules: Array<{ id: string; description: string; trigger: string; priority: number; enabled: boolean; conditions: unknown[]; actions: unknown[] }>;
  } = { contextRules: [], dynamicRules: [], engineRules: [] };

  if (type === "all" || type === "context") {
    const snapshot = collectContext(projectRoot, nexusDir);
    result.contextRules = snapshot.contextRules.map((r) => ({
      id: r.id, rule: r.rule, rationale: r.rationale, priority: r.priority, area: r.area, basedOn: r.basedOn,
    }));
  }

  if (type === "all" || type === "dynamic") {
    const dynamicRules = generateDynamicRules(projectRoot, nexusDir);
    result.dynamicRules = dynamicRules.map((r) => ({
      id: r.id, rule: r.rule, severity: r.severity, evidence: r.evidence, source: r.source,
    }));
  }

  if (type === "all" || type === "engine") {
    const engineRules = loadRules(nexusDir);
    result.engineRules = engineRules.map((r) => ({
      id: r.id, description: r.description, trigger: r.trigger, priority: r.priority, enabled: r.enabled, conditions: r.conditions, actions: r.actions,
    }));
  }

  if (format === "markdown") {
    const lines: string[] = ["# Governance Rules", ""];

    if (result.contextRules.length > 0) {
      lines.push("## Context-Aware Rules", "");
      for (const r of result.contextRules) {
        lines.push(`### ${r.id}`, `**Rule:** ${r.rule}`, `**Rationale:** ${r.rationale}`, `**Area:** \`${r.area}\` | **Priority:** ${r.priority}`, "");
      }
    }

    if (result.dynamicRules.length > 0) {
      lines.push("## Dynamic Rules (from History)", "");
      for (const r of result.dynamicRules) {
        const icon = r.severity === "critical" ? "🚨" : r.severity === "high" ? "⚠️" : "ℹ️";
        lines.push(`### ${icon} ${r.id}`, `**Rule:** ${r.rule}`, `**Evidence:** ${r.evidence}`, `**Source:** ${r.source} | **Severity:** ${r.severity}`, "");
      }
    }

    if (result.engineRules.length > 0) {
      lines.push("## Engine Rules (Declarative)", "");
      for (const r of result.engineRules) {
        const status = r.enabled ? "✅" : "❌";
        lines.push(`### ${status} ${r.id}`, `**Description:** ${r.description}`, `**Trigger:** ${r.trigger} | **Priority:** ${r.priority}`, "");
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

export function handleGetEngineeringState(
  projectRoot: string,
  nexusDir: string,
  _args: Record<string, unknown>
): ToolResponse {
  try {
    const state = getEngineeringState(projectRoot, nexusDir);
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  } catch (error) {
    throw new Error(`Failed to get engineering state: ${error}`);
  }
}

export function handleGetBacklog(
  _projectRoot: string,
  nexusDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const backlogPath = join(nexusDir, "docs", "BACKLOG.md");
  let items = parseBacklog(backlogPath);

  if (args.state && typeof args.state === "string") {
    const stateFilter = args.state.toLowerCase();
    items = items.filter(item => item.state.toLowerCase() === stateFilter);
  }

  return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
}

export function handleGetPlans(
  _projectRoot: string,
  nexusDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const plansDir = join(nexusDir, "governance", "plans");
  if (!existsSync(plansDir)) {
    return { content: [{ type: "text", text: "[]" }] };
  }

  if (args.planName && typeof args.planName === "string") {
    const planPath = join(plansDir, args.planName);
    if (!existsSync(planPath)) {
      throw new Error(`Plan not found: ${args.planName}`);
    }
    const content = readFileSync(planPath, "utf-8");
    return { content: [{ type: "text", text: content }] };
  }

  const files = readdirSync(plansDir).filter(f => f.endsWith(".md"));
  return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
}

export function handleSubmitFeedback(
  _projectRoot: string,
  nexusDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const outcome = args.outcome as "success" | "failure" | "partial";
  const notes = args.notes as string;

  if (!outcome || !notes) {
    throw new Error("Missing required arguments: outcome, notes");
  }

  const cache = readCache(nexusDir);
  if (!cache || !cache.entry) {
    throw new Error("No briefing cache found. A briefing must be generated first.");
  }

  const storage = createFileStorage(nexusDir);
  recordOutcome(storage, {
    briefingHash: cache.entry.inputHash,
    briefingTimestamp: cache.entry.computedAt,
    outcome,
    notes,
  });

  return { content: [{ type: "text", text: "Feedback submitted successfully." }] };
}
