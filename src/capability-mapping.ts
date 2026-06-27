/**
 * capability-mapping.ts — Shared Capability → File Mapping
 *
 * Fonte única de verdade para o mapeamento capacidade→ficheiros.
 * Usado tanto pelo scaffolder (init) como pelo upgrade (add capability).
 *
 * PRINCÍPIO: Um único sítio de definição — zero divergência.
 */

import type { Capability } from "./maturity-profile.js";

export interface CapabilityFile {
  src: string;
  dest: string;
  customize?: boolean;
}

export interface CapabilityMapping {
  directories: string[];
  files: CapabilityFile[];
}

/**
 * Mapeamento completo de capacidades para diretórios e arquivos.
 * Cada capacidade define exactamente o que instala.
 */
const CAPABILITY_MAPPINGS: Record<Capability, CapabilityMapping> = {
  core: {
    directories: [
      "nexus-system",
      "nexus-system/docs",
      "nexus-system/scripts",
      "nexus-system/core",
      "nexus-system/core/complexity",
      "nexus-system/governance",
      "nexus-system/governance/agents",
      "nexus-profile",
      "nexus-system/docs/feedback",
    ],
    files: [
      { src: "docs/AGENTS.md", dest: "nexus-system/docs/AGENTS.md", customize: true },
      { src: "docs/opencode-context.md", dest: "nexus-system/docs/opencode-context.md", customize: true },
      { src: "docs/Nexus-System_GUIDE.md", dest: "nexus-system/docs/Nexus-System_GUIDE.md", customize: true },
      { src: "docs/FORBIDDEN_OPERATIONS.md", dest: "nexus-system/docs/FORBIDDEN_OPERATIONS.md" },
      { src: "docs/DESDO.md", dest: "nexus-system/docs/DESDO.md" },
      { src: "docs/BACKLOG.md", dest: "nexus-system/docs/BACKLOG.md" },
      { src: "core/complexity/types.ts", dest: "nexus-system/core/complexity/types.ts" },
      { src: "docs/feedback/README.md", dest: "nexus-system/docs/feedback/README.md" },
      { src: "governance/SYSTEM_MAP.md", dest: "nexus-system/governance/SYSTEM_MAP.md" },
    ],
  },
  knowledge: {
    directories: [
      "nexus-system/docs/skills",
    ],
    files: [], // Skills are copied separately via selectSkills
  },
  architecture: {
    directories: [
      "nexus-system/docs/adrs",
      "nexus-system/docs/sdr",
      "nexus-system/docs/plans",
      "nexus-system/docs/session-template",
      "nexus-system/docs/layers",
    ],
    files: [
      { src: "docs/adrs/ADR-TEMPLATE.md", dest: "nexus-system/docs/adrs/ADR-TEMPLATE.md" },
      { src: "docs/sdr/SDR-TEMPLATE.md", dest: "nexus-system/docs/sdr/SDR-TEMPLATE.md" },
      { src: "docs/plans/TEMPLATE.md", dest: "nexus-system/docs/plans/TEMPLATE.md" },
      { src: "docs/session-template.md", dest: "nexus-system/docs/session-template.md" },
    ],
  },
  governance: {
    directories: [
      "nexus-system/governance/context",
    ],
    files: [
      { src: "governance/WORKFLOW.md", dest: "nexus-system/governance/WORKFLOW.md", customize: true },
      { src: "governance/context/context_buffer.yaml", dest: "nexus-system/governance/context/context_buffer.yaml" },
    ],
  },
  ai: {
    directories: [
      "nexus-system/governance/contracts",
      "nexus-system/governance/handoffs",
      "nexus-system/governance/policies",
      "nexus-system/cognition",
      "nexus-system/cognition/context",
      "nexus-system/cognition/memory",
      "nexus-system/cognition/prompts",
      "nexus-system/cognition/prompts/executor",
      "nexus-system/cognition/prompts/planner",
      "nexus-system/cognition/prompts/reviewer",
    ],
    files: [
      { src: "governance/agents/AI-CONTRACT-planner-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-planner-v1.yaml" },
      { src: "governance/agents/AI-CONTRACT-executor-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-executor-v1.yaml" },
      { src: "governance/agents/AI-CONTRACT-reviewer-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-reviewer-v1.yaml" },
      { src: "governance/agents/AI-CONTRACT-orchestrator-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-orchestrator-v1.yaml" },
      { src: "governance/contracts/CONTRACTS_INDEX.md", dest: "nexus-system/governance/contracts/CONTRACTS_INDEX.md" },
      { src: "governance/handoffs/TEMPLATE.md", dest: "nexus-system/governance/handoffs/TEMPLATE.md" },
      { src: "cognition/context/CONTEXT_HIERARCHY.md", dest: "nexus-system/cognition/context/CONTEXT_HIERARCHY.md" },
      { src: "cognition/memory/MEM-operational-state-v1.json", dest: "nexus-system/cognition/memory/MEM-operational-state-v1.json" },
      { src: "cognition/prompts/executor/README.md", dest: "nexus-system/cognition/prompts/executor/README.md" },
      { src: "cognition/prompts/planner/README.md", dest: "nexus-system/cognition/prompts/planner/README.md" },
      { src: "cognition/prompts/reviewer/README.md", dest: "nexus-system/cognition/prompts/reviewer/README.md" },
    ],
  },
  quality: {
    directories: [],
    files: [
      { src: "scripts/validate-session.ts", dest: "nexus-system/scripts/validate-session.ts" },
    ],
  },
  metrics: {
    directories: [
      "nexus-system/reports",
      "nexus-system/docs/history",
    ],
    files: [
      { src: "docs/reports/README.md", dest: "nexus-system/reports/README.md" },
    ],
  },
  operations: {
    directories: [
      "nexus-system/docs/runbooks",
    ],
    files: [
      { src: "scripts/close-session.ts", dest: "nexus-system/scripts/close-session.ts" },
      { src: "scripts/premortem-check.ts", dest: "nexus-system/scripts/premortem-check.ts" },
      { src: "docs/runbooks/merge.md", dest: "nexus-system/docs/runbooks/merge.md" },
    ],
  },
  compliance: {
    directories: [
      "nexus-system/governance/premortem",
      "nexus-system/governance/reviews",
    ],
    files: [
      { src: "governance/premortem/PREMORTEM.md", dest: "nexus-system/governance/premortem/PREMORTEM.md" },
      { src: "governance/reviews/SESSION_REVIEW.md", dest: "nexus-system/governance/reviews/SESSION_REVIEW.md" },
    ],
  },
};

/** Obtém o mapeamento de uma capacidade. */
export function getCapabilityMapping(capability: Capability): CapabilityMapping {
  return CAPABILITY_MAPPINGS[capability];
}

/** Obtém os ficheiros de uma capacidade (sem directórios). */
export function getCapabilityFiles(capability: Capability): CapabilityFile[] {
  return CAPABILITY_MAPPINGS[capability].files;
}

/** Obtém os directórios de uma capacidade. */
export function getCapabilityDirectories(capability: Capability): string[] {
  return CAPABILITY_MAPPINGS[capability].directories;
}
