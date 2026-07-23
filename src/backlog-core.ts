/**
 * backlog-core.ts — Unified Backlog Module
 *
 * Consolidates the 3 separate parsers (backlog-state-machine.ts,
 * backlog-parser.ts, backlog-transitions.ts) and the writer
 * (backlog-writer.ts) into a single cohesive module.
 *
 * Supports both formats:
 *   - Legacy:  docs/BACKLOG.md with | ID | Title | Priority | Status |
 *   - Modular: docs/backlog/ACTIVE.md + DONE.md with ### ID Title + | **Campo** | Valor |
 *
 * PUBLIC API:
 *   - parseBacklogItems(path)       → unified parser for any format
 *   - findItem(items, id)           → find by ID (exact → prefix)
 *   - addItem(path, item)           → add new item to backlog
 *   - transitionItem(path, id, to)  → validate + execute state transition
 *   - deleteItem(path, id)          → remove item
 *   - moveItemToDone(active, done, id) → move completed item
 *   - getBacklogSummary(items)      → statistics for briefing
 *   - getAllowedTransitions(state)   → valid next states
 *   - normalizeState(raw)           → canonical state from any alias
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type BacklogState =
  | "planeado"
  | "em investigação"
  | "em implementação"
  | "em validação"
  | "pausado"
  | "adiado"
  | "concluído"
  | "encerrado";

export type BacklogPriority = "P0" | "P1" | "P2" | "P3" | "";
export type BacklogSeverity = "Critico" | "Alto" | "Medio" | "Baixo" | "";

export interface BacklogItem {
  id: string;
  title: string;
  state: BacklogState;
  priority: BacklogPriority;
  severity: BacklogSeverity;
  owner: string;
  description: string;
  source: string;
  date: string;
  line: number;
  filePath: string;
  format: "modular" | "legacy";
}

export interface TransitionResult {
  success: boolean;
  message: string;
  previousState?: BacklogState;
  newState?: BacklogState;
}

export interface BacklogSummary {
  total: number;
  byState: Record<BacklogState, number>;
  byPriority: Record<string, number>;
  p0Count: number;
  p1Count: number;
  blockers: BacklogItem[];
  inProgress: BacklogItem[];
  recentlyCompleted: BacklogItem[];
}

// ── State Definitions ──────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<BacklogState, BacklogState[]> = {
  "planeado": ["em investigação", "em implementação", "encerrado"],
  "em investigação": ["em implementação", "encerrado"],
  "em implementação": ["em validação", "pausado"],
  "em validação": ["concluído", "em implementação"],
  "pausado": ["em investigação", "em implementação"],
  "adiado": ["planeado"],
  "concluído": [],
  "encerrado": [],
};

const STATE_ALIASES: Record<string, BacklogState> = {
  "planeado": "planeado",
  "planned": "planeado",
  "backlog": "planeado",
  "em investigação": "em investigação",
  "em investigacao": "em investigação",
  "in research": "em investigação",
  "em implementação": "em implementação",
  "em implementacao": "em implementação",
  "in progress": "em implementação",
  "doing": "em implementação",
  "em validação": "em validação",
  "em validacao": "em validação",
  "in review": "em validação",
  "review": "em validação",
  "pausado": "pausado",
  "paused": "pausado",
  "stopped": "pausado",
  "blocked": "pausado",
  "adiado": "adiado",
  "deferred": "adiado",
  "postponed": "adiado",
  "concluído": "concluído",
  "concluido": "concluído",
  "done": "concluído",
  "completed": "concluído",
  "encerrado": "encerrado",
  "closed": "encerrado",
  "cancelled": "encerrado",
  "canceled": "encerrado",
  "obsolet": "encerrado",
};

// ── State Helpers ──────────────────────────────────────────────────────────

export function normalizeState(raw: string): BacklogState | null {
  const lower = raw.toLowerCase().trim();
  return STATE_ALIASES[lower] || null;
}

export function getAllowedTransitions(state: BacklogState): BacklogState[] {
  return VALID_TRANSITIONS[state] || [];
}

export function isValidTransition(from: BacklogState, to: BacklogState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * BFS shortest path from `from` to `to` using VALID_TRANSITIONS.
 * Returns array of states to visit (excluding `from`), or null if unreachable.
 */
