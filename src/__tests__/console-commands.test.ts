/**
 * console-commands.test.ts — Tests for command execution hook and definitions
 */

import { describe, it, expect } from "vitest";
import {
  COMMAND_DEFINITIONS,
  type CommandDefinition,
} from "../console/hooks/use-command.js";

describe("Command Definitions", () => {
  it("should have 16 commands defined", () => {
    expect(COMMAND_DEFINITIONS).toHaveLength(16);
  });

  it("should have all required fields for each command", () => {
    for (const cmd of COMMAND_DEFINITIONS) {
      expect(cmd).toHaveProperty("id");
      expect(cmd).toHaveProperty("command");
      expect(cmd).toHaveProperty("args");
      expect(cmd).toHaveProperty("label");
      expect(cmd).toHaveProperty("description");
      expect(cmd).toHaveProperty("estimatedTime");
      expect(cmd).toHaveProperty("category");
      expect(typeof cmd.id).toBe("string");
      expect(typeof cmd.command).toBe("string");
      expect(Array.isArray(cmd.args)).toBe(true);
      expect(typeof cmd.label).toBe("string");
      expect(typeof cmd.description).toBe("string");
      expect(typeof cmd.estimatedTime).toBe("string");
      expect(["read-only", "management", "destructive"]).toContain(cmd.category);
    }
  });

  it("should have unique IDs for each command", () => {
    const ids = COMMAND_DEFINITIONS.map((cmd) => cmd.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have unique labels for each command", () => {
    const labels = COMMAND_DEFINITIONS.map((cmd) => cmd.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("should have 11 read-only commands", () => {
    const readOnly = COMMAND_DEFINITIONS.filter((cmd) => cmd.category === "read-only");
    expect(readOnly).toHaveLength(11);
  });

  it("should have 3 management commands", () => {
    const management = COMMAND_DEFINITIONS.filter((cmd) => cmd.category === "management");
    expect(management).toHaveLength(3);
  });

  it("should have 2 destructive commands", () => {
    const destructive = COMMAND_DEFINITIONS.filter((cmd) => cmd.category === "destructive");
    expect(destructive).toHaveLength(2);
  });

  it("should mark destructive commands with requiresConfirmation", () => {
    const destructive = COMMAND_DEFINITIONS.filter((cmd) => cmd.category === "destructive");
    for (const cmd of destructive) {
      expect(cmd.requiresConfirmation).toBe(true);
    }
  });

  it("should not mark read-only commands with requiresConfirmation", () => {
    const readOnly = COMMAND_DEFINITIONS.filter((cmd) => cmd.category === "read-only");
    for (const cmd of readOnly) {
      expect(cmd.requiresConfirmation).toBeUndefined();
    }
  });

  it("should have nexus as the command for all definitions", () => {
    for (const cmd of COMMAND_DEFINITIONS) {
      expect(cmd.command).toBe("nexus");
    }
  });

  it("should include --json flag in args for all commands", () => {
    for (const cmd of COMMAND_DEFINITIONS) {
      expect(cmd.args).toContain("--json");
    }
  });

  it("should have status command with correct args", () => {
    const status = COMMAND_DEFINITIONS.find((cmd) => cmd.id === "status");
    expect(status).toBeDefined();
    expect(status?.args).toEqual(["status", "--json"]);
  });

  it("should have feedback-summary command with --summary flag", () => {
    const feedback = COMMAND_DEFINITIONS.find((cmd) => cmd.id === "feedback-summary");
    expect(feedback).toBeDefined();
    expect(feedback?.args).toContain("--summary");
  });

  it("should have goal-list command with list subcommand", () => {
    const goalList = COMMAND_DEFINITIONS.find((cmd) => cmd.id === "goal-list");
    expect(goalList).toBeDefined();
    expect(goalList?.args).toContain("list");
  });

  it("should have clean command as destructive", () => {
    const clean = COMMAND_DEFINITIONS.find((cmd) => cmd.id === "clean");
    expect(clean).toBeDefined();
    expect(clean?.category).toBe("destructive");
    expect(clean?.requiresConfirmation).toBe(true);
  });

  it("should have sync command as destructive", () => {
    const sync = COMMAND_DEFINITIONS.find((cmd) => cmd.id === "sync");
    expect(sync).toBeDefined();
    expect(sync?.category).toBe("destructive");
    expect(sync?.requiresConfirmation).toBe(true);
  });
});
