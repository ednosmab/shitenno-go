/**
 * commands/daemon.ts — nexus daemon <start|stop|status|restart>
 *
 * Manages the Nexus background daemon lifecycle.
 *
 * PRINCIPLE: The daemon is opt-in. These commands give full control.
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized } from "../shared.js";
import { isDaemonRunning, startDaemon, stopDaemon, pingDaemon, shouldSkipDaemon, getSocketPath, getDaemonPid, isDaemonApproved } from "../daemon-client.js";
import { DaemonCircuitBreaker } from "../daemon-circuit-breaker.js";
import { output, outputBlank } from "../output.js";

export function daemonCommand(): Command {
  const cmd = new Command("daemon")
    .description("Manage the Nexus background daemon")
    .addHelpText("after", `
Examples:
  nexus daemon start     Start the daemon in the background
  nexus daemon stop      Stop the daemon gracefully
  nexus daemon status    Show daemon status and uptime
  nexus daemon restart   Restart the daemon
`);

  // ── start ──────────────────────────────────────────────────────────────────

  cmd.command("start")
    .description("Start the Nexus daemon in the background")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (shouldSkipDaemon()) {
        output(chalk.yellow("  ⚠  Daemon is disabled (NEXUS_NO_DAEMON=1 or CI=true)"));
        return;
      }

      const breaker = new DaemonCircuitBreaker(ctx.nexusDir);
      if (breaker.isTripped()) {
        const state = breaker.getState();
        output(chalk.red("  ✗ Circuit breaker is tripped — too many crashes"));
        output(chalk.gray(`    Last crash: ${state.lastCrashAt}`));
        output(chalk.gray("    Run 'nexus daemon status' for details."));
        output(chalk.dim("    To force-reset: delete nexus-system/daemon/circuit-breaker.json"));
        process.exitCode = 1;
        return;
      }

      if (isDaemonRunning(ctx.nexusDir)) {
        output(chalk.yellow("  ℹ  Daemon is already running"));
        return;
      }

      output(chalk.gray("  Starting daemon..."));
      try {
        await startDaemon(ctx.nexusDir);
        output(chalk.green("  ✓ Daemon started"));
        output(chalk.gray(`    Socket: ${getSocketPath(ctx.nexusDir)}`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        output(chalk.red(`  ✗ Failed to start daemon: ${msg}`));
        breaker.record();
        process.exitCode = 1;
      }
    });

  // ── stop ───────────────────────────────────────────────────────────────────

  cmd.command("stop")
    .description("Stop the Nexus daemon")
    .action((opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (!isDaemonRunning(ctx.nexusDir)) {
        output(chalk.yellow("  ℹ  Daemon is not running"));
        return;
      }

      const stopped = stopDaemon(ctx.nexusDir);
      if (stopped) {
        output(chalk.green("  ✓ Daemon stopped"));
      } else {
        output(chalk.red("  ✗ Failed to stop daemon"));
        process.exitCode = 1;
      }
    });

  // ── status ─────────────────────────────────────────────────────────────────

  cmd.command("status")
    .description("Show daemon status")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      outputBlank();
      output(chalk.bold.cyan("  🔧 Nexus Daemon Status"));
      outputBlank();

      const running = isDaemonRunning(ctx.nexusDir);
      const breaker = new DaemonCircuitBreaker(ctx.nexusDir);
      const breakerState = breaker.getState();

      output(`  Running:    ${running ? chalk.green("yes") : chalk.red("no")}`);

      if (running) {
        // Try to get detailed info via ping
        const alive = await pingDaemon(ctx.nexusDir);
        output(`  Responsive: ${alive ? chalk.green("yes") : chalk.yellow("no (socket not responding)")}`);

        // Show PID
        const pid = getDaemonPid(ctx.nexusDir);
        if (pid) {
          output(`  PID:        ${chalk.bold(pid)}`);
        }
      }

      outputBlank();
      output(chalk.bold("  Circuit Breaker:"));
      output(`    Tripped:   ${breakerState.tripped ? chalk.red("yes") : chalk.green("no")}`);
      output(`    Crashes:   ${breakerState.crashCount}`);
      if (breakerState.lastCrashAt) {
        output(`    Last crash: ${chalk.gray(breakerState.lastCrashAt)}`);
      }

      outputBlank();
      output(chalk.bold("  Environment:"));
      output(`    Skip daemon: ${shouldSkipDaemon() ? chalk.yellow("yes (env override)") : chalk.green("no")}`);
      output(`    Approved:    ${isDaemonApproved(ctx.nexusDir) ? chalk.green("yes") : chalk.gray("no (run 'nexus daemon start' once to approve)")}`);
      outputBlank();
    });

  // ── restart ────────────────────────────────────────────────────────────────

  cmd.command("restart")
    .description("Restart the Nexus daemon")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (isDaemonRunning(ctx.nexusDir)) {
        output(chalk.gray("  Stopping daemon..."));
        stopDaemon(ctx.nexusDir);
        // Brief pause to allow cleanup
        await new Promise<void>((r) => setTimeout(r, 1_000));
      }

      const breaker = new DaemonCircuitBreaker(ctx.nexusDir);
      if (breaker.isTripped()) {
        output(chalk.red("  ✗ Circuit breaker is tripped — cannot restart"));
        process.exitCode = 1;
        return;
      }

      output(chalk.gray("  Starting daemon..."));
      try {
        await startDaemon(ctx.nexusDir);
        output(chalk.green("  ✓ Daemon restarted"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        output(chalk.red(`  ✗ Failed to restart daemon: ${msg}`));
        breaker.record();
        process.exitCode = 1;
      }
    });

  return cmd;
}
