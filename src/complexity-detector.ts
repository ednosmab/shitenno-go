/**
 * complexity-detector.ts — Project Complexity Detection
 *
 * Analyses project structure to determine complexity level.
 * Used by the adaptive rule loader to filter relevant rules.
 *
 * Complexity levels:
 * - simple:  small projects, minimal tooling → only core rules
 * - medium:  standard projects, tests + governance → core + knowledge + governance + quality
 * - complex: large projects, CI/CD, monorepo → all capabilities active
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export type ProjectComplexity = "simple" | "medium" | "complex";

export interface ComplexityFactor {
  name: string;
  score: number;
  description: string;
}

export interface ComplexityResult {
  level: ProjectComplexity;
  score: number;
  factors: ComplexityFactor[];
  recommendedCapabilities: string[];
}

// ── Capability Mappings ────────────────────────────────────────────────────

const CAPABILITY_MAP: Record<ProjectComplexity, string[]> = {
  simple: ["core"],
  medium: ["core", "knowledge", "governance", "quality"],
  complex: [
    "core",
    "knowledge",
    "governance",
    "architecture",
    "ai",
    "quality",
    "metrics",
    "operations",
    "compliance",
  ],
};

// ── Detection Factors ──────────────────────────────────────────────────────

function countSourceFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      count += countSourceFiles(join(dir, item.name));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(item.name)) {
      count++;
    }
  }
  return count;
}

function getDependencyCount(projectRoot: string): number {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return 0;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    return deps + devDeps;
  } catch {
    return 0;
  }
}

function isMonorepo(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, "pnpm-workspace.yaml")) ||
    existsSync(join(projectRoot, "lerna.json")) ||
    existsSync(join(projectRoot, "turbo.json")) ||
    existsSync(join(projectRoot, "nx.json")) ||
    existsSync(join(projectRoot, "rush.json"))
  );
}

function hasTestFramework(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, "jest.config.js")) ||
    existsSync(join(projectRoot, "jest.config.ts")) ||
    existsSync(join(projectRoot, "jest.config.mjs")) ||
    existsSync(join(projectRoot, "vitest.config.ts")) ||
    existsSync(join(projectRoot, "vitest.config.mjs")) ||
    existsSync(join(projectRoot, "cypress.config.ts")) ||
    existsSync(join(projectRoot, "playwright.config.ts"))
  );
}

function hasCICD(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, ".github", "workflows")) ||
    existsSync(join(projectRoot, ".gitlab-ci.yml")) ||
    existsSync(join(projectRoot, ".circleci")) ||
    existsSync(join(projectRoot, "Jenkinsfile")) ||
    existsSync(join(projectRoot, ".travis.yml"))
  );
}

function hasMultiplePackages(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, "apps")) ||
    existsSync(join(projectRoot, "packages")) ||
    existsSync(join(projectRoot, "modules"))
  );
}

// ── Main Detection ─────────────────────────────────────────────────────────

/**
 * Detect project complexity based on structural analysis.
 *
 * @param projectRoot - Root directory of the project
 * @returns Complexity level, score, factors, and recommended capabilities
 */
export function detectComplexity(projectRoot: string): ComplexityResult {
  let score = 0;
  const factors: ComplexityFactor[] = [];

  // Factor 1: Source file count
  const srcFiles = countSourceFiles(join(projectRoot, "src"));
  if (srcFiles > 50) {
    score += 3;
    factors.push({ name: "source_files", score: 3, description: `${srcFiles} source files (>50)` });
  } else if (srcFiles > 10) {
    score += 2;
    factors.push({ name: "source_files", score: 2, description: `${srcFiles} source files (>10)` });
  } else {
    score += 1;
    factors.push({ name: "source_files", score: 1, description: `${srcFiles} source files (simple)` });
  }

  // Factor 2: Dependencies
  const deps = getDependencyCount(projectRoot);
  if (deps > 20) {
    score += 3;
    factors.push({ name: "dependencies", score: 3, description: `${deps} dependencies (>20)` });
  } else if (deps > 5) {
    score += 2;
    factors.push({ name: "dependencies", score: 2, description: `${deps} dependencies (>5)` });
  } else {
    factors.push({ name: "dependencies", score: 0, description: `${deps} dependencies (minimal)` });
  }

  // Factor 3: Monorepo
  if (isMonorepo(projectRoot)) {
    score += 3;
    factors.push({ name: "monorepo", score: 3, description: "Monorepo detected" });
  }

  // Factor 4: Test framework
  if (hasTestFramework(projectRoot)) {
    score += 2;
    factors.push({ name: "tests", score: 2, description: "Test framework detected" });
  }

  // Factor 5: CI/CD
  if (hasCICD(projectRoot)) {
    score += 2;
    factors.push({ name: "cicd", score: 2, description: "CI/CD pipeline detected" });
  }

  // Factor 6: Multiple packages
  if (hasMultiplePackages(projectRoot)) {
    score += 2;
    factors.push({ name: "multi_package", score: 2, description: "Multiple packages detected" });
  }

  // Determine complexity level
  let level: ProjectComplexity;
  if (score <= 4) {
    level = "simple";
  } else if (score <= 8) {
    level = "medium";
  } else {
    level = "complex";
  }

  return {
    level,
    score,
    factors,
    recommendedCapabilities: CAPABILITY_MAP[level],
  };
}
