/**
 * verification-lock-concurrent.test.ts — Integration test for cross-process lock
 *
 * Uses child_process.spawn() to create real separate Node.js processes
 * competing for the same verification lock, validating:
 * 1. Child acquires lock, parent detects conflict and skips
 * 2. Two concurrent children: exactly one wins
 * 3. Child crash (SIGKILL) → parent reclaims stale lock
 * 4. Failed acquire does not corrupt the lock file
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import {
  acquireVerificationLock,
  releaseVerificationLock,
} from "../verification-lock.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `shitenno-vlock-concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(join(dir, "governance", "plans"), { recursive: true });
  return dir;
}

function getLockPath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "plans", ".verification.lock");
}

/**
 * Creates a temporary .mjs worker script that implements the lock logic
 * inline using only Node.js builtins — no external imports needed.
 * Communicates via stdout JSON lines to avoid IPC issues with vitest.
 */
function createWorkerScript(dir: string): string {
  const scriptPath = join(dir, "worker.mjs");
  const script = `
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const shitennoDir = ${JSON.stringify(dir)};
const lockPath = join(shitennoDir, "governance", "plans", ".verification.lock");

function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function acquire() {
  if (existsSync(lockPath)) {
    try {
      const info = JSON.parse(readFileSync(lockPath, "utf-8"));
      if (isProcessAlive(info.pid)) return false;
    } catch { /* corrupted — reclaim */ }
  }
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2), "utf-8");
  return true;
}

function release() {
  try {
    if (existsSync(lockPath)) {
      const info = JSON.parse(readFileSync(lockPath, "utf-8"));
      if (info.pid === process.pid) unlinkSync(lockPath);
    }
  } catch { /* safe no-op */ }
}

// Signal ready, then wait for commands on stdin
const result = acquire();
process.stdout.write(JSON.stringify({ type: "result", acquired: result, pid: process.pid }) + "\\n");

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.type === "release") {
      release();
      process.stdout.write(JSON.stringify({ type: "released" }) + "\\n");
    }
    if (msg.type === "exit") {
      process.exit(0);
    }
  } catch { /* ignore bad input */ }
});
`;
  writeFileSync(scriptPath, script, "utf-8");
  return scriptPath;
}

/**
 * Spawn a child process that tries to acquire the lock.
 * Uses spawn() instead of fork() to avoid vitest's child_process patches.
 * Communicates via stdin/stdout JSON lines.
 */
