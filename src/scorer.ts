import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectAnalysis } from "./analyser.js";
import { walkSourceFiles, countSourceFilesInDir, FileContentCache } from "./utils.js";

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

/** Score de complexidade para uma área específica do projecto. */
export interface AreaScore {
  /** Nome da área (ex: "src/services", "packages/core"). */
  area: string;
  /** Score composto da área (0-10). */
  score: number;
  /** Nível recomendado para esta área. */
  level: "junior" | "pleno" | "senior";
  /** Número de ficheiros na área. */
  fileCount: number;
  /** Churn: commits que afectaram esta área nos últimos N dias. */
  churn: number;
  /** Número de keywords sensíveis encontradas nos ficheiros da área. */
  sensitiveSurface: number;
  /** Número de keywords de violação encontradas no histórico desta área. */
  violations: number;
  /** Fase 1.1: Número de imports cruzados (dependências de/para outras áreas). */
  dependencyDepth: number;
  /** Fase 1.1: Sessões desde a última violação nesta área. */
  incidentFreeAge: number;
  /** Fase 1.1: Tamanho total dos docs P2 referenciados para esta camada (KB). */
  contextPressure: number;
  /** Evidência legível. */
  evidence: string;
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
  /** Scores por área — vazio se ProjectProfile não disponível. */
  areaScores: AreaScore[];
}

// ── Project Profile (minimal, loaded from nexus-profile/) ────────────────────

interface ProjectProfile {
  projectName: string;
  areas: string[];
  sensitiveKeywords: string[];
  churnWindowDays: number;
  weights: Record<string, number>;
  violationKeywords: string[];
  feedbackPath?: string;
}

// ── Profile Loader ───────────────────────────────────────────────────────────

function loadProjectProfile(projectRoot: string): ProjectProfile | null {
  const profileDir = join(projectRoot, "nexus-profile");
  if (!existsSync(profileDir)) return null;

  const files = readdirSync(profileDir).filter(
    (f) => f.endsWith(".config.ts") && !f.startsWith("_")
  );
  if (files.length === 0) return null;

  // Read the first profile file and extract values via regex
  const content = readFileSync(join(profileDir, files[0]), "utf-8");

  const projectNameMatch = content.match(/projectName:\s*["']([^"']+)["']/);
  const areasMatch = content.match(/areas:\s*\[([\s\S]*?)\]/);
  const sensitiveMatch = content.match(
    /sensitiveKeywords:\s*\[([\s\S]*?)\]/
  );
  const churnMatch = content.match(/churnWindowDays:\s*(\d+)/);
  const violationMatch = content.match(
    /violationKeywords:\s*\[([\s\S]*?)\]/
  );

  if (!projectNameMatch || !areasMatch) return null;

  const parseStringArray = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .filter(Boolean);

  return {
    projectName: projectNameMatch[1],
    areas: parseStringArray(areasMatch[1]),
    sensitiveKeywords: sensitiveMatch
      ? parseStringArray(sensitiveMatch[1])
      : ["auth", "payment", "session", "security"],
    churnWindowDays: churnMatch ? parseInt(churnMatch[1], 10) : 90,
    weights: { churn: 1.0, violationRate: 1.0, sensitiveSurface: 1.0 },
    violationKeywords: violationMatch
      ? parseStringArray(violationMatch[1])
      : ["erro", "bug", "corrigi", "falhou", "rollback"],
  };
}

// ── Main Scoring Function ───────────────────────────────────────────────────

export function calculateComplexityScore(
  projectRoot: string,
  nexusDir: string,
  analysis: ProjectAnalysis
): ComplexityReport {
  const staticMetrics = collectStaticMetrics(analysis);
  const behavioralMetrics = collectBehavioralMetrics(projectRoot, nexusDir);

  // Per-area scoring (with shared cache for file reads)
  const profile = loadProjectProfile(projectRoot);
  const areaScores = profile
    ? calculateAreaScores(projectRoot, profile, new FileContentCache())
    : [];

  return scoreProject(analysis, staticMetrics, behavioralMetrics, areaScores);
}

