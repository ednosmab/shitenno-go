/**
 * markdown-plan-engine.ts — Markdown Plan Engine
 *
 * Manages human-authored markdown execution plans.
 * Plans are stored in governance/plans/ with status tracking.
 *
 * Status flow: andamento → parado → done
 * When status = done, plan is moved to done/ subdirectory.
 *
 * Architecture: MarkdownPlan → Frontmatter Parser → File Operations
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type MarkdownPlanStatus = "andamento" | "parado" | "done";

export interface MarkdownPlan {
  /** Plan ID (filename without .md). */
  id: string;
  /** Plan title (from first heading). */
  title: string;
  /** Current status. */
  status: MarkdownPlanStatus;
  /** Absolute file path. */
  filePath: string;
  /** Relative path from project root (e.g. nexus-system/governance/plans/...). */
  relativePath: string;
  /** Whether the plan is in the active directory (not done, not reference). */
  isActive: boolean;
  /** Creation date from frontmatter. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Additional frontmatter fields. */
  metadata: Record<string, string>;
}

export interface CreatePlanInput {
  /** Plan title. */
  title: string;
  /** Optional description. */
  description?: string;
  /** Priority (P0, P1, P2). */
  priority?: string;
  /** Estimated time. */
  estimatedTime?: string;
  /** Owner. */
  owner?: string;
  /** Custom content to append. */
  content?: string;
}

// ── Frontmatter Parser ─────────────────────────────────────────────────────

/**
 * Parse frontmatter from markdown content.
 * Format: **Field:** value (not YAML, per project convention).
 *
 * Looks for **Field:** patterns in the header area (before first `---` separator
 * or first `##` heading). Handles both formats:
 *   1. Frontmatter before `# Title`
 *   2. `**Field:** value` after `# Title` but before `---`
 */
function parseFrontmatter(content: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    // Stop at horizontal rule separator (---)
    if (line.trim() === "---") break;

    // Stop at second-level heading (## Section)
    if (line.startsWith("## ")) break;

    // Match **Field:** value pattern (format: **FieldName:** Value)
    const match = line.match(/^\*\*(.+?:)\*\*\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1].replace(/:$/, "").toLowerCase().replace(/\s+/g, "_");
      const value = match[2].trim();
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Extract title from markdown content (first heading).
 */
function extractTitle(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.slice(2).trim();
    }
  }
  return "Untitled Plan";
}

/**
 * Extract status from frontmatter.
 */
