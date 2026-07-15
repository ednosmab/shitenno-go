import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { execSync } from "node:child_process";
import type {
  DocType,
  DocLifecycleStatus,
  DocumentInfo,
  DocumentClassification,
  DetectionSignals,
} from "./types.js";
import { STALENESS_THRESHOLD_DAYS } from "./types.js";

function getSuggestedDestination(docType: DocType, status: DocLifecycleStatus): string {
  if (docType === "adr") {
    switch (status) {
      case "superseded":
        return "_archive/superseded";
      case "completed":
      case "planned":
      case "in_progress":
      default:
        return "adrs";
    }
  }

  switch (status) {
    case "planned":
    case "in_progress":
      return "_active";
    case "completed":
      return "_archive/completed";
    case "superseded":
      return "_archive/superseded";
    case "stale":
      return "_review";
  }
}

export function classifyDocument(doc: DocumentInfo, signals: DetectionSignals): DocumentClassification {
  let status: DocLifecycleStatus;
  let confidence: number;
  const evidence: string[] = [];

  if (signals.statusMarkers.status) {
    status = signals.statusMarkers.status;
    confidence = signals.statusMarkers.confidence;
    evidence.push(...signals.statusMarkers.evidence);
  }
  else if (doc.docType === "adr" && signals.supersessionSignals && signals.supersessionSignals.confidence >= 0.4) {
    status = "superseded";
    confidence = signals.supersessionSignals.confidence;
    evidence.push(`Supersession keywords: ${signals.supersessionSignals.keywordsFound.join(", ")}`);
    if (signals.supersessionSignals.supersededBy.length > 0) {
      evidence.push(`Referenced by: ${signals.supersessionSignals.supersededBy.join(", ")}`);
    }
  }
  else if (signals.crossReferences.some((r) => !r.exists)) {
    status = "superseded";
    confidence = 0.7;
    evidence.push("References non-existent documents");
  }
  else if (signals.staleness.ageInDays > STALENESS_THRESHOLD_DAYS && !signals.staleness.referencedByOtherDocs && !signals.staleness.recentCommits) {
    status = "stale";
    confidence = 0.6;
    evidence.push(`No activity in ${signals.staleness.ageInDays} days (threshold: ${STALENESS_THRESHOLD_DAYS})`);
  }
  else {
    status = "stale";
    confidence = 0.4;
    evidence.push("No clear status indicators found");
  }

  if (signals.statusMarkers.status && signals.gitCorrelation.referencedFilesExist) {
    confidence = Math.min(0.95, confidence + 0.1);
    evidence.push("Git correlation confirms status");
  }

  if (signals.staleness.referencedByOtherDocs && status !== "stale") {
    confidence = Math.min(0.95, confidence + 0.05);
    evidence.push("Referenced by other documents");
  }

  return {
    path: doc.path,
    relativePath: doc.relativePath,
    docType: doc.docType,
    status,
    confidence,
    evidence,
    suggestedDestination: getSuggestedDestination(doc.docType, status),
  };
}

function discoverDocuments(projectRoot: string, nexusDir: string): DocumentInfo[] {
  const docs: DocumentInfo[] = [];

  const planDirs = [join(nexusDir, "plans"), join(projectRoot, "plans")];
  for (const dir of planDirs) {
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir, { recursive: true })
      .filter((f): f is string => typeof f === "string" && f.endsWith(".md") && !basename(f).startsWith("README"));

    for (const file of files) {
      const fullPath = join(dir, file);
      if (!existsSync(fullPath)) continue;

      const content = readFileSync(fullPath, "utf-8");
      const relPath = relative(projectRoot, fullPath);

      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1] ?? basename(file, ".md");

      docs.push({
        path: fullPath,
        relativePath: relPath,
        title,
        content,
        docType: "plan",
      });
    }
  }

  const adrDir = join(nexusDir, "docs", "adrs");
  if (existsSync(adrDir)) {
    const files = readdirSync(adrDir, { recursive: true })
      .filter((f): f is string => typeof f === "string" && f.endsWith(".md") && !basename(f).startsWith("README") && !basename(f).startsWith("ADR-TEMPLATE"));

    for (const file of files) {
      const fullPath = join(adrDir, file);
      if (!existsSync(fullPath)) continue;

      const content = readFileSync(fullPath, "utf-8");
      const relPath = relative(projectRoot, fullPath);

      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1] ?? basename(file, ".md");

      docs.push({
        path: fullPath,
        relativePath: relPath,
        title,
        content,
        docType: "adr",
      });
    }
  }

  return docs;
}

function hasRecentCommits(filePath: string, days: number): boolean {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const result = execSync(
      `git log --since="${cutoff}" --oneline -- "${filePath}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

function getLastModified(filePath: string): string {
  try {
    const result = execSync(
      `git log -1 --format="%aI" -- "${filePath}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    return result || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export { discoverDocuments, hasRecentCommits, getLastModified };