export function findShortestPath(
  from: BacklogState,
  to: BacklogState,
): BacklogState[] | null {
  if (from === to) return [];

  const visited = new Set<BacklogState>();
  const queue: { state: BacklogState; path: BacklogState[] }[] = [
    { state: from, path: [] },
  ];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of VALID_TRANSITIONS[current.state] || []) {
      if (visited.has(next)) continue;
      const newPath = [...current.path, next];
      if (next === to) return newPath;
      visited.add(next);
      queue.push({ state: next, path: newPath });
    }
  }
  return null;
}

// ── Default Paths ──────────────────────────────────────────────────────────

const BACKLOG_DIR = "docs/backlog";
const ACTIVE_PATH = join(BACKLOG_DIR, "ACTIVE.md");
const DONE_PATH = join(BACKLOG_DIR, "DONE.md");
const LEGACY_PATH = "docs/BACKLOG.md";

export function resolveBacklogPaths(shitennoDir: string) {
  const modularActive = join(shitennoDir, ACTIVE_PATH);
  const modularDone = join(shitennoDir, DONE_PATH);
  const legacy = join(shitennoDir, LEGACY_PATH);

  if (existsSync(modularActive)) {
    return { active: modularActive, done: modularDone, format: "modular" as const };
  }
  if (existsSync(legacy)) {
    return { active: legacy, done: undefined, format: "legacy" as const };
  }
  return { active: modularActive, done: modularDone, format: "modular" as const };
}

// ── Unified Parser ─────────────────────────────────────────────────────────

export function parseBacklogItems(filePath: string): BacklogItem[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const hasModularHeaders = lines.some((l) => l.startsWith("### "));

  if (hasModularHeaders) {
    return parseModularFormat(content, filePath);
  }
  return parseLegacyFormat(content, filePath);
}

function parseLegacyFormat(content: string, filePath: string): BacklogItem[] {
  const lines = content.split("\n");
  const items: BacklogItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("|")) continue;

    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const [id, title, priority, status] = cells;
    if (!id || id === "ID" || id === "Item") continue;

    const state = normalizeState(status || "");
    if (!state) continue;

    items.push({
      id: id!,
      title: title || "",
      state,
      priority: (priority || "").toUpperCase() as BacklogPriority,
      severity: "",
      owner: "",
      description: "",
      source: "",
      date: "",
      line: i,
      filePath,
      format: "legacy",
    });
  }
  return items;
}

// ── Modular Format Parsing (split for complexity) ──────────────────────────

function createItemFromHeader(
  titleRaw: string,
  currentSection: string,
  i: number,
  filePath: string,
): Partial<BacklogItem> {
  const id = titleRaw.split(" ")[0]!;
  return {
    id,
    title: titleRaw,
    state: "planeado",
    priority: (currentSection || "") as BacklogPriority,
    severity: "",
    owner: "",
    description: "",
    source: "",
    date: "",
    line: i,
    filePath,
    format: "modular" as const,
  };
}

function applyModularField(item: Partial<BacklogItem>, key: string, value: string): void {
  switch (key) {
    case "Status": {
      const normalized = normalizeState(value);
      if (normalized) item.state = normalized;
      break;
    }
    case "Severidade":
      item.severity = value as BacklogSeverity;
      break;
    case "Prioridade":
      item.priority = value.toUpperCase() as BacklogPriority;
      break;
    case "Owner":
      item.owner = value;
      break;
    case "Descricao":
      item.description = value;
      break;
    case "Fonte":
      item.source = value;
      break;
    case "Data":
      item.date = value;
      break;
  }
}

