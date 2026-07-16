/**
 * daemon-client.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import {
  shouldSkipDaemon,
  isDaemonRunning,
  getPidPath,
  stopDaemon,
  queryDaemon,
  pingDaemon,
  queryDaemonStatus,
  getSocketPath,
} from "../daemon-client.js";

const TEST_DIR = join(__dirname, ".test-daemon-client");

describe("daemon-client", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    vi.stubEnv("SHITEN_NO_DAEMON", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("SHITEN_CHILD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("shouldSkipDaemon", () => {
    it("returns false by default", () => {
      expect(shouldSkipDaemon()).toBe(false);
    });

    it("returns true if SHITEN_NO_DAEMON=1", () => {
      vi.stubEnv("SHITEN_NO_DAEMON", "1");
      expect(shouldSkipDaemon()).toBe(true);
    });

    it("returns true if CI=true", () => {
      vi.stubEnv("CI", "true");
      expect(shouldSkipDaemon()).toBe(true);
    });

    it("returns true if SHITEN_CHILD=1", () => {
      vi.stubEnv("SHITEN_CHILD", "1");
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

  describe("queryDaemon", () => {
    it("returns null when socket does not exist", async () => {
      const result = await queryDaemon(TEST_DIR, { type: "ping" });
      expect(result).toBeNull();
    });

    it("returns null on timeout", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      // Create a server that accepts connections but never responds
      const server = createServer((_socket) => {
        // Intentionally do nothing — force timeout
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      const result = await queryDaemon(TEST_DIR, { type: "ping" }, 200);
      expect(result).toBeNull();

      server.close();
    });

    it("returns parsed response on success", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      const server = createServer((socket) => {
        socket.on("data", (data) => {
          const msg = JSON.parse(data.toString().trim());
          if (msg.type === "ping") {
            socket.write(JSON.stringify({ type: "pong" }) + "\n");
          }
        });
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      const result = await queryDaemon<{ type: string }>(TEST_DIR, { type: "ping" });
      expect(result).toEqual({ type: "pong" });

      server.close();
    });

    it("returns null on malformed JSON response", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      const server = createServer((socket) => {
        socket.on("data", () => {
          socket.write("not-json\n");
        });
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      const result = await queryDaemon(TEST_DIR, { type: "ping" });
      expect(result).toBeNull();

      server.close();
    });

    it("sends correct message payload", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      let receivedMsg: unknown = null;
      const server = createServer((socket) => {
        socket.on("data", (data) => {
          receivedMsg = JSON.parse(data.toString().trim());
          socket.write(JSON.stringify({ type: "ack" }) + "\n");
        });
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      await queryDaemon(TEST_DIR, { type: "query_health", limit: 5 });
      expect(receivedMsg).toEqual({ type: "query_health", limit: 5 });

      server.close();
    });
  });

  describe("pingDaemon", () => {
    it("returns false when daemon is not running", async () => {
      const result = await pingDaemon(TEST_DIR);
      expect(result).toBe(false);
    });

    it("returns true when daemon responds with pong", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      const server = createServer((socket) => {
        socket.on("data", (data) => {
          const msg = JSON.parse(data.toString().trim());
          if (msg.type === "ping") {
            socket.write(JSON.stringify({ type: "pong" }) + "\n");
          }
        });
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      const result = await pingDaemon(TEST_DIR);
      expect(result).toBe(true);

      server.close();
    });
  });

  describe("queryDaemonStatus", () => {
    it("returns null when daemon is not running", async () => {
      const result = await queryDaemonStatus(TEST_DIR);
      expect(result).toBeNull();
    });

    it("returns status response when daemon responds", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      const statusResponse = {
        type: "status",
        pid: 1234,
        version: "1.0.0",
        shitenDir: TEST_DIR,
        socketPath,
        uptimeSeconds: 60,
        eventsRecorded: 5,
        activeSessions: 1,
        lastSession: null,
        drift: null,
        health: { score: 80, checkedAt: new Date().toISOString() },
        challengesQueued: 0,
        debt: null,
      };

      const server = createServer((socket) => {
        socket.on("data", (data) => {
          const msg = JSON.parse(data.toString().trim());
          if (msg.type === "status") {
            socket.write(JSON.stringify(statusResponse) + "\n");
          }
        });
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      const result = await queryDaemonStatus(TEST_DIR);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("status");
      expect(result?.pid).toBe(1234);

      server.close();
    });
  });
});
