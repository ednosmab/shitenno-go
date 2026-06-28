/**
 * engineering-state.ts — Engineering State: Single Source of Truth
 *
 * Consolidates all engineering information into a single canonical state.
 * Every module contributes to this state. The state drives recommendations,
 * automations, and evolution.
 *
 * PRINCIPLE: One state to rule them all. Every component feeds into it,
 * every decision reads from it.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyseProject } from "./analyser.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "./knowledge-debt.js";
import {
  detectInstalledCapabilities,
  loadMaturityProfile,
  type Capability,
  type MaturityProfile,
} from "./maturity-profile.js";
import { detectLifecycleState, type NexusLifecycleState } from "./nexus-state-machine.js";
import {
  loadArtifacts,
  loadRelations,
  analyzeGraph,
  type Relation,
} from "./knowledge-graph.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Engineering Asset types — the fundamental units Nexus organizes. */
export type AssetType =
  | "adr"
  | "skill"
  | "policy"
  | "rule"
  | "prompt"
  | "context"
  | "template"
  | "checklist"
  | "decision"
  | "contract"
  | "runbook"
  | "workflow"
  | "script"
  | "plan"
  | "sdr"
  | "doc"
  | "report"
  | "feedback";

/** An Engineering Asset — files are representations of these. */
export interface EngineeringAsset {
  id: string;
  type: AssetType;
  name: string;
  path: string;
  description: string;
  tags: string[];
  status: "active" | "archived" | "draft";
  createdAt: string;
  updatedAt: string;
  /** Maturity dimensions this asset contributes to. */
  contributesTo: string[];
  /** Dependencies on other assets. */
  dependencies: string[];
}

/** The canonical Engineering State. */
export interface EngineeringState {
  /** Timestamp of consolidation. */
  consolidatedAt: string;

  /** Lifecycle state of the Nexus system. */
  lifecycle: NexusLifecycleState;

  /** Project metadata. */
  project: {
    name: string;
    root: string;
    stack: string[];
    hasGit: boolean;
    hasCI: boolean;
    hasTests: boolean;
    hasTypeScript: boolean;
    packageCount: number;
    sourceFileCount: number;
    monorepo: boolean;
  };

  /** Maturity profile. */
  maturity: MaturityProfile | null;

  /** Installed capabilities. */
  capabilities: Capability[];

  /** Knowledge debt status. */
  knowledgeDebt: {
    totalGaps: number;
    healthScore: number;
    detectedAt: string;
  } | null;

  /** Knowledge graph status. */
  knowledgeGraph: {
    totalArtifacts: number;
    totalRelations: number;
    healthScore: number;
  } | null;

  /** Engineering Assets discovered. */
  assets: EngineeringAsset[];

  /** Asset counts by type. */
  assetsByType: Record<AssetType, number>;

  /** Active rules count. */
  activeRules: number;

  /** Active policies count. */
  activePolicies: number;

  /** Health scores from different subsystems. */
  healthScores: {
    knowledgeDebt: number;
    knowledgeGraph: number;
    overall: number;
  };

  /** Entropy metrics — measures organizational decay. */
  entropy: {
    orphanedAssets: number;
    staleAssets: number;
    missingDependencies: number;
    score: number;
  };

  /** Summary for display. */
  summary: string;
}

// ── Asset Discovery ────────────────────────────────────────────────────────

