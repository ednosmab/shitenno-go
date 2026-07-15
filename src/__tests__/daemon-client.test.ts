/**
 * daemon-client.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shouldSkipDaemon, isDaemonRunning, getPidPath, stopDaemon } from "../daemon-client.js";

const TEST_DIR = join(__dirname, ".test-daemon-client");

describe("daemon-client", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    vi.stubEnv("NEXUS_NO_DAEMON", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("NEXUS_CHILD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("shouldSkipDaemon", () => {
    it("returns false by default", () => {
      expect(shouldSkipDaemon()).toBe(false);
    });

    it("returns true if NEXUS_NO_DAEMON=1", () => {
      vi.stubEnv("NEXUS_NO_DAEMON", "1");
      expect(shouldSkipDaemon()).toBe(true);
    });

    it("returns true if CI=true", () => {
      vi.stubEnv("CI", "true");
      expect(shouldSkipDaemon()).toBe(true);
    });

    it("returns true if NEXUS_CHILD=1", () => {
      vi.stubEnv("NEXUS_CHILD", "1");
      expect(shouldSkipDaemon()).toBe(true);
    });
  });

  describe("isDaemonRunning", () => {
    it("returns false if pid file does not exist", () => {
      expect(isDaemonRunning(TEST_DIR)).toBe(false);
    });

    it("returns false if pid file has invalid content", () => {
      const pidPath = getPidPath(TEST_DIR);
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      writeFileSync(pidPath, "not-a-number", "utf-8");
      expect(isDaemonRunning(TEST_DIR)).toBe(false);
    });

    it("returns true if process exists (mocked)", () => {
      const pidPath = getPidPath(TEST_DIR);
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      writeFileSync(pidPath, String(process.pid), "utf-8"); // We know our own process is running
      expect(isDaemonRunning(TEST_DIR)).toBe(true);
    });
  });

  describe("stopDaemon", () => {
    it("returns false if pid file does not exist", () => {
      expect(stopDaemon(TEST_DIR)).toBe(false);
    });

    it("handles error when process kill fails (invalid pid)", () => {
      const pidPath = getPidPath(TEST_DIR);
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      writeFileSync(pidPath, "999999999", "utf-8"); // Hope this doesn't exist
      
      const spy = vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });
      
      expect(stopDaemon(TEST_DIR)).toBe(false);
      spy.mockRestore();
    });
  });
});