function spawnLockHolder(dir: string): { child: ChildProcess; lines: string[]; onLine: (cb: (line: string) => void) => void } {
  const scriptPath = createWorkerScript(dir);
  const child = spawn(process.execPath, [scriptPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const lines: string[] = [];
  const listeners: Array<(line: string) => void> = [];

  child.stdout!.on("data", (data: Buffer) => {
    const text = data.toString();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      lines.push(line);
      for (const cb of listeners) cb(line);
    }
  });

  return {
    child,
    lines,
    onLine: (cb) => listeners.push(cb),
  };
}

function waitForStdoutLine(
  holder: { lines: string[]; onLine: (cb: (line: string) => void) => void },
  type: string,
  timeoutMs = 8000
): Promise<Record<string, unknown>> {
  // Check already-received lines first
  for (const line of holder.lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === type) return Promise.resolve(msg);
    } catch { /* not JSON */ }
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timeout waiting for line type="${type}". Received: ${holder.lines.join("; ")}`));
      }
    }, timeoutMs);
    holder.onLine((line) => {
      if (settled) return;
      try {
        const msg = JSON.parse(line);
        if (msg.type === type) {
          settled = true;
          clearTimeout(timer);
          resolve(msg);
        }
      } catch { /* not JSON */ }
    });
  });
}

function sendToChild(child: ChildProcess, msg: Record<string, string>): void {
  child.stdin!.write(JSON.stringify(msg) + "\n");
}

function killChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid || child.killed) {
      resolve();
      return;
    }
    child.on("exit", () => resolve());
    child.kill("SIGKILL");
    setTimeout(resolve, 1000);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("verification-lock: concurrent cross-process", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("child acquires lock, parent detects conflict and skips", async () => {
    // Step 1: Spawn child process that acquires the lock
    const holder = spawnLockHolder(dir);
    const childResult = await waitForStdoutLine(holder, "result") as { acquired: boolean; pid: number };

    // Child should have acquired the lock
    expect(childResult.acquired).toBe(true);
    expect(childResult.pid).toBeGreaterThan(0);

    // Verify lock file exists and belongs to the child
    expect(existsSync(getLockPath(dir))).toBe(true);
    const lockContent = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(lockContent.pid).toBe(childResult.pid);

    // Step 2: Parent (current process) tries to acquire — should fail
    const parentResult = acquireVerificationLock(dir);
    expect(parentResult).toBe(false);

    // Step 3: Tell child to release the lock
    sendToChild(holder.child, { type: "release" });
    await waitForStdoutLine(holder, "released");

    // Step 4: Parent can now acquire
    const secondAttempt = acquireVerificationLock(dir);
    expect(secondAttempt).toBe(true);

    // Cleanup
    sendToChild(holder.child, { type: "exit" });
    releaseVerificationLock(dir);
  });

  it("only one of two concurrent acquirers wins", async () => {
    // Spawn two children simultaneously, both try to acquire
    const holder1 = spawnLockHolder(dir);
    const holder2 = spawnLockHolder(dir);

    const [result1, result2] = await Promise.all([
      waitForStdoutLine(holder1, "result") as Promise<{ acquired: boolean; pid: number }>,
      waitForStdoutLine(holder2, "result") as Promise<{ acquired: boolean; pid: number }>,
    ]);

    // Exactly one should have acquired the lock
    const winners = [result1, result2].filter((r) => r.acquired);
    expect(winners.length).toBe(1);

    // The winner's PID should match the lock file
    const winner = winners[0]!;
    const lockContent = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(lockContent.pid).toBe(winner.pid);

    // The loser should have received false
    const losers = [result1, result2].filter((r) => !r.acquired);
    expect(losers.length).toBe(1);

    // Cleanup both children
    sendToChild(holder1.child, { type: "exit" });
    sendToChild(holder2.child, { type: "exit" });
    releaseVerificationLock(dir);
  });

  it("after child crash (SIGKILL), parent reclaims the stale lock", async () => {
    // Step 1: Spawn child that acquires the lock
    const holder = spawnLockHolder(dir);
    const childResult = await waitForStdoutLine(holder, "result") as { acquired: boolean; pid: number };
    expect(childResult.acquired).toBe(true);

    // Verify lock file belongs to child
    const lockContent = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(lockContent.pid).toBe(childResult.pid);

    // Step 2: Kill the child with SIGKILL (simulates crash)
    await killChild(holder.child);
    await new Promise((r) => setTimeout(r, 300));

    // Step 3: Parent tries to acquire — should reclaim the stale lock
    const parentResult = acquireVerificationLock(dir);
    expect(parentResult).toBe(true);

    // Lock should now belong to the parent
    const newLockContent = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(newLockContent.pid).toBe(process.pid);

    releaseVerificationLock(dir);
  });

  it("failed acquire does not corrupt the lock file", async () => {
    // Spawn child that holds the lock
    const holder = spawnLockHolder(dir);
    await waitForStdoutLine(holder, "result");

    // Parent tries and fails to acquire — should not corrupt the lock file
    acquireVerificationLock(dir);

    // Lock file should still be valid JSON with the child's PID
    const lockContent = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(typeof lockContent.pid).toBe("number");
    expect(typeof lockContent.startedAt).toBe("string");

    // Cleanup
    sendToChild(holder.child, { type: "exit" });
    releaseVerificationLock(dir);
  });
});
