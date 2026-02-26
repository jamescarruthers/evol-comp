// fitness/thirds.js — Rule of thirds scoring

/**
 * Score how well rectangles align with the rule of thirds power points.
 *
 * For each of the 4 power points we find the best proximity from any
 * rectangle (Gaussian fall-off, σ = 0.10).  The per-point scores are
 * averaged so the composition must cover ALL four intersections to
 * reach 1.0 — a single well-placed shape only helps one quarter of
 * the total.
 *
 * The previous implementation summed Gaussian-weighted area across all
 * points and normalised by totalArea × 4, which capped the achievable
 * score at roughly 0.29 regardless of placement.
 */
export function scoreThirds(individual) {
  const powerPoints = [
    [1 / 3, 1 / 3], [2 / 3, 1 / 3],
    [1 / 3, 2 / 3], [2 / 3, 2 / 3]
  ];
  const sigma = 0.10;
  const sigmaSquared2 = 2 * sigma * sigma;
  const rects = individual.rectangles;

  if (rects.length === 0) return 0;

  let score = 0;

  for (const [px, py] of powerPoints) {
    let bestProximity = 0;
    for (const rect of rects) {
      const dx = rect.x - px;
      const dy = rect.y - py;
      const distSq = dx * dx + dy * dy;
      const proximity = Math.exp(-distSq / sigmaSquared2);
      if (proximity > bestProximity) bestProximity = proximity;
    }
    score += bestProximity;
  }

  return score / powerPoints.length;
}
