export interface Fingerprint {
  hash: string
  detectedAt: string
  domain: string
  stack: string[]
  scale: string
  tooling: {
    typescript: boolean
    tests: boolean
    ci: boolean
    linter: boolean
    monorepo: boolean
  }
  maturityScore: number
  version: number
}

export interface MaturityDimensions {
  architecture: number
  governance: number
  quality: number
  automation: number
  ai: number
  documentation: number
  observability: number
}

export interface MaturityProfile {
  dimensions: MaturityDimensions
  overallScore: number
  recommendedCapabilities: string[]
  installedCapabilities: string[]
  futureCapabilities: string[]
  computedAt: string
}

export interface TelemetrySnapshot {
  timestamp: string
  dimensions: MaturityDimensions
  overallScore: number
  installedCapabilities: string[]
}

export interface StaticMetric {
  metric: string
  value: number
  score: number
  evidence: string
}

export interface BehavioralMetric {
  signal: string
  value: number
  score: number
  evidence: string
  suggestion?: string
}

export interface AreaScore {
  area: string
  score: number
  level: string
  fileCount: number
  churn: number
  sensitiveSurface: number
  violations: number
  dependencyDepth: number
  incidentFreeAge: number
  contextPressure: number
  evidence: string
}

export interface ComplexityReport {
  projectName: string
  computedAt: string
  score: number
  level: string
  staticScore: number
  behaviorScore: number
  staticMetrics: StaticMetric[]
  behavioralMetrics: BehavioralMetric[]
  areaScores: AreaScore[]
  reasons: string[]
  suggestions: string[]
}

export interface HealthIssue {
  type: string
  severity: number
  description: string
  location: string
  recommendation: string
}

export interface HealthReport {
  auditedAt: string
  totalRules: number
  historyEntries: number
  sessionsAnalyzed: number
  issues: HealthIssue[]
  optimizations: string[]
  healthScore: number
  summary: string
}

export interface SessionBuffer {
  session: {
    id: string
    started_at: string
    status: string
  }
  current_task: {
    id: string
    description: string
    status: string
    started_at: string
    completed_at?: string
  }
  documents_loaded: Array<{ path: string; loaded_at: string }>
  impediments: string[]
  technical_debt: string[]
  model_assignments: {
    planner: string
    executor: string
    reviewer: string
  }
  completed_tasks?: Array<{
    id: string
    description: string
    completed_at: string
    files_created?: string[]
    files_modified?: string[]
  }>
}

export interface FeedbackSummary {
  [key: string]: {
    recommendationId: string
    acceptCount: number
    rejectCount: number
    deferCount: number
    totalInteractions: number
    acceptanceRate: number
    lastAction: string
    lastTimestamp: string
    pathChoiceStats: {
      comfortableCount: number
      challengingCount: number
      lastPathChoice: string | null
    }
  }
}

export interface FeedbackRecord {
  id: string
  recommendationId: string
  action: string
  dimension: string
  evidence: string
  context: {
    maturityScore: number
    installedCapabilities: string[]
    knowledgeDebt: number
  }
  timestamp: string
}

export interface OperationalState {
  version: string
  last_updated: string
  system_state: {
    initialized: boolean
    version: string
    components: {
      cognition: Record<string, boolean>
      docs: Record<string, boolean>
      governance: Record<string, boolean>
      scripts: Record<string, boolean>
    }
  }
  session_history: unknown[]
  metrics: {
    total_sessions: number
    total_tasks: number
    completed_tasks: number
    failed_tasks: number
  }
}

export interface AgentContract {
  agent: {
    name: string
    role: string
    objective: string
  }
  inputs: Array<{ type: string; format: string }>
  outputs: Array<{ artifact: string; schema: string }>
  allowed_actions: string[]
  restricted_actions: string[]
  allowed_tools: string[]
  handoff: {
    incoming: string
    outgoing: string
  }
  failure_policy: {
    retry: number
    escalation: string
  }
}

export interface BacklogItem {
  id: string
  description: string
  status: string
  priority: string
  criteria: string
  completed_at?: string
}

export interface KnowledgeArtifact {
  id: string
  type: string
  path: string
  name: string
}

export interface KnowledgeRelation {
  from: string
  to: string
  type: string
}
