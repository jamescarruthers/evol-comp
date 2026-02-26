// fitness/clumping.js — Spatial colour clumping scoring
//
// Measures spatial autocorrelation of colour: do nearby shapes tend to share
// similar colours?  High scores mean colours are grouped into distinct zones
// (e.g. sky at top, earth at bottom) rather than scattered uniformly.

import { deltaE00, gaussianScore } from '../palette/harmony.js';

/** Gaussian spatial scale — normalised so σ covers a similar visual extent
 *  in both axes regardless of canvas aspect ratio. */
const SIGMA = 0.3;

/**
 * Score the spatial clumping of colours in a composition.
 *
 * For every pair of visible shapes, computes a proximity-weighted colour
 * similarity.  The result is a single 0–1 value measuring how strongly
 * same-coloured shapes cluster together spatially.
 *
 * @param {Object} individual - individual with .rectangles array
 * @param {Array}  palette    - colour palette (each entry has .lab)
 * @param {number} aspectRatio - canvas width / height
 * @returns {number} score 0–1
 */
export function scoreClumping(individual, palette, aspectRatio = 1) {
  const rects = individual.rectangles;
  if (!rects || rects.length < 3) return 0.5;

  const visible = rects.filter(r => (r.visibility ?? 1) > 0);
  if (visible.length < 3) return 0.5;

  const sigma2x2 = 2 * SIGMA * SIGMA;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];

      // Aspect-ratio-normalised distance so σ has equal visual effect in
      // both axes (coordinate system: height = 1, width = aspectRatio).
      const dx = (a.x - b.x) / aspectRatio;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy;
      const proximity = Math.exp(-dist2 / sigma2x2);

      // Perceptual colour similarity via CIEDE2000
      const dE = deltaE00(palette[a.colourIndex].lab, palette[b.colourIndex].lab);
      const similarity = 1 - Math.min(dE / 50, 1);

      // Weight by minimum visibility of the pair (consistent with colour.js)
      const pairVis = Math.min(a.visibility ?? 1, b.visibility ?? 1);
      const weight = proximity * pairVis;

      numerator += weight * similarity;
      denominator += weight;
    }
  }

  if (denominator < 0.001) return 0.5;

  const clumpScore = numerator / denominator;

  // Peak at ~0.65: moderate-high clumping.  Avoids trivially rewarding
  // single-colour compositions (which would hit 1.0) while clearly
  // favouring grouped colour zones over scattered placement.
  return gaussianScore(clumpScore, 0.65, 0.2);
}
