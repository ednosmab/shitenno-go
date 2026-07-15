import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { cleanCommand } from "../commands/clean.js";
import { doctorCommand } from "../commands/doctor.js";
import { reportCommand } from "../commands/report.js";
import { assessCommand } from "../commands/assess.js";
import { evolveCommand } from "../commands/evolve.js";
import { syncCommand } from "../commands/sync.js";


let tempDir: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-action-"));
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  stdoutSpy.mockRestore();
});

function setupNexusDir(dir: string) {
  const nexusDir = join(dir, "nexus-system");
  mkdirSync(join(nexusDir, "governance"), { recursive: true });
  mkdirSync(join(nexusDir, "docs", "skills"), { recursive: true });
  writeFileSync(join(dir, "opencode.json"), JSON.stringify({ agent: {} }));
  return nexusDir;
}

function setupNexusDirGoverned(dir: string) {
  const nexusDir = setupNexusDir(dir);
  writeFileSync(join(nexusDir, "maturity-profile.json"), JSON.stringify({ overallScore: 50, dimensions: {}, installedCapabilities: [], recommendedCapabilities: [], futureCapabilities: [] }));
  writeFileSync(join(nexusDir, "governance", "WORKFLOW.md"), "# Workflow");
  return nexusDir;
}

function getJsonOutput(): Record<string, unknown> {
  const allOutput = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join("");
  const start = allOutput.indexOf("{");
  if (start === -1) return {};
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < allOutput.length; i++) {
    const ch = allOutput[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(allOutput.slice(start, i + 1));
    }
  }
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// clean command
// ═══════════════════════════════════════════════════════════════════════════════

