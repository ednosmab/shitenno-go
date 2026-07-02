/**
 * use-command.ts — Command execution hook
 *
 * Executes nexus CLI commands via child_process and manages
 * execution state (idle/running/done/error) with output capture.
 */

import { useState, useCallback } from "react";
import { exec } from "child_process";

export type CommandStatus = "idle" | "running" | "done" | "error";

export interface CommandExecution {
  id: string;
  command: string;
  args: string[];
  label: string;
  description: string;
  status: CommandStatus;
  output: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export interface CommandDefinition {
  id: string;
  command: string;
  args: string[];
  label: string;
  description: string;
  estimatedTime: string;
  category: "read-only" | "management" | "destructive";
  requiresConfirmation?: boolean;
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    id: "status",
    command: "nexus",
    args: ["status", "--json"],
    label: "nexus status",
    description: "Check governance health status",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "validate",
    command: "nexus",
    args: ["validate", "--json"],
    label: "nexus validate",
    description: "Validate session integrity",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "doctor",
    command: "nexus",
    args: ["doctor", "--json"],
    label: "nexus doctor",
    description: "Engineering mentor: risks, improvements, teaching",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "digest",
    command: "nexus",
    args: ["digest", "--json"],
    label: "nexus digest",
    description: "Daily digest of project health and changes",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "briefing",
    command: "nexus",
    args: ["briefing", "--json"],
    label: "nexus briefing",
    description: "Pre-session briefing for AI agents",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "detect",
    command: "nexus",
    args: ["detect", "--json"],
    label: "nexus detect",
    description: "Detect patterns and propose candidate rules",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "audit",
    command: "nexus",
    args: ["audit", "--json"],
    label: "nexus audit",
    description: "Comprehensive health audit with graph analysis",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "evolve",
    command: "nexus",
    args: ["evolve", "--json"],
    label: "nexus evolve",
    description: "Evolution recommendations and growth profile",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "dashboard",
    command: "nexus",
    args: ["dashboard", "--json"],
    label: "nexus dashboard",
    description: "Token economy and session metrics",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "report",
    command: "nexus",
    args: ["report", "--json"],
    label: "nexus report",
    description: "User performance report across 7 dimensions",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "feedback-summary",
    command: "nexus",
    args: ["feedback", "--summary", "--json"],
    label: "nexus feedback --summary",
    description: "Feedback statistics and success rate",
    estimatedTime: "<1s",
    category: "read-only",
  },
  {
    id: "goal-list",
    command: "nexus",
    args: ["goal", "list", "--json"],
    label: "nexus goal list",
    description: "List governance goals with status",
    estimatedTime: "<1s",
    category: "management",
  },
  {
    id: "decide-list",
    command: "nexus",
    args: ["decide", "list", "--json"],
    label: "nexus decide list",
    description: "Decision history with scores",
    estimatedTime: "<1s",
    category: "management",
  },
  {
    id: "policy-list",
    command: "nexus",
    args: ["policy", "list", "--json"],
    label: "nexus policy list",
    description: "List governance policies",
    estimatedTime: "<1s",
    category: "management",
  },
  {
    id: "clean",
    command: "nexus",
    args: ["clean", "--json"],
    label: "nexus clean",
    description: "Clear cache and temporary files",
    estimatedTime: "<1s",
    category: "destructive",
    requiresConfirmation: true,
  },
  {
    id: "sync",
    command: "nexus",
    args: ["sync", "--json"],
    label: "nexus sync",
    description: "Sync governance files from nexus-system",
    estimatedTime: "<2s",
    category: "destructive",
    requiresConfirmation: true,
  },
];

let commandCounter = 0;

function generateId(): string {
  commandCounter += 1;
  return `cmd-${commandCounter}-${Date.now()}`;
}

export function useCommand(projectRoot: string) {
  const [executions, setExecutions] = useState<CommandExecution[]>([]);
  const [currentExecution, setCurrentExecution] = useState<CommandExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<CommandExecution[]>([]);

  const executeCommand = useCallback(
    (definition: CommandDefinition) => {
      if (isRunning) return;

      const execution: CommandExecution = {
        id: generateId(),
        command: definition.command,
        args: definition.args,
        label: definition.label,
        description: definition.description,
        status: "running",
        output: "",
        startTime: new Date(),
      };

      setCurrentExecution(execution);
      setIsRunning(true);

      setExecutions((prev) => [...prev, execution]);

      const fullCommand = `${definition.command} ${definition.args.join(" ")}`;

      exec(
        fullCommand,
        {
          cwd: projectRoot,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          const endTime = new Date();
          const duration = execution.startTime
            ? (endTime.getTime() - execution.startTime.getTime()) / 1000
            : 0;

          const result: CommandExecution = {
            ...execution,
            status: error ? "error" : "done",
            output: stdout || stderr || "",
            error: error ? error.message : undefined,
            endTime,
            duration,
          };

          setCurrentExecution(result);
          setIsRunning(false);

          setExecutions((prev) =>
            prev.map((e) => (e.id === execution.id ? result : e))
          );

          setHistory((prev) => [...prev, result]);
        }
      );
    },
    [projectRoot, isRunning]
  );

  const clearOutput = useCallback(() => {
    setCurrentExecution(null);
  }, []);

  const rerunCommand = useCallback(
    (definition: CommandDefinition) => {
      executeCommand(definition);
    },
    [executeCommand]
  );

  return {
    executions,
    currentExecution,
    isRunning,
    history,
    executeCommand,
    clearOutput,
    rerunCommand,
  };
}
