/**
 * backlog-state-machine.ts — Backlog State Machine
 *
 * Implements the 8 backlog states from AGENTS.md Rule #16:
 * - planeado → em investigação | em implementação | encerrado
 * - em investigação → em implementação | encerrado
 * - em implementação → em validação | pausado
 * - em validação → concluído | em implementação (rework)
 * - pausado → em investigação | em implementação
 * - adiado → planeado (requires [REVISIT: YYYY-MM-DD])
 * - concluído → (terminal)
 * - encerrado → (terminal)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { updateCurrentTask, addCompletedTask } from "./context-buffer-writer.js";
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

export interface BacklogTransition {
  from: BacklogState;
  to: BacklogState;
  requiresRevisit?: boolean;
}

export interface TransitionResult {
  success: boolean;
  message: string;
  previousState?: BacklogState;
  newState?: BacklogState;
}

export interface BacklogItem {
  id: string;
  title: string;
  state: BacklogState;
  priority: string;
  line: number;
}

// ── Valid Transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<BacklogState, BacklogState[]> = {
  "planeado": ["em investigação", "em implementação", "encerrado"],
  "em investigação": ["em implementação", "encerrado"],
  "em implementação": ["em validação", "pausado"],
  "em validação": ["concluído", "em implementação"],
  "pausado": ["em investigação", "em implementação"],
  "adiado": ["planeado"],
  "concluído": [],
  "encerrado": [],
};

// ── State Normalization ────────────────────────────────────────────────────

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
};

function normalizeState(state: string): BacklogState | null {
  const lower = state.toLowerCase().trim();
  return STATE_ALIASES[lower] || null;
}

// ── BACKLOG.md Parser ──────────────────────────────────────────────────────

/**
 * Parse BACKLOG.md and extract items with their states.
 * Format expected: | ID | Title | Priority | Status | ... |
 */
export function parseBacklog(backlogPath: string): BacklogItem[] {
  if (!existsSync(backlogPath)) return [];

  const content = readFileSync(backlogPath, "utf-8");
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
      priority: priority || "",
      line: i,
    });
  }

  return items;
}

/**
 * Find a backlog item by ID (partial match).
 */
export function findBacklogItem(
  backlogPath: string,
  taskId: string
): BacklogItem | null {
  const items = parseBacklog(backlogPath);
  const lowerTaskId = taskId.toLowerCase();

  return (
    items.find(
      (item) =>
        item.id.toLowerCase().includes(lowerTaskId) ||
        lowerTaskId.includes(item.id.toLowerCase())
    ) || null
  );
}

// ── State Transition ───────────────────────────────────────────────────────

/**
 * Validate if a transition is allowed.
 */
export function isValidTransition(
  from: BacklogState,
  to: BacklogState
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get allowed transitions from a given state.
 */
export function getAllowedTransitions(state: BacklogState): BacklogState[] {
  return VALID_TRANSITIONS[state] || [];
}

interface TransitionInput { taskId: string; fromState: BacklogState; toState: BacklogState; backlogPath: string; item: { state: string; line: number }; }

function validateTransition(input: TransitionInput): TransitionResult | null {
  const { taskId, fromState, toState, backlogPath, item } = input;
  if (!isValidTransition(fromState, toState)) {
    const allowed = getAllowedTransitions(fromState);
    return { success: false, message: `Invalid transition: ${fromState} → ${toState}. Allowed: ${allowed.join(", ") || "(terminal state)"}` };
  }
  if (!item) return { success: false, message: `Task ${taskId} not found in BACKLOG.md` };
  if (item.state !== fromState) return { success: false, message: `Task ${taskId} is in state "${item.state}", expected "${fromState}"` };

  if (fromState === "adiado" && toState === "planeado") {
    const lines = readFileSync(backlogPath, "utf-8").split("\n");
    const line = lines[item.line] || "";
    if (!line.includes("[REVISIT:") && !line.includes("[REVISIT:")) {
      return { success: false, message: `Task ${taskId} is "adiado" — requires [REVISIT: YYYY-MM-DD] date to transition back to "planeado"` };
    }
  }

  return null;
}

function updateBacklogFile(backlogPath: string, itemLine: number, toState: BacklogState): boolean {
  const content = readFileSync(backlogPath, "utf-8");
  const lines = content.split("\n");
  const line = lines[itemLine];
  if (!line) return false;

  const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length >= 4) {
    cells[3] = toState;
    lines[itemLine] = `| ${cells.join(" | ")} |`;
    writeFileSync(backlogPath, lines.join("\n"), "utf-8");
    return true;
  }
  return false;
}

