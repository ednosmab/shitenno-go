import { describe, it, expect, vi } from "vitest";
import {
  healthBar,
  miniBar,
  outputJson,
  statusIcon,
} from "../formatting.js";

// ── healthBar ────────────────────────────────────────────────────────────────

describe("healthBar", () => {
  it("renders a full bar at 100%", () => {
    const bar = healthBar(20, 20);
    expect(bar).toContain("█");
    expect(bar).toContain("100%");
  });

  it("renders an empty bar at 0%", () => {
    const bar = healthBar(0, 20);
    expect(bar).toContain("░");
    expect(bar).toContain("0%");
  });

  it("renders a half bar at 50%", () => {
    const bar = healthBar(10, 20);
    expect(bar).toContain("50%");
    expect(bar).toContain("█");
    expect(bar).toContain("░");
  });

  it("clamps to 100% when score exceeds max", () => {
    const bar = healthBar(50, 20);
    expect(bar).toContain("100%");
  });

  it("handles negative score gracefully", () => {
    const bar = healthBar(-5, 20);
    expect(bar).toContain("0%");
  });

  it("uses default max=100 when not specified", () => {
    const bar = healthBar(80);
    expect(bar).toContain("80%");
  });

  it("uses custom width", () => {
    const bar = healthBar(50, 100, 10);
    expect(bar).toContain("50%");
  });
});

// ── miniBar ──────────────────────────────────────────────────────────────────

describe("miniBar", () => {
  it("renders full bar at score 10", () => {
    const bar = miniBar(10, 10);
    expect(bar).toContain("█");
  });

  it("renders empty bar at score 0", () => {
    const bar = miniBar(0, 10);
    expect(bar).toContain("░");
  });

  it("renders mixed bar at score 5", () => {
    const bar = miniBar(5, 10);
    expect(bar).toContain("█");
    expect(bar).toContain("░");
  });

  it("clamps at max", () => {
    const bar = miniBar(15, 10);
    expect(bar).toContain("█");
  });

  it("handles negative score", () => {
    const bar = miniBar(-3, 10);
    expect(bar).toContain("░");
  });

  it("default max is 10", () => {
    const bar = miniBar(5);
    expect(bar).toContain("█");
    expect(bar).toContain("░");
  });
});

// ── outputJson ───────────────────────────────────────────────────────────────

describe("outputJson", () => {
  it("outputs valid JSON to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputJson({ key: "value", num: 42 });
    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output).toEqual({ key: "value", num: 42 });
    spy.mockRestore();
  });

  it("outputs nested objects", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputJson({ arr: [1, 2], nested: { a: true } });
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output.arr).toEqual([1, 2]);
    expect(output.nested.a).toBe(true);
    spy.mockRestore();
  });
});

// ── statusIcon ───────────────────────────────────────────────────────────────

describe("statusIcon", () => {
  it("returns ✔ for pass", () => {
    const { icon } = statusIcon("pass");
    expect(icon).toBe("✔");
  });

  it("returns ⚠ for warn", () => {
    const { icon } = statusIcon("warn");
    expect(icon).toBe("⚠");
  });

  it("returns ✘ for fail", () => {
    const { icon } = statusIcon("fail");
    expect(icon).toBe("✘");
  });

  it("returns a function (chalk color) for each status", () => {
    expect(typeof statusIcon("pass").color).toBe("function");
    expect(typeof statusIcon("warn").color).toBe("function");
    expect(typeof statusIcon("fail").color).toBe("function");
  });
});
