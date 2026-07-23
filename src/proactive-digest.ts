/**
 * proactive-digest.ts — Periodic Proactive Digest
 *
 * Generates a proactive digest every 30 minutes (configurable via
 * SHITENNO_PROACTIVE_INTERVAL_MS). Aggregates pending challenges,
 * drift, health trend, and writes .shitenno/daemon/proactive-digest.md.
 *
 * PRINCIPLE: Proactive insights should be surfaced, not buried in logs.
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";
import { queryDaemon, isDaemonRunning } from "./daemon-client.js";
import { logger } from "./logger.js";

const DEFAULT_DIGEST_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface DigestData {
  generatedAt: string;
  challenges: Array<{ type: string; severity: string; description: string }>;
  health: { score: number | null; trend: string } | null;
  drift: { filesChanged: number; minutesSinceLastCommit: number } | null;
  debt: { gapCount: number; healthScore: number } | null;
}

function formatDigest(data: DigestData): string {
  const lines = [
    "# Proactive Digest",
    `*Generated: ${data.generatedAt}*`,
    "",
  ];

  if (data.challenges.length > 0) {
    lines.push("## Pending Challenges");
    for (const c of data.challenges) {
      const icon = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
      lines.push(`- ${icon} **${c.type}**: ${c.description}`);
    }
    lines.push("");
  }

  if (data.health) {
    const scoreColor = data.health.score !== null && data.health.score >= 70 ? "🟢"
      : data.health.score !== null && data.health.score >= 40 ? "🟡" : "🔴";
    lines.push("## Health");
    lines.push(`- Score: ${data.health.score ?? "N/A"}/100 ${scoreColor}`);
    lines.push(`- Trend: ${data.health.trend}`);
    lines.push("");
  }

  if (data.drift) {
    lines.push("## Drift");
    lines.push(`- Files changed: ${data.drift.filesChanged}`);
    lines.push(`- Minutes since last commit: ${data.drift.minutesSinceLastCommit}`);
    lines.push("");
  }

  if (data.debt) {
    lines.push("## Knowledge Debt");
    lines.push(`- Gaps: ${data.debt.gapCount}`);
    lines.push(`- Health score: ${data.debt.healthScore}/100`);
    lines.push("");
  }

  if (data.challenges.length === 0 && !data.drift && (!data.debt || data.debt.gapCount === 0)) {
    lines.push("No pending proactive alerts. System is healthy.");
    lines.push("");
  }

  return lines.join("\n");
}

function writeDigest(shitennoDir: string, data: DigestData): void {
  const daemonDir = join(shitennoDir, "daemon");
  if (!existsSync(daemonDir)) mkdirSync(daemonDir, { recursive: true });
  const digestPath = join(daemonDir, "proactive-digest.md");
  writeFileSync(digestPath, formatDigest(data), "utf-8");
  logger.info("proactive-digest", `Digest written: ${digestPath}`);
}

async function collectDigestData(shitennoDir: string): Promise<DigestData> {
  const data: DigestData = {
    generatedAt: new Date().toISOString(),
    challenges: [],
    health: null,
    drift: null,
    debt: null,
  };

  if (!isDaemonRunning(shitennoDir)) return data;

  try {
    const challenges = await queryDaemon<{
      type: string;
      challenges: Array<{ type: string; severity: string; message: string }>;
    }>(shitennoDir, { type: "query_challenges" });
    if (challenges?.challenges) {
      data.challenges = challenges.challenges.map((c) => ({
        type: c.type,
        severity: c.severity,
        description: c.message,
      }));
    }
  } catch {}

  try {
    const health = await queryDaemon<{
      type: string;
      score: number | null;
      trend: string;
    }>(shitennoDir, { type: "query_health" });
    if (health) {
      data.health = { score: health.score, trend: health.trend };
    }
  } catch {}

  try {
    const drift = await queryDaemon<{
      type: string;
      drift: { filesChanged: number; minutesSinceLastCommit: number } | null;
    }>(shitennoDir, { type: "query_drift" });
    if (drift?.drift) {
      data.drift = drift.drift;
    }
  } catch {}

  try {
    const debt = await queryDaemon<{
      type: string;
      debt: { gapCount: number; healthScore: number } | null;
    }>(shitennoDir, { type: "query_debt" });
    if (debt?.debt) {
      data.debt = debt.debt;
    }
  } catch {}

  return data;
}

/**
 * Initialize the proactive digest timer.
 * Runs periodically, collects data from daemon, writes digest, publishes event.
 * Returns a stop function for cleanup.
 */
export function initProactiveDigest(shitennoDir: string): () => void {
  const intervalMs = Number(process.env["SHITENNO_PROACTIVE_INTERVAL_MS"]) || DEFAULT_DIGEST_INTERVAL_MS;

  const timer = setInterval(async () => {
    try {
      const data = await collectDigestData(shitennoDir);
      writeDigest(shitennoDir, data);
      getEventBus().publish("proactive.digest_ready", {
        challengeCount: data.challenges.length,
        healthScore: data.health?.score ?? null,
      });
    } catch (err) {
      logger.error("proactive-digest", `Digest generation failed: ${err}`);
    }
  }, intervalMs);

  // Unref the timer so it doesn't keep the process alive
  if (timer.unref) timer.unref();

  logger.info("proactive-digest", `Initialized — interval: ${intervalMs / 1000}s`);

  return () => clearInterval(timer);
}
