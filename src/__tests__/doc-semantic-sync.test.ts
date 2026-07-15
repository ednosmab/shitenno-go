/**
 * doc-semantic-sync.test.ts — Tests for the bridge between
 * semantic-drift-detector and context_buffer.yaml
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

vi.mock("../semantic-drift-detector.js", () => ({
  scanCodebase: vi.fn(),
  detectDriftBatch: vi.fn(),
}));

import { runSemanticDocSync } from "../doc-semantic-sync.js";
import * as detector from "../semantic-drift-detector.js";

const SAMPLE_BUFFER = `session:
  id: session-001
  status: active

reminders: []

current_task:
  id: task-001
  description: "Test"
  status: "in_progress"
`;

function createTmpProject(): { projectRoot: string; nexusDir: string } {
  const projectRoot = join(tmpdir(), `nexus-sync-test-${Date.now()}`);
  const nexusDir = join(projectRoot, "nexus-system");
  const governanceDir = join(nexusDir, "governance", "context");
  const docsDir = join(projectRoot, "docs");
  mkdirSync(governanceDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(governanceDir, "context_buffer.yaml"), SAMPLE_BUFFER, "utf-8");
  writeFileSync(join(docsDir, "README.md"), "# Test\n", "utf-8");
  return { projectRoot, nexusDir };
}

describe("runSemanticDocSync", () => {
  let tmpDir: { projectRoot: string; nexusDir: string };

  beforeEach(() => {
    tmpDir = createTmpProject();
  });

  afterEach(() => {
    rmSync(tmpDir.projectRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes reminders when drift is detected", () => {
    vi.mocked(detector.scanCodebase).mockReturnValue({
      dependencies: [],
      imports: [],
      cliCommands: ["init", "status"],
      configKeys: [],
    });
    vi.mocked(detector.detectDriftBatch).mockReturnValue([
      {
        document: "docs/README.md",
        confidence: 0.8,
        missingKeywords: ["daemon", "watch"],
        reason: "Missing in codebase: daemon, watch",
      },
    ]);

    const result = runSemanticDocSync({
      projectRoot: tmpDir.projectRoot,
      nexusDir: tmpDir.nexusDir,
    });

    expect(result.driftFound).toBe(1);
    expect(result.remindersWritten).toBe(1);
    expect(result.remindersSkipped).toBe(0);

    const content = readFileSync(
      join(tmpDir.nexusDir, "governance", "context", "context_buffer.yaml"),
      "utf-8"
    );
    expect(content).toContain('Doc desatualizada: docs/README.md');
    expect(content).toContain('priority: "high"');
    expect(content).toContain('category: "docs"');
  });

  it("deduplicates on second run", () => {
    vi.mocked(detector.scanCodebase).mockReturnValue({
      dependencies: [],
      imports: [],
      cliCommands: [],
      configKeys: [],
    });
    vi.mocked(detector.detectDriftBatch).mockReturnValue([
      {
        document: "docs/README.md",
        confidence: 0.9,
        missingKeywords: ["daemon"],
        reason: "Missing: daemon",
      },
    ]);

    const first = runSemanticDocSync({
      projectRoot: tmpDir.projectRoot,
      nexusDir: tmpDir.nexusDir,
    });
    expect(first.remindersWritten).toBe(1);

    const second = runSemanticDocSync({
      projectRoot: tmpDir.projectRoot,
      nexusDir: tmpDir.nexusDir,
    });
    expect(second.remindersWritten).toBe(0);
    expect(second.remindersSkipped).toBe(1);
  });

  it("returns zero when no drift detected", () => {
    vi.mocked(detector.scanCodebase).mockReturnValue({
      dependencies: [],
      imports: [],
      cliCommands: [],
      configKeys: [],
    });
    vi.mocked(detector.detectDriftBatch).mockReturnValue([]);

    const result = runSemanticDocSync({
      projectRoot: tmpDir.projectRoot,
      nexusDir: tmpDir.nexusDir,
    });

    expect(result.driftFound).toBe(0);
    expect(result.remindersWritten).toBe(0);
  });

  it("handles missing docs directory gracefully", () => {
    vi.mocked(detector.scanCodebase).mockReturnValue({
      dependencies: [],
      imports: [],
      cliCommands: [],
      configKeys: [],
    });
    vi.mocked(detector.detectDriftBatch).mockReturnValue([]);

    const result = runSemanticDocSync({
      projectRoot: tmpDir.projectRoot,
      nexusDir: tmpDir.nexusDir,
      docsDir: "/nonexistent/docs",
    });

    expect(result.scanned).toBe(0);
    expect(result.remindersWritten).toBe(0);
  });
});
