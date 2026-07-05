/**
 * commands.tsx — Tab 11: Commands
 *
 * Interactive CLI command panel. Users can browse, select,
 * and execute nexus commands directly from the dashboard.
 * Destructive commands require confirmation.
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { CommandCard } from "../components/command-card.js";
import { CommandOutput } from "../components/command-output.js";
import {
  useCommand,
  COMMAND_DEFINITIONS,
  type CommandDefinition,
} from "../hooks/use-command.js";

interface CommandsTabProps {
  projectRoot: string;
}

type ViewMode = "list" | "output" | "confirm";

export function CommandsTab({ projectRoot }: CommandsTabProps): React.ReactElement {
  const {
    currentExecution,
    isRunning,
    history,
    executeCommand,
    clearOutput,
    rerunCommand,
  } = useCommand(projectRoot);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingCommand, setPendingCommand] = useState<CommandDefinition | null>(null);

  const readOnlyCommands = COMMAND_DEFINITIONS.filter((c) => c.category === "read-only");
  const managementCommands = COMMAND_DEFINITIONS.filter((c) => c.category === "management");
  const destructiveCommands = COMMAND_DEFINITIONS.filter((c) => c.category === "destructive");

  const allCommands = [...readOnlyCommands, ...managementCommands, ...destructiveCommands];

  const handleSelect = useCallback(
    (definition: CommandDefinition) => {
      if (isRunning) return;

      if (definition.requiresConfirmation) {
        setPendingCommand(definition);
        setViewMode("confirm");
        return;
      }

      executeCommand(definition);
      setViewMode("output");
    },
    [isRunning, executeCommand]
  );

  const handleConfirm = useCallback(() => {
    if (pendingCommand) {
      executeCommand(pendingCommand);
      setPendingCommand(null);
      setViewMode("output");
    }
  }, [pendingCommand, executeCommand]);

  const handleCancel = useCallback(() => {
    setPendingCommand(null);
    setViewMode("list");
  }, []);

  const handleBack = useCallback(() => {
    clearOutput();
    setViewMode("list");
  }, [clearOutput]);

  const handleRerun = useCallback(() => {
    if (currentExecution) {
      const definition = COMMAND_DEFINITIONS.find(
        (d) => d.label === currentExecution.label
      );
      if (definition) {
        rerunCommand(definition);
      }
    }
  }, [currentExecution, rerunCommand]);

  const navigateUp = useCallback(() => {
    if (viewMode === "list") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
  }, [viewMode]);

  const navigateDown = useCallback(() => {
    if (viewMode === "list") {
      setSelectedIndex((prev) => Math.min(allCommands.length - 1, prev + 1));
    }
  }, [viewMode, allCommands.length]);

  const handleEnter = useCallback(() => {
    if (viewMode === "list") {
      const cmd = allCommands[selectedIndex];
      if (cmd) {
        handleSelect(cmd);
      }
    }
  }, [viewMode, selectedIndex, allCommands, handleSelect]);

  const handleEscape = useCallback(() => {
    if (viewMode === "output") {
      handleBack();
    } else if (viewMode === "confirm") {
      handleCancel();
    }
  }, [viewMode, handleBack, handleCancel]);

  // Wire local keyboard handlers. Multiple useInput hooks coexist in Ink.
  // The global handler in index.tsx still processes q/Ctrl+C and tab switching
  // (left/right arrows) — we only intercept keys relevant to this tab.
  useInput((input, key) => {
    if (viewMode === "list") {
      if (key.upArrow) {
        navigateUp();
      } else if (key.downArrow) {
        navigateDown();
      } else if (key.return) {
        handleEnter();
      }
    } else if (viewMode === "output") {
      if (key.escape) {
        handleEscape();
      }
    } else if (viewMode === "confirm") {
      if (key.escape) {
        handleEscape();
      } else if (input === "y" || input === "Y") {
        handleConfirm();
      }
    }
  });

  // Confirmation view
  if (viewMode === "confirm" && pendingCommand) {
    return (
      <Box flexDirection="column">
        <Box
          borderStyle="double"
          borderColor="red"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color="red">
            ⚠ Destructive Command
          </Text>
          <Box marginTop={1}>
            <Text>You are about to execute:</Text>
          </Box>
          <Box>
            <Text bold color="yellow">
              {pendingCommand.label}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="red">{pendingCommand.description}</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold>Are you sure? (y/n)</Text>
          </Box>
        </Box>
        <Box marginTop={1} gap={2}>
          <Text dimColor>[Y] Confirm</Text>
          <Text dimColor>[ESC] Cancel</Text>
        </Box>
      </Box>
    );
  }

  // Output view
  if (viewMode === "output" && currentExecution) {
    return (
      <CommandOutput
        execution={currentExecution}
        onBack={handleBack}
        onRerun={handleRerun}
      />
    );
  }

  // List view (default)
  let globalIndex = 0;

  return (
    <Box flexDirection="column" gap={1}>
      {/* Read-Only Commands */}
      <Box flexDirection="column">
        <Box marginBottom={0}>
          <Text bold color="cyan">
            Read-Only Commands
          </Text>
        </Box>
        {readOnlyCommands.map((cmd) => {
          const idx = globalIndex++;
          const historyEntry = history.find(
            (h) => h.label === cmd.label && h.status !== "running"
          );
          return (
            <CommandCard
              key={cmd.id}
              definition={cmd}
              status={
                isRunning && currentExecution?.label === cmd.label
                  ? "running"
                  : historyEntry?.status ?? "idle"
              }
              isSelected={viewMode === "list" && selectedIndex === idx}
              onSelect={() => {
                setSelectedIndex(idx);
                handleSelect(cmd);
              }}
              duration={historyEntry?.duration}
            />
          );
        })}
      </Box>

      {/* Management Commands */}
      <Box flexDirection="column">
        <Box marginBottom={0}>
          <Text bold color="cyan">
            Management Commands
          </Text>
        </Box>
        {managementCommands.map((cmd) => {
          const idx = globalIndex++;
          const historyEntry = history.find(
            (h) => h.label === cmd.label && h.status !== "running"
          );
          return (
            <CommandCard
              key={cmd.id}
              definition={cmd}
              status={
                isRunning && currentExecution?.label === cmd.label
                  ? "running"
                  : historyEntry?.status ?? "idle"
              }
              isSelected={viewMode === "list" && selectedIndex === idx}
              onSelect={() => {
                setSelectedIndex(idx);
                handleSelect(cmd);
              }}
              duration={historyEntry?.duration}
            />
          );
        })}
      </Box>

      {/* Destructive Commands */}
      <Box flexDirection="column">
        <Box marginBottom={0}>
          <Text bold color="red">
            Destructive Commands
          </Text>
        </Box>
        {destructiveCommands.map((cmd) => {
          const idx = globalIndex++;
          const historyEntry = history.find(
            (h) => h.label === cmd.label && h.status !== "running"
          );
          return (
            <CommandCard
              key={cmd.id}
              definition={cmd}
              status={
                isRunning && currentExecution?.label === cmd.label
                  ? "running"
                  : historyEntry?.status ?? "idle"
              }
              isSelected={viewMode === "list" && selectedIndex === idx}
              onSelect={() => {
                setSelectedIndex(idx);
                handleSelect(cmd);
              }}
              duration={historyEntry?.duration}
            />
          );
        })}
      </Box>

      {/* Navigation hints */}
      <Box gap={2}>
        <Text dimColor>[↑/↓] Navigate</Text>
        <Text dimColor>[Enter] Run</Text>
        <Text dimColor>[q] Quit</Text>
      </Box>
    </Box>
  );
}
