import { describe, it, expect, beforeEach } from "vitest";
import {
  detectArtifactType,
  detectDirectoryScore,
  calculateFrequencyScore,
  calculateSizeScore,
  calculateSignificance,
  ChangeHistoryTracker,
  type ChangeFrequency,
} from "../doc-sync-significance.js";

const NEXUS = "/project/nexus-system";

// ── detectArtifactType ─────────────────────────────────────────────────────

describe("detectArtifactType", () => {
  it("detects skill files", () => {
    expect(detectArtifactType(`${NEXUS}/docs/skills/tdd.md`, NEXUS)).toBe("skill");
  });

  it("detects ADR files", () => {
    expect(detectArtifactType(`${NEXUS}/docs/adrs/ADR-001.md`, NEXUS)).toBe("adr");
  });

  it("detects workflow files", () => {
    expect(detectArtifactType(`${NEXUS}/governance/WORKFLOW.md`, NEXUS)).toBe("workflow");
  });

  it("detects rule files", () => {
    expect(detectArtifactType(`${NEXUS}/governance/rules/RULE-001.json`, NEXUS)).toBe("rule");
  });

  it("detects agent config files", () => {
    expect(detectArtifactType(`${NEXUS}/governance/agents/planner.yaml`, NEXUS)).toBe("config");
  });

  it("detects generic governance docs", () => {
    expect(detectArtifactType(`${NEXUS}/governance/policies/BRANCH.md`, NEXUS)).toBe("doc");
  });

  it("detects generic docs", () => {
    expect(detectArtifactType(`${NEXUS}/docs/README.md`, NEXUS)).toBe("doc");
  });

  it("detects script files", () => {
    expect(detectArtifactType(`${NEXUS}/scripts/close-session.ts`, NEXUS)).toBe("script");
  });

  it("detects telemetry files", () => {
    expect(detectArtifactType(`${NEXUS}/telemetry/log.json`, NEXUS)).toBe("telemetry");
  });

  it("detects report files", () => {
    expect(detectArtifactType(`${NEXUS}/reports/weekly.md`, NEXUS)).toBe("report");
  });

  it("detects feedback files", () => {
    expect(detectArtifactType(`${NEXUS}/feedback/2026-07-08.md`, NEXUS)).toBe("feedback");
  });

  it("detects session-feedback files", () => {
    expect(detectArtifactType(`${NEXUS}/session-feedback/notes.md`, NEXUS)).toBe("feedback");
  });

  it("detects core config files", () => {
    expect(detectArtifactType(`${NEXUS}/core/complexity/types.ts`, NEXUS)).toBe("config");
  });

  it("detects cognition docs", () => {
    expect(detectArtifactType(`${NEXUS}/cognition/context/HIERARCHY.md`, NEXUS)).toBe("doc");
  });

  it("detects JSON files as config", () => {
    expect(detectArtifactType(`${NEXUS}/some/path.json`, NEXUS)).toBe("config");
  });

  it("detects YAML files as config", () => {
    expect(detectArtifactType(`${NEXUS}/some/path.yaml`, NEXUS)).toBe("config");
  });

  it("detects .md files as doc", () => {
    expect(detectArtifactType(`${NEXUS}/some/file.md`, NEXUS)).toBe("doc");
  });

  it("detects .ts files as script", () => {
    expect(detectArtifactType(`${NEXUS}/some/file.ts`, NEXUS)).toBe("script");
  });

  it("returns unknown for unrecognized files", () => {
    expect(detectArtifactType(`${NEXUS}/some/file.xyz`, NEXUS)).toBe("unknown");
  });
});

// ── detectDirectoryScore ───────────────────────────────────────────────────

