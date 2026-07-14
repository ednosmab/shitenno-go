/**
 * cli-global-flags.test.ts — Tests for --quiet and --no-color global CLI flags
 *
 * Tests:
 * 1. Logger respects NEXUS_QUIET env var
 * 2. Logger still outputs errors in quiet mode
 * 3. Logger works normally without NEXUS_QUIET
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    vi.restoreAllMocks();
  });

  it("outputs debug/info/warn when NEXUS_QUIET is not set", () => {
    delete process.env.NEXUS_QUIET;
    setLogLevel("debug"); // Enable all levels

    const spies = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };

    logger.debug("test", "debug message");
    logger.info("test", "info message");
    logger.warn("test", "warn message");
    logger.error("test", "error message");

    expect(spies.debug).toHaveBeenCalledOnce();
    expect(spies.log).toHaveBeenCalledOnce();
    expect(spies.warn).toHaveBeenCalledOnce();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("suppresses debug/info/warn when NEXUS_QUIET=1", () => {
    process.env.NEXUS_QUIET = "1";

    const spies = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };

    logger.debug("test", "should be suppressed");
    logger.info("test", "should be suppressed");
    logger.warn("test", "should be suppressed");
    logger.error("test", "should pass through");

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("still outputs error level when NEXUS_QUIET=1", () => {
    process.env.NEXUS_QUIET = "1";

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("test", "critical error");
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("respects both NEXUS_QUIET and log level together", () => {
    process.env.NEXUS_QUIET = "1";
    setLogLevel("debug"); // Would normally show debug

    const spies = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };

    logger.debug("test", "should be suppressed by quiet");
    logger.error("test", "should pass through");

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
  });
});

// ── MuteLogs utility ────────────────────────────────────────────────────────

describe("logger — muteLogs utility", () => {
  beforeEach(() => {
    setLogLevel("info");
  });

  afterEach(() => {
    setLogLevel("info");
    vi.restoreAllMocks();
  });

  it("suppresses all output except error", () => {
    muteLogs();

    const spies = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };

    logger.debug("test", "debug msg");
    logger.info("test", "info msg");
    logger.warn("test", "warn msg");
    logger.error("test", "error msg");

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
    expect(spies.error.mock.calls[0]![0]!).toContain("error msg");
  });
});
