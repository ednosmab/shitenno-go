/**
 * commands/daemon.ts — shiten daemon <start|stop|status|restart>
 *
 * Manages the Shiten background daemon lifecycle.
 *
 * PRINCIPLE: The daemon is opt-in. These commands give full control.
 */

import { Command } from "commander";
import chalk from "chalk";
// eslint-disable-next-line no-restricted-imports -- daemon log viewer needs direct fs access
import { existsSync, statSync, createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import { isDaemonRunning, startDaemon, stopDaemon, shouldSkipDaemon, getSocketPath, isDaemonApproved, queryDaemonStatus } from "../daemon-client.js";
import { DaemonCircuitBreaker } from "../daemon-circuit-breaker.js";
import { output, outputBlank } from "../output.js";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function daemonCommand(): Command {
  const cmd = new Command("daemon")
    .description("Manage the Shiten background daemon")
    .addHelpText("after", `
Exemplos:
  shiten daemon start     Iniciar o daemon em segundo plano
  shiten daemon stop      Parar o daemon graciosamente
  shiten daemon status    Mostrar estado e uptime do daemon
  shiten daemon restart   Reiniciar o daemon

O daemon é um hub de eventos que monitoriza:
  - Arquivo automático de planos concluídos
  - Alertas de drift no working directory
  - Sessões activas e histórico
  - Saúde do projecto e desafios de melhoria
  - Dívida de conhecimento
`);

  // ── start ──────────────────────────────────────────────────────────────────

  cmd.command("start")
    .description("Start the Shiten daemon in the background")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (shouldSkipDaemon()) {
        output(chalk.yellow("  ⚠  Daemon is disabled (SHITEN_NO_DAEMON=1 or CI=true)"));
        return;
      }

      const breaker = new DaemonCircuitBreaker(ctx.shitenDir);
      if (breaker.isTripped()) {
        const state = breaker.getState();
        output(chalk.red("  ✗ Circuit breaker is tripped — too many crashes"));
        output(chalk.gray(`    Last crash: ${state.lastCrashAt}`));
        output(chalk.gray("    Run 'shiten daemon status' for details."));
        output(chalk.dim("    To force-reset: delete shitenno-go/daemon/circuit-breaker.json"));
        process.exitCode = 1;
        return;
      }

      if (isDaemonRunning(ctx.shitenDir)) {
        output(chalk.yellow("  ℹ  Daemon is already running"));
        return;
      }

      output(chalk.gray("  Starting daemon..."));
      try {
        await startDaemon(ctx.shitenDir);
        output(chalk.green("  ✓ Daemon started"));
        output(chalk.gray(`    Socket: ${getSocketPath(ctx.shitenDir)}`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        output(chalk.red(`  ✗ Failed to start daemon: ${msg}`));
        breaker.record();
        process.exitCode = 1;
      }
    });

  // ── stop ───────────────────────────────────────────────────────────────────

  cmd.command("stop")
    .description("Stop the Shiten daemon")
    .action((opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (!isDaemonRunning(ctx.shitenDir)) {
        output(chalk.yellow("  ℹ  Daemon is not running"));
        return;
      }

      const stopped = stopDaemon(ctx.shitenDir);
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
      output(chalk.bold.cyan("  🔧 Shiten Daemon Status"));
      outputBlank();

      const running = isDaemonRunning(ctx.shitenDir);
      const breaker = new DaemonCircuitBreaker(ctx.shitenDir);
      const breakerState = breaker.getState();

      output(`  Running:    ${running ? chalk.green("yes") : chalk.red("no")}`);

      if (running) {
        const status = await queryDaemonStatus(ctx.shitenDir);

        if (status) {
          output(`  PID:        ${chalk.bold(status.pid)}`);
          output(`  Version:    ${status.version}`);
          output(`  Uptime:     ${formatUptime(status.uptimeSeconds)}`);
          output(`  Events:     ${status.eventsRecorded} recorded`);

          outputBlank();
          output(chalk.bold("  Sessions:"));
          output(`    Active:   ${status.activeSessions}`);
          if (status.lastSession) {
            const dur = status.lastSession.duration
              ? `${status.lastSession.duration}min`
              : "em curso";
            output(`    Latest:   ${chalk.gray(`${status.lastSession.id} (${dur})`)}`);
          }

          if (status.drift) {
            outputBlank();
            output(chalk.bold("  Drift:"));
            output(`    Files:    ${chalk.yellow(String(status.drift.filesChanged))} changed`);
            output(`    Time:     ${chalk.yellow(String(status.drift.minutesSinceLastCommit))} min since last commit`);
            output(`    Detected: ${chalk.gray(status.drift.detectedAt)}`);
          }

          if (status.health) {
            outputBlank();
            output(chalk.bold("  Health:"));
            const scoreColor = status.health.score >= 70 ? chalk.green
              : status.health.score >= 40 ? chalk.yellow
              : chalk.red;
            output(`    Score:    ${scoreColor(String(status.health.score))}/100`);
            output(`    Checked:  ${chalk.gray(status.health.checkedAt)}`);
          }

          if (status.challengesQueued > 0) {
            outputBlank();
            output(chalk.bold("  Challenges:"));
            output(`    Queued:   ${chalk.yellow(String(status.challengesQueued))}`);
          }

          if (status.debt) {
            outputBlank();
            output(chalk.bold("  Knowledge Debt:"));
            output(`    Gaps:     ${chalk.yellow(String(status.debt.gapCount))}`);
            const debtColor = status.debt.healthScore >= 70 ? chalk.green
              : status.debt.healthScore >= 40 ? chalk.yellow
              : chalk.red;
            output(`    Health:   ${debtColor(String(status.debt.healthScore))}/100`);
          }
        } else {
          output(chalk.yellow("  ℹ  Daemon is running but did not respond to status query"));
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
      output(`    Approved:    ${isDaemonApproved(ctx.shitenDir) ? chalk.green("yes") : chalk.gray("no (run 'shiten daemon start' once to approve)")}`);
      outputBlank();
    });

  // ── restart ────────────────────────────────────────────────────────────────

  cmd.command("restart")
    .description("Restart the Shiten daemon")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (isDaemonRunning(ctx.shitenDir)) {
        output(chalk.gray("  Stopping daemon..."));
        stopDaemon(ctx.shitenDir);
        // Brief pause to allow cleanup
        await new Promise<void>((r) => setTimeout(r, 1_000));
      }

      const breaker = new DaemonCircuitBreaker(ctx.shitenDir);
      if (breaker.isTripped()) {
        output(chalk.red("  ✗ Circuit breaker is tripped — cannot restart"));
        process.exitCode = 1;
        return;
      }

      output(chalk.gray("  Starting daemon..."));
      try {
        await startDaemon(ctx.shitenDir);
        output(chalk.green("  ✓ Daemon restarted"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        output(chalk.red(`  ✗ Failed to restart daemon: ${msg}`));
        breaker.record();
        process.exitCode = 1;
      }
    });

  // ── shiten daemon logs ────────────────────────────────────────────────────

  cmd.command("logs")
    .description("Attach to the running daemon and stream its log in real time")
    .option("--lines <n>", "Number of historical lines to show before following", "50")
    .action(async (opts: Record<string, unknown>) => {
      const ctx = guardNotInitialized(opts, false);
      if (!ctx) return;

      if (!isDaemonRunning(ctx.shitenDir)) {
        output(chalk.yellow("  ℹ  Daemon is not running — nothing to attach to."));
        output(chalk.gray("     Start it with: shiten daemon start"));
        return;
      }

      const daemonDir = join(ctx.shitenDir, "daemon");
      const logPath = process.env["SHITEN_DAEMON_LOG"] ?? join(daemonDir, "daemon.log");
      if (!existsSync(logPath)) {
        output(chalk.yellow(`  ℹ  Log file not found yet at ${logPath}`));
        return;
      }

      output(chalk.gray(`  Attached to daemon log (${logPath}) — Ctrl+C to detach (daemon keeps running)`));
      outputBlank();

      // Show the last N lines
      const numLines = Number(opts.lines) || 50;
      try {
        const content = readFileSync(logPath, "utf-8");
        const lines = content.split("\n").filter(Boolean);
        const tail = lines.slice(-numLines);
        for (const line of tail) {
          output(colorizeLogLine(line));
        }
      } catch {
        // File may have been rotated — continue to follow
      }

      // Follow the file in real time
      let lastSize = statSync(logPath).size;
      const stream = () => {
        try {
          const { size } = statSync(logPath);
          if (size > lastSize) {
            const rs = createReadStream(logPath, { start: lastSize, end: size });
            rs.on("data", (chunk) => {
              const text = chunk.toString();
              for (const line of text.split("\n").filter(Boolean)) {
                output(colorizeLogLine(line));
              }
            });
            lastSize = size;
          } else if (size < lastSize) {
            // File was rotated — restart from beginning
            lastSize = 0;
          }
        } catch {
          // Log file may have been removed — keep polling
        }
      };

      const { watchFile, unwatchFile } = await import("node:fs");
      watchFile(logPath, { interval: 300 }, stream);

      process.on("SIGINT", () => {
        unwatchFile(logPath, stream);
        output(chalk.gray("\n  Detached (daemon continues running in background)."));
        process.exit(0);
      });
    });

  return cmd;
}

function colorizeLogLine(line: string): string {
  if (line.includes("[ERROR]")) return chalk.red(line);
  if (line.includes("[WARN]")) return chalk.yellow(line);
  if (line.includes("[DEBUG]")) return chalk.gray(line);
  return line;
}