// ── Per-Area Scoring ────────────────────────────────────────────────────────

function calculateAreaScores(
  projectRoot: string,
  profile: ProjectProfile,
  cache: FileContentCache
): AreaScore[] {

  const results = profile.areas.map((area) => {
    const areaPath = join(projectRoot, area);
    const fileCount = countSourceFilesInDir(areaPath);
    const churn = countChurnPerArea(projectRoot, area, profile.churnWindowDays);
    const sensitiveSurface = countSensitivePerAreaCached(areaPath, profile.sensitiveKeywords, cache);
    const violations = countViolationsPerArea(projectRoot, area, profile.violationKeywords);
    // Fase 1.1 signals
    const dependencyDepth = countDependencyDepth(projectRoot, area, profile.areas);
    const incidentFreeAge = countIncidentFreeAge(projectRoot, area);
    const contextPressure = countContextPressure(projectRoot, area);

    // Compose score: normalize each component to 0-3, then weighted sum (max ~10)
    const w = profile.weights;

    // Normalize churn: 0→0, 1-5→1, 6-20→2, 21+→3
    const churnNorm = churn === 0 ? 0 : churn <= 5 ? 1 : churn <= 20 ? 2 : 3;
    // Normalize violations: 0→0, 1→1, 2-3→2, 4+→3
    const violationsNorm = violations === 0 ? 0 : violations === 1 ? 1 : violations <= 3 ? 2 : 3;
    // Normalize sensitive: 0→0, 1-2→1, 3-5→2, 6+→3
    const sensitiveNorm = sensitiveSurface === 0 ? 0 : sensitiveSurface <= 2 ? 1 : sensitiveSurface <= 5 ? 2 : 3;
    // File count bonus: 0→0, 1-29→0, 30-99→1, 100+→2
    const filesNorm = fileCount >= 100 ? 2 : fileCount >= 30 ? 1 : 0;
    // Fase 1.1: dependency depth: 0→0, 1-5→1, 6-15→2, 16+→3
    const depsNorm = dependencyDepth === 0 ? 0 : dependencyDepth <= 5 ? 1 : dependencyDepth <= 15 ? 2 : 3;
    // Fase 1.1: incident-free age: 0→3 (recent), 1-3→2, 4-10→1, 11+→0 (stable)
    const ageNorm = incidentFreeAge === 0 ? 3 : incidentFreeAge <= 3 ? 2 : incidentFreeAge <= 10 ? 1 : 0;
    // Fase 1.1: context pressure: 0→0, 1-50KB→1, 51-200KB→2, 201+→3
    const pressureNorm = contextPressure === 0 ? 0 : contextPressure <= 50 ? 1 : contextPressure <= 200 ? 2 : 3;

    const rawScore =
      churnNorm * (w.churn || 1) +
      violationsNorm * (w.violationRate || 1) +
      sensitiveNorm * (w.sensitiveSurface || 1) +
      filesNorm +
      depsNorm * 0.5 +
      ageNorm * 0.5 +
      pressureNorm * 0.5;

    const score = Math.min(10, Math.round(rawScore * 10) / 10);

    let level: "junior" | "pleno" | "senior" = "junior";
    if (score >= 6) level = "senior";
    else if (score >= 3) level = "pleno";

    const evidenceParts: string[] = [];
    if (fileCount > 0) evidenceParts.push(`${fileCount} files`);
    if (churn > 0) evidenceParts.push(`${churn} commits/${profile.churnWindowDays}d`);
    if (sensitiveSurface > 0) evidenceParts.push(`${sensitiveSurface} sensitive keywords`);
    if (violations > 0) evidenceParts.push(`${violations} violations`);
    if (dependencyDepth > 0) evidenceParts.push(`${dependencyDepth} cross-area imports`);
    if (incidentFreeAge > 0) evidenceParts.push(`${incidentFreeAge} sessions since last incident`);
    if (contextPressure > 0) evidenceParts.push(`${contextPressure}KB P2 docs`);

    return {
      area,
      score,
      level,
      fileCount,
      churn,
      sensitiveSurface,
      violations,
      dependencyDepth,
      incidentFreeAge,
      contextPressure,
      evidence: evidenceParts.join(", ") || "no activity detected",
    };
  });

  return results;
}

