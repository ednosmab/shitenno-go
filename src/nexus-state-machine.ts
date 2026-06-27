/**
 * nexus-state-machine.ts — Lifecycle State Machine
 *
 * Governs the lifecycle of the Nexus System itself.
 * Tracks states and validates transitions.
 *
 * PRINCIPLE: The system that governs should govern itself.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export type NexusLifecycleState =
  | "uninitialized"
  | "discovered"
  | "assessed"
  | "governed"
  | "evolved";

export interface StateTransition {
  from: NexusLifecycleState;
  to: NexusLifecycleState;
  trigger: string;
  timestamp: string;
}

interface StateMachineFile {
  currentState: NexusLifecycleState;
  history: StateTransition[];
  lastUpdated: string;
}

// ── Valid Transitions ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<NexusLifecycleState, NexusLifecycleState[]> = {
  uninitialized: ["discovered"],
  discovered: ["assessed"],
  assessed: ["governed"],
  governed: ["evolved", "assessed"],
  evolved: ["governed", "assessed"],
};

/** Check if a transition is valid. */
export function isValidTransition(
  from: NexusLifecycleState,
  to: NexusLifecycleState
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── State Detection ──────────────────────────────────────────────────────────

/** Detect the current lifecycle state from filesystem. */
export function detectLifecycleState(
  projectRoot: string,
  nexusDir: string
): NexusLifecycleState {
  // Check: uninitialized
  if (!existsSync(join(projectRoot, "opencode.json"))) {
    return "uninitialized";
  }
  if (!existsSync(nexusDir)) {
    return "uninitialized";
  }

  // Check: discovered (has maturity profile)
  if (!existsSync(join(nexusDir, "maturity-profile.json"))) {
    return "discovered";
  }

  // Check: assessed (has governance workflow)
  if (!existsSync(join(nexusDir, "governance", "WORKFLOW.md"))) {
    return "assessed";
  }

  // Check: evolved (has evolution report)
  const reportsDir = join(nexusDir, "reports");
  if (existsSync(reportsDir)) {
    const evolutionReports = readdirSync(reportsDir).filter(
      (f) => f.startsWith("evolution-") && f.endsWith(".json")
    );
    if (evolutionReports.length > 0) {
      return "evolved";
    }
  }

  return "governed";
}

// ── State Machine ────────────────────────────────────────────────────────────

export interface NexusStateMachine {
  getState(): NexusLifecycleState;
  canTransition(to: NexusLifecycleState): boolean;
  transition(
    to: NexusLifecycleState,
    trigger: string
  ): boolean;
  getHistory(): StateTransition[];
  save(): void;
}

function getStateFilePath(nexusDir: string): string {
  return join(nexusDir, "lifecycle-state.json");
}

/** Create a state machine instance. */
export function createStateMachine(nexusDir: string): NexusStateMachine {
  const stateFilePath = getStateFilePath(nexusDir);

  // Load or detect initial state
  let currentState: NexusLifecycleState = "uninitialized";
  let history: StateTransition[] = [];

  if (existsSync(stateFilePath)) {
    try {
      const file: StateMachineFile = JSON.parse(readFileSync(stateFilePath, "utf-8"));
      currentState = file.currentState;
      history = file.history || [];
    } catch {
      // use defaults
    }
  }

  return {
    getState(): NexusLifecycleState {
      return currentState;
    },

    canTransition(to: NexusLifecycleState): boolean {
      return isValidTransition(currentState, to);
    },

    transition(to: NexusLifecycleState, trigger: string): boolean {
      if (!isValidTransition(currentState, to)) {
        return false;
      }

      const from = currentState;
      currentState = to;

      history.push({
        from,
        to,
        trigger,
        timestamp: new Date().toISOString(),
      });

      // Persist
      this.save();

      return true;
    },

    getHistory(): StateTransition[] {
      return [...history];
    },

    save(): void {
      const dir = join(nexusDir);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const file: StateMachineFile = {
        currentState,
        history,
        lastUpdated: new Date().toISOString(),
      };

      writeFileSync(stateFilePath, JSON.stringify(file, null, 2));
    },
  };
}

// ── Gate Enforcement ─────────────────────────────────────────────────────────

/** Minimum state required for each command. */
const COMMAND_GATES: Record<string, NexusLifecycleState> = {
  init: "uninitialized",
  status: "discovered",
  detect: "discovered",
  audit: "discovered",
  upgrade: "assessed",
  validate: "assessed",
  assess: "discovered",
  doctor: "discovered",
  run: "assessed",
  sync: "governed",
  clean: "governed",
  evolve: "governed",
};

/** Check if a command is allowed in the current state. */
export function canRunCommand(
  command: string,
  currentState: NexusLifecycleState
): boolean {
  const requiredState = COMMAND_GATES[command];
  if (!requiredState) return true; // Unknown commands are allowed

  const stateOrder: NexusLifecycleState[] = [
    "uninitialized",
    "discovered",
    "assessed",
    "governed",
    "evolved",
  ];

  const currentIdx = stateOrder.indexOf(currentState);
  const requiredIdx = stateOrder.indexOf(requiredState);

  // init can only run from uninitialized (exact match)
  if (command === "init") {
    return currentIdx === requiredIdx;
  }

  // Other commands can run from required state or later
  return currentIdx >= requiredIdx;
}
