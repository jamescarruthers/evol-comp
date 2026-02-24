// fitness/index.js — Composite fitness scorer (weighted sum)

import { scoreThirds } from './thirds.js';
import { scoreBalance } from './balance.js';
import { scoreSymmetry } from './symmetry.js';
import { scoreOverlap } from './overlap.js';
import { scoreColour } from './colour.js';
import { scoreVariety } from './variety.js';
import { scoreEdgePenalty } from './edge.js';

export const DEFAULT_WEIGHTS = {
  thirds: 0.20,
  balance: 0.20,
  symmetry: 0.10,
  overlap: 0.15,
  colour: 0.15,
  variety: 0.10,
  edge: 0.10
};

/**
 * Evaluate an individual's composite fitness.
 * @param {Object} individual
 * @param {Array} palette - colour palette
 * @param {Object} weights - weight per fitness component
 * @param {string} bgColour - background colour (CSS hex)
 * @returns {number} fitness score 0–1
 */
export function evaluate(individual, palette, weights = DEFAULT_WEIGHTS, bgColour = '#f5f5f0') {
  const scores = {
    thirds: scoreThirds(individual),
    balance: scoreBalance(individual, palette),
    symmetry: scoreSymmetry(individual),
    overlap: scoreOverlap(individual),
    colour: scoreColour(individual, palette, bgColour),
    variety: scoreVariety(individual),
    edge: scoreEdgePenalty(individual)
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
