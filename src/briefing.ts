/**
 * briefing.ts — Pre-Session Briefing Generator
 *
 * Generates a concise briefing for AI agents before starting work:
 * - Project identity (fingerprint)
 * - Risk areas (risk map)
 * - Test coverage status
 * - Recent patterns
 * - Context rules
 *
 * PRINCIPLE: AI should understand the project before modifying it.
 */

import type { ProjectFingerprint } from "./project-fingerprint.js";
import type { RiskMap } from "./risk-map.js";
import type { ContextRule } from "./context-rules.js";
import type { DynamicRule } from "./dynamic-rules.js";
import type { MaturityProfile } from "./maturity-profile.js";
import { partitionRules, type RuleManifestEntry, type TaskMetadata } from "./rule-manifest.js";

// ── Types ──────────────────────────────────────────────────────────────────

/** Reminder priority levels. */
export type ReminderPriority = "high" | "medium" | "low";

/** Reminder categories for filtering and display. */
export type ReminderCategory = "bug" | "feature" | "debt" | "security" | "docs" | "infra";

/** A single reminder with metadata. */
export interface Reminder {
  /** The reminder message */
  message: string;
  /** Priority level (high/medium/low) */
  priority: ReminderPriority;
  /** Category for filtering */
  category: ReminderCategory;
  /** When the reminder was created */
  createdAt: string;
}

export interface Briefing {
  /** When the briefing was generated */
  generatedAt: string;
  /** Project identity */
  project: {
    domain: string;
    scale: string;
    stack: string[];
    maturityScore: number;
  };
  /** Risk summary */
  risks: {
    overall: string;
    criticalAreas: string[];
    highAreas: string[];
  };
  /** Test coverage status */
  tests: {
    hasTests: boolean;
    areasWithoutTests: string[];
  };
  /** Recent patterns */
  patterns: {
    recurringErrors: string[];
    hotAreas: string[];
    /** Detected patterns from pattern-detector (recurring errors, reverted decisions, hot areas). */
    detected: Array<{
      type: string;
      description: string;
      occurrences: number;
      affectedArea: string;
      severity: number;
    }>;
  };
  /** Context rules (top 5) */
  contextRules: ContextRule[];
  /** Dynamic rules (top 3) */
  dynamicRules: DynamicRule[];
  /** Recommended next steps */
  recommendations: string[];
  /** Token economy metrics */
  tokenEconomy: {
    /** Estimated tokens saved vs manual discovery */
    estimatedTokensSaved: number;
    /** Whether this briefing was served from cache */
    cacheHit: boolean;
    /** Number of context rules contributing to savings */
    contextRuleCount: number;
    /** Number of dynamic rules contributing to savings */
    dynamicRuleCount: number;
  };
  /** Quick Board — session state summary for agent reminder */
  quickBoard?: {
    /** Current task in progress (from context_buffer.yaml) */
    currentTask: string;
    /** Next P0 priority item */
    nextP0: string;
    /** P1 debts with due dates */
    p1Debts: string;
    /** Impediments */
    impediments: string;
    /** Last session status */
    lastSessionStatus: string;
  };
  /** Active reminders from context_buffer.yaml */
  reminders: Reminder[];
  /** Recent activity from event bus (last 24h) */
  recentActivity?: {
    events: Array<{
      type: string;
      summary: string;
      timestamp: string;
    }>;
    syncCount: number;
    errorCount: number;
  };
  /** Governance knowledge — lightweight summaries of ADRs and skills */
  governanceKnowledge?: {
    adrs: Array<{ id: string; title: string; status: string }>;
    skills: Array<{ name: string; description: string }>;
  };
}

// ── Briefing Generation ────────────────────────────────────────────────────