function parseModularFormat(content: string, filePath: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = content.split("\n");
  let currentSection = "";
  let currentItem: Partial<BacklogItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const sectionMatch = line.match(/^## (P[0-9]+)\s/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!;
      continue;
    }

    const itemMatch = line.match(/^### (.+)/);
    if (itemMatch) {
      if (currentItem?.id) items.push(currentItem as BacklogItem);
      currentItem = createItemFromHeader(itemMatch[1]!, currentSection, i, filePath);
      continue;
    }

    if (currentItem && line.startsWith("| **")) {
      const fieldMatch = line.match(/\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|?\s*$/);
      if (fieldMatch?.[1] && fieldMatch?.[2]) {
        const value = fieldMatch[2].trim().replace(/\|$/, "").trim();
        applyModularField(currentItem, fieldMatch[1], value);
      }
    }
  }

  if (currentItem?.id) items.push(currentItem as BacklogItem);
  return items;
}

// ── Find Item ──────────────────────────────────────────────────────────────

export function findItem(items: BacklogItem[], taskId: string): BacklogItem | null {
  const lower = taskId.toLowerCase();
  const exact = items.find((item) => item.id.toLowerCase() === lower);
  if (exact) return exact;
  return items.find((item) => item.id.toLowerCase().startsWith(lower)) || null;
}

// ── Add Item ───────────────────────────────────────────────────────────────

export interface AddItemInput {
  id: string;
  title: string;
  state?: BacklogState;
  priority?: BacklogPriority;
  severity?: BacklogSeverity;
  owner?: string;
  description?: string;
  source?: string;
}

export function addItem(filePath: string, input: AddItemInput): { success: boolean; message: string } {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const state = input.state || "planeado";
  const priority = input.priority || "P2";
  const severity = input.severity || "Medio";
  const date = new Date().toISOString().slice(0, 10);

  const block = [
    "",
    `### ${input.id} ${input.title}`,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| **Status** | ${state} |`,
    `| **Severidade** | ${severity} |`,
    `| **Prioridade** | ${priority} |`,
    `| **Owner** | ${input.owner || "unassigned"} |`,
    `| **Data** | ${date} |`,
    `| **Fonte** | ${input.source || "manual"} |`,
    `| **Descricao** | ${input.description || ""} |`,
    "",
  ].join("\n");

  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
    if (content.includes(`### ${input.id}`)) {
      return { success: false, message: `Item ${input.id} already exists in backlog` };
    }
  } else {
    content = "# BACKLOG — Active Items\n\n";
  }

  content += block;
  writeFileSync(filePath, content, "utf-8");
  logger.info("backlog-core", `Added item ${input.id} to ${filePath}`);
  return { success: true, message: `Added ${input.id}: ${input.title} (${state})` };
}

// ── Delete Item ────────────────────────────────────────────────────────────

export function deleteItem(filePath: string, itemId: string): { success: boolean; message: string } {
  if (!existsSync(filePath)) {
    return { success: false, message: `Backlog file not found: ${filePath}` };
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const range = findItemRange(lines, itemId);

  if (!range) {
    return { success: false, message: `Item ${itemId} not found in backlog` };
  }

  const remaining = [...lines.slice(0, range.start), ...lines.slice(range.end)].join("\n");
  writeFileSync(filePath, remaining, "utf-8");
  logger.info("backlog-core", `Deleted item ${itemId} from ${filePath}`);
  return { success: true, message: `Deleted ${itemId} from backlog` };
}

// ── Item Range Helper ──────────────────────────────────────────────────────

function findItemRange(lines: string[], itemId: string): { start: number; end: number } | null {
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("### ") && line.slice(4).trim().startsWith(itemId)) {
      startIdx = i;
      continue;
    }
    if (startIdx !== -1 && line.startsWith("### ") && i > startIdx) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;
  return { start: startIdx, end: endIdx === -1 ? lines.length : endIdx };
}

