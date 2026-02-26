// fitness/symmetry.js — Bilateral symmetry scoring

import { gaussianScore } from '../palette/harmony.js';

/**
 * Score bilateral symmetry (vertical axis).
 * Uses a soft target — peak score at ~70% symmetry (perfect symmetry is boring).
 */
export function scoreSymmetry(individual, aspectRatio = 1) {
  const rects = individual.rectangles;
  if (rects.length < 2) return 0.5;

  const midX = aspectRatio / 2;

  // Only consider shapes that are at least partially visible
  const visibleRects = rects.filter(r => (r.visibility ?? 1) > 0);
  if (visibleRects.length < 2) return 0.5;

  // Split into left-side and right-side rectangles
  const leftRects = [];
  const rightRects = [];

  for (const rect of visibleRects) {
    if (rect.x < midX) {
      leftRects.push(rect);
    } else {
      rightRects.push(rect);
    }
  }

  if (leftRects.length === 0 || rightRects.length === 0) return 0.2;

  // For each left rectangle, find closest mirrored match on the right
  let matchScore = 0;
  let matchCount = 0;

  for (const lr of leftRects) {
    const mirroredX = aspectRatio - lr.x;
    let bestDist = Infinity;

    for (const rr of rightRects) {
      const dx = rr.x - mirroredX;
      const dy = rr.y - lr.y;
      const dw = Math.abs(rr.w - lr.w);
      const dh = Math.abs(rr.h - lr.h);
      const dist = Math.sqrt(dx * dx + dy * dy + dw * dw + dh * dh);
      if (dist < bestDist) bestDist = dist;
    }

    // Convert distance to similarity (0–1), weighted by visibility
    const similarity = Math.exp(-bestDist * bestDist / (2 * 0.2 * 0.2));
    const vis = lr.visibility ?? 1;
    matchScore += similarity * vis;
    matchCount++;
  }

  const rawSymmetry = matchCount > 0 ? matchScore / matchCount : 0;

  // Sweet spot: peak at ~70% symmetry, slight penalty for >90%
  return gaussianScore(rawSymmetry, 0.7, 0.15);
}