/**
 * Transition a backlog item to a new state.
 */
export function transitionTask(
  shitennoDir: string,
  taskId: string,
  fromState: BacklogState,
  toState: BacklogState
): TransitionResult {
  const backlogPath = join(shitennoDir, "docs", "BACKLOG.md");
  const item = findBacklogItem(backlogPath, taskId);

  if (!item) {
    return { success: false, message: `Task ${taskId} not found in BACKLOG.md` };
  }

  const validationError = validateTransition({ taskId, fromState, toState, backlogPath, item });
  if (validationError) return validationError;

  try {
    if (!updateBacklogFile(backlogPath, item.line, toState)) {
      return { success: false, message: `Could not read line ${item.line} of BACKLOG.md` };
    }

    const bufStatus = toState === "concluído" ? "completed" : "in_progress";
    updateCurrentTask(shitennoDir, { status: bufStatus });
    if (toState === "concluído") {
      addCompletedTask(shitennoDir, { id: taskId, description: "Auto-completed via backlog state machine", completed_at: new Date().toISOString() });
    }

    logger.info("backlog-state-machine", `Transitioned ${taskId}: ${fromState} → ${toState}`);
    return { success: true, message: `Task ${taskId} transitioned: ${fromState} → ${toState}`, previousState: fromState, newState: toState };
  } catch (error) {
    return { success: false, message: `Failed to update BACKLOG.md: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Transition task to "concluído" (convenience function).
 * Finds the shortest path from current state to "concluído".
 */
export function completeTask(
  shitennoDir: string,
  taskId: string
): TransitionResult {
  const backlogPath = join(shitennoDir, "docs", "BACKLOG.md");
  const item = findBacklogItem(backlogPath, taskId);

  if (!item) {
    return {
      success: false,
      message: `Task ${taskId} not found in BACKLOG.md`,
    };
  }

  // If already concluded, return success
  if (item.state === "concluído") {
    return {
      success: true,
      message: `Task ${taskId} is already "concluído"`,
      previousState: item.state,
      newState: item.state,
    };
  }

  // Find shortest path to "concluído"
  const path = findShortestPath(item.state, "concluído");
  if (!path) {
    return {
      success: false,
      message: `No path from "${item.state}" to "concluído"`,
    };
  }

  // Execute each transition in the path
  let currentState: BacklogState = item.state;
  let lastResult: TransitionResult = { success: true, message: "Initial state" };

  for (const nextState of path) {
    lastResult = transitionTask(shitennoDir, taskId, currentState, nextState);
    if (!lastResult.success) {
      return lastResult;
    }
    currentState = nextState;
  }

  return lastResult;
}

/**
 * Find shortest path between two states using BFS.
 */
function findShortestPath(
  from: BacklogState,
  to: BacklogState
): BacklogState[] | null {
  if (from === to) return [];

  const queue: Array<{ state: BacklogState; path: BacklogState[] }> = [
    { state: from, path: [] },
  ];
  const visited = new Set<BacklogState>();

  while (queue.length > 0) {
    const { state, path } = queue.shift()!;
    if (visited.has(state)) continue;
    visited.add(state);

    const transitions = VALID_TRANSITIONS[state] || [];
    for (const next of transitions) {
      const newPath = [...path, next];
      if (next === to) return newPath;
      if (!visited.has(next)) {
        queue.push({ state: next, path: newPath });
      }
    }
  }

  return null;
}
