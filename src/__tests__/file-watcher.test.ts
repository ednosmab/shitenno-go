import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("chokidar", () => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    watch: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
        return { on: (..._a: any[]) => ({ close: vi.fn() }) };
      }),
      close: vi.fn(),
      __handlers: handlers,
    }),
  };
});

vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue("# test content"),
}));

vi.mock("../event-bus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    publish: vi.fn(),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  }),
}));

vi.mock("../doc-sync-significance.js", () => {
  const mockRecord = vi.fn().mockReturnValue(3);
  return {
    calculateSignificance: vi.fn().mockReturnValue({
      score: 0.8,
      level: "high",
      shouldSync: true,
      outputLevel: "verbose",
      reasons: ["high-churn"],
    }),
    ChangeHistoryTracker: vi.fn(function () {
      return { recordChange: mockRecord };
    }),
  };
});

vi.mock("../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── startWatching ──────────────────────────────────────────────────────────

describe("startWatching", () => {
  it("returns a stop function", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const stop = startWatching("/nexus");
    expect(typeof stop).toBe("function");
    stop();
  });

  it("publishes asset.created on file add", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    const stop = startWatching("/nexus");
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    // Get the chokidar watcher and trigger 'add'
    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const addHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "add")?.[1];

    if (addHandler) {
      addHandler("/nexus/docs/adrs/ADR-001.md");
    }

    expect(bus?.publish).toHaveBeenCalledWith(
      "asset.created",
      expect.objectContaining({ assetType: "adr" })
    );
    stop();
  });

  it("publishes adr.created for ADR files", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    const stop = startWatching("/nexus");
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const addHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "add")?.[1];

    if (addHandler) {
      addHandler("/nexus/docs/adrs/ADR-001.md");
    }

    expect(bus?.publish).toHaveBeenCalledWith(
      "adr.created",
      expect.objectContaining({ adrId: "ADR-001" })
    );
    stop();
  });

  it("publishes skill.created for skill files", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    const stop = startWatching("/nexus");
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const addHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "add")?.[1];

    if (addHandler) {
      addHandler("/nexus/docs/skills/my-skill.md");
    }

    expect(bus?.publish).toHaveBeenCalledWith(
      "skill.created",
      expect.objectContaining({ skillId: "my-skill" })
    );
    stop();
  });

  it("publishes asset.updated on file change", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/governance/rules/RULE-001.json");
    }

    vi.advanceTimersByTime(150);

    expect(bus?.publish).toHaveBeenCalledWith(
      "asset.updated",
      expect.objectContaining({ assetType: "rule" })
    );
    vi.useRealTimers();
    stop();
  });

  it("publishes rule.triggered for rule file changes", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/governance/rules/RULE-001.json");
    }

    vi.advanceTimersByTime(150);

    expect(bus?.publish).toHaveBeenCalledWith(
      "rule.triggered",
      expect.objectContaining({ ruleId: "RULE-001" })
    );
    vi.useRealTimers();
    stop();
  });

  it("publishes engineering_state.updated for workflow changes", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/governance/WORKFLOW.md");
    }

    vi.advanceTimersByTime(150);

    expect(bus?.publish).toHaveBeenCalledWith(
      "engineering_state.updated",
      expect.objectContaining({ dimension: "governance" })
    );
    vi.useRealTimers();
    stop();
  });

  it("publishes engineering_state.updated for config changes", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/config.json");
    }

    vi.advanceTimersByTime(150);

    expect(bus?.publish).toHaveBeenCalledWith(
      "engineering_state.updated",
      expect.objectContaining({ dimension: "configuration" })
    );
    vi.useRealTimers();
    stop();
  });

  it("publishes docs.sync.triggered when significance.shouldSync is true", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/docs/README.md");
    }

    vi.advanceTimersByTime(150);

    expect(bus?.publish).toHaveBeenCalledWith(
      "docs.sync.triggered",
      expect.objectContaining({ significance: 0.8, level: "high" })
    );
    vi.useRealTimers();
    stop();
  });

  it("does not publish docs.sync.triggered when enableDocSync is false", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100, enableDocSync: false });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/docs/README.md");
    }

    vi.advanceTimersByTime(150);

    const docSyncCalls = vi.mocked(bus?.publish).mock.calls.filter(
      (c: any) => c[0] === "docs.sync.triggered"
    );
    expect(docSyncCalls).toHaveLength(0);
    vi.useRealTimers();
    stop();
  });

  it("debounces rapid changes to the same file", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 200 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/docs/same.md");
      vi.advanceTimersByTime(100);
      changeHandler("/nexus/docs/same.md");
      vi.advanceTimersByTime(100);
      changeHandler("/nexus/docs/same.md");
      vi.advanceTimersByTime(250);
    }

    const assetUpdates = vi.mocked(bus?.publish).mock.calls.filter(
      (c: any) => c[0] === "asset.updated"
    );
    expect(assetUpdates).toHaveLength(1);
    vi.useRealTimers();
    stop();
  });

  it("does not re-trigger docs.sync.triggered when syncing writes to docs/generated/", async () => {
    // Override the mock for calculateSignificance to return 0.0 for this test
    const { calculateSignificance } = await import("../doc-sync-significance.js");
    vi.mocked(calculateSignificance).mockReturnValueOnce({
      score: 0.0,
      level: "ignore",
      shouldSync: false,
      outputLevel: "silent",
      reasons: ["directory:docs/generated/(0.0)"],
    });

    const { startWatching } = await import("../file-watcher.js");
    const { getEventBus } = await import("../event-bus.js");

    vi.useFakeTimers();
    const stop = startWatching("/nexus", { debounceMs: 100 });
    const bus = vi.mocked(getEventBus).mock.results[0]?.value;

    const { watch } = await import("chokidar");
    const watcher = vi.mocked(watch).mock.results[0]?.value;
    const changeHandler = (watcher as any)?.on?.mock?.calls?.find?.((c: any) => c[0] === "change")?.[1];

    if (changeHandler) {
      changeHandler("/nexus/docs/generated/ARCHITECTURE.md");
    }

    vi.advanceTimersByTime(150);

    const docSyncCalls = vi.mocked(bus?.publish).mock.calls.filter(
      (c: any) => c[0] === "docs.sync.triggered"
    );
    expect(docSyncCalls).toHaveLength(0); // Zero calls because it's ignored
    vi.useRealTimers();
    stop();
  });

  it("includes extraPaths in watch list", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const { watch } = await import("chokidar");

    const stop = startWatching("/nexus", { extraPaths: ["/extra/**/*.ts"] });
    const watchCall = vi.mocked(watch).mock.calls[0];
    expect(watchCall![0]).toContain("/extra/**/*.ts");
    stop();
  });
});

// ── stopWatching ───────────────────────────────────────────────────────────

describe("stopWatching", () => {
  it("can be called without active watcher", async () => {
    const { stopWatching } = await import("../file-watcher.js");
    expect(() => stopWatching()).not.toThrow();
  });
});

// ── WatcherOptions type ────────────────────────────────────────────────────

describe("WatcherOptions type", () => {
  it("accepts valid options", async () => {
    const { startWatching } = await import("../file-watcher.js");
    const stop = startWatching("/nexus", {
      debounceMs: 300,
      extraPaths: ["/extra"],
      enableDocSync: false,
    });
    expect(typeof stop).toBe("function");
    stop();
  });
});