describe("clean command action handler", () => {
  it("removes .nexus-cache.json", () => {
    setupNexusDirGoverned(tempDir);
    writeFileSync(join(tempDir, ".nexus-cache.json"), "{}");

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    expect(existsSync(join(tempDir, ".nexus-cache.json"))).toBe(false);
  });

  it("removes *.tsbuildinfo files", () => {
    setupNexusDirGoverned(tempDir);
    writeFileSync(join(tempDir, "tsconfig.tsbuildinfo"), "{}");

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    expect(existsSync(join(tempDir, "tsconfig.tsbuildinfo"))).toBe(false);
  });

  it("outputs JSON with itemsRemoved array", () => {
    setupNexusDirGoverned(tempDir);
    writeFileSync(join(tempDir, ".nexus-cache.json"), "{}");

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("itemsRemoved");
    expect(output).toHaveProperty("count");
    expect(Array.isArray(output.itemsRemoved)).toBe(true);
    expect(output.count).toBeGreaterThanOrEqual(1);
  });

  it("outputs empty itemsRemoved when nothing to clean", () => {
    setupNexusDirGoverned(tempDir);

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output.itemsRemoved).toEqual([]);
    expect(output.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// doctor command
// ═══════════════════════════════════════════════════════════════════════════════

describe("doctor command action handler", () => {
  it("outputs JSON with health report structure", () => {
    setupNexusDirGoverned(tempDir);

    doctorCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("overallHealth");
    expect(output).toHaveProperty("healthScore");
    expect(output).toHaveProperty("findings");
    expect(output).toHaveProperty("teachingMoments");
    expect(output).toHaveProperty("summary");
    expect(typeof output.healthScore).toBe("number");
    expect(Array.isArray(output.findings)).toBe(true);
  });

  it("returns valid health score range", () => {
    setupNexusDir(tempDir);

    doctorCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output.healthScore).toBeGreaterThanOrEqual(0);
    expect(output.healthScore).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// report command
// ═══════════════════════════════════════════════════════════════════════════════

describe("report command action handler", () => {
  it("outputs JSON with report structure", () => {
    setupNexusDir(tempDir);

    const cmd = reportCommand();
    cmd.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("dimensions");
    expect(output).toHaveProperty("insights");
    expect(output).toHaveProperty("nextSteps");
    expect(output).toHaveProperty("period");
  });

  it("uses default period of 30 days", () => {
    setupNexusDir(tempDir);

    const cmd = reportCommand();
    cmd.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    const period = output.period as Record<string, unknown>;
    expect(period?.days).toBe(30);
  });

  it("respects --period flag", () => {
    setupNexusDir(tempDir);

    const cmd = reportCommand();
    cmd.parse(["node", "test", "--dir", tempDir, "--json", "--period", "7"], { from: "user" });

    const output = getJsonOutput();
    const period = output.period as Record<string, unknown>;
    expect(period?.days).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// assess command
// ═══════════════════════════════════════════════════════════════════════════════

describe("assess command action handler", () => {
  it("outputs JSON with assessment structure", () => {
    setupNexusDirGoverned(tempDir);

    assessCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("newProfile");
    expect(output).toHaveProperty("computedAt");
    expect(output).toHaveProperty("projectRoot");
  });

  it("newProfile has dimensions and scores", () => {
    setupNexusDirGoverned(tempDir);

    assessCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    const profile = output.newProfile as Record<string, unknown>;
    expect(profile).toHaveProperty("dimensions");
    expect(profile).toHaveProperty("overallScore");
    expect(profile).toHaveProperty("installedCapabilities");
    expect(profile).toHaveProperty("recommendedCapabilities");
    expect(typeof profile.overallScore).toBe("number");
  });

  it("records maturity snapshot in telemetry dir", () => {
    const nexusDir = setupNexusDir(tempDir);

    assessCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    expect(existsSync(join(nexusDir, "maturity-profile.json"))).toBe(true);
    const telemetryDir = join(nexusDir, "telemetry");
    expect(existsSync(telemetryDir)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// evolve command
// ═══════════════════════════════════════════════════════════════════════════════

describe("evolve command action handler", () => {
  it("outputs JSON with evolution report", () => {
    setupNexusDirGoverned(tempDir);

    evolveCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("totalRecommendations");
    expect(output).toHaveProperty("recommendations");
    expect(output).toHaveProperty("byType");
    expect(output).toHaveProperty("byPriority");
    expect(output).toHaveProperty("summary");
  });

  it("accept records feedback", () => {
    setupNexusDirGoverned(tempDir);

    evolveCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--accept", "EVO-001", "--comfortable"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output).toHaveProperty("feedback");
  });

  it("reject records feedback with reason", () => {
    setupNexusDirGoverned(tempDir);

    evolveCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--reject", "EVO-002", "--reason", "Not now"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output).toHaveProperty("feedback");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sync command
// ═══════════════════════════════════════════════════════════════════════════════

describe("sync command action handler", () => {
  it("errors when nexus-path not specified", () => {
    setupNexusDir(tempDir);

    syncCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output.error).toBe("lifecycle_gate");
  });

  it("errors when nexus-system directory not found", () => {
    setupNexusDir(tempDir);

    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--nexus-path", "/nonexistent"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output.error).toBe("lifecycle_gate");
  });

  it("errors when project not initialized (lifecycle gate blocks first)", () => {
    // After decoupling from opencode.json, nexus-system/ alone = initialized.
    // sync requires governed state; discovered state triggers lifecycle_gate first.
    const nexusDir = setupNexusDir(tempDir);
    rmSync(join(tempDir, "opencode.json"));

    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--nexus-path", nexusDir],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output.error).toBe("lifecycle_gate");
  });

  it("errors when nexus-system/ missing (truly uninitialized)", () => {
    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json"],
      { from: "user" }
    );

    const output = getJsonOutput();
    // sync checks nexus-dir existence first, returns missing_nexus_dir
    expect(output.error).toBe("missing_nexus_dir");
  });

  it("--dry-run does not modify files", () => {
    const nexusDir = setupNexusDirGoverned(tempDir);
    writeFileSync(join(nexusDir, "docs", "AGENTS.md"), "# Agents");

    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--nexus-path", nexusDir, "--dry-run"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output.dryRun).toBe(true);
    expect(existsSync(join(tempDir, "docs", "AGENTS.md"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// feedback command — user rating/comment/tags flags
// ═══════════════════════════════════════════════════════════════════════════════

import { recordOutcome, type SessionFeedbackRecord } from "../session-feedback.js";
import { parseUserRating, parseUserTags } from "../feedback-utils.js";

describe("feedback command — user rating/comment/tags parsing", () => {
  // These tests verify the shared parsing helpers from feedback-utils.ts
  // and their integration with recordOutcome.

  it("parses valid user rating", () => {
    expect(parseUserRating("4")).toBe(4);
  });

  it("returns undefined for rating below 1", () => {
    expect(parseUserRating("0")).toBeUndefined();
  });

  it("returns undefined for rating above 5", () => {
    expect(parseUserRating("9")).toBeUndefined();
  });

  it("returns undefined when user rating not provided", () => {
    expect(parseUserRating(undefined)).toBeUndefined();
  });

  it("parses comma-separated user tags", () => {
    expect(parseUserTags("refactor,audit,perf")).toEqual(["refactor", "audit", "perf"]);
  });

  it("trims whitespace from user tags", () => {
    expect(parseUserTags(" refactor , audit ")).toEqual(["refactor", "audit"]);
  });

  it("returns undefined when user tags not provided", () => {
    expect(parseUserTags(undefined)).toBeUndefined();
  });

  it("records all user fields through recordOutcome", () => {
    const appended: SessionFeedbackRecord[] = [];
    const storage = { append: (r: SessionFeedbackRecord) => { appended.push(r); } };

    recordOutcome(storage, {
      outcome: "partial",
      briefingHash: "abc",
      briefingTimestamp: "2026-01-01",
      userRating: 3,
      userComment: "Needs improvement",
      userTags: ["bug", "urgent"],
    });

    const record = appended[0]!;
    expect(record.outcome).toBe("partial");
    expect(record.userRating).toBe(3);
    expect(record.userComment).toBe("Needs improvement");
    expect(record.userTags).toEqual(["bug", "urgent"]);
  });

  it("omits user fields when not provided", () => {
    const appended: SessionFeedbackRecord[] = [];
    const storage = { append: (r: SessionFeedbackRecord) => { appended.push(r); } };

    recordOutcome(storage, {
      outcome: "success",
      briefingHash: "abc",
      briefingTimestamp: "2026-01-01",
    });

    const record = appended[0]!;
    expect(record.userRating).toBeUndefined();
    expect(record.userComment).toBeUndefined();
    expect(record.userTags).toBeUndefined();
  });
});
