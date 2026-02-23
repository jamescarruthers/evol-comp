// fitness/thirds.js — Rule of thirds scoring

/**
 * Score how well rectangles align with the rule of thirds power points.
 * Visual weight at each power point = sum of Gaussian-weighted contributions.
 */
export function scoreThirds(individual) {
  const powerPoints = [
    [1 / 3, 1 / 3], [2 / 3, 1 / 3],
    [1 / 3, 2 / 3], [2 / 3, 2 / 3]
  ];
  const sigma = 0.15;
  const sigmaSquared2 = 2 * sigma * sigma;
  const rects = individual.rectangles;

  if (rects.length === 0) return 0;

  let totalWeight = 0;

  for (const [px, py] of powerPoints) {
    let pointWeight = 0;
    for (const rect of rects) {
      const area = rect.w * rect.h;
      const dx = rect.x - px;
      const dy = rect.y - py;
      const distSq = dx * dx + dy * dy;
      pointWeight += area * Math.exp(-distSq / sigmaSquared2);
    }
    totalWeight += pointWeight;
  }

  // Normalise: max possible contribution is if all area is centred on power points
  const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
  // 4 power points, each could get full totalArea contribution
  const maxWeight = totalArea * 4;

  if (maxWeight === 0) return 0;
  return Math.min(1, totalWeight / maxWeight);
}
