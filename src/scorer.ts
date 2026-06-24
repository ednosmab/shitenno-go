import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectAnalysis } from "./analyser.js";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface UserBehavior {
  // Governance
  validateFailures: number;
  sessionsWithoutClose: number;
  bufferUpdates: number;
  adrCount: number;

  // Code patterns
  openBranches: number;
  commitsPerWeek: number;
  bugFixesInSameFile: number;

  // Team
  agentCount: number;
  skillCount: number;
}

export interface ComplexityReport {
  score: number;
  level: "junior" | "pleno" | "senior";
  staticScore: number;
  behaviorScore: number;
  reasons: string[];
  suggestions: string[];
}

// ── Main Scoring Function ───────────────────────────────────────────────────

export function calculateComplexityScore(
  projectRoot: string,
  nexusDir: string,
  analysis: ProjectAnalysis
): ComplexityReport {
  const behavior = collectBehaviorMetrics(projectRoot, nexusDir);
  return scoreProject(analysis, behavior);
}

// ── Behavior Metrics Collection ──────────────────────────────────────────────

function collectBehaviorMetrics(
  projectRoot: string,
  nexusDir: string
): UserBehavior {
  return {
    // Governance
    validateFailures: countValidateFailures(nexusDir),
    sessionsWithoutClose: countSessionsWithoutClose(nexusDir),
    bufferUpdates: countBufferUpdates(nexusDir),
    adrCount: countAdrs(nexusDir),

    // Code patterns
    openBranches: countOpenBranches(projectRoot),
    commitsPerWeek: countCommitsPerWeek(projectRoot),
    bugFixesInSameFile: countBugFixes(projectRoot),

    // Team
    agentCount: countAgents(projectRoot),
    skillCount: countSkills(nexusDir),
  };
}

// ── Governance Metrics ───────────────────────────────────────────────────────

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
    // If session is not idle but no close happened
    if (content.includes('status: "in_progress"')) return 1;
    if (content.includes('status: "active"')) return 1;
    return 0;
  } catch {
    return 0;
  }
}

