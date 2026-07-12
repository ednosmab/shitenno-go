/**
 * index.tsx — Interactive Handbook TUI
 *
 * Main entry point for the interactive handbook.
 * Uses Ink (React for terminals) with mouse and keyboard support.
 * Mouse handling via useInput — Ink passes mouse bytes through as input
 * because they don't match any key patterns.
 *
 * Based on: https://github.com/htlin222/mcq-tui/wiki/Mouse-Support-in-Ink
 *
 * Usage:
 *   nexus handbook          # Interactive mode
 *   nexus handbook --print  # Print mode (non-interactive)
 */

import { useState, useEffect } from "react";
import { appendFileSync } from "node:fs";
import { Box, useInput, useApp } from "ink";
import { useHandbookNav } from "./hooks/use-handbook-nav.js";
import { Sidebar } from "./components/sidebar.js";
import { Content } from "./components/content.js";
import { Footer } from "./components/footer.js";

const DEBUG = "/tmp/handbook-mouse-debug.log";
function dbg(msg: string) {
  appendFileSync(DEBUG, `[${new Date().toISOString()}] ${msg}\n`);
}

// SGR mouse regex — ESC optional because Ink strips it
const SGR_MOUSE = /\x1b?\[<(\d+);(\d+);(\d+)([Mm])/;

function HandbookInner() {
  const { exit } = useApp();
  const nav = useHandbookNav();
  const [contentScrollOffset, setContentScrollOffset] = useState(0);

  // ── Enable mouse tracking (clicks only, no motion) ────────────────────
  useEffect(() => {
    dbg("Enabling mouse: ?1000h ?1006h");
    process.stdout.write("\x1B[?1000h\x1B[?1006h");
    return () => {
      dbg("Disabling mouse: ?1006l ?1000l");
      process.stdout.write("\x1B[?1006l\x1B[?1000l");
    };
  }, []);

  // ── Keyboard + Mouse via useInput ─────────────────────────────────────
  useInput((input, key) => {
    // Log ALL input for debugging
    const hex = Buffer.from(input).toString("hex");
    const printable = input.length === 1 && input >= " " && input <= "~";
    dbg(`INPUT len=${input.length} hex=${hex} printable=${printable} key=${JSON.stringify({ up: key.upArrow, down: key.downArrow, ret: key.return, esc: key.escape })}`);

    // Quit
    if (input === "q" || (key.ctrl && input === "c")) {
      process.stdout.write("\x1B[?1006l\x1B[?1000l");
      exit();
      return;
    }

    // ── Mouse click (SGR format) ──────────────────────────────────────
    const mouseMatch = SGR_MOUSE.exec(input);
    if (mouseMatch) {
      const [, btn, , row, action] = mouseMatch;
      const btnNum = Number(btn);

      // Scroll wheel (64=up, 65=down) — only on press
      if (btnNum >= 64 && btnNum <= 65 && action === "M") {
        const direction = btnNum === 64 ? -1 : 1;
        if (nav.viewMode === "content") {
          setContentScrollOffset((p) => Math.max(0, p + direction));
        } else {
          if (direction < 0) nav.moveUp();
          else nav.moveDown();
        }
        return;
      }

      // Left click
      if (btnNum === 0 && action === "M") {
        const HEADER_LINES = 2;
        const rowIndex = Number(row) - HEADER_LINES - 1;
        dbg(`CLICK: row=${row} rowIndex=${rowIndex} totalItems=${nav.totalItems}`);
        if (rowIndex >= 0 && rowIndex < nav.totalItems) {
          nav.selectAt(rowIndex);
          setContentScrollOffset(0);
        }
      }
      return;
    }

    // ── Tree mode keyboard navigation ─────────────────────────────────
    if (nav.viewMode === "tree") {
      if (key.upArrow) { nav.moveUp(); return; }
      if (key.downArrow) { nav.moveDown(); return; }
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
    if (nav.viewMode === "content") {
      if (key.upArrow) { setContentScrollOffset((p) => Math.max(0, p - 1)); return; }
      if (key.downArrow) { setContentScrollOffset((p) => p + 1); return; }
      if (key.escape || key.backspace) {
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
  return <HandbookInner />;
}
