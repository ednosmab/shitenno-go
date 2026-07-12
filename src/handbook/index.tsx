/**
 * index.tsx — Interactive Handbook TUI
 *
 * Two-panel layout with independent scroll contexts:
 * - Sidebar (left, 40%): tree navigation with its own scroll
 * - Content (right, 60%): markdown content with its own scroll
 *
 * Keyboard-only navigation (no mouse support):
 * - Tree mode: ↑↓ navigate, Enter/Space select, 1/2/3 jump to level
 * - Content mode: ↑↓ navigate sidebar, Enter select topic, Esc go back
 *
 * Usage:
 *   nexus handbook          # Interactive mode
 *   nexus handbook --print  # Print mode (non-interactive)
 */

import { useState } from "react";
import { Box, useInput, useApp, useWindowSize } from "ink";
import { useHandbookNav } from "./hooks/use-handbook-nav.js";
import { Sidebar } from "./components/sidebar.js";
import { Content } from "./components/content.js";
import { Footer } from "./components/footer.js";

// Reserved lines: footer (1 line border + 1 line content)
const FOOTER_LINES = 2;
// Reserved lines: sidebar title (1 line text + 1 line marginBottom)
const SIDEBAR_TITLE_LINES = 2;
// Max scroll indicators shown in sidebar (▲ and/or ▼)
const SIDEBAR_INDICATOR_LINES = 2;
// Content overhead: title(1) + levelName(1) + marginBottom(1) + padding(2) + counter(2)
const CONTENT_OVERHEAD = 7;

function HandbookInner() {
  const { exit } = useApp();
  const nav = useHandbookNav();
  const [contentScrollOffset, setContentScrollOffset] = useState(0);
  const { rows: terminalHeight } = useWindowSize();

  // Sidebar viewport: total minus footer, title, and scroll indicators (clamped ≥3)
  const sidebarMaxVisible = Math.max(3, terminalHeight - FOOTER_LINES - SIDEBAR_TITLE_LINES - SIDEBAR_INDICATOR_LINES);
  // Content viewport: total minus footer and internal content overhead (title, padding, counter)
  const contentViewportHeight = Math.max(3, terminalHeight - FOOTER_LINES - CONTENT_OVERHEAD);

  // ── Keyboard navigation via useInput ─────────────────────────────────
  useInput((input, key) => {
    // Quit
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }

    // ── Tree mode keyboard navigation ─────────────────────────────────
    if (nav.viewMode === "tree") {
      if (key.upArrow) { nav.moveUp(sidebarMaxVisible); return; }
      if (key.downArrow) { nav.moveDown(sidebarMaxVisible); return; }
      if (key.return || input === " ") {
        nav.selectCurrent();
        setContentScrollOffset(0);
        return;
      }
      if (input === "1") { nav.jumpToLevel(1); return; }
      if (input === "2") { nav.jumpToLevel(2); return; }
      if (input === "3") { nav.jumpToLevel(3); return; }
    }

    // ── Content mode keyboard navigation ──────────────────────────────
    // ↑↓ navigate the sidebar, Enter selects topic, Esc goes back
    if (nav.viewMode === "content") {
      if (key.upArrow) { nav.moveUp(sidebarMaxVisible); return; }
      if (key.downArrow) { nav.moveDown(sidebarMaxVisible); return; }
      if (key.return || input === " ") {
        // If selected item is a topic, load it; if level, expand/collapse
        nav.selectCurrent();
        setContentScrollOffset(0);
        return;
      }
      if (key.escape || key.backspace) {
        nav.goBack();
        setContentScrollOffset(0);
        return;
      }
      // Scroll content with PageUp/PageDown or j/k
      if (key.pageUp) { setContentScrollOffset((p) => Math.max(0, p - contentViewportHeight)); return; }
      if (key.pageDown) { setContentScrollOffset((p) => p + contentViewportHeight); return; }
      if (input === "j") { setContentScrollOffset((p) => p + 1); return; }
      if (input === "k") { setContentScrollOffset((p) => Math.max(0, p - 1)); return; }
    }
  });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" height="100%">
      <Box flexDirection="row" flexGrow={1}>
        <Sidebar
          items={nav.navItems}
          selectedIndex={nav.selectedIndex}
          scrollOffset={nav.sidebarScrollOffset}
          maxVisibleItems={sidebarMaxVisible}
        />
        <Content
          topic={nav.selectedTopic}
          content={nav.content}
          scrollOffset={contentScrollOffset}
          maxVisibleLines={contentViewportHeight}
        />
      </Box>
      <Footer viewMode={nav.viewMode} />
    </Box>
  );
}

export function HandbookApp() {
  return <HandbookInner />;
}