/** Discover all Engineering Assets from nexus-system directory. */
export function discoverAssets(nexusDir: string): EngineeringAsset[] {
  const assets: EngineeringAsset[] = [];
  const now = new Date().toISOString();

  // ADRs
  const adrDir = join(nexusDir, "docs", "adrs");
  if (existsSync(adrDir)) {
    const files = readdirSync(adrDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
    );
    for (const file of files) {
      const content = readFileSync(join(adrDir, file), "utf-8");
      const titleMatch = content.match(/^#\s+(.+)/m);
      const statusMatch = content.match(/Estado:\s*(\w+)/i) || content.match(/Status:\s*(\w+)/i);
      assets.push({
        id: `adr-${file.replace(".md", "")}`,
        type: "adr",
        name: titleMatch?.[1] ?? file.replace(".md", "").replace(/-/g, " "),
        path: `docs/adrs/${file}`,
        description: `Architecture Decision Record: ${file}`,
        tags: ["adr", "decision", "architecture"],
        status: statusMatch?.[1]?.toLowerCase() === "deprecated" ? "archived" : "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["architecture", "documentation"],
        dependencies: [],
      });
    }
  }

  // Skills
  const skillsDir = join(nexusDir, "docs", "skills");
  if (existsSync(skillsDir)) {
    const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      assets.push({
        id: `skill-${file.replace(".md", "")}`,
        type: "skill",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/skills/${file}`,
        description: `Engineering skill: ${file}`,
        tags: ["skill", "engineering"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["documentation", "quality"],
        dependencies: [],
      });
    }
  }

  // Contracts (AI agent contracts)
  const contractsDir = join(nexusDir, "governance", "agents");
  if (existsSync(contractsDir)) {
    const files = readdirSync(contractsDir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of files) {
      assets.push({
        id: `contract-${file.replace(/\.(yaml|yml)$/, "")}`,
        type: "contract",
        name: file.replace(/\.(yaml|yml)$/, "").replace(/-/g, " "),
        path: `governance/agents/${file}`,
        description: `AI agent contract: ${file}`,
        tags: ["contract", "agent", "ai"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["ai", "governance"],
        dependencies: [],
      });
    }
  }

  // Policies (from rules directory)
  const rulesDir = join(nexusDir, "governance", "rules");
  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter(
      (f) => f.endsWith(".json") && !f.startsWith("_")
    );
    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
        assets.push({
          id: `policy-${content.id || file.replace(".json", "")}`,
          type: "policy",
          name: content.description || file.replace(".json", ""),
          path: `governance/rules/${file}`,
          description: `Governance rule: ${content.id || file}`,
          tags: ["policy", "rule", "governance"],
          status: content.enabled ? "active" : "draft",
          createdAt: now,
          updatedAt: now,
          contributesTo: ["governance"],
          dependencies: [],
        });
      } catch {
        // skip invalid JSON
      }
    }
  }

  // Workflows
  const workflowPath = join(nexusDir, "governance", "WORKFLOW.md");
  if (existsSync(workflowPath)) {
    assets.push({
      id: "workflow-main",
      type: "workflow",
      name: "Main Workflow",
      path: "governance/WORKFLOW.md",
      description: "Main session workflow",
      tags: ["workflow", "session", "governance"],
      status: "active",
      createdAt: now,
      updatedAt: now,
      contributesTo: ["governance"],
      dependencies: [],
    });
  }

  // Runbooks
  const runbooksDir = join(nexusDir, "docs", "runbooks");
  if (existsSync(runbooksDir)) {
    const files = readdirSync(runbooksDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      assets.push({
        id: `runbook-${file.replace(".md", "")}`,
        type: "runbook",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/runbooks/${file}`,
        description: `Operational runbook: ${file}`,
        tags: ["runbook", "operations"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["operations", "quality"],
        dependencies: [],
      });
    }
  }

  // Plans
  const plansDir = join(nexusDir, "docs", "plans");
  if (existsSync(plansDir)) {
    const files = readdirSync(plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );
    for (const file of files) {
      assets.push({
        id: `plan-${file.replace(".md", "")}`,
        type: "plan",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/plans/${file}`,
        description: `Execution plan: ${file}`,
        tags: ["plan", "execution"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["architecture"],
        dependencies: [],
      });
    }
  }

  // Scripts
  const scriptsDir = join(nexusDir, "scripts");
  if (existsSync(scriptsDir)) {
    const files = readdirSync(scriptsDir).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js")
    );
    for (const file of files) {
      assets.push({
        id: `script-${file.replace(/\.(ts|js)$/, "")}`,
        type: "script",
        name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
        path: `scripts/${file}`,
        description: `Automation script: ${file}`,
        tags: ["script", "automation"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["automation"],
        dependencies: [],
      });
    }
  }

  // Governance docs
  const docsDir = join(nexusDir, "docs");
  if (existsSync(docsDir)) {
    const governanceDocNames = [
      "AGENTS.md", "FORBIDDEN_OPERATIONS.md", "DESDO.md",
      "CONCEPTUAL_MODEL.md", "KNOWLEDGE_LIFECYCLE.md", "BACKLOG.md",
    ];
    const files = readdirSync(docsDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("README")
    );
    for (const file of files) {
      const isGovernanceDoc = governanceDocNames.includes(file);
      assets.push({
        id: `doc-${file.replace(".md", "")}`,
        type: "doc",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/${file}`,
        description: `Documentation: ${file}`,
        tags: ["doc", "documentation", ...(isGovernanceDoc ? ["governance"] : [])],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: isGovernanceDoc ? ["governance", "documentation"] : ["documentation"],
        dependencies: [],
      });
    }
  }

  // Templates
  const templatesDir = join(nexusDir, "templates");
  if (existsSync(templatesDir)) {
    const files = readdirSync(templatesDir).filter(
      (f) => f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of files) {
      assets.push({
        id: `template-${file.replace(/\.(md|yaml|yml)$/, "")}`,
        type: "template",
        name: file.replace(/\.(md|yaml|yml)$/, "").replace(/_/g, " "),
        path: `templates/${file}`,
        description: `Template: ${file}`,
        tags: ["template"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["documentation"],
        dependencies: [],
      });
    }
  }

  // Reports
  const reportsDir = join(nexusDir, "reports");
  if (existsSync(reportsDir)) {
    const files = readdirSync(reportsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      assets.push({
        id: `report-${file.replace(".json", "")}`,
        type: "report",
        name: file.replace(".json", "").replace(/-/g, " "),
        path: `reports/${file}`,
        description: `Report: ${file}`,
        tags: ["report", "metrics"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["observability"],
        dependencies: [],
      });
    }
  }

  // Context (session state)
  const contextBuffer = join(nexusDir, "governance", "context", "context_buffer.yaml");
  if (existsSync(contextBuffer)) {
    assets.push({
      id: "context-session",
      type: "context",
      name: "Session Context Buffer",
      path: "governance/context/context_buffer.yaml",
      description: "Current session context state",
      tags: ["context", "session", "state"],
      status: "active",
      createdAt: now,
      updatedAt: now,
      contributesTo: ["governance"],
      dependencies: [],
    });
  }

  // Prompts
  const cognitionDir = join(nexusDir, "cognition", "prompts");
  if (existsSync(cognitionDir)) {
    const subDirs = readdirSync(cognitionDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const subDir of subDirs) {
      const promptDir = join(cognitionDir, subDir.name);
      const promptFiles = readdirSync(promptDir).filter((f) => f.endsWith(".md"));
      for (const file of promptFiles) {
        assets.push({
          id: `prompt-${subDir.name}-${file.replace(".md", "")}`,
          type: "prompt",
          name: `${subDir.name} prompt: ${file.replace(".md", "")}`,
          path: `cognition/prompts/${subDir.name}/${file}`,
          description: `AI prompt: ${subDir.name}/${file}`,
          tags: ["prompt", "ai", subDir.name],
          status: "active",
          createdAt: now,
          updatedAt: now,
          contributesTo: ["ai"],
          dependencies: [],
        });
      }
    }
  }

  return assets;
}

// ── Entropy Calculation ────────────────────────────────────────────────────

/** Calculate organizational entropy metrics. */
function calculateEntropy(
  assets: EngineeringAsset[],
  relations: Relation[]
): { orphanedAssets: number; staleAssets: number; missingDependencies: number; score: number } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Find orphaned assets (no relations in or out)
  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.source);
    connectedIds.add(r.target);
  }
  const orphanedAssets = assets.filter((a) => !connectedIds.has(a.id) && a.type !== "report" && a.type !== "doc").length;

  // Find stale assets (not updated in 30+ days)
  const staleAssets = assets.filter((a) => {
    const updated = new Date(a.updatedAt);
    return updated < thirtyDaysAgo && a.status === "active";
  }).length;

  // Find missing dependencies (assets referencing non-existent targets)
  const assetIds = new Set(assets.map((a) => a.id));
  const missingDependencies = assets.filter((a) =>
    a.dependencies.some((dep) => !assetIds.has(dep))
  ).length;

  // Entropy score: 0 = perfect order, 100 = maximum entropy
  const totalAssets = assets.length || 1;
  const orphanRatio = orphanedAssets / totalAssets;
  const staleRatio = staleAssets / totalAssets;
  const depRatio = missingDependencies / totalAssets;

  const score = Math.round(
    (orphanRatio * 40 + staleRatio * 30 + depRatio * 30) * 100
  );

  return {
    orphanedAssets,
    staleAssets,
    missingDependencies,
    score: Math.min(100, score),
  };
}