export function generateBriefing(
  fingerprint: ProjectFingerprint,
  riskMap: RiskMap,
  contextRules: ContextRule[],
  dynamicRules: DynamicRule[],
  maturityProfile?: MaturityProfile,
  quickBoard?: {
    currentTask: string;
    nextP0: string;
    p1Debts: string;
    impediments: string;
    lastSessionStatus: string;
  },
  reminders?: Reminder[]
): Briefing {
  // Extract risk information
  const criticalAreas = riskMap.areas
    .filter((a) => a.riskLevel === "critical")
    .map((a) => a.path);
  const highAreas = riskMap.areas
    .filter((a) => a.riskLevel === "high")
    .map((a) => a.path);

  // Extract test coverage information
  const areasWithoutTests = riskMap.areas
    .flatMap((a) => a.factors)
    .filter((f) => f.type === "no-tests")
    .map((f) => f.description)
    .slice(0, 5);

  // Generate recommendations
  const recommendations: string[] = [];
  if (criticalAreas.length > 0) {
    recommendations.push(`Address critical risk areas: ${criticalAreas.join(", ")}`);
  }
  if (areasWithoutTests.length > 0) {
    recommendations.push(`Improve test coverage in ${areasWithoutTests.length} area(s)`);
  }
  if (maturityProfile?.recommendedCapabilities?.length) {
    recommendations.push(`Consider installing: ${maturityProfile.recommendedCapabilities.slice(0, 3).join(", ")}`);
  }
  if (recommendations.length === 0) {
    recommendations.push("Project looks healthy. Continue current practices.");
  }

  // Token economy estimate:
  // Without shugo, agent reads: package.json (~500) + AGENTS.md (~3k) +
  // risk analysis (~2k) + history (~1k) + rules (~1.5k) = ~8k tokens
  // With shugo: briefing provides all of that in ~500 tokens
  // Rules add targeted context (~100 tokens each) vs agent discovering (~500 each)
  const estimatedTokensSaved = 8000
    + (contextRules.length * 400) // 500 (manual) - 100 (briefing) per rule
    + (dynamicRules.length * 400);

  return {
    generatedAt: new Date().toISOString(),
    project: {
      domain: fingerprint.domain,
      scale: fingerprint.scale,
      stack: fingerprint.stack.slice(0, 5),
      maturityScore: maturityProfile?.overallScore ?? 0,
    },
    risks: {
      overall: riskMap.overallRisk,
      criticalAreas,
      highAreas,
    },
    tests: {
      hasTests: fingerprint.tooling.tests,
      areasWithoutTests,
    },
    patterns: {
      recurringErrors: [],
      hotAreas: riskMap.areas
        .filter((a) => a.factors.some((f) => f.type === "high-churn"))
        .map((a) => a.path),
      detected: [],
    },
    contextRules: contextRules.slice(0, 5),
    dynamicRules: dynamicRules.slice(0, 3),
    recommendations,
    tokenEconomy: {
      estimatedTokensSaved,
      cacheHit: false,
      contextRuleCount: contextRules.length,
      dynamicRuleCount: dynamicRules.length,
    },
    quickBoard: quickBoard ?? {
      currentTask: "Nenhuma",
      nextP0: "Definir novo P0 no BACKLOG.md",
      p1Debts: "Nenhuma",
      impediments: "Nenhum",
      lastSessionStatus: "Desconhecido",
    },
    reminders: reminders ?? [],
  };
}

// ── Helper Functions ──────────────────────────────────────────────────────

/** Get priority icon for markdown display. */
function getPriorityIcon(priority: ReminderPriority): string {
  switch (priority) {
    case "high": return "🔴 **HIGH**";
    case "medium": return "🟡 **MEDIUM**";
    case "low": return "🟢 **LOW**";
  }
}

/** Get category label for display. */
function getCategoryLabel(category: ReminderCategory): string {
  return `[${category}]`;
}

// ── Output Formats ────────────────────────────────────────────────────────

/**
 * Structured JSON output for tooling consumption.
 * Pure function — easy to test.
 */
export function briefingToJson(briefing: Briefing): Record<string, unknown> {
  return {
    generatedAt: briefing.generatedAt,
    project: briefing.project,
    risks: briefing.risks,
    tests: briefing.tests,
    patterns: briefing.patterns,
    contextRules: briefing.contextRules.map((r) => ({
      id: r.id,
      rule: r.rule,
      priority: r.priority,
      area: r.area,
    })),
    dynamicRules: briefing.dynamicRules.map((r) => ({
      id: r.id,
      rule: r.rule,
      severity: r.severity,
    })),
    recommendations: briefing.recommendations,
  };
}

/**
 * One-line summary for quick consumption.
 * Pure function — easy to test.
 */
export function briefingToSummary(briefing: Briefing): string {
  const parts: string[] = [];
  parts.push(`Domain: ${briefing.project.domain}`);
  parts.push(`Scale: ${briefing.project.scale}`);
  parts.push(`Risk: ${briefing.risks.overall}`);
  if (briefing.risks.criticalAreas.length > 0) {
    parts.push(`Critical: ${briefing.risks.criticalAreas.join(", ")}`);
  }
  if (briefing.tests.areasWithoutTests.length > 0) {
    parts.push(`No-tests: ${briefing.tests.areasWithoutTests.length} area(s)`);
  }
  parts.push(`Recommendations: ${briefing.recommendations.length}`);
  if (briefing.tokenEconomy.estimatedTokensSaved > 0) {
    parts.push(`Tokens saved: ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()}`);
  }
  return parts.join(" | ");
}

