/**
 * formatting.ts — Shared CLI formatting utilities
 *
 * Health bars, JSON output helpers, and display formatting.
 */

import chalk from "chalk";

/**
 * Render an ASCII health bar for a score.
 *
 * @param score - Value to visualize
 * @param max - Maximum possible value (default: 100)
 * @param width - Bar width in characters (default: 20)
 * @returns Formatted string with bar + percentage
 */
export function healthBar(
  score: number,
  max: number = 100,
  width: number = 20
): string {
  const pct = Math.min(1, Math.max(0, score / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const barColor =
    pct >= 0.8 ? chalk.green : pct >= 0.5 ? chalk.yellow : chalk.red;

  const bar = barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  const pctStr = `${Math.round(pct * 100)}%`;

  return `${bar} ${chalk.bold(pctStr)}`;
}

/**
 * Render a small inline health bar for area scores (0-10 scale).
 */
export function miniBar(score: number, max: number = 10): string {
  const pct = Math.min(1, Math.max(0, score / max));
  const width = 8;
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const barColor =
    pct >= 0.8 ? chalk.red : pct >= 0.5 ? chalk.yellow : chalk.green;

  return barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

/**
 * Output JSON to stdout when --json flag is used.
 */
export function outputJson(data: Record<string, unknown>): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Format a check result icon + color.
 */
export function statusIcon(
  status: "pass" | "warn" | "fail"
): { icon: string; color: typeof chalk.green } {
  switch (status) {
    case "pass":
      return { icon: "✔", color: chalk.green };
    case "warn":
      return { icon: "⚠", color: chalk.yellow };
    case "fail":
      return { icon: "✘", color: chalk.red };
  }
}
