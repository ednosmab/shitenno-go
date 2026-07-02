const NEXUS_ROOT = '../../../../../nexus-system'

export const SOURCES = {
  fingerprint: `${NEXUS_ROOT}/fingerprint.json`,
  maturityProfile: `${NEXUS_ROOT}/maturity-profile.json`,
  contextBuffer: `${NEXUS_ROOT}/governance/context/context_buffer.yaml`,
  backlog: `${NEXUS_ROOT}/docs/BACKLOG.md`,
  feedbackSummary: `${NEXUS_ROOT}/feedback/summary.json`,
  feedbackRecords: `${NEXUS_ROOT}/feedback/records`,
  operationalState: `${NEXUS_ROOT}/cognition/memory/MEM-operational-state-v1.json`,
  systemMap: `${NEXUS_ROOT}/governance/SYSTEM_MAP.md`,
  knowledgeArtifacts: `${NEXUS_ROOT}/governance/knowledge-graph/artifacts.json`,
  knowledgeRelations: `${NEXUS_ROOT}/governance/knowledge-graph/relations.json`,
  agentsDir: `${NEXUS_ROOT}/governance/agents`,
  telemetryDir: `${NEXUS_ROOT}/telemetry`,
  reportsDir: `${NEXUS_ROOT}/reports`,
} as const
