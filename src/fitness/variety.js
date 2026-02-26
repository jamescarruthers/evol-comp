// fitness/variety.js — Size variety & coverage scoring

import { gaussianScore } from '../palette/harmony.js';

/**
 * Score size variety (coefficient of variation of rectangle areas)
 * and canvas coverage.
 */
export function scoreVariety(individual, aspectRatio = 1) {
  const rects = individual.rectangles;
  if (rects.length === 0) return 0;

  // Use visibility-weighted areas so hidden shapes don't inflate metrics
  const visibleRects = rects.filter(r => (r.visibility ?? 1) > 0);
  if (visibleRects.length === 0) return 0;

  const areas = visibleRects.map(r => r.w * r.h * (r.visibility ?? 1));
  const n = areas.length;

  // 1. Size variety via coefficient of variation
  const mean = areas.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;

  const variance = areas.reduce((sum, a) => sum + (a - mean) * (a - mean), 0) / n;
  const std = Math.sqrt(variance);
  const cv = std / mean;

  // CV peaks at ~0.8
  const varietyScore = gaussianScore(cv, 0.8, 0.3);

  // 2. Coverage: approximate visible area / canvas area
  const totalArea = areas.reduce((a, b) => a + b, 0);
  // Canvas area in isotropic coords is aspectRatio × 1
  const canvasArea = aspectRatio;
  // Clamp coverage to 0–1
  const coverage = Math.min(1, totalArea / canvasArea);

  // Ideal coverage: 40–75%
  const coverageScore = gaussianScore(coverage, 0.55, 0.15);

  return 0.5 * varietyScore + 0.5 * coverageScore;
}