/**
 * Generate a human-readable diff between two briefings.
 * Shows what changed between the old and new briefing.
 * Pure function — easy to test.
 */
export function generateDiff(oldBriefing: Briefing, newBriefing: Briefing): string {
  const lines: string[] = [];

  lines.push("# Briefing Diff");
  lines.push("");

  let hasChanges = false;

  // Risk changes
  if (oldBriefing.risks.overall !== newBriefing.risks.overall) {
    lines.push(`- Risk level changed: ${oldBriefing.risks.overall} → ${newBriefing.risks.overall}`);
    hasChanges = true;
  }

  const oldCritical = new Set(oldBriefing.risks.criticalAreas);
  const newCritical = new Set(newBriefing.risks.criticalAreas);
  for (const area of newBriefing.risks.criticalAreas) {
    if (!oldCritical.has(area)) {
      lines.push(`+ New critical area: ${area}`);
      hasChanges = true;
    }
  }
  for (const area of oldBriefing.risks.criticalAreas) {
    if (!newCritical.has(area)) {
      lines.push(`- Removed critical area: ${area}`);
      hasChanges = true;
    }
  }

  // Test coverage changes
  const oldNoTests = new Set(oldBriefing.tests.areasWithoutTests);
  const newNoTests = new Set(newBriefing.tests.areasWithoutTests);
  for (const area of newBriefing.tests.areasWithoutTests) {
    if (!oldNoTests.has(area)) {
      lines.push(`+ New area without tests: ${area}`);
      hasChanges = true;
    }
  }
  for (const area of oldBriefing.tests.areasWithoutTests) {
    if (!newNoTests.has(area)) {
      lines.push(`- Area now has tests: ${area}`);
      hasChanges = true;
    }
  }

  // Rule changes
  const oldRuleIds = new Set(oldBriefing.contextRules.map((r) => r.id));
  for (const rule of newBriefing.contextRules) {
    if (!oldRuleIds.has(rule.id)) {
      lines.push(`+ New rule: [${rule.area}] ${rule.rule}`);
      hasChanges = true;
    }
  }

  // Dynamic rule changes
  const oldDynamicIds = new Set(oldBriefing.dynamicRules.map((r) => r.id));
  for (const rule of newBriefing.dynamicRules) {
    if (!oldDynamicIds.has(rule.id)) {
      lines.push(`+ New dynamic rule: [${rule.severity}] ${rule.rule}`);
      hasChanges = true;
    }
  }

  // Recommendation changes
  const oldRecs = new Set(oldBriefing.recommendations);
  for (const rec of newBriefing.recommendations) {
    if (!oldRecs.has(rec)) {
      lines.push(`+ New recommendation: ${rec}`);
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    lines.push("No changes detected.");
  }

  return lines.join("\n");
}

// ── Manifest Integration ──────────────────────────────────────────────────

export interface ManifestRuleSection {
  mandatory: RuleManifestEntry[];
  contextual: RuleManifestEntry[];
  taskMeta: TaskMetadata;
}

/**
 * Resolve rules from manifest based on task metadata.
 * Returns partitioned rules (mandatory + contextual) for positional injection.
 */
export function resolveManifestRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): ManifestRuleSection {
  const { mandatory, contextual } = partitionRules(manifest, taskMeta);
  return { mandatory, contextual, taskMeta };
}

/**
 * Generate a markdown section for manifest-resolved rules.
 * Mandatory rules always appear first with a precedence warning.
 */
