/**
 * dynamic-rules.ts — Dynamic FORBIDDEN_OPERATIONS Generation
 *
 * Generates rules based on project history:
 * - Git incidents (force pushes, reverts)
 * - Session history (recurring errors)
 * - Pattern detection (recurring issues)
 *
 * PRINCIPLE: Rules should be born from evidence, not assumptions.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ── Types ──────────────────────────────────────────────────────────────────

export type RuleSeverity = "critical" | "high" | "medium" | "low";

export interface DynamicRule {
  /** Unique rule identifier */
  id: string;
  /** The rule text */
  rule: string;
  /** Source of the rule (git, history, pattern) */
  source: "git-incident" | "history-analysis" | "pattern-detection";
  /** Rule severity */
  severity: RuleSeverity;
  /** Evidence supporting this rule */
  evidence: string;
  /** When the rule was generated */
  generatedAt: string;
  /** Number of incidents supporting this rule */
  incidentCount: number;
}

// ── Git Incident Detection ─────────────────────────────────────────────────

function detectGitIncidents(projectRoot: string): DynamicRule[] {
  const rules: DynamicRule[] = [];

  try {
    // Check for force pushes
    const forcePushOutput = execSync(
      'git log --oneline --all --grep="force push" --grep="forced push" --grep="\\+\\+" --since="180 days ago" 2>/dev/null | wc -l',
      { encoding: "utf-8", cwd: projectRoot, timeout: 10000 }
    );
    const forcePushCount = parseInt(forcePushOutput.trim(), 10);
    if (forcePushCount > 0) {
      rules.push({
        id: "git-force-push",
        rule: `This project has ${forcePushCount} force push(es) in the last 180 days. Avoid "git push --force" — use --force-with-lease instead.`,
        source: "git-incident",
        severity: "high",
        evidence: `${forcePushCount} force push(es) detected in git log`,
        generatedAt: new Date().toISOString(),
        incidentCount: forcePushCount,
      });
    }

    // Check for reverts
    const revertOutput = execSync(
      'git log --oneline --all --grep="revert" --since="180 days ago" 2>/dev/null | wc -l',
      { encoding: "utf-8", cwd: projectRoot, timeout: 10000 }
    );
    const revertCount = parseInt(revertOutput.trim(), 10);
    if (revertCount > 2) {
      rules.push({
        id: "git-reverts",
        rule: `This project has ${revertCount} reverts in the last 180 days. Ensure thorough testing before merging.`,
        source: "git-incident",
        severity: "medium",
        evidence: `${revertCount} revert(s) detected in git log`,
        generatedAt: new Date().toISOString(),
        incidentCount: revertCount,
      });
    }

    // Check for hotfixes
    const hotfixOutput = execSync(
      'git log --oneline --all --grep="hotfix" --grep="hot-fix" --grep="urgent" --grep="critical" --since="180 days ago" 2>/dev/null | wc -l',
      { encoding: "utf-8", cwd: projectRoot, timeout: 10000 }
    );
    const hotfixCount = parseInt(hotfixOutput.trim(), 10);
    if (hotfixCount > 3) {
      rules.push({
        id: "git-hotfixes",
        rule: `This project has ${hotfixCount} hotfix(es) in the last 180 days. Consider adding more pre-merge validation.`,
        source: "git-incident",
        severity: "medium",
        evidence: `${hotfixCount} hotfix(es) detected in git log`,
        generatedAt: new Date().toISOString(),
        incidentCount: hotfixCount,
      });
    }
  } catch {
    // Git not available or no history
  }

  return rules;
}

// ── History Analysis ───────────────────────────────────────────────────────

function detectHistoryIncidents(projectRoot: string, nexusDir: string): DynamicRule[] {
  const rules: DynamicRule[] = [];
  const historyDir = join(nexusDir, "docs", "history");

  if (!existsSync(historyDir)) return rules;

  try {
    const files = readdirSync(historyDir).filter((f: string) => f.endsWith(".md"));

    const incidentKeywords = ["erro", "bug", "falhou", "rollback", "incidente", "problema", "broken", "regression"];
    const areaIncidents: Record<string, number> = {};

    for (const file of files) {
      const content = readFileSync(join(historyDir, file), "utf-8").toLowerCase();

      // Detect incidents by keyword
      for (const keyword of incidentKeywords) {
        if (content.includes(keyword)) {
          // Extract area from content (look for src/, packages/, apps/)
          const areaMatches = content.match(/(src|packages|apps|lib)\/[\w/-]+/g) || [];
          for (const area of areaMatches) {
            areaIncidents[area] = (areaIncidents[area] || 0) + 1;
          }
        }
      }
    }

    // Generate rules for areas with multiple incidents
    for (const [area, count] of Object.entries(areaIncidents)) {
      if (count >= 3) {
        rules.push({
          id: `history-incident-${area.replace(/[^a-z0-9]/gi, "-")}`,
          rule: `Area "${area}" has ${count} incident(s) in session history. Apply extra caution when modifying.`,
          source: "history-analysis",
          severity: count >= 5 ? "high" : "medium",
          evidence: `${count} incident(s) found in session history for ${area}`,
          generatedAt: new Date().toISOString(),
          incidentCount: count,
        });
      }
    }
  } catch {
    // History directory not readable
  }

  return rules;
}

// ── Main Function ──────────────────────────────────────────────────────────

export function generateDynamicRules(
  projectRoot: string,
  nexusDir: string
): DynamicRule[] {
  const rules: DynamicRule[] = [];

  // Detect from git
  rules.push(...detectGitIncidents(projectRoot));

  // Detect from history
  rules.push(...detectHistoryIncidents(projectRoot, nexusDir));

  // Sort by severity
  const severityOrder: Record<RuleSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  rules.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Deduplicate by id
  const seen = new Set<string>();
  return rules.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function dynamicRulesToMarkdown(rules: DynamicRule[]): string {
  if (rules.length === 0) return "";

  const lines = ["## Dynamic Rules (Auto-Generated from History)", ""];
  lines.push("*These rules are generated based on your project's actual incident history.*");
  lines.push("");

  for (const rule of rules) {
    const severityIcon = rule.severity === "critical" ? "🚨" : rule.severity === "high" ? "⚠️" : "ℹ️";
    lines.push(`### ${severityIcon} ${rule.id}`);
    lines.push(`**Rule:** ${rule.rule}`);
    lines.push(`**Evidence:** ${rule.evidence}`);
    lines.push(`**Source:** ${rule.source} | **Severity:** ${rule.severity} | **Incidents:** ${rule.incidentCount}`);
    lines.push("");
  }

  return lines.join("\n");
}
