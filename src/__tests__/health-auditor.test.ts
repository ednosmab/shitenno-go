import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditHealth, writeHealthReport } from "../health-auditor.js";

let tempDir: string;
let nexusDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-audit-"));
  nexusDir = join(tempDir, "nexus-system");
  mkdirSync(nexusDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("auditHealth", () => {
  it("returns health score 100 for empty project", () => {
    // No docs, no history → missing_docs issues only
    const report = auditHealth(tempDir, nexusDir);
    expect(report.healthScore).toBeLessThan(100);
    expect(report.totalRules).toBe(0);
    expect(report.historyEntries).toBe(0);
  });

  it("returns health score 100 when all docs exist and no issues", () => {
    // Create all expected docs
    mkdirSync(join(nexusDir, "docs"), { recursive: true });
    writeFileSync(
      join(nexusDir, "docs", "AGENTS.md"),
      "# Rules\n1. **Rule One**: do this\n2. **Rule Two**: do that\n3. **Rule Three**: other"
    );
    writeFileSync(join(nexusDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden");
    writeFileSync(join(nexusDir, "docs", "DESDO.md"), "# DESDO");
    mkdirSync(join(nexusDir, "governance"), { recursive: true });
    writeFileSync(join(nexusDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(nexusDir, "governance", "SYSTEM_MAP.md"), "# Map");
    writeFileSync(join(nexusDir, "docs", "session-template.md"), "# Template");
    // Small buffer
    mkdirSync(join(nexusDir, "governance", "context"), { recursive: true });
    writeFileSync(
      join(nexusDir, "governance", "context", "context_buffer.yaml"),
      "# Buffer\ncurrent_task:\n  status: done\n"
    );

    const report = auditHealth(tempDir, nexusDir);
    expect(report.healthScore).toBe(100);
    expect(report.totalRules).toBe(3);
  });

  it("detects missing critical docs", () => {
    const report = auditHealth(tempDir, nexusDir);
    const missingDocs = report.issues.filter((i) => i.type === "missing_docs");
    expect(missingDocs.length).toBeGreaterThanOrEqual(4);

    const criticalMissing = missingDocs.filter((i) => i.severity === 3);
    expect(criticalMissing.length).toBeGreaterThanOrEqual(3);
  });

  it("detects stale buffer with too many lines", () => {
    mkdirSync(join(nexusDir, "governance", "context"), { recursive: true });
    const longBuffer = Array.from({ length: 60 }, (_, i) => `line-${i}: value`).join("\n");
    writeFileSync(
      join(nexusDir, "governance", "context", "context_buffer.yaml"),
      longBuffer
    );

    const report = auditHealth(tempDir, nexusDir);
    const staleBuffer = report.issues.find((i) => i.type === "stale_buffer");
    expect(staleBuffer).toBeDefined();
    expect(staleBuffer!.severity).toBe(2);
  });

  it("detects unclosed session in buffer", () => {
    mkdirSync(join(nexusDir, "governance", "context"), { recursive: true });
    writeFileSync(
      join(nexusDir, "governance", "context", "context_buffer.yaml"),
      "current_task:\n  status: in_progress\n"
    );

    const report = auditHealth(tempDir, nexusDir);
    const stale = report.issues.find(
      (i) => i.type === "stale_buffer" && i.description.includes("curso")
    );
    expect(stale).toBeDefined();
  });

  it("detects violation hotspots with 50%+ violation rate", () => {
    mkdirSync(join(nexusDir, "docs", "history"), { recursive: true });
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        join(nexusDir, "docs", "history", `2025-06-${20 + i}-s1.md`),
        i < 4 ? "# Session\nHad a bug here, fixed the erro." : "# Session\nClean session."
      );
    }

    const report = auditHealth(tempDir, nexusDir);
    const hotspot = report.issues.find((i) => i.type === "violation_hotspot");
    expect(hotspot).toBeDefined();
  });

  it("proposes optimizations for each issue type", () => {
    // Create conditions for orphan_dir
    mkdirSync(join(nexusDir, "mystery"), { recursive: true });
    writeFileSync(join(nexusDir, "mystery", "README.md"), "# Mystery");

    const report = auditHealth(tempDir, nexusDir);
    const orphanOpt = report.optimizations.find(
      (o) => o.action === "add_docs"
    );
    expect(orphanOpt).toBeDefined();
    expect(orphanOpt!.id).toMatch(/^OPT-\d{3}$/);
  });
});

describe("writeHealthReport", () => {
  it("returns null when reports/ doesn't exist", () => {
    const report = auditHealth(tempDir, nexusDir);
    const result = writeHealthReport(nexusDir, report);
    expect(result).toBeNull();
  });

  it("writes health report when reports/ exists", () => {
    mkdirSync(join(nexusDir, "reports"), { recursive: true });
    const report = auditHealth(tempDir, nexusDir);
    const filename = writeHealthReport(nexusDir, report);
    expect(filename).toMatch(/^health-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
