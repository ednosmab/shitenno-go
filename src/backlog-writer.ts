/**
 * backlog-writer.ts — Auto-backlog Generator
 *
 * Detecta gaps e adiciona automaticamente ao BACKLOG.md do projeto.
 * Usado por `nexus audit --auto-backlog` para documentar issues encontradas.
 *
 * PRINCÍPIO: O sistema que diagnostica também documenta o plano de correção.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { logger } from "./logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type BacklogSeverity = "Critico" | "Alto" | "Medio" | "Baixo";
export type BacklogPriority = "P0" | "P1" | "P2" | "P3";

export interface BacklogItem {
  id: string;
  title: string;
  severity: BacklogSeverity;
  priority: BacklogPriority;
  source: string;
  date: string;
  modules: string[];
  description: string;
  correction: string;
}

export interface BacklogWriteResult {
  itemsAdded: number;
  itemsSkipped: number;
  sectionInserted: boolean;
  backlogPath: string;
}

// ── Severity / Priority Mapping ──────────────────────────────────────────────

/**
 * Map audit severity (1-3) + maturity score to backlog priority.
 */
export function mapSeverityToPriority(
  auditSeverity: number,
  maturityScore?: number
): BacklogPriority {
  if (auditSeverity === 3) return "P0";
  if (auditSeverity === 2) return "P1";
  if (maturityScore !== undefined && maturityScore < 25) return "P0";
  if (maturityScore !== undefined && maturityScore < 50) return "P1";
  if (maturityScore !== undefined && maturityScore < 75) return "P2";
  return "P2";
}

/**
 * Map numeric severity to label.
 */
export function severityLabel(severity: number): BacklogSeverity {
  if (severity === 3) return "Critico";
  if (severity === 2) return "Alto";
  if (severity === 1) return "Medio";
  return "Baixo";
}

// ── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Check if an item with the same title already exists in the backlog.
 */
export function isDuplicate(backlogContent: string, item: BacklogItem): boolean {
  const normalizedTitle = item.title.toLowerCase().trim();
  const lines = backlogContent.split("\n");
  for (const line of lines) {
    if (line.toLowerCase().includes(normalizedTitle)) {
      return true;
    }
  }
  return false;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a single backlog item as markdown.
 */
export function formatBacklogItem(item: BacklogItem): string {
  return `### ${item.id} ${item.title}

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | ${item.severity} |
| **Prioridade** | ${item.priority} |
| **Owner** | unassigned |
| **Data** | ${item.date} |
| **Fonte** | ${item.source} |
| **Modulos** | ${item.modules.join(", ")} |
| **Descricao** | ${item.description} |
| **Correcao** | ${item.correction} |`;
}

/**
 * Format a complete backlog section from items.
 */
export function formatBacklogSection(items: BacklogItem[], date: string): string {
  if (items.length === 0) return "";

  const p0 = items.filter((i) => i.priority === "P0");
  const p1 = items.filter((i) => i.priority === "P1");
  const p2 = items.filter((i) => i.priority === "P2");
  const p3 = items.filter((i) => i.priority === "P3");

  let section = `## Auto-análise ${date}\n\n`;
  section += `> **Gerado por:** nexus audit --auto-backlog\n`;
  section += `> **Data:** ${date}\n`;
  section += `> **Itens:** ${items.length} (${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3)\n`;
  section += `\n`;

  for (const item of items) {
    section += formatBacklogItem(item) + "\n\n";
  }

  return section;
}

// ── File Operations ──────────────────────────────────────────────────────────

/**
 * Find the insertion point in the backlog file.
 * Inserts before "## Métricas de Qualidade" or at the end.
 */
function findInsertionPoint(content: string): number {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && line.startsWith("## Metricas de Qualidade")) {
      return i;
    }
  }
  return lines.length;
}

/**
 * Update the summary table in the backlog with new counts.
 */
function updateSummary(content: string, added: number): string {
  // Find the P0 count line and increment
  const p0Match = content.match(/\| \*\*P0\*\* \(≤ 7d\) \| (\d+) \|/);
  if (p0Match && p0Match[1] !== undefined) {
    const newCount = parseInt(p0Match[1], 10) + added;
    content = content.replace(
      p0Match[0],
      `| **P0** (≤ 7d) | ${newCount} |`
    );
  }

  // Find the total count line and increment
  const totalMatch = content.match(/\| \*\*Total\*\* \| \*\*(\d+)\*\* \|/);
  if (totalMatch && totalMatch[1] !== undefined) {
    const newTotal = parseInt(totalMatch[1], 10) + added;
    content = content.replace(
      totalMatch[0],
      `| **Total** | **${newTotal}** |`
    );
  }

  return content;
}

/**
 * Append a formatted section to the backlog file.
 * Returns a result object with counts.
 */
export function appendBacklogSection(
  backlogPath: string,
  items: BacklogItem[],
  date: string
): BacklogWriteResult {
  const result: BacklogWriteResult = {
    itemsAdded: 0,
    itemsSkipped: 0,
    sectionInserted: false,
    backlogPath,
  };

  if (!existsSync(backlogPath)) {
    logger.debug("backlog-writer", `Backlog file not found: ${backlogPath}`);
    return result;
  }

  let content = readFileSync(backlogPath, "utf-8");

  // Filter duplicates
  const newItems = items.filter((item) => {
    if (isDuplicate(content, item)) {
      result.itemsSkipped++;
      return false;
    }
    return true;
  });

  if (newItems.length === 0) {
    return result;
  }

  // Generate section
  const section = formatBacklogSection(newItems, date);
  if (!section) return result;

  // Insert at the right position
  const lines = content.split("\n");
  const insertAt = findInsertionPoint(content);

  // Add section with separator
  const newLines = ["---\n\n", section, "\n"];
  lines.splice(insertAt, 0, ...newLines);

  content = lines.join("\n");

  // Update summary
  content = updateSummary(content, newItems.length);

  // Write back
  writeFileSync(backlogPath, content, "utf-8");

  result.itemsAdded = newItems.length;
  result.sectionInserted = true;

  return result;
}

// ── Audit Issue → Backlog Item Conversion ────────────────────────────────────

/**
 * Convert a health audit issue to a backlog item.
 */
export function issueToBacklogItem(
  issue: {
    type: string;
    severity: number;
    description: string;
    location: string;
    recommendation: string;
  },
  date: string,
  idPrefix: string,
  index: number
): BacklogItem {
  const id = `${idPrefix}${String(index).padStart(2, "0")}`;
  const priority = mapSeverityToPriority(issue.severity);

  return {
    id,
    title: issue.description.slice(0, 60),
    severity: severityLabel(issue.severity),
    priority,
    source: "nexus audit",
    date,
    modules: [issue.location],
    description: issue.description,
    correction: issue.recommendation,
  };
}

/**
 * Convert a maturity dimension gap to a backlog item.
 */
export function dimensionToBacklogItem(
  dimension: string,
  score: number,
  date: string,
  id: string
): BacklogItem {
  const priority = mapSeverityToPriority(1, score);
  const severity = score < 10 ? "Critico" : score < 25 ? "Alto" : "Medio";

  return {
    id,
    title: `${dimension} ${score}% (abaixo de 25%)`,
    severity,
    priority,
    source: "nexus assess",
    date,
    modules: ["src/"],
    description: `Dimensao ${dimension} do score de maturidade esta em ${score}%.`,
    correction: `Melhorar praticas de ${dimension} no projeto.`,
  };
}