// ── Transition Item (split for complexity) ─────────────────────────────────

function validateAdiadoRevisit(
  item: BacklogItem,
  toState: BacklogState,
  filePath: string,
): TransitionResult | null {
  if (item.state !== "adiado" || toState !== "planeado") return null;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const line = lines[item.line] || "";

  if (!line.includes("[REVISIT:")) {
    return {
      success: false,
      message: `Item ${item.id} is "adiado" — requires [REVISIT: YYYY-MM-DD] date to transition back to "planeado"`,
    };
  }
  return null;
}

function updateModularStatus(filePath: string, lineIdx: number, toState: BacklogState, date: string): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const statusLabel = toState === "concluído" ? `Done — ${date}` : toState;
  lines[lineIdx] = `| **Status** | ${statusLabel} |`;
  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

function updateLegacyStatus(filePath: string, line: string | undefined, lineIdx: number, toState: BacklogState): void {
  if (line && line.startsWith("|")) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      cells[3] = toState;
      lines[lineIdx] = `| ${cells.join(" | ")} |`;
      writeFileSync(filePath, lines.join("\n"), "utf-8");
    }
  }
}

export function transitionItem(
  filePath: string,
  itemId: string,
  toState: BacklogState,
  options?: { date?: string }
): TransitionResult {
  if (!existsSync(filePath)) {
    return { success: false, message: `Backlog file not found: ${filePath}` };
  }

  const items = parseBacklogItems(filePath);
  const item = findItem(items, itemId);

  if (!item) {
    return { success: false, message: `Item ${itemId} not found in backlog` };
  }

  const revisitCheck = validateAdiadoRevisit(item, toState, filePath);
  if (revisitCheck) return revisitCheck;

  if (!isValidTransition(item.state, toState)) {
    const allowed = getAllowedTransitions(item.state);
    return {
      success: false,
      message: `Invalid transition: ${item.state} → ${toState}. Allowed: ${allowed.join(", ") || "(terminal state)"}`,
    };
  }

  const date = options?.date ?? new Date().toISOString().slice(0, 10);

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const line = lines[item.line];

    if (item.format === "modular") {
      updateModularStatus(filePath, item.line, toState, date);
    } else {
      updateLegacyStatus(filePath, line, item.line, toState);
    }

    logger.info("backlog-core", `Transitioned ${itemId}: ${item.state} → ${toState}`);
    return {
      success: true,
      message: `Item ${itemId} transitioned: ${item.state} → ${toState}`,
      previousState: item.state,
      newState: toState,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update backlog: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ── Move Item to Done (split for complexity) ───────────────────────────────

function extractDoneRow(block: string, itemId: string): string {
  const titleMatch = block.match(/^### (.+)/m);
  const title = titleMatch ? titleMatch[1]!.trim() : itemId;
  const severityMatch = block.match(/\*\*Severidade\*\*\s*\|\s*([^|]+)/);
  const severity = severityMatch ? severityMatch[1]!.trim() : "—";
  const descMatch = block.match(/\*\*Descricao\*\*\s*\|\s*([^|]+)/);
  const description = descMatch ? descMatch[1]!.trim() : "Concluído";
  return `| ${title} | ${severity} | ${description} |`;
}

function appendToDoneFile(donePath: string, doneRow: string): void {
  const doneDir = dirname(donePath);
  if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });

  let doneContent = existsSync(donePath)
    ? readFileSync(donePath, "utf-8")
    : "## Done\n\n| Item | Severidade | Resolucao |\n|---|---|---|\n";

  const sep = doneContent.endsWith("\n") ? "" : "\n";
  doneContent += sep + doneRow + "\n";
  writeFileSync(donePath, doneContent, "utf-8");
}

export function moveItemToDone(
  activePath: string,
  donePath: string,
  itemId: string
): { success: boolean; message: string } {
  if (!existsSync(activePath)) {
    return { success: false, message: `Active backlog not found: ${activePath}` };
  }

  const content = readFileSync(activePath, "utf-8");
  const lines = content.split("\n");
  const range = findItemRange(lines, itemId);

  if (!range) {
    return { success: false, message: `Item ${itemId} not found in active backlog` };
  }

  const block = lines.slice(range.start, range.end).join("\n").trim();
  const doneRow = extractDoneRow(block, itemId);

  const remaining = [...lines.slice(0, range.start), ...lines.slice(range.end)].join("\n");
  writeFileSync(activePath, remaining + "\n", "utf-8");

  appendToDoneFile(donePath, doneRow);
  logger.info("backlog-core", `Moved ${itemId} from active to done`);
  return { success: true, message: `Moved ${itemId} to done` };
}

// ── Summary ────────────────────────────────────────────────────────────────

export function getBacklogSummary(items: BacklogItem[]): BacklogSummary {
  const byState: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const item of items) {
    byState[item.state] = (byState[item.state] || 0) + 1;
    const p = item.priority || "P?";
    byPriority[p] = (byPriority[p] || 0) + 1;
  }

  return {
    total: items.length,
    byState: byState as Record<BacklogState, number>,
    byPriority,
    p0Count: byPriority["P0"] || 0,
    p1Count: byPriority["P1"] || 0,
    blockers: items.filter((i) => i.state === "pausado"),
    inProgress: items.filter((i) => i.state === "em implementação" || i.state === "em validação"),
    recentlyCompleted: items.filter((i) => i.state === "concluído").slice(0, 5),
  };
}