function countBufferUpdates(nexusDir: string): number {
  const bufferPath = join(
    nexusDir,
    "governance",
    "context",
    "context_buffer.yaml"
  );
  if (!existsSync(bufferPath)) return 0;

  try {
    const output = execSync(
      `git log --oneline --follow -- "${bufferPath}" 2>/dev/null | wc -l`,
      {
        encoding: "utf-8",
        timeout: 5000,
      }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countAdrs(nexusDir: string): number {
  const adrDir = join(nexusDir, "docs", "adrs");
  if (!existsSync(adrDir)) return 0;

  return readdirSync(adrDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README") && !f.startsWith("ADR-TEMPLATE")
  ).length;
}

// ── Code Pattern Metrics ─────────────────────────────────────────────────────

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

// ── Team Metrics ─────────────────────────────────────────────────────────────

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
  behavior: UserBehavior
): ComplexityReport {
  let staticScore = 0;
  let behaviorScore = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // ── Static Metrics (Project Structure) ─────────────────────────────────

  if (analysis.packageCount >= 5) {
    staticScore += 2;
    reasons.push(`${analysis.packageCount} packages detected (+2)`);
  } else if (analysis.packageCount >= 3) {
    staticScore += 1;
    reasons.push(`${analysis.packageCount} packages detected (+1)`);
  }

  if (analysis.appCount >= 3) {
    staticScore += 3;
    reasons.push(`${analysis.appCount} apps detected (+3)`);
  } else if (analysis.appCount >= 2) {
    staticScore += 2;
    reasons.push(`${analysis.appCount} apps detected (+2)`);
  }

  if (analysis.sourceFileCount >= 300) {
    staticScore += 2;
    reasons.push(`${analysis.sourceFileCount} source files (+2)`);
  } else if (analysis.sourceFileCount >= 150) {
    staticScore += 1;
    reasons.push(`${analysis.sourceFileCount} source files (+1)`);
  }

  if (analysis.dependencyCount >= 100) {
    staticScore += 2;
    reasons.push(`${analysis.dependencyCount} dependencies (+2)`);
  } else if (analysis.dependencyCount >= 50) {
    staticScore += 1;
    reasons.push(`${analysis.dependencyCount} dependencies (+1)`);
  }

  if (analysis.monorepo) {
    staticScore += 1;
    reasons.push("Monorepo detected (+1)");
  }

  // ── Behavioral Metrics (User Actions) ──────────────────────────────────

  if (behavior.validateFailures >= 3) {
    behaviorScore += 3;
    reasons.push(
      `${behavior.validateFailures} validate failures — precisa de mais estrutura (+3)`
    );
    suggestions.push(
      "Run 'nexus upgrade' to add governance components"
    );
  } else if (behavior.validateFailures >= 1) {
    behaviorScore += 1;
    reasons.push(`${behavior.validateFailures} validate failure(s) (+1)`);
  }

  if (behavior.adrCount >= 3) {
    behaviorScore += 3;
    reasons.push(
      `${behavior.adrCount} ADRs created — active architectural decisions (+3)`
    );
    suggestions.push(
      "Consider adding governance/agents/ for role separation"
    );
  } else if (behavior.adrCount >= 1) {
    behaviorScore += 2;
    reasons.push(`${behavior.adrCount} ADR(s) created (+2)`);
  }

  if (behavior.openBranches >= 5) {
    behaviorScore += 2;
    reasons.push(
      `${behavior.openBranches} feat branches open — parallel development (+2)`
    );
    suggestions.push(
      "Add governance/context/ for session persistence"
    );
  } else if (behavior.openBranches >= 3) {
    behaviorScore += 1;
    reasons.push(`${behavior.openBranches} feat branches open (+1)`);
  }

  if (behavior.commitsPerWeek >= 20) {
    behaviorScore += 2;
    reasons.push(
      `${behavior.commitsPerWeek} commits/week — high velocity (+2)`
    );
  } else if (behavior.commitsPerWeek >= 10) {
    behaviorScore += 1;
    reasons.push(`${behavior.commitsPerWeek} commits/week (+1)`);
  }

  if (behavior.sessionsWithoutClose >= 2) {
    behaviorScore += 2;
    reasons.push(
      `${behavior.sessionsWithoutClose} sessions without close — needs automation (+2)`
    );
    suggestions.push(
      "Add scripts/close-session.ts for session management"
    );
  } else if (behavior.sessionsWithoutClose >= 1) {
    behaviorScore += 1;
    reasons.push(`${behavior.sessionsWithoutClose} unclosed session(s) (+1)`);
  }

  if (behavior.bugFixesInSameFile >= 5) {
    behaviorScore += 2;
    reasons.push(
      `${behavior.bugFixesInSameFile} bug fixes — code instability (+2)`
    );
    suggestions.push(
      "Add tests and governance for affected modules"
    );
  } else if (behavior.bugFixesInSameFile >= 3) {
    behaviorScore += 1;
    reasons.push(
      `${behavior.bugFixesInSameFile} bug fixes detected (+1)`
    );
  }

  if (behavior.agentCount >= 4) {
    behaviorScore += 2;
    reasons.push(
      `${behavior.agentCount} agents configured — needs orchestrator (+2)`
    );
    suggestions.push(
      "Add governance/agents/ with AI contracts"
    );
  }

  if (behavior.skillCount >= 6) {
    behaviorScore += 1;
    reasons.push(
      `${behavior.skillCount} skills installed — multi-domain project (+1)`
    );
  }

  // ── Calculate Final Score ──────────────────────────────────────────────

  const totalScore = staticScore + behaviorScore;
  let level: "junior" | "pleno" | "senior" = "junior";

  if (totalScore >= 10) {
    level = "senior";
  } else if (totalScore >= 5) {
    level = "pleno";
  }

  // Auto-generate suggestions based on level
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
  };
}
