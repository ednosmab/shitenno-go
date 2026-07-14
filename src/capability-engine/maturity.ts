import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { CAPABILITIES, type Capability, type CapabilityInfo } from "../maturity-profile.js";
import type { CapabilityMaturity, CapabilityEntity } from "./types.js";

export function detectCapabilityMaturity(
  capability: Capability,
  nexusDir: string,
  installedCapabilities: Capability[]
): { level: CapabilityMaturity; score: number } {
  if (!installedCapabilities.includes(capability)) {
    return { level: "dormant", score: 0 };
  }

  const capInfo = CAPABILITIES.find((c) => c.id === capability);
  if (!capInfo) return { level: "dormant", score: 0 };

  let score = 20;

  if (checkCapabilityFiles(capability, nexusDir)) score += 20;
  if (checkCapabilityRules(capability, nexusDir)) score += 20;
  if (checkCapabilitySkills(capability, nexusDir)) score += 15;
  if (checkCapabilityTemplates(capability, nexusDir)) score += 10;
  if (checkCapabilityMetrics(capability, nexusDir)) score += 15;

  let level: CapabilityMaturity;
  if (score >= 80) level = "optimized";
  else if (score >= 60) level = "active";
  else if (score >= 40) level = "configured";
  else level = "installed";

  return { level, score: Math.min(100, score) };
}

function checkCapabilityFiles(capability: Capability, nexusDir: string): boolean {
  const mapping = getCapabilityFilesForEngine(capability);
  return mapping.some((f) => existsSync(join(nexusDir, f)));
}

function checkCapabilityRules(capability: Capability, nexusDir: string): boolean {
  const rulesDir = join(nexusDir, "governance", "rules");
  if (!existsSync(rulesDir)) return false;

  const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
  for (const file of ruleFiles) {
    try {
      const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
      if (content.tags && content.tags.includes(capability)) return true;
    } catch {
      logger.debug("capability-engine", "Failed to parse rule file:", file);
    }
  }
  return false;
}

function checkCapabilitySkills(_capability: Capability, nexusDir: string): boolean {
  const skillsDir = join(nexusDir, "docs", "skills");
  if (!existsSync(skillsDir)) return false;
  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length > 0;
}

function checkCapabilityTemplates(_capability: Capability, nexusDir: string): boolean {
  const templatesDir = join(nexusDir, "templates");
  if (!existsSync(templatesDir)) return false;
  return readdirSync(templatesDir).filter(
    (f) => f.endsWith(".md") || f.endsWith(".yaml")
  ).length > 0;
}

function checkCapabilityMetrics(_capability: Capability, nexusDir: string): boolean {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return false;
  return readdirSync(reportsDir).filter((f) => f.endsWith(".json")).length > 0;
}

export function getCapabilityFilesForEngine(capability: Capability): string[] {
  const fileMap: Record<Capability, string[]> = {
    core: ["docs/BACKLOG.md", "docs/AGENTS.md"],
    knowledge: ["docs/skills/", "docs/AGENTS.md"],
    architecture: ["docs/adrs/", "governance/plans/"],
    governance: ["governance/WORKFLOW.md", "governance/context/"],
    ai: ["governance/agents/", "cognition/"],
    quality: ["scripts/validate-session.ts"],
    metrics: ["reports/"],
    operations: ["scripts/close-session.ts", "docs/runbooks/"],
    compliance: ["docs/FORBIDDEN_OPERATIONS.md", "docs/DESDO.md"],
  };
  return fileMap[capability] || [];
}

export function buildCapabilityEntity(
  capInfo: CapabilityInfo,
  nexusDir: string,
  installedCapabilities: Capability[],
  assets: Array<{ type: string; path: string }>,
  _maturityScore: number
): CapabilityEntity {
  const isInstalled = installedCapabilities.includes(capInfo.id);
  const { level, score } = detectCapabilityMaturity(capInfo.id, nexusDir, installedCapabilities);

  const capabilityAssets = assets.filter((a) => {
    const mapping = getCapabilityFilesForEngine(capInfo.id);
    return mapping.some((m) => a.path.startsWith(m.replace(/\/$/, "")));
  });

  const activePolicies = collectCapabilityPolicies(capInfo.id, nexusDir);
  const activeSkills = collectCapabilitySkills(capInfo.id, nexusDir);
  const templates = collectCapabilityTemplates(capInfo.id, nexusDir);

  return {
    id: capInfo.id,
    name: capInfo.name,
    description: capInfo.description,
    maturity: level,
    maturityScore: score,
    dimensions: capInfo.dimensions,
    dependencies: capInfo.requires,
    activePolicies,
    activeSkills,
    templates,
    recommendations: [],
    metrics: {
      assetCount: capabilityAssets.length,
      ruleCount: activePolicies.length,
      policyCount: activePolicies.length,
      healthScore: score,
      lastUpdated: new Date().toISOString(),
      referenceCount: 0,
    },
    alwaysInstalled: capInfo.alwaysInstalled,
    isInstalled,
    files: getCapabilityFilesForEngine(capInfo.id),
  };
}

function collectCapabilityPolicies(capability: Capability, nexusDir: string): string[] {
  const policies: string[] = [];
  const rulesDir = join(nexusDir, "governance", "rules");
  if (!existsSync(rulesDir)) return policies;

  const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
  for (const file of ruleFiles) {
    try {
      const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
      if (content.tags && content.tags.includes(capability)) {
        policies.push(content.id || file.replace(".json", ""));
      }
    } catch {
      logger.debug("capability-engine", "Failed to parse rule file:", file);
    }
  }
  return policies;
}

function collectCapabilitySkills(_capability: Capability, nexusDir: string): string[] {
  const skills: string[] = [];
  const skillsDir = join(nexusDir, "docs", "skills");
  if (!existsSync(skillsDir)) return skills;

  const skillFiles = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  for (const file of skillFiles) {
    skills.push(file.replace(".md", ""));
  }
  return skills;
}

function collectCapabilityTemplates(_capability: Capability, nexusDir: string): string[] {
  const templates: string[] = [];
  const templatesDir = join(nexusDir, "templates");
  if (!existsSync(templatesDir)) return templates;

  const templateFiles = readdirSync(templatesDir).filter(
    (f) => f.endsWith(".md") || f.endsWith(".yaml")
  );
  for (const file of templateFiles) {
    templates.push(file);
  }
  return templates;
}
