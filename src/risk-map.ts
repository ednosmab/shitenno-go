/**
 * risk-map.ts — Project Risk Mapping
 *
 * Maps project areas to risk levels based on:
 * - Test coverage (files without tests)
 * - Code churn (git log correlation)
 * - File size (large files = higher risk)
 * - Import complexity (many imports = higher coupling)
 *
 * PRINCIPLE: Risk should be visible before it becomes incident.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  /** Factor type */
  type: "no-tests" | "high-churn" | "large-file" | "many-imports" | "no-types" | "sensitive-keyword";
  /** Factor description */
  description: string;
  /** Factor weight (0-1) */
  weight: number;
}

export interface RiskArea {
  /** Directory path relative to project root */
  path: string;
  /** Overall risk level */
  riskLevel: RiskLevel;
  /** Risk score (0-100) */
  score: number;
  /** Contributing risk factors */
  factors: RiskFactor[];
  /** Number of source files in area */
  fileCount: number;
}

export interface RiskMap {
  /** When the risk map was generated */
  generatedAt: string;
  /** Overall project risk level */
  overallRisk: RiskLevel;
  /** Overall risk score (0-100) */
  overallScore: number;
  /** All mapped areas */
  areas: RiskArea[];
  /** Summary */
  summary: string;
}

// ── Risk Detection ─────────────────────────────────────────────────────────

const SENSITIVE_KEYWORDS = ["auth", "payment", "security", "session", "token", "password", "secret"];

function getSourceFiles(dir: string, extensions = [".ts", ".tsx", ".js", ".jsx"]): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...getSourceFiles(fullPath, extensions));
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    logger.debug("risk-map", `Permission error reading ${dir}: ${err}`);
  }
  return files;
}

function hasTestFile(filePath: string): boolean {
  const base = filePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  const testPatterns = [
    `${base}.test.ts`,
    `${base}.test.tsx`,
    `${base}.spec.ts`,
    `${base}.spec.tsx`,
    `${base}.test.js`,
    `${base}.spec.js`,
  ];
  return testPatterns.some((p) => existsSync(p));
}

function getFileLineCount(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch (err) {
    logger.debug("risk-map", `Cannot read file for line count: ${err}`);
    return 0;
  }
}

function getImportCount(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    const importMatches = content.match(/^import\s+.*from\s+["'].*["']/gm) || [];
    return importMatches.length;
  } catch (err) {
    logger.debug("risk-map", `Cannot read file for import count: ${err}`);
    return 0;
  }
}

function getChurnData(projectRoot: string): Map<string, number> {
  const churn = new Map<string, number>();
  try {
    const output = execSync(
      'git log --pretty=format:"" --name-only --since="90 days ago" 2>/dev/null | sort | uniq -c | sort -rn | head -50',
      { encoding: "utf-8", cwd: projectRoot, timeout: 10000 }
    );
    for (const line of output.trim().split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match && match[1] && match[2]) {
        churn.set(match[2], parseInt(match[1], 10));
      }
    }
  } catch (err) {
    logger.debug("risk-map", `Git not available or no history: ${err}`);
  }
  return churn;
}

function detectSensitiveKeywords(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8").toLowerCase();
    return SENSITIVE_KEYWORDS.some((kw) => content.includes(kw));
  } catch (err) {
    logger.debug("risk-map", `Cannot read file for sensitive keywords: ${err}`);
    return false;
  }
}

// ── Area Analysis ──────────────────────────────────────────────────────────

function analyzeArea(
  projectRoot: string,
  areaPath: string,
  churnData: Map<string, number>
): RiskArea {
  const fullPath = join(projectRoot, areaPath);
  const files = getSourceFiles(fullPath);
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Check each file for risk factors
  for (const file of files) {
    const relPath = relative(projectRoot, file);

    // No tests
    if (!hasTestFile(file)) {
      factors.push({
        type: "no-tests",
        description: `No test file for ${relPath}`,
        weight: 0.3,
      });
      totalScore += 15;
    }

    // High churn
    const churn = churnData.get(relPath) || 0;
    if (churn > 10) {
      factors.push({
        type: "high-churn",
        description: `${relPath} changed ${churn} times in 90 days`,
        weight: 0.25,
      });
      totalScore += 10;
    }

    // Large file
    const lineCount = getFileLineCount(file);
    if (lineCount > 300) {
      factors.push({
        type: "large-file",
        description: `${relPath} has ${lineCount} lines`,
        weight: 0.2,
      });
      totalScore += 8;
    }

    // Many imports (high coupling)
    const importCount = getImportCount(file);
    if (importCount > 15) {
      factors.push({
        type: "many-imports",
        description: `${relPath} has ${importCount} imports`,
        weight: 0.15,
      });
      totalScore += 5;
    }

    // Sensitive keywords
    if (detectSensitiveKeywords(file)) {
      factors.push({
        type: "sensitive-keyword",
        description: `${relPath} contains sensitive keywords`,
        weight: 0.1,
      });
      totalScore += 3;
    }
  }

  // Normalize score to 0-100
  const normalizedScore = Math.min(100, totalScore);

  // Determine risk level
  let riskLevel: RiskLevel;
  if (normalizedScore >= 70) riskLevel = "critical";
  else if (normalizedScore >= 40) riskLevel = "high";
  else if (normalizedScore >= 15) riskLevel = "medium";
  else riskLevel = "low";

  // Deduplicate factors
  const uniqueFactors = factors.slice(0, 10); // Top 10 factors

  return {
    path: areaPath,
    riskLevel,
    score: normalizedScore,
    factors: uniqueFactors,
    fileCount: files.length,
  };
}

// ── Main Function ──────────────────────────────────────────────────────────

export function generateRiskMap(projectRoot: string, _nexusDir: string): RiskMap {
  const areas: RiskArea[] = [];

  // Detect areas to analyze
  const possibleAreas = ["src", "lib", "packages", "apps", "pages", "components", "services", "utils"];

  for (const area of possibleAreas) {
    const areaPath = area;
    const fullPath = join(projectRoot, areaPath);
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        areas.push(analyzeArea(projectRoot, areaPath, getChurnData(projectRoot)));
      }
    }
  }

  // If no standard areas found, analyze root src/ or project root
  if (areas.length === 0) {
    const srcPath = join(projectRoot, "src");
    if (existsSync(srcPath)) {
      areas.push(analyzeArea(projectRoot, "src", getChurnData(projectRoot)));
    } else {
      areas.push(analyzeArea(projectRoot, ".", getChurnData(projectRoot)));
    }
  }

  // Calculate overall score
  const totalScore = areas.reduce((sum, a) => sum + a.score, 0);
  const overallScore = areas.length > 0 ? Math.round(totalScore / areas.length) : 0;

  // Determine overall risk level
  let overallRisk: RiskLevel;
  if (overallScore >= 70) overallRisk = "critical";
  else if (overallScore >= 40) overallRisk = "high";
  else if (overallScore >= 15) overallRisk = "medium";
  else overallRisk = "low";

  // Generate summary
  const criticalAreas = areas.filter((a) => a.riskLevel === "critical" || a.riskLevel === "high");
  const summary = criticalAreas.length > 0
    ? `${criticalAreas.length} area(s) with high/critical risk detected. Focus on: ${criticalAreas.map((a) => a.path).join(", ")}`
    : "All areas within acceptable risk levels.";

  return {
    generatedAt: new Date().toISOString(),
    overallRisk,
    overallScore,
    areas,
    summary,
  };
}