describe("detectDirectoryScore", () => {
  it("returns 1.0 for docs/skills/", () => {
    expect(detectDirectoryScore(`${NEXUS}/docs/skills/tdd.md`, NEXUS)).toBe(1.0);
  });

  it("returns 0.9 for docs/adrs/", () => {
    expect(detectDirectoryScore(`${NEXUS}/docs/adrs/ADR-001.md`, NEXUS)).toBe(0.9);
  });

  it("returns 0.9 for governance/agents/", () => {
    expect(detectDirectoryScore(`${NEXUS}/governance/agents/planner.yaml`, NEXUS)).toBe(0.9);
  });

  it("returns 1.0 for governance/WORKFLOW", () => {
    expect(detectDirectoryScore(`${NEXUS}/governance/WORKFLOW.md`, NEXUS)).toBe(1.0);
  });

  it("returns 0.7 for governance/rules/", () => {
    expect(detectDirectoryScore(`${NEXUS}/governance/rules/RULE-001.json`, NEXUS)).toBe(0.7);
  });

  it("returns 0.0 for telemetry/", () => {
    expect(detectDirectoryScore(`${NEXUS}/telemetry/log.json`, NEXUS)).toBe(0.0);
  });

  it("returns 0.0 for reports/", () => {
    expect(detectDirectoryScore(`${NEXUS}/reports/weekly.md`, NEXUS)).toBe(0.0);
  });

  it("returns 0.1 for unmatched paths", () => {
    expect(detectDirectoryScore(`${NEXUS}/unknown/file.txt`, NEXUS)).toBe(0.1);
  });

  it("scores files inside docs/generated/ as zero significance (BUG-002)", () => {
    expect(detectDirectoryScore(`${NEXUS}/docs/generated/ARCHITECTURE.md`, NEXUS)).toBe(0.0);
  });

  it("docs/generated/ takes priority over the generic docs/ prefix", () => {
    const generatedScore = detectDirectoryScore(`${NEXUS}/docs/generated/ANYTHING.md`, NEXUS);
    const genericDocsScore = detectDirectoryScore(`${NEXUS}/docs/some-other-file.md`, NEXUS);
    expect(generatedScore).toBeLessThan(genericDocsScore);
  });

  it("matches longest prefix first", () => {
    expect(detectDirectoryScore(`${NEXUS}/governance/context/state.yaml`, NEXUS)).toBe(0.6);
  });
});

// ── calculateFrequencyScore ────────────────────────────────────────────────

describe("calculateFrequencyScore", () => {
  it("returns 0.2 for expired window", () => {
    const history: ChangeFrequency = {
      count: 10,
      windowStart: Date.now() - 120_000,
      lastChange: Date.now() - 120_000,
    };
    expect(calculateFrequencyScore(history)).toBe(0.2);
  });

  it("returns 0.2 for single change in window", () => {
    const history: ChangeFrequency = {
      count: 1,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(0.2);
  });

  it("returns 0.5 for 2-5 changes", () => {
    const history: ChangeFrequency = {
      count: 3,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(0.5);
  });

  it("returns 0.8 for 6-10 changes", () => {
    const history: ChangeFrequency = {
      count: 8,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(0.8);
  });

  it("returns 1.0 for 11+ changes", () => {
    const history: ChangeFrequency = {
      count: 15,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(1.0);
  });
});

// ── calculateSizeScore ─────────────────────────────────────────────────────

describe("calculateSizeScore", () => {
  it("returns 0.5 for small new file (<20 lines)", () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(null, content)).toBe(0.5);
  });

  it("returns 0.8 for medium new file (20-99 lines)", () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(null, content)).toBe(0.8);
  });

  it("returns 1.0 for large new file (100+ lines)", () => {
    const content = Array.from({ length: 150 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(null, content)).toBe(1.0);
  });

  it("returns 0.2 for small change (<5 lines diff)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 53 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(0.2);
  });

  it("returns 0.5 for medium change (5-19 lines diff)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 65 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(0.5);
  });

  it("returns 0.8 for large change (20-99 lines diff)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(0.8);
  });

  it("returns 1.0 for massive change (100+ lines diff)", () => {
    const old = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(1.0);
  });
});

