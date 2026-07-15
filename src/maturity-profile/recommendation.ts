import type { MaturityDimensions, Capability } from "../domain/entities/engineering-state.js";
import { CAPABILITIES } from "./capabilities.js";

const CAPABILITY_THRESHOLD = 25;

export function recommendCapabilities(
  dimensions: MaturityDimensions,
  installed: Capability[]
): Capability[] {
  const recommended: Capability[] = [];

  for (const cap of CAPABILITIES) {
    if (cap.alwaysInstalled) continue;
    if (installed.includes(cap.id)) continue;

    let relevance = 0;
    let weightCount = 0;
    for (const [dim, weight] of Object.entries(cap.dimensions)) {
      if (weight === undefined) continue;
      const dimScore = dimensions[dim as keyof MaturityDimensions];
      relevance += dimScore * weight;
      weightCount += weight;
    }

    if (weightCount === 0) continue;
    const avgRelevance = relevance / weightCount;

    const depsMet = cap.requires.every((req) =>
      installed.includes(req) || recommended.includes(req)
    );

    if (avgRelevance >= CAPABILITY_THRESHOLD && depsMet) {
      recommended.push(cap.id);
    }
  }

  return recommended;
}

export function getFutureCapabilities(
  installed: Capability[],
  recommended: Capability[]
): Capability[] {
  const activeList: Capability[] = [...installed, ...recommended];
  const future: Capability[] = [];

  for (const cap of CAPABILITIES) {
    if (cap.alwaysInstalled || activeList.includes(cap.id)) continue;
    future.push(cap.id);
  }

  return future;
}