/** Counts sensitive keywords in an area using shared cache. */
function countSensitivePerAreaCached(areaPath: string, keywords: string[], cache: FileContentCache): number {
  if (!existsSync(areaPath)) return 0;
  let count = 0;

  walkSourceFiles(
    areaPath,
    (fullPath) => {
      const content = cache.get(fullPath);
      if (content === null) return;
      const lower = content.toLowerCase();
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          count++;
          break; // one match per file
        }
      }
    },
    { includeAll: true }
  );

  return count;
}

function countChurnPerArea(
  projectRoot: string,
  area: string,
  windowDays: number
): number {
  try {
    const output = execSync(
      `git log --since="${windowDays} days ago" --oneline -- "${area}" 2>/dev/null | wc -l`,
      { encoding: "utf-8", cwd: projectRoot, timeout: 5000 }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countViolationsPerArea(
  projectRoot: string,
  area: string,
  violationKeywords: string[]
): number {
  const nexusDir = join(projectRoot, "nexus-system");
  const historyDir = join(nexusDir, "docs", "history");
  if (!existsSync(historyDir)) return 0;

  let count = 0;
  const files = readdirSync(historyDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    try {
      const content = readFileSync(join(historyDir, file), "utf-8").toLowerCase();
      // Check if this history entry mentions the area AND a violation keyword
      if (content.includes(area.toLowerCase())) {
        for (const kw of violationKeywords) {
          if (content.includes(kw.toLowerCase())) {
            count++;
            break; // one violation per history entry
          }
        }
      }
    } catch {
      // skip
    }
  }
  return count;
}

// ── Fase 1.1: Additional Signals ─────────────────────────────────────────────

/** Counts cross-area imports (dependency depth). Scans import/from statements. */
function countDependencyDepth(projectRoot: string, area: string, allAreas: string[]): number {
  const areaPath = join(projectRoot, area);
  if (!existsSync(areaPath)) return 0;

  const otherAreas = allAreas.filter((a) => a !== area);
  if (otherAreas.length === 0) return 0;

  let depth = 0;
  const importRegex = /^(?:import|from)\s+.*["'](.*)["']/;

  walkSourceFiles(areaPath, (fullPath) => {
    try {
      const content = readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(importRegex);
        if (!match) continue;
        const importPath = match[1];
        for (const other of otherAreas) {
          // Check if import resolves to another area (relative or alias)
          if (
            importPath.includes(`../${other}/`) ||
            importPath.includes(`./${other}/`) ||
            importPath.startsWith(other + "/")
          ) {
            depth++;
            break;
          }
        }
      }
    } catch {
      // skip
    }
  });

  return depth;
}

/** Counts sessions since last violation for an area. Reads history files. */
function countIncidentFreeAge(projectRoot: string, area: string): number {
  const nexusDir = join(projectRoot, "nexus-system");
  const historyDir = join(nexusDir, "docs", "history");
  if (!existsSync(historyDir)) return 0;

  const files = readdirSync(historyDir)
    .filter((f) => f.endsWith(".md"))
    .sort(); // chronological

  const violationKeywords = ["erro", "bug", "corrigi", "falhou", "rollback", "violação"];
  let sessionsSinceLastViolation = 0;
  let found = false;

  // Walk from newest to oldest
  for (let i = files.length - 1; i >= 0; i--) {
    try {
      const content = readFileSync(join(historyDir, files[i]), "utf-8").toLowerCase();
      if (content.includes(area.toLowerCase())) {
        for (const kw of violationKeywords) {
          if (content.includes(kw)) {
            found = true;
            break;
          }
        }
      }
      if (found) break;
      sessionsSinceLastViolation++;
    } catch {
      sessionsSinceLastViolation++;
    }
  }

  return sessionsSinceLastViolation;
}

/** Measures context pressure: total size (KB) of P2 docs for a layer. */
function countContextPressure(projectRoot: string, area: string): number {
  const nexusDir = join(projectRoot, "nexus-system");
  const layersDir = join(nexusDir, "docs", "layers");
  if (!existsSync(layersDir)) return 0;

  // Map area to potential layer name (e.g., "src/services" → "services")
  const areaParts = area.split("/");
  const layerName = areaParts[areaParts.length - 1];
  const layerDir = join(layersDir, layerName);

  if (!existsSync(layerDir)) return 0;

  let totalBytes = 0;
  walkSourceFiles(layerDir, (fullPath) => {
    try {
      const stats = statSync(fullPath);
      totalBytes += stats.size;
    } catch {
      // skip
    }
  });

  return Math.round(totalBytes / 1024); // KB
}

// ── Static Metrics ───────────────────────────────────────────────────────────

function collectStaticMetrics(analysis: ProjectAnalysis): StaticMetric[] {
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

function collectBehavioralMetrics(
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
  behavioralMetrics: BehavioralMetric[],
  areaScores: AreaScore[]
): ComplexityReport {
  const staticScore = staticMetrics.reduce((sum, m) => sum + m.score, 0);
  const behaviorScore = behavioralMetrics.reduce((sum, m) => sum + m.score, 0);
  const totalScore = staticScore + behaviorScore;

  const reasons: string[] = [
    ...staticMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
    ...behavioralMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
  ];

  const suggestions: string[] = behavioralMetrics
    .filter((m) => m.suggestion)
    .map((m) => m.suggestion!);

  let level: "junior" | "pleno" | "senior" = "junior";
  if (totalScore >= 10) {
    level = "senior";
  } else if (totalScore >= 5) {
    level = "pleno";
  }

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

  // Add per-area suggestions
  const hotAreas = areaScores.filter((a) => a.score >= 6);
  if (hotAreas.length > 0) {
    suggestions.push(
      `High-complexity areas: ${hotAreas.map((a) => `${a.area} (${a.score})`).join(", ")} — consider governance focus here`
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
    areaScores,
  };
}

// ── Report Writer ────────────────────────────────────────────────────────────

/**
 * Grava um relatório JSON em reports/ após cada scoring.
 * Convenção: complexity-<projectName>-<YYYY-MM-DD>-session<N>.json
 */
export function writeComplexityReport(
  projectRoot: string,
  nexusDir: string,
  report: ComplexityReport
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) {
    return null; // reports/ only available at L3 (senior)
  }

  const dirName = projectRoot.split(/[/\\]/).pop() || "unknown";
  const projectName = dirName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  // Count existing reports for this project today
  const existing = readdirSync(reportsDir).filter(
    (f) => f.startsWith(`complexity-${projectName}-${date}`)
  );
  const sessionNum = existing.length + 1;

  const filename = `complexity-${projectName}-${date}-session${sessionNum}.json`;
  const filepath = join(reportsDir, filename);

  const reportData = {
    projectName,
    computedAt: report.computedAt,
    score: report.score,
    level: report.level,
    staticScore: report.staticScore,
    behaviorScore: report.behaviorScore,
    staticMetrics: report.staticMetrics,
    behavioralMetrics: report.behavioralMetrics,
    areaScores: report.areaScores,
    reasons: report.reasons,
    suggestions: report.suggestions,
  };

  try {
    writeFileSync(filepath, JSON.stringify(reportData, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
