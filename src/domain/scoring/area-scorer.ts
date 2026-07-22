import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import type { ProjectAnalysis } from "../../analyser.js";
import { walkSourceFiles } from "../../utils.js";
import { logger } from "../../logger.js";
import type { StaticMetric, BehavioralMetric } from "../entities/engineering-state.js";
import type { FileContentCache } from "../../utils.js";

// ── Area Metrics ────────────────────────────────────────────────────────────

export interface AreaMetrics {
  fileCount: number;
  sensitiveSurface: number;
  dependencyDepth: number;
}

function fileMatchesArea(trimmed: string, area: string): boolean {
  return trimmed.startsWith(area + "/") || trimmed.includes("/" + area + "/");
}

function addToAreaFileSet(
  fileSetByArea: Map<string, Set<string>>,
  areas: string[],
  trimmed: string
): void {
  for (const a of areas) {
    if (fileMatchesArea(trimmed, a)) {
      fileSetByArea.get(a)?.add(trimmed);
    }
  }
}

interface HistoryScanCtx {
  areas: string[];
  violationKeywords: string[];
  violationsByArea: Map<string, number>;
  lastViolationIdx: Map<string, number>;
}

function scanHistoryFile(content: string, fileIndex: number, ctx: HistoryScanCtx): void {
  const lower = content.toLowerCase();
  for (const a of ctx.areas) {
    if (!lower.includes(a.toLowerCase())) continue;
    if (!ctx.violationKeywords.some((kw) => lower.includes(kw))) continue;
    ctx.violationsByArea.set(a, (ctx.violationsByArea.get(a) || 0) + 1);
    ctx.lastViolationIdx.set(a, fileIndex);
  }
}

function buildThresholdMetric(
  metric: string,
  value: number,
  thresholds: { min: number; score: number; evidence: string }[]
): StaticMetric {
  for (const t of thresholds) {
    if (value >= t.min) {
      return { metric, value, score: t.score, evidence: t.evidence };
    }
  }
  return { metric, value, score: 0, evidence: `${value} ${metric} — minimal` };
}

function pushConditionalMetric(
  metrics: BehavioralMetric[],
  signal: string,
  value: number,
  conditions: { min: number; score: number; evidence: string; suggestion?: string }[]
): void {
  for (const c of conditions) {
    if (value >= c.min) {
      const m: BehavioralMetric = { signal, value, score: c.score, evidence: c.evidence };
      if (c.suggestion) m.suggestion = c.suggestion;
      metrics.push(m);
      return;
    }
  }
}

export function batchScoreArea(
  areaPath: string,
  allAreas: string[],
  sensitiveKeywords: string[],
  cache: FileContentCache
): AreaMetrics {
  const result: AreaMetrics = { fileCount: 0, sensitiveSurface: 0, dependencyDepth: 0 };
  if (!existsSync(areaPath)) return result;

  const otherAreas = allAreas
    .filter((a) => !areaPath.includes(a))
    .map((a) => ({ full: a, short: a.split("/").pop()! }));

  const importRegex = /^(?:import|from)\s+.*["'](.*)["']/;

  walkSourceFiles(
    areaPath,
    (fullPath) => {
      result.fileCount++;
      const content = cache.get(fullPath);
      if (content === null) return;

      const lower = content.toLowerCase();
      for (const kw of sensitiveKeywords) {
        if (lower.includes(kw.toLowerCase())) {
          result.sensitiveSurface++;
          break;
        }
      }

      for (const line of content.split("\n")) {
        const match = line.match(importRegex);
        if (!match) continue;
        const importPath = match[1];
        if (!importPath) continue;
        for (const { full, short } of otherAreas) {
          if (
            importPath.includes(`../${short}/`) ||
            importPath.includes(`./${short}/`) ||
            importPath.includes(`../${full}/`) ||
            importPath.includes(`./${full}/`) ||
            importPath.startsWith(full + "/")
          ) {
            result.dependencyDepth++;
            break;
          }
        }
      }
    },
    { includeAll: true }
  );

  return result;
}

// ── Batch Git Churn ─────────────────────────────────────────────────────────

export function batchGitChurn(
  projectRoot: string,
  areas: string[],
  windowDays: number
): Map<string, number> {
  const churnMap = new Map<string, number>();
  for (const a of areas) churnMap.set(a, 0);

  try {
    const output = execSync(
      `git log --since="${windowDays} days ago" --name-only --pretty=format:"" 2>/dev/null`,
      { encoding: "utf-8", cwd: projectRoot, timeout: 5000 }
    );

    const fileSetByArea = new Map<string, Set<string>>();
    for (const a of areas) fileSetByArea.set(a, new Set());

    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) addToAreaFileSet(fileSetByArea, areas, trimmed);
    }

    for (const [a, files] of fileSetByArea) {
      churnMap.set(a, files.size);
    }
  } catch {
    logger.debug("scorer", "Failed to compute churn metrics");
  }

  return churnMap;
}

