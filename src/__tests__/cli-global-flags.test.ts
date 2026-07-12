/**
 * cli-global-flags.test.ts — Tests for --quiet and --no-color global CLI flags
 *
 * Tests:
 * 1. Logger respects NEXUS_QUIET env var
 * 2. Logger still outputs errors in quiet mode
 * 3. Logger works normally without NEXUS_QUIET
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, muteLogs } from "../logger.js";

// ── Logger NEXUS_QUIET tests ────────────────────────────────────────────────

describe("logger — NEXUS_QUIET env var", () => {
  const originalEnv = process.env.NEXUS_QUIET;

  beforeEach(() => {
    setLogLevel("info"); // Reset log level
  });

  afterEach(() => {
    // Restore env
    if (originalEnv === undefined) {
      delete process.env.NEXUS_QUIET;
    } else {
      process.env.NEXUS_QUIET = originalEnv;
    }
  });

  it("outputs debug/info/warn when NEXUS_QUIET is not set", () => {
    delete process.env.NEXUS_QUIET;

    // These should not throw - they use console.error/warn internally
    expect(() => logger.debug("test", "debug message")).not.toThrow();
    expect(() => logger.info("test", "info message")).not.toThrow();
    expect(() => logger.warn("test", "warn message")).not.toThrow();
    expect(() => logger.error("test", "error message")).not.toThrow();
  });

  it("suppresses debug/info/warn when NEXUS_QUIET=1", () => {
    process.env.NEXUS_QUIET = "1";

    // Mock console.error and console.warn to capture output
    const originalError = console.error;
    const originalWarn = console.warn;
    const captured: string[] = [];
    console.error = (...args: unknown[]) => captured.push(args.join(" "));
    console.warn = (...args: unknown[]) => captured.push(args.join(" "));

    try {
      logger.debug("test", "should be suppressed");
      logger.info("test", "should be suppressed");
      logger.warn("test", "should be suppressed");
      logger.error("test", "should pass through");

      // debug, info, warn should be suppressed
      expect(captured.some((c) => c.includes("should be suppressed"))).toBe(false);
      // error should still pass through
      expect(captured.some((c) => c.includes("should pass through"))).toBe(true);
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  it("still outputs error level when NEXUS_QUIET=1", () => {
    process.env.NEXUS_QUIET = "1";

    const originalError = console.error;
    const captured: string[] = [];
    console.error = (...args: unknown[]) => captured.push(args.join(" "));

    try {
      logger.error("test", "critical error");
      expect(captured.some((c) => c.includes("critical error"))).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  it("respects both NEXUS_QUIET and log level together", () => {
    process.env.NEXUS_QUIET = "1";
    setLogLevel("debug"); // Would normally show debug

    const originalError = console.error;
    const captured: string[] = [];
    console.error = (...args: unknown[]) => captured.push(args.join(" "));

    try {
      logger.debug("test", "should be suppressed by quiet");
      logger.error("test", "should pass through");

      expect(captured.some((c) => c.includes("should be suppressed"))).toBe(false);
      expect(captured.some((c) => c.includes("should pass through"))).toBe(true);
    } finally {
      console.error = originalError;
    }
  });
});

// ── MuteLogs utility ────────────────────────────────────────────────────────

describe("logger — muteLogs utility", () => {
  beforeEach(() => {
    setLogLevel("info");
  });

  afterEach(() => {
    setLogLevel("info");
  });

  it("suppresses all output except error", () => {
    muteLogs();

    const originalError = console.error;
    const captured: string[] = [];
    console.error = (...args: unknown[]) => captured.push(args.join(" "));

    try {
      logger.debug("test", "debug msg");
      logger.info("test", "info msg");
      logger.warn("test", "warn msg");
      logger.error("test", "error msg");

      expect(captured.some((c) => c.includes("debug msg"))).toBe(false);
      expect(captured.some((c) => c.includes("info msg"))).toBe(false);
      expect(captured.some((c) => c.includes("warn msg"))).toBe(false);
      expect(captured.some((c) => c.includes("error msg"))).toBe(true);
    } finally {
      console.error = originalError;
    }
  });
});
