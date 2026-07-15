export type DocType = "plan" | "adr";

export type DocLifecycleStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "superseded"
  | "stale";

export interface StatusMarkerResult {
  status: DocLifecycleStatus | null;
  confidence: number;
  evidence: string[];
}

export interface CrossReference {
  target: string;
  exists: boolean;
}

export interface GitCorrelation {
  lastModified: string;
  referencedFilesExist: boolean;
  recentCommits: boolean;
}

export interface StalenessSignals {
  ageInDays: number;
  referencedByOtherDocs: boolean;
  recentCommits: boolean;
}

export interface DetectionSignals {
  statusMarkers: StatusMarkerResult;
  crossReferences: CrossReference[];
  gitCorrelation: GitCorrelation;
  staleness: StalenessSignals;
  supersessionSignals?: SupersessionSignals;
}

export interface SupersessionSignals {
  keywordsFound: string[];
  topicSimilarity: number;
  supersededBy: string[];
  confidence: number;
}

export interface DocumentInfo {
  path: string;
  relativePath: string;
  title: string;
  content: string;
  docType: DocType;
}

export interface DocumentClassification {
  path: string;
  relativePath: string;
  docType: DocType;
  status: DocLifecycleStatus;
  confidence: number;
  evidence: string[];
  suggestedDestination: string;
}

export interface ProposedMove {
  source: string;
  destination: string;
  docType: DocType;
  status: DocLifecycleStatus;
  reason: string;
}

export interface DocLifecycleReport {
  auditedAt: string;
  totalPlans: number;
  totalAdrs: number;
  classifications: DocumentClassification[];
  proposedMoves: ProposedMove[];
  summary: string;
}

export interface MoveResult {
  movesApplied: number;
  movesSkipped: number;
  errors: string[];
}

export const STALENESS_THRESHOLD_DAYS = 90;
