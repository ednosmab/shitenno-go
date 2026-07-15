import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NEXUS_DIR_NAME } from "../../constants.js";
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
      if (!trimmed) continue;
      for (const a of areas) {
        if (trimmed.startsWith(a + "/") || trimmed.includes("/" + a + "/")) {
          const fileSet = fileSetByArea.get(a);
          if (fileSet) fileSet.add(trimmed);
        }
      }
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
  nexusDir: string,
  areas: string[],
  violationKeywords: string[]
): PreReadHistory {
  const historyDir = join(nexusDir, "docs", "history");
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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    try {
      const content = readFileSync(join(historyDir, file), "utf-8").toLowerCase();
      for (const a of areas) {
        if (content.includes(a.toLowerCase())) {
          const hasViolation = violationKeywords.some((kw) => content.includes(kw));
          if (hasViolation) {
            result.violationsByArea.set(a, (result.violationsByArea.get(a) || 0) + 1);
            lastViolationIdx.set(a, i);
          }
        }
      }
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
  const nexusDir = join(projectRoot, NEXUS_DIR_NAME);
  const layersDir = join(nexusDir, "docs", "layers");
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
  const metrics: StaticMetric[] = [];

  if (analysis.packageCount >= 5) {
    metrics.push({
      metric: "packages",
      value: analysis.packageCount,
      score: 2,
      evidence: `${analysis.packageCount} packages detected — monorepo with multiple modules`,
    });
  } else if (analysis.packageCount >= 3) {
    metrics.push({
      metric: "packages",
      value: analysis.packageCount,
      score: 1,
      evidence: `${analysis.packageCount} packages detected — growing monorepo`,
    });
  } else {
    metrics.push({
      metric: "packages",
      value: analysis.packageCount,
      score: 0,
      evidence: `${analysis.packageCount} packages — simple structure`,
    });
  }

  if (analysis.appCount >= 3) {
    metrics.push({
      metric: "apps",
      value: analysis.appCount,
      score: 3,
      evidence: `${analysis.appCount} apps detected — multi-app project needs coordination`,
    });
  } else if (analysis.appCount >= 2) {
    metrics.push({
      metric: "apps",
      value: analysis.appCount,
      score: 2,
      evidence: `${analysis.appCount} apps detected — multi-app project`,
    });
  } else {
    metrics.push({
      metric: "apps",
      value: analysis.appCount,
      score: 0,
      evidence: `${analysis.appCount} apps — single app or no apps`,
    });
  }

  if (analysis.sourceFileCount >= 300) {
    metrics.push({
      metric: "files",
      value: analysis.sourceFileCount,
      score: 2,
      evidence: `${analysis.sourceFileCount} source files — large codebase`,
    });
  } else if (analysis.sourceFileCount >= 150) {
    metrics.push({
      metric: "files",
      value: analysis.sourceFileCount,
      score: 1,
      evidence: `${analysis.sourceFileCount} source files — medium codebase`,
    });
  } else {
    metrics.push({
      metric: "files",
      value: analysis.sourceFileCount,
      score: 0,
      evidence: `${analysis.sourceFileCount} source files — small codebase`,
    });
  }

  if (analysis.dependencyCount >= 100) {
    metrics.push({
      metric: "dependencies",
      value: analysis.dependencyCount,
      score: 2,
      evidence: `${analysis.dependencyCount} dependencies — complex dependency tree`,
    });
  } else if (analysis.dependencyCount >= 50) {
    metrics.push({
      metric: "dependencies",
      value: analysis.dependencyCount,
      score: 1,
      evidence: `${analysis.dependencyCount} dependencies — moderate dependency count`,
    });
  } else {
    metrics.push({
      metric: "dependencies",
      value: analysis.dependencyCount,
      score: 0,
      evidence: `${analysis.dependencyCount} dependencies — simple dependency tree`,
    });
  }

  if (analysis.monorepo) {
    metrics.push({
      metric: "monorepo",
      value: 1,
      score: 1,
      evidence: "Monorepo detected — cross-package coordination needed",
    });
  }

  return metrics;
}

// ── Behavioral Metrics ──────────────────────────────────────────────────────

export function collectBehavioralMetrics(
  projectRoot: string,
  nexusDir: string
): BehavioralMetric[] {
  const metrics: BehavioralMetric[] = [];

  const validateFailures = countValidateFailures(nexusDir);
  if (validateFailures >= 3) {
    metrics.push({
      signal: "validate-failures",
      value: validateFailures,
      score: 3,
      evidence: `${validateFailures} validate failures in history — structural gaps`,
      suggestion: "Run 'nexus upgrade' to add governance components",
    });
  } else if (validateFailures >= 1) {
    metrics.push({
      signal: "validate-failures",
      value: validateFailures,
      score: 1,
      evidence: `${validateFailures} validate failure(s) detected`,
    });
  }

  const adrCount = countAdrs(nexusDir);
  if (adrCount >= 3) {
    metrics.push({
      signal: "adr-count",
      value: adrCount,
      score: 3,
      evidence: `${adrCount} ADRs created — active architectural decisions`,
      suggestion: "Consider adding governance/agents/ for role separation",
    });
  } else if (adrCount >= 1) {
    metrics.push({
      signal: "adr-count",
      value: adrCount,
      score: 2,
      evidence: `${adrCount} ADR(s) created`,
    });
  }

  const openBranches = countOpenBranches(projectRoot);
  if (openBranches >= 5) {
    metrics.push({
      signal: "open-branches",
      value: openBranches,
      score: 2,
      evidence: `${openBranches} feat branches open — parallel development`,
      suggestion: "Add governance/context/ for session persistence",
    });
  } else if (openBranches >= 3) {
    metrics.push({
      signal: "open-branches",
      value: openBranches,
      score: 1,
      evidence: `${openBranches} feat branches open`,
    });
  }

  const commitsPerWeek = countCommitsPerWeek(projectRoot);
  if (commitsPerWeek >= 20) {
    metrics.push({
      signal: "commits-per-week",
      value: commitsPerWeek,
      score: 2,
      evidence: `${commitsPerWeek} commits/week — high velocity`,
    });
  } else if (commitsPerWeek >= 10) {
    metrics.push({
      signal: "commits-per-week",
      value: commitsPerWeek,
      score: 1,
      evidence: `${commitsPerWeek} commits/week`,
    });
  }

  const sessionsWithoutClose = countSessionsWithoutClose(nexusDir);
  if (sessionsWithoutClose >= 2) {
    metrics.push({
      signal: "sessions-without-close",
      value: sessionsWithoutClose,
      score: 2,
      evidence: `${sessionsWithoutClose} sessions without close — needs automation`,
      suggestion: "Add scripts/close-session.ts for session management",
    });
  } else if (sessionsWithoutClose >= 1) {
    metrics.push({
      signal: "sessions-without-close",
      value: sessionsWithoutClose,
      score: 1,
      evidence: `${sessionsWithoutClose} unclosed session(s)`,
    });
  }

  const bugFixes = countBugFixes(projectRoot);
  if (bugFixes >= 5) {
    metrics.push({
      signal: "bug-fixes",
      value: bugFixes,
      score: 2,
      evidence: `${bugFixes} bug fixes — code instability`,
      suggestion: "Add tests and governance for affected modules",
    });
  } else if (bugFixes >= 3) {
    metrics.push({
      signal: "bug-fixes",
      value: bugFixes,
      score: 1,
      evidence: `${bugFixes} bug fixes detected`,
    });
  }

  const agentCount = countAgents(projectRoot);
  if (agentCount >= 4) {
    metrics.push({
      signal: "agent-count",
      value: agentCount,
      score: 2,
      evidence: `${agentCount} agents configured — needs orchestrator`,
      suggestion: "Add governance/agents/ with AI contracts",
    });
  }

  const skillCount = countSkills(nexusDir);
  if (skillCount >= 6) {
    metrics.push({
      signal: "skill-count",
      value: skillCount,
      score: 1,
      evidence: `${skillCount} skills installed — multi-domain project`,
    });
  }

  return metrics;
}

// ── Raw Count Functions ─────────────────────────────────────────────────────

function countValidateFailures(nexusDir: string): number {
  const historyDir = join(nexusDir, "docs", "history");
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

function countSessionsWithoutClose(nexusDir: string): number {
  const bufferPath = join(
    nexusDir,
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

function countAdrs(nexusDir: string): number {
  const adrDir = join(nexusDir, "docs", "adrs");
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

function countSkills(nexusDir: string): number {
  const skillsDir = join(nexusDir, "docs", "skills");
  if (!existsSync(skillsDir)) return 0;

  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length;
}