function extractStatus(metadata: Record<string, string>, content: string): MarkdownPlanStatus {
  const statusField = metadata["status"];
  if (statusField) {
    const lower = statusField.toLowerCase();
    if (lower.includes("done") || lower.includes("conclu")) return "done";
    if (lower.includes("parado") || lower.includes("paused") || lower.includes("stopped")) return "parado";
    return "andamento";
  }

  // Fallback: check if all checkboxes are [x] (plan used checklist format)
  const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
  const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;
  if (closedBoxes > 0 && openBoxes === 0) return "done";

  return "andamento";
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class MarkdownPlanEngine {
  private plansDir: string;
  private doneDir: string;
  private referenceDir: string;

  constructor(nexusDir: string) {
    this.plansDir = join(nexusDir, "governance", "plans");
    this.doneDir = join(this.plansDir, "done");
    this.referenceDir = join(this.plansDir, "reference");

    // Ensure directories exist
    if (!existsSync(this.plansDir)) {
      mkdirSync(this.plansDir, { recursive: true });
    }
    if (!existsSync(this.doneDir)) {
      mkdirSync(this.doneDir, { recursive: true });
    }
    if (!existsSync(this.referenceDir)) {
      mkdirSync(this.referenceDir, { recursive: true });
    }
  }

  /**
   * List all active plans (not done, not reference).
   */
  list(): MarkdownPlan[] {
    if (!existsSync(this.plansDir)) return [];

    const files = readdirSync(this.plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE") && f !== "README.md"
    );

    const plans: MarkdownPlan[] = [];
    for (const file of files) {
      const id = file.replace(".md", "");
      const filePath = join(this.plansDir, file);
      const plan = this.parsePlan(id, filePath, `nexus-system/governance/plans/${file}`);
      if (plan && plan.status !== "done") {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * List all plans including done — used by inference engine
   * to detect inconsistencies (status=done but checkboxes open).
   */
  listAll(): MarkdownPlan[] {
    if (!existsSync(this.plansDir)) return [];

    const files = readdirSync(this.plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE") && f !== "README.md"
    );

    const plans: MarkdownPlan[] = [];
    for (const file of files) {
      const id = file.replace(".md", "");
      const filePath = join(this.plansDir, file);
      const plan = this.parsePlan(id, filePath, `nexus-system/governance/plans/${file}`);
      if (plan) {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * List all done plans.
   */
  listDone(): MarkdownPlan[] {
    if (!existsSync(this.doneDir)) return [];

    const files = readdirSync(this.doneDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );

    const plans: MarkdownPlan[] = [];
    for (const file of files) {
      const id = file.replace(".md", "");
      const filePath = join(this.doneDir, file);
      const plan = this.parsePlan(id, filePath, `nexus-system/governance/plans/done/${file}`);
      if (plan) {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * Get a plan by ID.
   * Searches in active, done, and reference directories.
   */
  getById(id: string): MarkdownPlan | null {
    // Search in active plans
    const activePath = join(this.plansDir, `${id}.md`);
    if (existsSync(activePath)) {
      return this.parsePlan(id, activePath, `nexus-system/governance/plans/${id}.md`);
    }

    // Search in done plans
    const donePath = join(this.doneDir, `${id}.md`);
    if (existsSync(donePath)) {
      return this.parsePlan(id, donePath, `nexus-system/governance/plans/done/${id}.md`);
    }

    // Search in reference plans
    const refPath = join(this.referenceDir, `${id}.md`);
    if (existsSync(refPath)) {
      return this.parsePlan(id, refPath, `nexus-system/governance/plans/reference/${id}.md`);
    }

    return null;
  }

  /**
   * Update plan status.
   * If new status is "done", move plan to done/ directory.
   */
  updateStatus(id: string, newStatus: MarkdownPlanStatus): MarkdownPlan {
    const plan = this.getById(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    // Read current content
    let content = readFileSync(plan.filePath, "utf-8");

    // Update status in frontmatter
    const statusRegex = /(\*\*Status:\*\*\s*)(.+)/;
    const statusMatch = content.match(statusRegex);

    if (statusMatch) {
      // Update existing status
      const newStatusDisplay = newStatus === "done" ? "Done" : 
                               newStatus === "parado" ? "Paused" : "In Progress";
      content = content.replace(statusRegex, `$1${newStatusDisplay}`);
    } else {
      // Add status after title
      const lines = content.split("\n");
      const titleIndex = lines.findIndex((l) => l.startsWith("# "));
      if (titleIndex !== -1) {
        lines.splice(titleIndex + 2, 0, "", `**Status:** ${newStatus === "done" ? "Done" : newStatus === "parado" ? "Paused" : "In Progress"}`);
        content = lines.join("\n");
      }
    }

    // Update updated_at if exists
    const updatedAtRegex = /(\*\*Updated_at:\*\*\s*)(.+)/;
    if (content.match(updatedAtRegex)) {
      content = content.replace(updatedAtRegex, `$1${new Date().toISOString()}`);
    }

    // Write updated content
    writeFileSync(plan.filePath, content, "utf-8");

    // If status is done, move to done/ and publish event
    if (newStatus === "done") {
      this.moveToDone(id);

      // Publish plan.archived event for reactive chain
      const bus = getEventBus();
      bus.publish("plan.archived", {
        planId: id,
        title: plan.title,
        path: `nexus-system/governance/plans/done/${id}.md`,
        finalStatus: "done",
      });
    }

    // Return updated plan
    return this.getById(id)!;
  }

  /**
   * Move plan to done/ directory.
   */
  moveToDone(id: string): void {
    const sourcePath = join(this.plansDir, `${id}.md`);
    const destPath = join(this.doneDir, `${id}.md`);

    if (!existsSync(sourcePath)) {
      throw new Error(`Plan file not found: ${sourcePath}`);
    }

    renameSync(sourcePath, destPath);
  }

  /**
   * Check if a plan file has status "done" and archive it if so.
   * Used by file-watcher for reactive archival.
   * Returns true if the plan was archived.
   */
  archiveIfDone(id: string): boolean {
    const plan = this.getById(id);
    if (!plan) return false;
    if (plan.status !== "done") return false;
    // Guard: if plan is already in done/ or source file doesn't exist, skip
    if (!plan.isActive) return false;
    const sourcePath = join(this.plansDir, `${id}.md`);
    if (!existsSync(sourcePath)) return false;

    this.moveToDone(id);

    const bus = getEventBus();
    bus.publish("plan.archived", {
      planId: id,
      title: plan.title,
      path: `nexus-system/governance/plans/done/${id}.md`,
      finalStatus: "done",
    });

    return true;
  }

  /**
   * Create a new plan with template.
   */
  create(input: CreatePlanInput): MarkdownPlan {
    const id = this.generateId(input.title);
    const filePath = join(this.plansDir, `${id}.md`);
    const now = new Date().toISOString();

    const content = this.generateTemplate({
      ...input,
      id,
      createdAt: now,
    });

    writeFileSync(filePath, content, "utf-8");

    return this.parsePlan(id, filePath, `nexus-system/governance/plans/${id}.md`)!;
  }

  /**
   * Generate plan ID from title.
   */
  private generateId(title: string): string {
    const date = new Date().toISOString().split("T")[0];
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    return `${date}-${slug}`;
  }

  /**
   * Generate plan template content.
   */
  private generateTemplate(input: CreatePlanInput & { id: string; createdAt: string }): string {
    const { title, description, priority, estimatedTime, owner, content, createdAt } = input;

    return `# ${title}

**Date:** ${createdAt.split("T")[0]}
**Status:** In Progress
**Priority:** ${priority || "P1"}
**Owner:** ${owner || "AI Agent"}
**Estimated Time:** ${estimatedTime || "TBD"}
**Updated_at:** ${createdAt}

---

## Context

${description || "TBD"}

---

## Steps

### Step 1: TBD

| # | Action | Verification |
|---|--------|--------------|
| 1.1 | TBD | TBD |

---

## Notes

${content || ""}
`;
  }

  /**
   * Normalize plan header: if **Status:** is missing, infer from checkboxes
   * and write it to the file.
   */
  private normalizePlanHeader(filePath: string, content: string): string {
    if (/^\*\*Status:\*\*/m.test(content)) return content;

    const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
    const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;
    const status = (closedBoxes > 0 && openBoxes === 0) ? "Done" : "In Progress";

    const lines = content.split("\n");
    const titleIndex = lines.findIndex((l) => l.startsWith("# "));
    if (titleIndex === -1) return content;

    lines.splice(titleIndex + 1, 0, "", `**Status:** ${status}`);
    const updated = lines.join("\n");

    writeFileSync(filePath, updated, "utf-8");
    return updated;
  }

  /**
   * Parse a plan file into MarkdownPlan object.
   */
  private parsePlan(id: string, filePath: string, relativePath: string): MarkdownPlan | null {
    try {
      const content = readFileSync(filePath, "utf-8");
      const normalized = this.normalizePlanHeader(filePath, content);
      const metadata = parseFrontmatter(normalized);
      const title = extractTitle(normalized);
      const status = extractStatus(metadata, normalized);
      const isActive = !relativePath.includes("/done/") && !relativePath.includes("/reference/");

      return {
        id,
        title,
        status,
        filePath,
        relativePath,
        isActive,
        createdAt: metadata["date"] || metadata["created_at"] || "",
        updatedAt: metadata["updated_at"] || "",
        metadata,
      };
    } catch {
      return null;
    }
  }
}
