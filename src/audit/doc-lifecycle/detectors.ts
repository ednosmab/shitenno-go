import { basename } from "node:path";
import type { DocLifecycleStatus, StatusMarkerResult, CrossReference, SupersessionSignals, DocumentInfo } from "./types.js";

// ── Status Marker Detection ──────────────────────────────────────────────────

const STATUS_PATTERNS: Array<{ regex: RegExp; status: DocLifecycleStatus; confidence: number }> = [
  { regex: /\*\*Status:\*\*\s*(?:Concluído|Completed|Done|Finished|Aceite|Accepted)/gi, status: "completed", confidence: 0.9 },
  { regex: /Status:\s*(?:Concluído|Completed|Done|Finished|Aceite|Accepted)/gi, status: "completed", confidence: 0.85 },
  { regex: /(?:✓|✔|✅)\s*(?:Concluído|Completed|Done)/gi, status: "completed", confidence: 0.8 },
  { regex: /\*\*Status:\*\*\s*(?:Pendente|Pending|Planned|Todo|Proposed)/gi, status: "planned", confidence: 0.9 },
  { regex: /Status:\s*(?:Pendente|Pending|Planned|Todo|Proposed)/gi, status: "planned", confidence: 0.85 },
  { regex: /TODO:\s/gi, status: "planned", confidence: 0.6 },
  { regex: /\*\*Objetivo:\*\*/gi, status: "planned", confidence: 0.5 },
  { regex: /\*\*Status:\*\*\s*(?:Em andamento|In Progress|Active)/gi, status: "in_progress", confidence: 0.9 },
  { regex: /Status:\s*(?:Em andamento|In Progress|Active)/gi, status: "in_progress", confidence: 0.85 },
  { regex: /(?:🔄|⏳|🚧)\s*(?:Em andamento|In Progress)/gi, status: "in_progress", confidence: 0.8 },
  { regex: /\*\*Status:\*\*\s*(?:Superseded|Deprecated|Substituído)/gi, status: "superseded", confidence: 0.9 },
  { regex: /(?:Substituído por|Superseded by|Replaced by|See instead)[:\s]+/gi, status: "superseded", confidence: 0.9 },
];

export function detectStatusMarkers(content: string): StatusMarkerResult {
  const evidence: string[] = [];
  const statusCounts: Record<DocLifecycleStatus, number> = {
    planned: 0,
    in_progress: 0,
    completed: 0,
    superseded: 0,
    stale: 0,
  };

  for (const pattern of STATUS_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      for (const match of matches) {
        statusCounts[pattern.status]++;
        evidence.push(match.trim());
      }
    }
  }

  let maxCount = 0;
  let detectedStatus: DocLifecycleStatus | null = null;

  for (const [status, count] of Object.entries(statusCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedStatus = status as DocLifecycleStatus;
    }
  }

  if (detectedStatus === null || maxCount === 0) {
    return { status: null, confidence: 0, evidence: [] };
  }

  const totalMarkers = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const consistency = maxCount / totalMarkers;
  const confidence = Math.min(0.95, consistency * 0.9);

  return { status: detectedStatus, confidence, evidence };
}

// ── Cross-Reference Detection ────────────────────────────────────────────────

const CROSS_REF_PATTERNS: RegExp[] = [
  /(?:ver|see|ref:|refira|consulte|consultar)[:\s]+[`"]?([a-zA-Z0-9_\-/.]+\.md)[`"]?/gi,
  /\[([^\]]+)\]\(([^)]+\.md)\)/g,
  /(?:substituído por|superseded by|replaced by|see instead)[:\s]+[`"]?([a-zA-Z0-9_\-/.]+\.md)[`"]?/gi,
];

export function detectCrossReferences(content: string, allDocs: string[]): CrossReference[] {
  const refs: CrossReference[] = [];
  const seen = new Set<string>();

  for (const pattern of CROSS_REF_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const target = match[1] || match[2];
      if (target && !seen.has(target)) {
        seen.add(target);
        const exists = allDocs.some((doc) => doc.endsWith(target) || doc.includes(target));
        refs.push({ target, exists });
      }
    }
  }

  return refs;
}

// ── ADR Supersession Detection ──────────────────────────────────────────────

function extractTopicWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/^adr-\d+:\s*/, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "about", "using", "should"].includes(w));
}

function calculateTopicSimilarity(title1: string, title2: string): number {
  const words1 = extractTopicWords(title1);
  const words2 = extractTopicWords(title2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = [...set1].filter((w) => set2.has(w));

  return intersection.length / Math.max(set1.size, set2.size);
}

export function detectSupersession(adr: DocumentInfo, allAdrs: DocumentInfo[]): SupersessionSignals {
  const keywordsFound: string[] = [];
  const supersededBy: string[] = [];
  let maxSimilarity = 0;
  const adrName = basename(adr.path, ".md").toLowerCase();

  const contentLower = adr.content.toLowerCase();
  const supersededByPatterns = [
    /superseded by/i,
    /supersedes/i,
    /replaced by/i,
    /replaces/i,
    /substituído por/i,
    /substitui/i,
    /see instead/i,
    /ver instead/i,
    /obsolete/i,
    /no longer valid/i,
  ];

  for (const pattern of supersededByPatterns) {
    if (pattern.test(contentLower)) {
      keywordsFound.push(pattern.source);
    }
  }

  for (const other of allAdrs) {
    if (other.path === adr.path) continue;

    const similarity = calculateTopicSimilarity(adr.title, other.title);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }

    const otherContentLower = other.content.toLowerCase();
    if (
      otherContentLower.includes(`supersedes ${adrName}`) ||
      otherContentLower.includes(`substitui ${adrName}`) ||
      otherContentLower.includes(`replaces ${adrName}`)
    ) {
      supersededBy.push(basename(other.path, ".md"));
    }
  }

  let confidence = 0;
  if (keywordsFound.length > 0) confidence += 0.4;
  if (supersededBy.length > 0) confidence += 0.4;
  if (maxSimilarity > 0.5) confidence += 0.2;

  return {
    keywordsFound,
    topicSimilarity: maxSimilarity,
    supersededBy,
    confidence: Math.min(0.95, confidence),
  };
}