// ── Health Score Calculation ────────────────────────────────────────────────

function calculateOverallHealth(
  knowledgeDebtScore: number,
  knowledgeGraphScore: number,
  entropyScore: number
): number {
  // Weighted average: knowledge debt 40%, graph 30%, entropy 30%
  const entropyInverse = 100 - entropyScore; // Lower entropy = better health
  return Math.round(
    knowledgeDebtScore * 0.4 +
    knowledgeGraphScore * 0.3 +
    entropyInverse * 0.3
  );
}

// ── Main Consolidation ─────────────────────────────────────────────────────

/** Consolidate all engineering information into a single canonical state. */
export function consolidateEngineeringState(
  projectRoot: string,
  nexusDir: string
): EngineeringState {
  const projectAnalysis = analyseProject(projectRoot);
  const lifecycle = detectLifecycleState(projectRoot, nexusDir);
  const maturityProfile = loadMaturityProfile(nexusDir);
  const installedCapabilities = detectInstalledCapabilities(nexusDir);
  const assets = discoverAssets(nexusDir);

  // Knowledge graph
  const artifacts = loadArtifacts(nexusDir);
  const relations = loadRelations(nexusDir);
  const graphAnalysis = artifacts.length > 0
    ? analyzeGraph(artifacts, relations)
    : null;

  // Knowledge debt
  let debtReport: KnowledgeDebtReport | null = null;
  try {
    debtReport = detectKnowledgeDebt(projectRoot, nexusDir);
  } catch {
    // skip
  }

  // Entropy
  const entropy = calculateEntropy(assets, relations);

  // Asset counts
  const assetsByType = {} as Record<AssetType, number>;
  for (const asset of assets) {
    assetsByType[asset.type] = (assetsByType[asset.type] || 0) + 1;
  }

  // Count active rules and policies
  const rulesDir = join(nexusDir, "governance", "rules");
  let activeRules = 0;
  if (existsSync(rulesDir)) {
    const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
    for (const file of ruleFiles) {
      try {
        const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
        if (content.enabled) activeRules++;
      } catch {
        // skip
      }
    }
  }

  const activePolicies = assets.filter((a) => a.type === "policy" && a.status === "active").length;

  // Health scores
  const knowledgeDebtScore = debtReport?.healthScore ?? 100;
  const knowledgeGraphScore = graphAnalysis?.healthScore ?? 100;
  const overall = calculateOverallHealth(knowledgeDebtScore, knowledgeGraphScore, entropy.score);

  // Build summary
  const parts: string[] = [];
  parts.push(`${assets.length} assets.`);
  parts.push(`${installedCapabilities.length} capabilities.`);
  parts.push(`Health: ${overall}/100.`);
  if (entropy.orphanedAssets > 0) parts.push(`${entropy.orphanedAssets} orphaned.`);
  if (debtReport && debtReport.totalGaps > 0) parts.push(`${debtReport.totalGaps} knowledge gaps.`);
  parts.push(`Lifecycle: ${lifecycle}.`);

  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle,
    project: {
      name: projectRoot.split("/").pop() || "",
      root: projectRoot,
      stack: projectAnalysis.stack,
      hasGit: projectAnalysis.hasGit,
      hasCI: projectAnalysis.hasCI,
      hasTests: projectAnalysis.hasTests,
      hasTypeScript: projectAnalysis.hasTypeScript,
      packageCount: projectAnalysis.packageCount,
      sourceFileCount: projectAnalysis.sourceFileCount,
      monorepo: projectAnalysis.monorepo,
    },
    maturity: maturityProfile,
    capabilities: installedCapabilities,
    knowledgeDebt: debtReport ? {
      totalGaps: debtReport.totalGaps,
      healthScore: debtReport.healthScore,
      detectedAt: debtReport.generatedAt,
    } : null,
    knowledgeGraph: graphAnalysis ? {
      totalArtifacts: graphAnalysis.totalArtifacts,
      totalRelations: graphAnalysis.totalRelations,
      healthScore: graphAnalysis.healthScore,
    } : null,
    assets,
    assetsByType,
    activeRules,
    activePolicies,
    healthScores: {
      knowledgeDebt: knowledgeDebtScore,
      knowledgeGraph: knowledgeGraphScore,
      overall,
    },
    entropy,
    summary: parts.join(" "),
  };
}

