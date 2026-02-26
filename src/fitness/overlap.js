// fitness/overlap.js — Overlap & spacing quality scoring

import { gaussianScore } from '../palette/harmony.js';

/**
 * Compute axis-aligned overlap area between two rectangles.
 * Rectangles defined by centre (x,y) and size (w,h).
 */
function overlapArea(a, b) {
  const aLeft = a.x - a.w / 2, aRight = a.x + a.w / 2;
  const aTop = a.y - a.h / 2, aBottom = a.y + a.h / 2;
  const bLeft = b.x - b.w / 2, bRight = b.x + b.w / 2;
  const bTop = b.y - b.h / 2, bBottom = b.y + b.h / 2;

  const overlapW = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
  const overlapH = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
  return overlapW * overlapH;
}

/**
 * Score overlap quality.
 * Ideal: ~15–30% total overlap ratio. Some layering is interesting, too much is muddy.
 */
export function scoreOverlap(individual) {
  const rects = individual.rectangles;
  if (rects.length < 2) return 0.8;

  let totalOverlap = 0;
  let totalArea = 0;
  let maxOcclusion = 0;

  for (let i = 0; i < rects.length; i++) {
    const area = rects[i].w * rects[i].h;
    totalArea += area;

    for (let j = i + 1; j < rects.length; j++) {
      totalOverlap += overlapArea(rects[i], rects[j]);
    }

    const vis = rects[i].visibility ?? 1;
    if (vis < 0.2) maxOcclusion = Math.max(maxOcclusion, 1 - vis);
  }

  if (totalArea === 0) return 0;

  const overlapRatio = totalOverlap / totalArea;

  // Score via Gaussian around ideal overlap
  let score = gaussianScore(overlapRatio, 0.2, 0.1);

  // Graduated penalty for heavily occluded shapes (uses precomputed visibility)
  if (maxOcclusion > 0.8) {
    score *= 0.7;
  }

  return score;
}
