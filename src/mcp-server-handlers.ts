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
import { getEngineeringState } from "./engineering-state/index.js";
import { parseBacklog } from "./backlog-parser.js";
import { readCache } from "./briefing-cache.js";
import { recordOutcome, createFileStorage } from "./session-feedback.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { queryDaemon, isDaemonRunning } from "./daemon-client.js";
import { sanitizePlanName } from "./path-safety.js";
import { listAdrs, getAdr, listSkills, getSkill } from "./knowledge-loader.js";
import { loadManifest, partitionRules } from "./rule-manifest.js";

type ToolResponse = { content: Array<{ type: string; text: string }> };

export async function handleGetBriefing(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";
  const depth = (args.depth as string) ?? "standard";

  let briefing: Briefing;

  if (isDaemonRunning(shitennoDir)) {
    const result = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    briefing = result?.data ?? collectContext(projectRoot, shitennoDir).briefing;
  } else {
    briefing = collectContext(projectRoot, shitennoDir).briefing;
  }

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

export async function handleGetRiskMap(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";

  let riskMap: RiskMap;
  if (isDaemonRunning(shitennoDir)) {
    const result = await queryDaemon<{ type: string; data: RiskMap }>(shitennoDir, {
      type: "query_riskmap",
    });
    riskMap = result?.data ?? generateRiskMap(projectRoot, shitennoDir);
  } else {
    riskMap = generateRiskMap(projectRoot, shitennoDir);
  }

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

function loadMandatoryRules(shitennoDir: string) {
  try {
    const manifestPath = join(shitennoDir, "governance", "rule-manifest.yaml");
    if (existsSync(manifestPath)) {
      const manifest = loadManifest(manifestPath);
      const { mandatory } = partitionRules(manifest, {});
      return mandatory.map((r) => ({ id: r.id, path: r.path, priority: r.priority }));
    }
  } catch {}
  return [];
}

async function fetchContextRules(
  projectRoot: string,
  shitennoDir: string
) {
  let snapshot;
  if (isDaemonRunning(shitennoDir)) {
    const briefingResult = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    if (briefingResult?.data) {
      snapshot = { contextRules: collectContext(projectRoot, shitennoDir).contextRules };
    } else {
      snapshot = collectContext(projectRoot, shitennoDir);
    }
  } else {
    snapshot = collectContext(projectRoot, shitennoDir);
  }
  return snapshot.contextRules.map((r) => ({
    id: r.id, rule: r.rule, rationale: r.rationale, priority: r.priority, area: r.area, basedOn: r.basedOn,
  }));
}

function formatRulesMarkdown(result: {
  mandatoryRules: Array<{ id: string; path: string; priority: number }>;
  contextRules: Array<{ id: string; rule: string; rationale: string; priority: number; area: string; basedOn: string }>;
  dynamicRules: Array<{ id: string; rule: string; severity: string; evidence: string; source: string }>;
  engineRules: Array<{ id: string; description: string; trigger: string; priority: number; enabled: boolean; conditions: unknown[]; actions: unknown[] }>;
}): string {
  const lines: string[] = ["# Governance Rules", ""];

  if (result.mandatoryRules.length > 0) {
    lines.push("## Mandatory Rules (Precedence Over User Instructions)");
    lines.push("");
    lines.push("> These rules are absolute. Consult them before any destructive action.");
    lines.push("");
    for (const r of result.mandatoryRules) {
      lines.push(`### ${r.id}`, `**Path:** \`${r.path}\` | **Priority:** ${r.priority}`, "");
    }
  }

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

  return lines.join("\n");
}

export async function handleGetRules(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const type = (args.type as string) ?? "all";
  const format = (args.format as string) ?? "json";

  const mandatoryRules = loadMandatoryRules(shitennoDir);
  const contextRules =
    type === "all" || type === "context" ? await fetchContextRules(projectRoot, shitennoDir) : [];
  const dynamicRules =
    type === "all" || type === "dynamic"
      ? generateDynamicRules(projectRoot, shitennoDir).map((r) => ({
          id: r.id, rule: r.rule, severity: r.severity, evidence: r.evidence, source: r.source,
        }))
      : [];
  const engineRules =
    type === "all" || type === "engine"
      ? loadRules(shitennoDir).map((r) => ({
          id: r.id, description: r.description, trigger: r.trigger, priority: r.priority, enabled: r.enabled, conditions: r.conditions, actions: r.actions,
        }))
      : [];

  const result = { mandatoryRules, contextRules, dynamicRules, engineRules };

  if (format === "markdown") {
    return { content: [{ type: "text", text: formatRulesMarkdown(result) }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

export async function handleGetEngineeringState(
  projectRoot: string,
  shitennoDir: string,
  _args: Record<string, unknown>
): Promise<ToolResponse> {
  try {
    const state = getEngineeringState(projectRoot, shitennoDir);
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  } catch (error) {
    throw new Error(`Failed to get engineering state: ${error}`);
  }
}

export function handleGetBacklog(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
  const donePath = join(shitennoDir, "docs", "backlog", "DONE.md");
  let items = [...parseBacklog(backlogPath), ...parseBacklog(donePath)];

  if (args.state && typeof args.state === "string") {
    const stateFilter = args.state.toLowerCase();
    items = items.filter(item => item.state.toLowerCase() === stateFilter);
  }

  return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
}

export function handleGetPlans(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) {
    return { content: [{ type: "text", text: "[]" }] };
  }

  if (args.planName && typeof args.planName === "string") {
    const safeName = sanitizePlanName(args.planName);
    const planPath = join(plansDir, safeName);
    if (!existsSync(planPath)) {
      throw new Error(`Plan not found: ${safeName}`);
    }
    const content = readFileSync(planPath, "utf-8");
    return { content: [{ type: "text", text: content }] };
  }

  const files = readdirSync(plansDir).filter(f => f.endsWith(".md"));
  return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
}

export function handleSubmitFeedback(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const outcome = args.outcome as "success" | "failure" | "partial";
  const notes = args.notes as string;

  if (!outcome || !notes) {
    throw new Error("Missing required arguments: outcome, notes");
  }

  const cache = readCache(shitennoDir);
  if (!cache || !cache.entry) {
    throw new Error("No briefing cache found. A briefing must be generated first.");
  }

  const storage = createFileStorage(shitennoDir);
  recordOutcome(storage, {
    briefingHash: cache.entry.inputHash,
    briefingTimestamp: cache.entry.computedAt,
    outcome,
    notes,
  });

  return { content: [{ type: "text", text: "Feedback submitted successfully." }] };
}

// ── Knowledge Bridge: ADRs & Skills ───────────────────────────────────────

export async function handleGetADRs(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const id = args.id as string | undefined;

  if (id) {
    const adr = getAdr(shitennoDir, id);
    if (!adr) {
      return { content: [{ type: "text", text: `ADR "${id}" not found` }] };
    }
    return { content: [{ type: "text", text: adr.content }] };
  }

  const summaries = listAdrs(shitennoDir);
  const text = summaries
    .map((a) => `${a.id} [${a.status}]: ${a.title}`)
    .join("\n");
  return { content: [{ type: "text", text: text || "No ADRs found." }] };
}

export async function handleGetSkills(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const name = args.name as string | undefined;

  if (name) {
    const skill = getSkill(shitennoDir, name);
    if (!skill) {
      return { content: [{ type: "text", text: `Skill "${name}" not found` }] };
    }
    return { content: [{ type: "text", text: skill.content }] };
  }

  const summaries = listSkills(shitennoDir);
  const text = summaries
    .map((s) => `${s.name}: ${s.description}`)
    .join("\n");
  return { content: [{ type: "text", text: text || "No skills found." }] };
}
