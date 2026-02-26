// fitness/index.js — Composite fitness scorer (weighted sum)

import { scoreThirds } from './thirds.js';
import { scoreBalance } from './balance.js';
import { scoreSymmetry } from './symmetry.js';
import { scoreOverlap } from './overlap.js';
import { scoreColour } from './colour.js';
import { scoreVariety } from './variety.js';
import { scoreEdgePenalty } from './edge.js';
import { scoreDetail } from './detail.js';
import { scoreClumping } from './clumping.js';
import { scoreDetailClumping } from './detailClumping.js';
import { tetrisToRects } from '../genome/tetris.js';
import { computeVisibility } from './visibility.js';

export const DEFAULT_WEIGHTS = {
  thirds: 0.20,
  balance: 0.20,
  symmetry: 0.10,
  overlap: 0.15,
  colour: 0.15,
  variety: 0.10,
  edge: 0.05,
  detail: 0.05,
  clumping: 0,
  detailClumping: 0
};

/**
 * Evaluate an individual's composite fitness.
 * For tetris-mode individuals, converts pieces to pseudo-rectangles first.
 * @param {Object} individual
 * @param {Array} palette - colour palette
 * @param {Object} weights - weight per fitness component
 * @param {string} bgColour - background colour (CSS hex)
 * @param {number} aspectRatio - canvas width/height ratio
 * @returns {number} fitness score 0–1
 */
export function evaluate(individual, palette, weights = DEFAULT_WEIGHTS, bgColour = '#f5f5f0', aspectRatio = 1) {
  // For tetris individuals, create a proxy with pseudo-rectangles for fitness
  let proxy = individual;
  if (individual.mode === 'tetris') {
    proxy = { rectangles: tetrisToRects(individual) };
  }

  // Annotate each rectangle with its visible fraction (0–1) so that
  // scoring functions can down-weight or skip occluded shapes.
  computeVisibility(proxy.rectangles);

  const scores = {
    thirds: scoreThirds(proxy, aspectRatio),
    balance: scoreBalance(proxy, palette, aspectRatio),
    symmetry: scoreSymmetry(proxy, aspectRatio),
    overlap: scoreOverlap(proxy),
    colour: scoreColour(proxy, palette, bgColour, aspectRatio),
    variety: scoreVariety(proxy, aspectRatio),
    edge: scoreEdgePenalty(proxy, aspectRatio),
    detail: scoreDetail(proxy, aspectRatio),
    clumping: scoreClumping(proxy, palette, aspectRatio),
    detailClumping: scoreDetailClumping(proxy, aspectRatio)
  };

  let fitness = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    fitness += weight * (scores[key] || 0);
    totalWeight += weight;
  }

  // Normalise in case weights don't sum to 1
  if (totalWeight > 0) fitness /= totalWeight;

  individual.fitness = fitness;
  individual.scores = scores;
  return fitness;
}