// ── Persistence ────────────────────────────────────────────────────────────

/** Save engineering state to disk. */
export function saveEngineeringState(
  nexusDir: string,
  state: EngineeringState
): void {
  const filePath = join(nexusDir, "engineering-state.json");
  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

/** Load engineering state from disk. */
export function loadEngineeringState(
  nexusDir: string
): EngineeringState | null {
  const filePath = join(nexusDir, "engineering-state.json");
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as EngineeringState;
  } catch {
    return null;
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

/** Generate human-readable report from engineering state. */
export function engineeringStateToText(state: EngineeringState): string {
  const lines: string[] = [];

  lines.push("# Engineering State Report");
  lines.push(`Consolidated: ${state.consolidatedAt}`);
  lines.push(`Lifecycle: ${state.lifecycle}`);
  lines.push("");

  // Project
  lines.push("## Project");
  lines.push(`  Name: ${state.project.name}`);
  lines.push(`  Stack: ${state.project.stack.join(", ") || "none detected"}`);
  lines.push(`  Files: ${state.project.sourceFileCount}`);
  lines.push(`  Packages: ${state.project.packageCount}`);
  lines.push("");

  // Health
  lines.push("## Health");
  lines.push(`  Overall: ${state.healthScores.overall}/100`);
  lines.push(`  Knowledge Debt: ${state.healthScores.knowledgeDebt}/100`);
  lines.push(`  Knowledge Graph: ${state.healthScores.knowledgeGraph}/100`);
  lines.push("");

  // Maturity
  if (state.maturity) {
    lines.push("## Maturity");
    lines.push(`  Overall: ${state.maturity.overallScore}/100`);
    for (const [key, value] of Object.entries(state.maturity.dimensions)) {
      lines.push(`  ${key}: ${value}/100`);
    }
    lines.push("");
  }

  // Capabilities
  lines.push("## Capabilities");
  lines.push(`  Installed: ${state.capabilities.join(", ")}`);
  lines.push(`  Active Rules: ${state.activeRules}`);
  lines.push(`  Active Policies: ${state.activePolicies}`);
  lines.push("");

  // Assets
  lines.push("## Engineering Assets");
  lines.push(`  Total: ${state.assets.length}`);
  for (const [type, count] of Object.entries(state.assetsByType)) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push("");

  // Entropy
  lines.push("## Entropy");
  lines.push(`  Score: ${state.entropy.score}/100`);
  lines.push(`  Orphaned Assets: ${state.entropy.orphanedAssets}`);
  lines.push(`  Stale Assets: ${state.entropy.staleAssets}`);
  lines.push(`  Missing Dependencies: ${state.entropy.missingDependencies}`);
  lines.push("");

  return lines.join("\n");
}
