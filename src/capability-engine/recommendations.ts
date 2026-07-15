import type { MaturityDimensions } from "../maturity-profile.js";
import type { CapabilityEntity, CapabilityRecommendation } from "./types.js";

export function generateCapabilityRecommendations(
  capabilities: CapabilityEntity[],
  dimensions: MaturityDimensions
): CapabilityRecommendation[] {
  const recommendations: CapabilityRecommendation[] = [];

  for (const cap of capabilities) {
    if (cap.maturity === "dormant") {
      let relevance = 0;
      let weightCount = 0;
      for (const [dim, weight] of Object.entries(cap.dimensions)) {
        const dimScore = dimensions[dim as keyof MaturityDimensions];
        relevance += dimScore * weight;
        weightCount += weight;
      }

      if (weightCount > 0 && relevance / weightCount >= 25) {
        const depsMet = cap.dependencies.every((dep) =>
          capabilities.find((c) => c.id === dep)?.isInstalled
        );

        if (depsMet) {
          recommendations.push({
            capability: cap.id,
            action: "activate",
            priority: "high",
            reason: `Maturity dimensions warrant ${cap.name} capability`,
            expectedImpact: `Adds ${cap.name.toLowerCase()} governance to the project`,
            dependencies: cap.dependencies,
          });
        }
      }
    } else if (cap.maturity === "installed" || cap.maturity === "configured") {
      if (cap.maturityScore < 60) {
        recommendations.push({
          capability: cap.id,
          action: "configure",
          priority: "medium",
          reason: `${cap.name} is ${cap.maturity} but not fully configured`,
          expectedImpact: "Improves capability effectiveness",
          dependencies: [],
        });
      }
    } else if (cap.maturity === "active") {
      if (cap.maturityScore < 80) {
        recommendations.push({
          capability: cap.id,
          action: "optimize",
          priority: "low",
          reason: `${cap.name} can be further optimized`,
          expectedImpact: "Maximizes capability value",
          dependencies: [],
        });
      }
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