export function manifestRulesToMarkdown(section: ManifestRuleSection): string {
  const lines: string[] = [];

  if (section.mandatory.length > 0) {
    lines.push("## Mandatory Rules (Precedence Over User Instructions)");
    lines.push("");
    lines.push("> These rules are absolute and must be consulted before any destructive action.");
    lines.push("");
    for (const rule of section.mandatory) {
      lines.push(`- **${rule.id}**: "${rule.path}"`);
    }
    lines.push("");
  }

  if (section.contextual.length > 0) {
    lines.push("## Contextual Rules");
    lines.push("");
    for (const rule of section.contextual) {
      const conditionText = rule.when
        ? Object.entries(rule.when).map(([k, v]) => `${k}=${v}`).join(", ")
        : "always";
      lines.push(`- **${rule.id}**: "${rule.path}" (${conditionText})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function briefingToMarkdown(briefing: Briefing): string {
  const lines: string[] = [];

  lines.push("# Pre-Session Briefing");
  lines.push(`*Generated: ${briefing.generatedAt}*`);
  lines.push("");

  // Quick Board — session state summary
  if (briefing.quickBoard) {
    lines.push("---");
    lines.push("");
    lines.push("## QUICK BOARD — Estado do Projecto");
    lines.push("");
    lines.push("> **Apresentar este quadro ao utilizador antes da primeira resposta operacional.**");
    lines.push("> Veja regra #13 em `docs/AGENTS.md` (QUICK BOARD DE AVISO).");
    lines.push("");
    lines.push("| Campo | Estado |");
    lines.push("|---|---|");
    lines.push(`| **Tarefa em curso** | ${briefing.quickBoard.currentTask} |`);
    lines.push(`| **Próximo P0** | ${briefing.quickBoard.nextP0} |`);
    lines.push(`| **Dívidas P1** | ${briefing.quickBoard.p1Debts} |`);
    lines.push(`| **Impedimentos** | ${briefing.quickBoard.impediments} |`);
    lines.push(`| **Estado última sessão** | ${briefing.quickBoard.lastSessionStatus} |`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Recent Activity — last 24h events
  if (briefing.recentActivity && briefing.recentActivity.events.length > 0) {
    lines.push("## Actividade Recente (24h)");
    lines.push("");
    lines.push("| Evento | Detalhe | Hora |");
    lines.push("|--------|---------|------|");

    for (const event of briefing.recentActivity.events) {
      const time = event.timestamp.slice(11, 16);
      lines.push(`| ${event.type} | ${event.summary} | ${time} |`);
    }

    lines.push("");
    lines.push(
      `**Resumo:** ${briefing.recentActivity.syncCount} sincronizações, ${briefing.recentActivity.errorCount} erros`
    );
    lines.push("");
  }

  // Reminders section
  if (briefing.reminders && briefing.reminders.length > 0) {
    lines.push("## Active Reminders");
    lines.push("");

    // Sort reminders by priority: high → medium → low
    const priorityOrder: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };
    const sortedReminders = [...briefing.reminders].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (const reminder of sortedReminders) {
      const priority = getPriorityIcon(reminder.priority);
      const category = getCategoryLabel(reminder.category);
      lines.push(`- ${priority} — ${reminder.message} ${category}`);
    }
    lines.push("");
  }

  // Project identity
  lines.push("## Project Identity");
  lines.push(`- **Domain:** ${briefing.project.domain}`);
  lines.push(`- **Scale:** ${briefing.project.scale}`);
  lines.push(`- **Stack:** ${briefing.project.stack.join(", ")}`);
  lines.push(`- **Maturity:** ${briefing.project.maturityScore}/100`);
  lines.push("");

  // Risks
  lines.push("## Risk Status");
  lines.push(`- **Overall:** ${briefing.risks.overall}`);
  if (briefing.risks.criticalAreas.length > 0) {
    lines.push(`- **Critical:** ${briefing.risks.criticalAreas.join(", ")}`);
  }
  if (briefing.risks.highAreas.length > 0) {
    lines.push(`- **High:** ${briefing.risks.highAreas.join(", ")}`);
  }
  lines.push("");

  // Tests
  lines.push("## Test Coverage");
  lines.push(`- **Has Tests:** ${briefing.tests.hasTests ? "Yes" : "No"}`);
  if (briefing.tests.areasWithoutTests.length > 0) {
    lines.push(`- **Areas Without Tests:** ${briefing.tests.areasWithoutTests.length}`);
  }
  lines.push("");

  // Context rules
  if (briefing.contextRules.length > 0) {
    lines.push("## Context Rules (Top)");
    for (const rule of briefing.contextRules) {
      lines.push(`- ${rule.rule}`);
    }
    lines.push("");
  }

  // Dynamic rules
  if (briefing.dynamicRules.length > 0) {
    lines.push("## Dynamic Rules (From History)");
    for (const rule of briefing.dynamicRules) {
      lines.push(`- [${rule.severity}] ${rule.rule}`);
    }
    lines.push("");
  }

  // Recommendations
  lines.push("## Recommended Next Steps");
  for (const rec of briefing.recommendations) {
    lines.push(`1. ${rec}`);
  }

  // Token economy
  lines.push("");
  lines.push("## Token Economy");
  lines.push(`- **Estimated tokens saved:** ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()}`);
  lines.push(`- **Context rules:** ${briefing.tokenEconomy.contextRuleCount}`);
  lines.push(`- **Dynamic rules:** ${briefing.tokenEconomy.dynamicRuleCount}`);
  lines.push(`- **Cache hit:** ${briefing.tokenEconomy.cacheHit ? "Yes" : "No"}`);

  return lines.join("\n");
}
