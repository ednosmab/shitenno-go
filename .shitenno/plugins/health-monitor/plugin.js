/**
 * health-monitor plugin — Post-analysis health logging
 *
 * Logs analysis completion and runs additional health checks.
 */

const healthMonitorPlugin = {
  name: "health-monitor",
  version: "1.0.0",
  description: "Logs analysis completion and runs additional health checks",
  hooks: {
    "post-analysis": (input) => {
      const ctx = input || {};
      const command = ctx.command || "unknown";
      const timestamp = new Date().toISOString();

      console.log(`  [health-monitor] Analysis completed for command: ${command} at ${timestamp}`);

      return input;
    },
    "custom-check": async (input) => {
      const ctx = input || {};
      const shitennoDir = ctx.shitennoDir;

      if (!shitennoDir) return null;

      // Additional health check: verify critical files exist
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");

      const criticalFiles = [
        join(shitennoDir, "governance", "context", "context_buffer.yaml"),
        join(shitennoDir, "docs", "AGENTS.md"),
      ];

      const missing = criticalFiles.filter((f) => !existsSync(f));

      if (missing.length > 0) {
        return `[health-monitor] Warning: ${missing.length} critical file(s) missing`;
      }

      return null;
    },
  },
};

export default healthMonitorPlugin;