// ── Formatting Helpers ─────────────────────────────────────────────────────

const STATE_ICONS: Record<BacklogState, string> = {
  "planeado": "📋",
  "em investigação": "🔍",
  "em implementação": "🔨",
  "em validação": "✅",
  "pausado": "⏸️",
  "adiado": "⏳",
  "concluído": "✔️",
  "encerrado": "❌",
};

const PRIORITY_COLORS: Record<string, string> = {
  "P0": "\x1b[31m",
  "P1": "\x1b[33m",
  "P2": "\x1b[36m",
  "P3": "\x1b[37m",
};

const RESET = "\x1b[0m";

export function formatItemCompact(item: BacklogItem): string {
  const icon = STATE_ICONS[item.state] || "•";
  const color = PRIORITY_COLORS[item.priority] || "";
  const priority = item.priority || "P?";
  return `${icon} ${color}${priority}${RESET} ${item.id} — ${item.title}`;
}

export function formatItemsByPriority(items: BacklogItem[]): string {
  if (items.length === 0) return "  Nenhum item encontrado.";

  const groups: Record<string, BacklogItem[]> = {};
  for (const item of items) {
    const p = item.priority || "P?";
    if (!groups[p]) groups[p] = [];
    groups[p]!.push(item);
  }

  const lines: string[] = [];
  for (const p of ["P0", "P1", "P2", "P3"]) {
    const group = groups[p];
    if (group && group.length > 0) {
      lines.push(`\n  ${p} (${group.length} itens):`);
      for (const item of group) {
        lines.push(`    ${formatItemCompact(item)}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatSummaryLine(summary: BacklogSummary): string {
  const parts: string[] = [];
  if (summary.p0Count > 0) parts.push(`🔴 P0: ${summary.p0Count}`);
  if (summary.p1Count > 0) parts.push(`🟡 P1: ${summary.p1Count}`);
  parts.push(`Total: ${summary.total}`);
  if (summary.blockers.length > 0) parts.push(`Blockers: ${summary.blockers.length}`);
  if (summary.inProgress.length > 0) parts.push(`Em progresso: ${summary.inProgress.length}`);
  return parts.join(" │ ");
}
