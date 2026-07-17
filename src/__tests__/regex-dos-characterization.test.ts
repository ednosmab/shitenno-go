/**
 * regex-dos-characterization.test.ts — Characterization tests for flagged regex patterns
 *
 * Phase 4 of PLAN-2026-07-16-security-findings-remediation.
 *
 * Each regex marked as `regex_dos` by the audit detector is tested empirically
 * with adversarial input to determine if it actually hangs (ReDoS vulnerable).
 * Patterns that pass are marked as false positives; patterns that fail are
 * rewritten.
 *
 * Source: src/context-buffer-writer.ts line 418 — impedimentsRegex
 */

import { describe, it, expect } from "vitest";

// ── impedimentsRegex (context-buffer-writer.ts:418) ────────────────────────
// Regex: /^impediments:\s*\n((?:\s+- .*\n)*)/m
// The nested quantifier `(?:\s+- .*\n)*` was flagged by the detector.
// Analysis: \s+ and .* don't compete for the same text in practice (\s+ matches
// leading whitespace, .* matches everything after `- ` to EOL). The regex should
// be safe, but we verify empirically.

describe("impedimentsRegex ReDoS resistance", () => {
  // This regex is defined inline to match the source exactly
  const impedimentsRegex = /^impediments:\s*\n((?:\s+- .*\n)*)/m;

  it("does not hang on adversarial input (50k entries, no final match)", () => {
    // Construct input that forces maximum backtracking if vulnerable:
    // Many matching lines but NO trailing newline on the last entry,
    // which means the `.*\n` group can't match the final line,
    // potentially causing backtracking through all prior matches.
    const adversarial =
      "impediments:\n" +
      "  - x\n".repeat(50_000) +
      "!"; // no trailing \n on last line — forces backtracking if vulnerable

    const start = Date.now();
    impedimentsRegex.exec(adversarial);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000); // Must be sub-second
  });

  it("does not hang on empty impediments section", () => {
    const input = "impediments:\n";
    const start = Date.now();
    impedimentsRegex.exec(input);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("correctly matches normal impediments", () => {
    const input =
      "impediments:\n" +
      "  - description: \"Test impediment\"\n" +
      "    priority: \"high\"\n" +
      "    createdAt: \"2026-01-01\"\n" +
      "\n";
    const match = impedimentsRegex.exec(input);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("Test impediment");
  });
});

// ── Reminder regex (context-buffer-writer.ts:389) ──────────────────────────
// Regex: /^reminders:\s*\n/m
// This is a simple anchor — no nested quantifiers, no ReDoS risk.
// Characterization test included for completeness.

describe("remindersRegex ReDoS resistance", () => {
  const remindersRegex = /^reminders:\s*\n/m;

  it("does not hang on large input", () => {
    const adversarial = "x\n".repeat(100_000) + "reminders:\n";
    const start = Date.now();
    remindersRegex.exec(adversarial);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

// ── Additional regex patterns from the codebase (characterization) ──────────

describe("Other regex patterns flagged by audit", () => {
  // capabilityBlockRegex from scaffolder.ts (used in filterAgentsMdByCapabilities)
  // Pattern: /<!-- CAPABILITY: (\w+) -->[\s\S]*?<!-- \/CAPABILITY -->/g
  const capabilityBlockRegex = /<!-- CAPABILITY: (\w+) -->[\s\S]*?<!-- \/CAPABILITY -->/g;

  it("does not hang on large input with many CAPABILITY blocks", () => {
    const blocks = Array.from(
      { length: 10_000 },
      (_, i) => `<!-- CAPABILITY: cap${i} -->\ncontent\n<!-- /CAPABILITY -->\n`
    ).join("");
    const start = Date.now();
    capabilityBlockRegex.lastIndex = 0;
    capabilityBlockRegex.exec(blocks);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