// ── Pre-Read History ────────────────────────────────────────────────────────

export interface PreReadHistory {
  totalEntries: number;
  violationsByArea: Map<string, number>;
  incidentFreeAgeByArea: Map<string, number>;
}

export function preReadHistory(
  shitennoDir: string,
  areas: string[],
  violationKeywords: string[]
): PreReadHistory {
  const historyDir = join(shitennoDir, "docs", "history");
  const result: PreReadHistory = {
    totalEntries: 0,
    violationsByArea: new Map(),
    incidentFreeAgeByArea: new Map(),
  };

  for (const a of areas) {
    result.violationsByArea.set(a, 0);
    result.incidentFreeAgeByArea.set(a, 0);
  }

  if (!existsSync(historyDir)) return result;

  const files = readdirSync(historyDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .sort();

  result.totalEntries = files.length;

  const lastViolationIdx = new Map<string, number>();
  for (const a of areas) lastViolationIdx.set(a, -1);

  const ctx: HistoryScanCtx = {
    areas,
    violationKeywords,
    violationsByArea: result.violationsByArea,
    lastViolationIdx,
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    try {
      scanHistoryFile(readFileSync(join(historyDir, file), "utf-8"), i, ctx);
    } catch {
      // skip
    }
  }

  for (const a of areas) {
    const idx = lastViolationIdx.get(a);
    result.incidentFreeAgeByArea.set(a, (idx === undefined || idx < 0) ? files.length : files.length - idx - 1);
  }

  return result;
}

// ── Context Pressure ────────────────────────────────────────────────────────

export function countContextPressure(projectRoot: string, area: string): number {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  const layersDir = join(shitennoDir, "docs", "layers");
  if (!existsSync(layersDir)) return 0;

  const areaParts = area.split("/");
  const layerName = areaParts[areaParts.length - 1] ?? "";
  const layerDir = join(layersDir, layerName);

  if (!existsSync(layerDir)) return 0;

  let totalBytes = 0;
  walkSourceFiles(layerDir, (fullPath) => {
    try {
      const stats = statSync(fullPath);
      totalBytes += stats.size;
    } catch {
      logger.debug("scorer", "Failed to stat file:", fullPath);
    }
  });

  return Math.round(totalBytes / 1024);
}

// ── Static Metrics ──────────────────────────────────────────────────────────

export function collectStaticMetrics(analysis: ProjectAnalysis): StaticMetric[] {
  const pc = analysis.packageCount;
  const ac = analysis.appCount;
  const fc = analysis.sourceFileCount;
  const dc = analysis.dependencyCount;

  return [
    buildThresholdMetric("packages", pc, [
      { min: 5, score: 2, evidence: `${pc} packages detected — monorepo with multiple modules` },
      { min: 3, score: 1, evidence: `${pc} packages detected — growing monorepo` },
    ]),
    buildThresholdMetric("apps", ac, [
      { min: 3, score: 3, evidence: `${ac} apps detected — multi-app project needs coordination` },
      { min: 2, score: 2, evidence: `${ac} apps detected — multi-app project` },
    ]),
    buildThresholdMetric("files", fc, [
      { min: 300, score: 2, evidence: `${fc} source files — large codebase` },
      { min: 150, score: 1, evidence: `${fc} source files — medium codebase` },
    ]),
    buildThresholdMetric("dependencies", dc, [
      { min: 100, score: 2, evidence: `${dc} dependencies — complex dependency tree` },
      { min: 50, score: 1, evidence: `${dc} dependencies — moderate dependency count` },
    ]),
    ...(analysis.monorepo
      ? [{ metric: "monorepo" as const, value: 1, score: 1, evidence: "Monorepo detected — cross-package coordination needed" }]
      : []),
  ];
}

// ── Behavioral Metrics ──────────────────────────────────────────────────────

export function collectBehavioralMetrics(
  projectRoot: string,
  shitennoDir: string
): BehavioralMetric[] {
  const metrics: BehavioralMetric[] = [];

  const vf = countValidateFailures(shitennoDir);
  pushConditionalMetric(metrics, "validate-failures", vf, [
    { min: 3, score: 3, evidence: `${vf} validate failures in history — structural gaps`, suggestion: "Run 'shugo upgrade' to add governance components" },
    { min: 1, score: 1, evidence: `${vf} validate failure(s) detected` },
  ]);

  const adr = countAdrs(shitennoDir);
  pushConditionalMetric(metrics, "adr-count", adr, [
    { min: 3, score: 3, evidence: `${adr} ADRs created — active architectural decisions`, suggestion: "Consider adding governance/agents/ for role separation" },
    { min: 1, score: 2, evidence: `${adr} ADR(s) created` },
  ]);

  const ob = countOpenBranches(projectRoot);
  pushConditionalMetric(metrics, "open-branches", ob, [
    { min: 5, score: 2, evidence: `${ob} feat branches open — parallel development`, suggestion: "Add governance/context/ for session persistence" },
    { min: 3, score: 1, evidence: `${ob} feat branches open` },
  ]);

  const cpw = countCommitsPerWeek(projectRoot);
  pushConditionalMetric(metrics, "commits-per-week", cpw, [
    { min: 20, score: 2, evidence: `${cpw} commits/week — high velocity` },
    { min: 10, score: 1, evidence: `${cpw} commits/week` },
  ]);

  const swc = countSessionsWithoutClose(shitennoDir);
  pushConditionalMetric(metrics, "sessions-without-close", swc, [
    { min: 2, score: 2, evidence: `${swc} sessions without close — needs automation`, suggestion: "Add scripts/close-session.ts for session management" },
    { min: 1, score: 1, evidence: `${swc} unclosed session(s)` },
  ]);

  const bf = countBugFixes(projectRoot);
  pushConditionalMetric(metrics, "bug-fixes", bf, [
    { min: 5, score: 2, evidence: `${bf} bug fixes — code instability`, suggestion: "Add tests and governance for affected modules" },
    { min: 3, score: 1, evidence: `${bf} bug fixes detected` },
  ]);

  const agents = countAgents(projectRoot);
  pushConditionalMetric(metrics, "agent-count", agents, [
    { min: 4, score: 2, evidence: `${agents} agents configured — needs orchestrator`, suggestion: "Add governance/agents/ with AI contracts" },
  ]);

  const skills = countSkills(shitennoDir);
  pushConditionalMetric(metrics, "skill-count", skills, [
    { min: 6, score: 1, evidence: `${skills} skills installed — multi-domain project` },
  ]);

  return metrics;
}

// ── Raw Count Functions ─────────────────────────────────────────────────────

function countValidateFailures(shitennoDir: string): number {
  const historyDir = join(shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return 0;

  let count = 0;
  const files = readdirSync(historyDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    try {
      const content = readFileSync(join(historyDir, file), "utf-8");
      if (content.includes("VALIDATE") && content.includes("fail")) {
        count++;
      }
    } catch {
      logger.debug("scorer", "Failed to read history file:", file);
    }
  }
  return count;
}

function countSessionsWithoutClose(shitennoDir: string): number {
  const bufferPath = join(
    shitennoDir,
    "governance",
    "context",
    "context_buffer.yaml"
  );
  if (!existsSync(bufferPath)) return 0;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    if (content.includes('status: "in_progress"')) return 1;
    if (content.includes('status: "active"')) return 1;
    return 0;
  } catch {
    return 0;
  }
}

function countAdrs(shitennoDir: string): number {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return 0;

  return readdirSync(adrDir).filter(
    (f) =>
      f.endsWith(".md") && !f.startsWith("README") && !f.startsWith("ADR-TEMPLATE")
  ).length;
}

function countOpenBranches(projectRoot: string): number {
  try {
    const output = execSync("git branch --list 'feat/*' 2>/dev/null | wc -l", {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 5000,
    });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countCommitsPerWeek(projectRoot: string): number {
  try {
    const output = execSync(
      'git log --since="1 week ago" --oneline 2>/dev/null | wc -l',
      {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 5000,
      }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countBugFixes(projectRoot: string): number {
  try {
    const output = execSync(
      'git log --since="1 month ago" --oneline --grep="fix" 2>/dev/null | wc -l',
      {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 5000,
      }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countAgents(projectRoot: string): number {
  const configPath = join(projectRoot, "opencode.json");
  if (!existsSync(configPath)) return 0;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.agent ? Object.keys(config.agent).length : 0;
  } catch {
    return 0;
  }
}

function countSkills(shitennoDir: string): number {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return 0;

  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length;
}
