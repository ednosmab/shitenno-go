import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectAnalysis } from "./analyser.js";

// ── Types (aligned with nexus-system/core/complexity/types.ts) ───────────────

/** Resultado de uma métrica estática calculada para o projecto. */
export interface StaticMetric {
  metric: string;
  value: number;
  score: number;
  evidence: string;
}

/** Resultado de uma métrica comportamental calculada a partir de acções do utilizador. */
export interface BehavioralMetric {
  signal: string;
  value: number;
  score: number;
  evidence: string;
  suggestion?: string;
}

// ── CLI ComplexityReport (extends core with display-friendly fields) ─────────

export interface ComplexityReport {
  score: number;
  level: "junior" | "pleno" | "senior";
  staticScore: number;
  behaviorScore: number;
  reasons: string[];
  suggestions: string[];
  staticMetrics: StaticMetric[];
  behavioralMetrics: BehavioralMetric[];
  computedAt: string;
}

// ── Main Scoring Function ───────────────────────────────────────────────────

export function calculateComplexityScore(
  projectRoot: string,
  nexusDir: string,
  analysis: ProjectAnalysis
): ComplexityReport {
  const staticMetrics = collectStaticMetrics(analysis);
  const behavioralMetrics = collectBehavioralMetrics(projectRoot, nexusDir);
  return scoreProject(analysis, staticMetrics, behavioralMetrics);
}

// ── Static Metrics ───────────────────────────────────────────────────────────

function collectStaticMetrics(analysis: ProjectAnalysis): StaticMetric[] {
  const metrics: StaticMetric[] = [];

  // Packages
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

  // Apps
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

  // Source files
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

  // Dependencies
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

  // Monorepo
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

function collectBehavioralMetrics(
  projectRoot: string,
  nexusDir: string
): BehavioralMetric[] {
  const metrics: BehavioralMetric[] = [];

  // Validate failures
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

  // ADR count
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

  // Open branches
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

  // Commits per week
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

  // Sessions without close
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

  // Bug fixes
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

  // Agent count
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

  // Skill count
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
      // skip
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

// ── Scoring Logic ────────────────────────────────────────────────────────────

function scoreProject(
  analysis: ProjectAnalysis,
  staticMetrics: StaticMetric[],
  behavioralMetrics: BehavioralMetric[]
): ComplexityReport {
  const staticScore = staticMetrics.reduce((sum, m) => sum + m.score, 0);
  const behaviorScore = behavioralMetrics.reduce((sum, m) => sum + m.score, 0);
  const totalScore = staticScore + behaviorScore;

  // Build reasons from metrics
  const reasons: string[] = [
    ...staticMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
    ...behavioralMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
  ];

  // Build suggestions from behavioral metrics
  const suggestions: string[] = behavioralMetrics
    .filter((m) => m.suggestion)
    .map((m) => m.suggestion!);

  // Determine level
  let level: "junior" | "pleno" | "senior" = "junior";
  if (totalScore >= 10) {
    level = "senior";
  } else if (totalScore >= 5) {
    level = "pleno";
  }

  // Add level-based suggestion
  if (level === "pleno" && !suggestions.some((s) => s.includes("upgrade"))) {
    suggestions.push(
      "Your project complexity suggests L2 (Pleno). Run: nexus upgrade --level pleno"
    );
  }
  if (level === "senior" && !suggestions.some((s) => s.includes("upgrade"))) {
    suggestions.push(
      "Your project complexity suggests L3 (Senior). Run: nexus upgrade --level senior"
    );
  }

  return {
    score: totalScore,
    level,
    staticScore,
    behaviorScore,
    reasons,
    suggestions,
    staticMetrics,
    behavioralMetrics,
    computedAt: new Date().toISOString(),
  };
}
