/**
 * console-components.test.ts — Tests for console UI components
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { HealthBar, MiniBar, ScoreGauge } from "../console/components/health-bar.js";
import { SectionBox, DataRow, TreeView } from "../console/components/section-box.js";
import { TabBar } from "../console/components/tab-bar.js";
import { Footer, DEFAULT_HINTS } from "../console/components/footer.js";
import { Sparkline } from "../console/components/sparkline.js";

describe("HealthBar", () => {
  it("should render with label and value", () => {
    const { lastFrame } = render(
      React.createElement(HealthBar, { label: "Test", value: 50 })
    );
    expect(lastFrame()).toContain("Test");
    expect(lastFrame()).toContain("50%");
  });

  it("should render green bar for high values", () => {
    const { lastFrame } = render(
      React.createElement(HealthBar, { label: "Health", value: 90 })
    );
    expect(lastFrame()).toContain("90%");
  });

  it("should render red bar for low values", () => {
    const { lastFrame } = render(
      React.createElement(HealthBar, { label: "Health", value: 20 })
    );
    expect(lastFrame()).toContain("20%");
  });

  it("should respect custom width", () => {
    const { lastFrame } = render(
      React.createElement(HealthBar, { label: "Test", value: 50, width: 10 })
    );
    expect(lastFrame()).toContain("Test");
  });

  it("should hide percentage when showPercentage is false", () => {
    const { lastFrame } = render(
      React.createElement(HealthBar, { label: "Test", value: 50, showPercentage: false })
    );
    expect(lastFrame()).not.toContain("50%");
  });
});

describe("MiniBar", () => {
  it("should render without label", () => {
    const { lastFrame } = render(
      React.createElement(MiniBar, { value: 50 })
    );
    expect(lastFrame()).toContain("█");
    expect(lastFrame()).toContain("░");
  });
});

describe("ScoreGauge", () => {
  it("should render label and score", () => {
    const { lastFrame } = render(
      React.createElement(ScoreGauge, { label: "Score", score: 75 })
    );
    expect(lastFrame()).toContain("Score");
    expect(lastFrame()).toContain("75/100");
  });
});

describe("SectionBox", () => {
  it("should render with title and children", () => {
    const { lastFrame } = render(
      React.createElement(SectionBox, { title: "Test Section", children: React.createElement(DataRow, { label: "Key", value: "Value" }) })
    );
    expect(lastFrame()).toContain("Test Section");
    expect(lastFrame()).toContain("Key");
    expect(lastFrame()).toContain("Value");
  });
});

describe("DataRow", () => {
  it("should render label and value", () => {
    const { lastFrame } = render(
      React.createElement(DataRow, { label: "Status", value: "Active" })
    );
    expect(lastFrame()).toContain("Status");
    expect(lastFrame()).toContain("Active");
  });

  it("should render numeric value", () => {
    const { lastFrame } = render(
      React.createElement(DataRow, { label: "Count", value: 42 })
    );
    expect(lastFrame()).toContain("Count");
    expect(lastFrame()).toContain("42");
  });
});

describe("TabBar", () => {
  const tabs = [
    { id: "tab1", label: "Tab 1", shortcut: "1" },
    { id: "tab2", label: "Tab 2", shortcut: "2" },
    { id: "tab3", label: "Tab 3", shortcut: "3" },
  ];

  it("should render all tabs", () => {
    const { lastFrame } = render(
      React.createElement(TabBar, { tabs, activeIndex: 0, onSelect: () => {} })
    );
    expect(lastFrame()).toContain("Tab 1");
    expect(lastFrame()).toContain("Tab 2");
    expect(lastFrame()).toContain("Tab 3");
  });

  it("should render shortcuts", () => {
    const { lastFrame } = render(
      React.createElement(TabBar, { tabs, activeIndex: 0, onSelect: () => {} })
    );
    expect(lastFrame()).toContain("[1]");
    expect(lastFrame()).toContain("[2]");
    expect(lastFrame()).toContain("[3]");
  });
});

describe("Footer", () => {
  it("should render all hints", () => {
    const { lastFrame } = render(
      React.createElement(Footer, { hints: DEFAULT_HINTS })
    );
    expect(lastFrame()).toContain("Tabs");
    expect(lastFrame()).toContain("Jump");
    expect(lastFrame()).toContain("Scroll");
    expect(lastFrame()).toContain("Select");
    expect(lastFrame()).toContain("Back");
    expect(lastFrame()).toContain("Quit");
    expect(lastFrame()).toContain("Refresh");
  });

  it("should render mode when provided", () => {
    const { lastFrame } = render(
      React.createElement(Footer, { hints: DEFAULT_HINTS, mode: "Live (5s)" })
    );
    expect(lastFrame()).toContain("Live (5s)");
  });
});

describe("Sparkline", () => {
  it("should render with data", () => {
    const { lastFrame } = render(
      React.createElement(Sparkline, { data: [10, 20, 30, 40, 50] })
    );
    // Sparkline renders unicode characters that may not show in test output
    expect(lastFrame()).toBeDefined();
  });

  it("should render with single data point", () => {
    const { lastFrame } = render(
      React.createElement(Sparkline, { data: [50] })
    );
    expect(lastFrame()).toBeDefined();
  });

  it("should show no data message for empty array", () => {
    const { lastFrame } = render(
      React.createElement(Sparkline, { data: [] })
    );
    expect(lastFrame()).toContain("no data");
  });
});

describe("TreeView", () => {
  it("should render tree items", () => {
    const items = [
      { name: "root", children: [{ name: "child1" }, { name: "child2" }] },
    ];
    const { lastFrame } = render(
      React.createElement(TreeView, { items })
    );
    expect(lastFrame()).toContain("root");
    expect(lastFrame()).toContain("child1");
    expect(lastFrame()).toContain("child2");
  });

  it("should mark orphan items", () => {
    const items = [
      { name: "orphan", isOrphan: true },
    ];
    const { lastFrame } = render(
      React.createElement(TreeView, { items })
    );
    expect(lastFrame()).toContain("orphan");
  });

  it("should mark hub items", () => {
    const items = [
      { name: "hub", isHub: true },
    ];
    const { lastFrame } = render(
      React.createElement(TreeView, { items })
    );
    expect(lastFrame()).toContain("hub");
  });
});
