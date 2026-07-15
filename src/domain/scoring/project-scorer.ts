import { join } from "node:path";
import { getEventBus } from "../../event-bus.js";
import { FileContentCache } from "../../utils.js";
import type { ProjectAnalysis } from "../../analyser.js";
import type { AreaScore, ComplexityReport } from "../entities/engineering-state.js";
import type { ProjectProfile } from "./profile-loader.js";
import { batchScoreArea, batchGitChurn, preReadHistory, countContextPressure, type AreaMetrics } from "./area-scorer.js";

export function calculateAreaScores(
  projectRoot: string,
  nexusDir: string,
  profile: ProjectProfile,
  cache: FileContentCache
): Promise<AreaScore[]> {

  const churnMap = batchGitChurn(projectRoot, profile.areas, profile.churnWindowDays);
  const history = preReadHistory(nexusDir, profile.areas, profile.violationKeywords);

  const areaMetricsPromises = profile.areas.map((area) => {
    const areaPath = join(projectRoot, area);
    return new Promise<{ area: string; metrics: AreaMetrics }>((resolve) => {
      setImmediate(() => {
        resolve({
          area,
          metrics: batchScoreArea(areaPath, profile.areas, profile.sensitiveKeywords, cache),
        });
      });
    });
  });

  return Promise.all(areaMetricsPromises).then((areaMetrics) => {
    const metricsMap = new Map(areaMetrics.map(({ area, metrics }) => [area, metrics]));

    const results = profile.areas.map((area) => {
      const m = metricsMap.get(area);
      if (!m) return null;
      const churn = churnMap.get(area) || 0;
      const violations = history.violationsByArea.get(area) || 0;
      const incidentFreeAge = history.incidentFreeAgeByArea.get(area) || 0;
      const contextPressure = countContextPressure(projectRoot, area);
      const { fileCount, sensitiveSurface, dependencyDepth } = m;

      const w = profile.weights;

      const churnNorm = churn === 0 ? 0 : churn <= 5 ? 1 : churn <= 20 ? 2 : 3;
      const violationsNorm = violations === 0 ? 0 : violations === 1 ? 1 : violations <= 3 ? 2 : 3;
      const sensitiveNorm = sensitiveSurface === 0 ? 0 : sensitiveSurface <= 2 ? 1 : sensitiveSurface <= 5 ? 2 : 3;
      const filesNorm = fileCount >= 100 ? 2 : fileCount >= 30 ? 1 : 0;
      const depsNorm = dependencyDepth === 0 ? 0 : dependencyDepth <= 5 ? 1 : dependencyDepth <= 15 ? 2 : 3;
      const ageNorm = incidentFreeAge === 0 ? 3 : incidentFreeAge <= 3 ? 2 : incidentFreeAge <= 10 ? 1 : 0;
      const pressureNorm = contextPressure === 0 ? 0 : contextPressure <= 50 ? 1 : contextPressure <= 200 ? 2 : 3;

      const rawScore =
        churnNorm * (w.churn || 1) +
        violationsNorm * (w.violationRate || 1) +
        sensitiveNorm * (w.sensitiveSurface || 1) +
        filesNorm +
        depsNorm * 0.5 +
        ageNorm * 0.5 +
        pressureNorm * 0.5;

      const score = Math.min(10, Math.round(rawScore * 10) / 10);

      let level: "junior" | "pleno" | "senior" = "junior";
      if (score >= 6) level = "senior";
      else if (score >= 3) level = "pleno";

      const evidenceParts: string[] = [];
      if (fileCount > 0) evidenceParts.push(`${fileCount} files`);
      if (churn > 0) evidenceParts.push(`${churn} commits/${profile.churnWindowDays}d`);
      if (sensitiveSurface > 0) evidenceParts.push(`${sensitiveSurface} sensitive keywords`);
      if (violations > 0) evidenceParts.push(`${violations} violations`);
      if (dependencyDepth > 0) evidenceParts.push(`${dependencyDepth} cross-area imports`);
      if (incidentFreeAge > 0) evidenceParts.push(`${incidentFreeAge} sessions since last incident`);
      if (contextPressure > 0) evidenceParts.push(`${contextPressure}KB P2 docs`);

      return {
        area,
        score,
        level,
        fileCount,
        churn,
        sensitiveSurface,
        violations,
        dependencyDepth,
        incidentFreeAge,
        contextPressure,
        evidence: evidenceParts.join(", ") || "no activity detected",
      };
    });

    return results.filter((r): r is AreaScore => r !== null);
  });
}

export function scoreProject(
  _analysis: ProjectAnalysis,
  staticMetrics: import("../entities/engineering-state.js").StaticMetric[],
  behavioralMetrics: import("../entities/engineering-state.js").BehavioralMetric[],
  areaScores: AreaScore[]
): ComplexityReport {
  const staticScore = staticMetrics.reduce((sum, m) => sum + m.score, 0);
  const behaviorScore = behavioralMetrics.reduce((sum, m) => sum + m.score, 0);
  const totalScore = staticScore + behaviorScore;

  const reasons: string[] = [
    ...staticMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
    ...behavioralMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
  ];

  const suggestions: string[] = behavioralMetrics
    .filter((m) => m.suggestion)
    .map((m) => m.suggestion!);

  let level: "junior" | "pleno" | "senior" = "junior";
  if (totalScore >= 10) {
    level = "senior";
  } else if (totalScore >= 5) {
    level = "pleno";
  }

  if (level === "pleno" && !suggestions.some((s) => s.includes("upgrade"))) {
    suggestions.push(
      "Your project complexity suggests moderate complexity. Run: nexus upgrade --list"
    );
  }
  if (level === "senior" && !suggestions.some((s) => s.includes("upgrade"))) {
    suggestions.push(
      "Your project complexity suggests high complexity. Run: nexus upgrade --list"
    );
  }

  const hotAreas = areaScores.filter((a) => a.score >= 6);
  if (hotAreas.length > 0) {
    suggestions.push(
      `High-complexity areas: ${hotAreas.map((a) => `${a.area} (${a.score})`).join(", ")} — consider governance focus here`
    );
  }

  const report = {
    score: totalScore,
    level,
    staticScore,
    behaviorScore,
    reasons,
    suggestions,
    staticMetrics,
    behavioralMetrics,
    computedAt: new Date().toISOString(),
    areaScores,
  };

  getEventBus().publish("score.calculated", {
    projectId: "",
    score: totalScore,
    timestamp: new Date().toISOString(),
  });

  return report;
}
