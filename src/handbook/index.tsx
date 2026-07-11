/**
 * index.tsx — Interactive Handbook TUI
 *
 * Main entry point for the interactive handbook.
 * Uses Ink (React for terminals) with mouse and keyboard support.
 *
 * Usage:
 *   nexus handbook          # Interactive mode
 *   nexus handbook --print  # Print mode (non-interactive)
 */

import { useState } from "react";
import { Box, useInput, useApp } from "ink";
import { MouseProvider } from "@ink-tools/ink-mouse";
import { useHandbookNav } from "./hooks/use-handbook-nav.js";
import { Sidebar } from "./components/sidebar.js";
import { Content } from "./components/content.js";
import { Footer } from "./components/footer.js";

function HandbookInner() {
  const { exit } = useApp();
  const nav = useHandbookNav();
  const [contentScrollOffset, setContentScrollOffset] = useState(0);

  // ── Keyboard Navigation ────────────────────────────────────────────────

  useInput((input, key) => {
    // Quit
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }

    // Tree mode navigation
    if (nav.viewMode === "tree") {
      // Move up/down
      if (key.upArrow) {
        nav.moveUp();
        return;
      }
      if (key.downArrow) {
        nav.moveDown();
        return;
      }

      // Select/expand
      if (key.return) {
        nav.selectCurrent();
        setContentScrollOffset(0);
        return;
      }

      // Space to expand level
      if (input === " ") {
        nav.selectCurrent();
        setContentScrollOffset(0);
        return;
      }

      // Number keys for level jump
      if (input === "1") {
        nav.jumpToLevel(1);
        return;
      }
      if (input === "2") {
        nav.jumpToLevel(2);
        return;
      }
      if (input === "3") {
        nav.jumpToLevel(3);
        return;
      }
    }

    // Content mode navigation
    if (nav.viewMode === "content") {
      // Scroll up/down
      if (key.upArrow) {
        setContentScrollOffset((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setContentScrollOffset((prev) => prev + 1);
        return;
      }

      // Go back
      if (key.escape) {
        nav.goBack();
        setContentScrollOffset(0);
        return;
      }

      // Backspace also goes back
      if (key.backspace) {
        nav.goBack();
        setContentScrollOffset(0);
        return;
      }
    }
  });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" height="100%">
      <Box flexDirection="row" flexGrow={1}>
        <Sidebar
          items={nav.navItems}
          selectedIndex={nav.selectedIndex}
          onSelect={(index) => {
            nav.selectAt(index);
            setContentScrollOffset(0);
          }}
        />
        <Content
          topic={nav.selectedTopic}
          content={nav.content}
          scrollOffset={contentScrollOffset}
        />
      </Box>
      <Footer viewMode={nav.viewMode} />
    </Box>
  );
}

export function HandbookApp() {
  return (
    <MouseProvider autoEnable={true} cacheInvalidationMs={0}>
      <HandbookInner />
    </MouseProvider>
  );
}
