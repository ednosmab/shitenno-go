/**
 * doc-engine.ts — Documentation Engine
 *
 * Generates incremental documentation from Engineering State.
 * Tracks which docs are stale and regenerates only what changed.
 *
 * Architecture: EngineeringState → DocGenerator → Markdown files
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { EngineeringState, EngineeringAsset, AssetType } from "./engineering-state.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type DocType =
  | "system-map"
  | "asset-index"
  | "capability-report"
  | "health-report"
  | "changelog"
  | "architecture-overview";

export interface DocMetadata {
  /** Unique doc ID. */
  id: string;
  /** Doc type. */
  type: DocType;
  /** Output path (relative to nexus-dir). */
  path: string;
  /** ISO timestamp of last generation. */
  generatedAt: string;
  /** Hash of the state used to generate this doc. */
  stateHash: string;
  /** Whether the doc is stale (state changed since generation). */
  stale: boolean;
}

export interface DocGenerationResult {
  /** Docs generated. */
  generated: DocMetadata[];
  /** Docs that were already up-to-date. */
  upToDate: string[];
  /** Docs that failed to generate. */
  failed: Array<{ type: DocType; error: string }>;
}

// ── State Hash ─────────────────────────────────────────────────────────────

function computeStateHash(state: EngineeringState): string {
  const payload = JSON.stringify({
    assets: state.assets.length,
    health: state.healthScores.overall,
    rules: state.activeRules,
    policies: state.activePolicies,
    consolidatedAt: state.consolidatedAt,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

// ── Generators ─────────────────────────────────────────────────────────────

function generateSystemMap(state: EngineeringState): string {
  const lines: string[] = [
    "# System Map",
    "",
    `> Generated: ${new Date().toISOString()}`,
    `> Health Score: ${state.healthScores.overall}/100`,
    "",
    "## Overview",
    "",
    `- **Project:** ${state.project.name}`,
    `- **Root:** ${state.project.root}`,
    `- **Stack:** ${state.project.stack.join(", ") || "Unknown"}`,
    `- **Lifecycle:** ${state.lifecycle}`,
    "",
    "## Assets",
    "",
  ];

  const byType = new Map<AssetType, EngineeringAsset[]>();
  for (const asset of state.assets) {
    const existing = byType.get(asset.type) ?? [];
    existing.push(asset);
    byType.set(asset.type, existing);
  }

  for (const [type, assets] of byType) {
    lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s (${assets.length})`);
    lines.push("");
    for (const asset of assets.slice(0, 10)) {
      lines.push(`- ${asset.name} — ${asset.path}`);
    }
    if (assets.length > 10) {
      lines.push(`- ... and ${assets.length - 10} more`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateAssetIndex(state: EngineeringState): string {
  const lines: string[] = [
    "# Asset Index",
    "",
    `> Generated: ${new Date().toISOString()}`,
    `> Total Assets: ${state.assets.length}`,
    "",
    "| Type | Name | Path | Status |",
    "|------|------|------|--------|",
  ];

  for (const asset of state.assets) {
    lines.push(`| ${asset.type} | ${asset.name} | ${asset.path} | ${asset.status} |`);
  }

  return lines.join("\n");
}

function generateCapabilityReport(state: EngineeringState): string {
  const lines: string[] = [
    "# Capability Report",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## Installed Capabilities",
    "",
  ];

  if (state.capabilities.length === 0) {
    lines.push("_No capabilities installed._");
  } else {
    for (const cap of state.capabilities) {
      lines.push(`- ${cap}`);
    }
  }

  return lines.join("\n");
}

function generateHealthReport(state: EngineeringState): string {
  const lines: string[] = [
    "# Health Report",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## Scores",
    "",
    `- **Overall:** ${state.healthScores.overall}/100`,
    `- **Knowledge Debt:** ${state.healthScores.knowledgeDebt}/100`,
    `- **Knowledge Graph:** ${state.healthScores.knowledgeGraph}/100`,
    "",
    "## Entropy",
    "",
    `- **Orphaned Assets:** ${state.entropy.orphanedAssets}`,
    `- **Stale Assets:** ${state.entropy.staleAssets}`,
    `- **Missing Dependencies:** ${state.entropy.missingDependencies}`,
    `- **Entropy Score:** ${state.entropy.score}`,
    "",
    "## Summary",
    "",
    state.summary,
  ];

  return lines.join("\n");
}

function generateArchitectureOverview(state: EngineeringState): string {
  const lines: string[] = [
    "# Architecture Overview",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## System Architecture",
    "",
    "The Nexus System follows a cognitive cycle architecture:",
    "",
    "```",
    "Observe → Understand → Reason → Decide → Validate → Act → Learn",
    "   ↓          ↓          ↓        ↓         ↓        ↓      ↓",
    "Context   Pattern    Goal    Decision   Policy   Action  Feedback",
    "Pipeline  Detection  Engine  Engine     Engine   Engine  Loop",
    "```",
    "",
    "## Components",
    "",
    `- **Context Pipeline:** Collects and processes project context`,
    `- **Pattern Detection:** Identifies patterns from history and codebase`,
    `- **Goal Engine:** Manages governance goals and targets`,
    `- **Decision Engine:** Evaluates actions using specialized evaluators`,
    `- **Policy Engine:** Enforces declarative governance policies`,
    `- **Action Engine:** Executes actions with idempotency guarantees`,
    `- **Plan Engine:** Coordinates sequences of actions`,
    "- **Feedback Loop:** Learns from session outcomes",
    "",
    "## Metrics",
    "",
    `- **Active Rules:** ${state.activeRules}`,
    `- **Active Policies:** ${state.activePolicies}`,
    `- **Total Assets:** ${state.assets.length}`,
  ];

  return lines.join("\n");
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class DocEngine {
  private docsDir: string;
  private metadata: Map<DocType, DocMetadata> = new Map();

  constructor(nexusDir: string) {
    this.docsDir = join(nexusDir, "docs", "generated");
    if (!existsSync(this.docsDir)) {
      mkdirSync(this.docsDir, { recursive: true });
    }
    this.loadMetadata();
  }

  /** Generate all docs (or only stale ones). */
  generateAll(state: EngineeringState, force = false): DocGenerationResult {
    const stateHash = computeStateHash(state);
    const result: DocGenerationResult = {
      generated: [],
      upToDate: [],
      failed: [],
    };

    const docTypes: DocType[] = [
      "system-map",
      "asset-index",
      "capability-report",
      "health-report",
      "architecture-overview",
    ];

    for (const type of docTypes) {
      const existing = this.metadata.get(type);
      if (!force && existing && existing.stateHash === stateHash && !existing.stale) {
        result.upToDate.push(type);
        continue;
      }

      try {
        const doc = this.generateDoc(type, state, stateHash);
        result.generated.push(doc);
      } catch (error) {
        result.failed.push({
          type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /** Generate a specific doc. */
  generateDoc(type: DocType, state: EngineeringState, stateHash?: string): DocMetadata {
    const hash = stateHash ?? computeStateHash(state);

    let content: string;
    let filename: string;

    switch (type) {
      case "system-map":
        content = generateSystemMap(state);
        filename = "SYSTEM_MAP.md";
        break;
      case "asset-index":
        content = generateAssetIndex(state);
        filename = "ASSET_INDEX.md";
        break;
      case "capability-report":
        content = generateCapabilityReport(state);
        filename = "CAPABILITY_REPORT.md";
        break;
      case "health-report":
        content = generateHealthReport(state);
        filename = "HEALTH_REPORT.md";
        break;
      case "architecture-overview":
        content = generateArchitectureOverview(state);
        filename = "ARCHITECTURE.md";
        break;
      default:
        throw new Error(`Unknown doc type: ${type}`);
    }

    const filepath = join(this.docsDir, filename);
    writeFileSync(filepath, content, "utf-8");

    const metadata: DocMetadata = {
      id: `DOC-${randomUUID().slice(0, 8).toUpperCase()}`,
      type,
      path: `docs/generated/${filename}`,
      generatedAt: new Date().toISOString(),
      stateHash: hash,
      stale: false,
    };

    this.metadata.set(type, metadata);
    this.saveMetadata();

    return metadata;
  }

  /** Check which docs are stale. */
  getStaleDocs(state: EngineeringState): DocType[] {
    const stateHash = computeStateHash(state);
    const stale: DocType[] = [];

    for (const [type, meta] of this.metadata) {
      if (meta.stateHash !== stateHash) {
        stale.push(type);
      }
    }

    return stale;
  }

  /** Get metadata for all docs. */
  getAllMetadata(): DocMetadata[] {
    return Array.from(this.metadata.values());
  }

  private loadMetadata(): void {
    const metaPath = join(this.docsDir, "_metadata.json");
    if (existsSync(metaPath)) {
      try {
        const data = JSON.parse(readFileSync(metaPath, "utf-8")) as DocMetadata[];
        for (const meta of data) {
          this.metadata.set(meta.type, meta);
        }
      } catch {
        // Ignore corrupt metadata
      }
    }
  }

  private saveMetadata(): void {
    const metaPath = join(this.docsDir, "_metadata.json");
    const data = Array.from(this.metadata.values());
    writeFileSync(metaPath, JSON.stringify(data, null, 2), "utf-8");
  }
}
