/**
 * rule-manifest.ts — Declarative Rule Selection by Task Metadata
 *
 * PRINCIPLE: Explicit field matching, no inference.
 * Same input -> same rule set, always (deterministic).
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface RuleManifestEntry {
  id: string;
  path: string;
  mandatory?: boolean;
  priority: number;
  when?: Record<string, string>;
}

export interface TaskMetadata {
  task?: string;
  language?: string;
  framework?: string;
  [key: string]: string | undefined;
}

export function loadManifest(manifestPath: string): RuleManifestEntry[] {
  const raw = readFileSync(manifestPath, "utf-8");
  const parsed = parseYaml(raw) as { rules: RuleManifestEntry[] };
  return parsed.rules;
}

/**
 * Resolve which rules apply to a task, ordered by priority
 * (0 = highest). Mandatory rules always apply regardless of `when`.
 */
export function resolveRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): RuleManifestEntry[] {
  const selected = manifest.filter((rule) => {
    if (rule.mandatory) return true;
    if (!rule.when) return false;
    return Object.entries(rule.when).every(
      ([key, value]) => taskMeta[key] === value
    );
  });

  return selected.sort((a, b) => a.priority - b.priority);
}

/**
 * Separate rules into mandatory and contextual groups.
 * Useful for positional injection in prompts and MCP responses.
 */
export function partitionRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): { mandatory: RuleManifestEntry[]; contextual: RuleManifestEntry[] } {
  const resolved = resolveRules(manifest, taskMeta);
  return {
    mandatory: resolved.filter((r) => r.mandatory),
    contextual: resolved.filter((r) => !r.mandatory),
  };
}
