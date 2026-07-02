import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, muteLogs } from "../logger.js";

describe("logger", () => {
  let consoleSpy: { debug: ReturnType<typeof vi.spyOn>; log: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
    setLogLevel("info");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info logs when level is info", () => {
    logger.info("TestModule", "hello");
    expect(consoleSpy.log).toHaveBeenCalledOnce();
    expect(consoleSpy.log.mock.calls[0]![0]!).toContain("[TestModule]");
    expect(consoleSpy.log.mock.calls[0]![0]!).toContain("hello");
  });

  it("warn logs when level is info", () => {
    logger.warn("TestModule", "warning");
    expect(consoleSpy.warn).toHaveBeenCalledOnce();
  });

  it("error always logs", () => {
    setLogLevel("error");
    logger.error("TestModule", "fail");
    expect(consoleSpy.error).toHaveBeenCalledOnce();
  });

  it("debug does not log when level is info", () => {
    logger.debug("TestModule", "hidden");
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it("debug logs when level is debug", () => {
    setLogLevel("debug");
    logger.debug("TestModule", "visible");
    expect(consoleSpy.debug).toHaveBeenCalledOnce();
  });

  it("muteLogs suppresses all except error", () => {
    muteLogs();
    logger.info("TestModule", "suppressed");
    logger.warn("TestModule", "suppressed");
    logger.debug("TestModule", "suppressed");
    logger.error("TestModule", "visible");
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledOnce();
  });
});
