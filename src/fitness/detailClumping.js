// fitness/detailClumping.js — Spatial detail/size clumping scoring
//
// Measures spatial autocorrelation of shape size: do similarly-sized shapes
// cluster together?  High scores mean small detailed shapes group into
// focal clusters while large shapes occupy their own areas — creating
// distinct "busy" and "calm" zones rather than a uniform size mix.

import { gaussianScore } from '../palette/harmony.js';

/** Gaussian spatial scale — same as colour clumping for consistency. */
const SIGMA = 0.3;

/**
 * Score the spatial clumping of similarly-sized shapes.
 *
 * For every pair of visible shapes, computes proximity-weighted size
 * similarity.  Shapes whose areas are close in magnitude and that sit
 * near each other contribute positively.  The result rewards compositions
 * where small pieces cluster together (e.g. a detailed focal area) and
 * large pieces cluster elsewhere (calm background areas).
 *
 * Works naturally with tetris mode: subdivided areas produce many small
 * pseudo-rectangles that will cluster spatially.
 *
 * @param {Object} individual  - individual with .rectangles array
 * @param {number} aspectRatio - canvas width / height
 * @returns {number} score 0–1
 */
export function scoreDetailClumping(individual, aspectRatio = 1) {
  const rects = individual.rectangles;
  if (!rects || rects.length < 3) return 0.5;

  const visible = rects.filter(r => (r.visibility ?? 1) > 0);
  if (visible.length < 3) return 0.5;

  // Compute log-area for each visible shape.  Using log makes the
  // similarity measure proportional (a 0.01 vs 0.02 shape is as
  // "different" as a 0.1 vs 0.2 shape).
  const logAreas = visible.map(r => Math.log(Math.max(r.w * r.h, 1e-6)));

  // Range of log-areas for normalisation
  let minLog = Infinity;
  let maxLog = -Infinity;
  for (const la of logAreas) {
    if (la < minLog) minLog = la;
    if (la > maxLog) maxLog = la;
  }
  const logRange = maxLog - minLog;

  // If all shapes are the same size there's nothing to clump
  if (logRange < 0.01) return 0.5;

  const sigma2x2 = 2 * SIGMA * SIGMA;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];

      // Aspect-ratio-normalised spatial distance
      const dx = (a.x - b.x) / aspectRatio;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy;
      const proximity = Math.exp(-dist2 / sigma2x2);

      // Size similarity: 1 when identical log-area, 0 at opposite ends
      const sizeSim = 1 - Math.abs(logAreas[i] - logAreas[j]) / logRange;

      const pairVis = Math.min(a.visibility ?? 1, b.visibility ?? 1);
      const weight = proximity * pairVis;

      numerator += weight * sizeSim;
      denominator += weight;
    }
  }

  if (denominator < 0.001) return 0.5;

  const clumpScore = numerator / denominator;

  // Peak at ~0.65: moderate-high clumping, same target as colour clumping.
  return gaussianScore(clumpScore, 0.65, 0.2);
}