// ── calculateSignificance ──────────────────────────────────────────────────

describe("calculateSignificance", () => {
  it("returns high significance for skill file with frequent changes", () => {
    const highFreq: ChangeFrequency = { count: 12, windowStart: Date.now(), lastChange: Date.now() };
    const result = calculateSignificance(
      `${NEXUS}/docs/skills/tdd.md`, NEXUS, null,
      Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n"),
      highFreq
    );
    expect(result.level).toBe("high");
    expect(result.shouldSync).toBe(true);
    expect(result.outputLevel).toBe("verbose");
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("returns ignore for telemetry file with no changes", () => {
    const result = calculateSignificance(
      `${NEXUS}/telemetry/log.json`, NEXUS, "old", "old",
      { count: 1, windowStart: Date.now() - 120_000, lastChange: Date.now() - 120_000 }
    );
    expect(result.level).toBe("ignore");
    expect(result.shouldSync).toBe(false);
    expect(result.outputLevel).toBe("silent");
  });

  it("returns low/medium for moderate changes", () => {
    const result = calculateSignificance(
      `${NEXUS}/docs/README.md`, NEXUS, "old\n".repeat(10), "new\n".repeat(15),
      { count: 3, windowStart: Date.now(), lastChange: Date.now() }
    );
    expect(["low", "medium"]).toContain(result.level);
    expect(result.shouldSync).toBe(true);
  });

  it("populates reasons array for significant factors", () => {
    const highFreq: ChangeFrequency = { count: 8, windowStart: Date.now(), lastChange: Date.now() };
    const result = calculateSignificance(
      `${NEXUS}/docs/skills/test.md`, NEXUS, null,
      Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n"),
      highFreq
    );
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("score is between 0 and 1", () => {
    const result = calculateSignificance(
      `${NEXUS}/governance/rules/RULE-001.json`, NEXUS, "a\n".repeat(5), "b\n".repeat(25),
      { count: 6, windowStart: Date.now(), lastChange: Date.now() }
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("does not trigger sync for files inside docs/generated/ (BUG-002, full pipeline)", () => {
    const tracker = new ChangeHistoryTracker();
    const filePath = `${NEXUS}/docs/generated/ARCHITECTURE.md`;

    const result = calculateSignificance(
      filePath,
      NEXUS,
      null,
      "# Conteúdo gerado\n".repeat(50),
      tracker.recordChange(filePath)
    );

    expect(result.shouldSync).toBe(false);
    expect(result.level).toBe("ignore");
  });
});

// ── ChangeHistoryTracker ───────────────────────────────────────────────────

describe("ChangeHistoryTracker", () => {
  let tracker: ChangeHistoryTracker;

  beforeEach(() => {
    tracker = new ChangeHistoryTracker();
  });

  it("records first change with count 1", () => {
    const freq = tracker.recordChange("file.md");
    expect(freq.count).toBe(1);
  });

  it("increments count for same file in same window", () => {
    tracker.recordChange("file.md");
    tracker.recordChange("file.md");
    tracker.recordChange("file.md");
    const freq = tracker.getFrequency("file.md");
    expect(freq.count).toBe(3);
  });

  it("returns default frequency for unknown file", () => {
    const freq = tracker.getFrequency("unknown.md");
    expect(freq.count).toBe(0);
  });

  it("clears all history", () => {
    tracker.recordChange("file.md");
    tracker.clear();
    const freq = tracker.getFrequency("file.md");
    expect(freq.count).toBe(0);
  });

  it("tracks different files independently", () => {
    tracker.recordChange("a.md");
    tracker.recordChange("a.md");
    tracker.recordChange("b.md");
    expect(tracker.getFrequency("a.md").count).toBe(2);
    expect(tracker.getFrequency("b.md").count).toBe(1);
  });
});
