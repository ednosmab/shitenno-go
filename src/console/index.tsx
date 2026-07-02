/**
 * index.tsx — NexusConsole main component
 *
 * Root component that manages tab navigation, keyboard input,
 * mouse events, and screen reader accessibility.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { MouseProvider, useOnWheel } from "@ink-tools/ink-mouse";
import { TabBar } from "./components/tab-bar.js";
import { Footer, DEFAULT_HINTS } from "./components/footer.js";
import { useNavigate } from "./hooks/use-navigate.js";
import { useRefresh } from "./hooks/use-refresh.js";
import { OverviewTab } from "./tabs/overview.js";
import { EngineeringTab } from "./tabs/engineering.js";
import { ArchitectureTab } from "./tabs/architecture.js";
import { KnowledgeTab } from "./tabs/knowledge.js";
import { HealthTab } from "./tabs/health.js";
import { GoalsTab } from "./tabs/goals.js";
import { DecisionsTab } from "./tabs/decisions.js";
import { SessionsTab } from "./tabs/sessions.js";
import { EventsTab } from "./tabs/events.js";
import { LifecycleTab } from "./tabs/lifecycle.js";
import { CommandsTab } from "./tabs/commands.js";
import type { ConsoleData } from "./data-collector.js";

// ── Tab Definitions ────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", shortcut: "1" },
  { id: "engineering", label: "Engineering", shortcut: "2" },
  { id: "architecture", label: "Architecture", shortcut: "3" },
  { id: "knowledge", label: "Knowledge", shortcut: "4" },
  { id: "health", label: "Health", shortcut: "5" },
  { id: "goals", label: "Goals", shortcut: "6" },
  { id: "decisions", label: "Decisions", shortcut: "7" },
  { id: "sessions", label: "Sessions", shortcut: "8" },
  { id: "events", label: "Events", shortcut: "9" },
  { id: "lifecycle", label: "Lifecycle", shortcut: "0" },
  { id: "commands", label: "Commands", shortcut: "c" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface NexusConsoleProps {
  projectRoot: string;
  nexusDir: string;
  refreshInterval?: number;
  isScreenReaderEnabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

// ── Inner Component (inside MouseProvider) ──────────────────────────────────

function NexusConsoleInner({
  projectRoot,
  nexusDir,
  refreshInterval,
  isScreenReaderEnabled,
}: NexusConsoleProps): React.ReactElement {
  const { data, refresh, lastRefresh } = useRefresh(projectRoot, nexusDir, refreshInterval);
  const nav = useNavigate(TABS.length);
  const { isRawModeSupported } = useStdin();
  const contentRef = useRef(null);

  // Mouse wheel scroll
  useOnWheel(contentRef, (event) => {
    if (event.button === "wheel-up") {
      nav.scrollUp();
    } else if (event.button === "wheel-down") {
      nav.scrollDown();
    }
  });

  // Keyboard navigation
  useInput((input, key) => {
    // Quit
    if (input === "q" || (key.ctrl && input === "c")) {
      process.exit(0);
    }

    // Refresh
    if (input === "r") {
      refresh();
      return;
    }

    // Tab navigation (left/right arrows)
    if (key.leftArrow) {
      nav.prevTab();
      return;
    }
    if (key.rightArrow) {
      nav.nextTab();
      return;
    }

    // Tab cycling
    if (key.tab) {
      if (key.shift) {
        nav.prevTab();
      } else {
        nav.nextTab();
      }
      return;
    }

    // Escape — go back or exit
    if (key.escape) {
      if (nav.canGoBack) {
        nav.goBack();
      } else {
        process.exit(0);
      }
      return;
    }

    // Enter — expand/select
    if (key.return) {
      // Expand item based on current tab
      const expandMap: Record<number, string> = {
        5: "goal",
        6: "decision",
        7: "session-metrics",
      };
      const prefix = expandMap[nav.activeTab];
      if (prefix) {
        const itemId = `${prefix}-${nav.scrollOffset}`;
        nav.expandItem(itemId);
      }
      return;
    }

    // Arrow keys for scrolling within a tab
    if (key.upArrow) {
      nav.scrollUp();
      return;
    }
    if (key.downArrow) {
      nav.scrollDown();
      return;
    }

    // Number keys for direct tab access
    if (input >= "0" && input <= "9") {
      const index = input === "0" ? 9 : parseInt(input) - 1;
      if (index < TABS.length) {
        nav.goToTab(index);
      }
      return;
    }

    // 'c' key for commands tab
    if (input === "c" || input === "C") {
      nav.goToTab(10);
      return;
    }
  });

  // Render the active tab
  const renderTab = (): React.ReactElement => {
    switch (nav.activeTab) {
      case 0: return <OverviewTab data={data} scrollOffset={nav.scrollOffset} />;
      case 1: return <EngineeringTab data={data} scrollOffset={nav.scrollOffset} />;
      case 2: return <ArchitectureTab data={data} scrollOffset={nav.scrollOffset} />;
      case 3: return <KnowledgeTab data={data} scrollOffset={nav.scrollOffset} />;
      case 4: return <HealthTab data={data} scrollOffset={nav.scrollOffset} />;
      case 5: return <GoalsTab data={data} scrollOffset={nav.scrollOffset} expandedItem={nav.expandedItem} onExpandItem={nav.expandItem} />;
      case 6: return <DecisionsTab data={data} scrollOffset={nav.scrollOffset} expandedItem={nav.expandedItem} onExpandItem={nav.expandItem} />;
      case 7: return <SessionsTab data={data} scrollOffset={nav.scrollOffset} expandedItem={nav.expandedItem} onExpandItem={nav.expandItem} />;
      case 8: return <EventsTab data={data} scrollOffset={nav.scrollOffset} />;
      case 9: return <LifecycleTab data={data} scrollOffset={nav.scrollOffset} />;
      case 10: return <CommandsTab projectRoot={projectRoot} />;
      default: return <OverviewTab data={data} scrollOffset={nav.scrollOffset} />;
    }
  };

  // Screen reader mode: linearized output
  if (isScreenReaderEnabled) {
    const currentTab = TABS[nav.activeTab];
    const tabLabel = currentTab?.label ?? "Overview";
    return (
      <Box flexDirection="column" aria-label="Nexus Console Dashboard">
        <Box aria-label={`Current tab: ${tabLabel}`}>
          <Text>
            Tab {nav.activeTab + 1} of {TABS.length}: {tabLabel}
          </Text>
        </Box>
        {renderTab()}
        <Box aria-label="Navigation: Use arrow keys to switch tabs. Press q to quit.">
          <Text>
            Navigation: Left/Right arrows to switch tabs. Number keys 1-0 for direct access.
            Press q to quit. Press r to refresh.
          </Text>
        </Box>
      </Box>
    );
  }

  // Normal mode: rich visual output
  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor="cyan"
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text bold color="cyan">NEXUS CONSOLE v0.1.0</Text>
        </Box>
        <Box>
          <Text dimColor>{data.timestamp.slice(0, 16).replace("T", " ")}</Text>
          <Text> │ </Text>
          <Text color="green">{data.lifecycle}</Text>
        </Box>
      </Box>

      {/* Tab Bar */}
      <TabBar
        tabs={TABS}
        activeIndex={nav.activeTab}
        onSelect={nav.goToTab}
        ariaLabel="Navigation tabs"
      />

      {/* Main Content */}
      <Box ref={contentRef} flexGrow={1} padding={1} flexDirection="column">
        {renderTab()}
      </Box>

      {/* Footer */}
      <Footer
        hints={DEFAULT_HINTS}
        mode={refreshInterval && refreshInterval > 0 ? `Live (${refreshInterval / 1000}s)` : undefined}
      />
    </Box>
  );
}

// ── Root Component (with MouseProvider) ─────────────────────────────────────

export function NexusConsole(props: NexusConsoleProps): React.ReactElement {
  return (
    <MouseProvider autoEnable={true}>
      <NexusConsoleInner {...props} />
    </MouseProvider>
  );
}
