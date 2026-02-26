// genome/operators.js — Crossover, mutation, selection operators

import { RECT_COUNT_MIN, RECT_COUNT_MAX, cloneIndividual, snapToGrid } from './representation.js';
import { crossoverTetris, mutateTetris } from './tetris.js';

/**
 * Gaussian random with mean 0 and given standard deviation.
 */
function gaussRandom(sigma) {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Tournament selection — pick tournamentSize random individuals, return the fittest.
 */
export function tournamentSelect(population, tournamentSize) {
  let best = null;
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Uniform rectangle crossover.
 * Each offspring rectangle is randomly drawn from parent A or B.
 */
export function uniformCrossover(parentA, parentB, paletteLength) {
  const nA = parentA.rectangles.length;
  const nB = parentB.rectangles.length;
  const count = Math.min(nA, nB) + Math.floor(Math.random() * (Math.abs(nA - nB) + 1));

  const rectangles = [];
  for (let i = 0; i < count; i++) {
    const source = Math.random() < 0.5 ? parentA : parentB;
    const srcRect = source.rectangles[Math.floor(Math.random() * source.rectangles.length)];
    rectangles.push({ ...srcRect, z: i });
  }

  return { rectangles, fitness: null, scores: null };
}

/**
 * Spatial split crossover.
 * A random line divides the canvas; offspring gets rectangles from each parent on each side.
 */
export function spatialCrossover(parentA, parentB, paletteLength) {
  const vertical = Math.random() < 0.5;
  const splitPos = 0.2 + Math.random() * 0.6;

  const rectangles = [];

  for (const rect of parentA.rectangles) {
    const val = vertical ? rect.x : rect.y;
    if (val < splitPos) rectangles.push({ ...rect });
  }
  for (const rect of parentB.rectangles) {
    const val = vertical ? rect.x : rect.y;
    if (val >= splitPos) rectangles.push({ ...rect });
  }

  // Ensure minimum rectangle count
  if (rectangles.length < RECT_COUNT_MIN) {
    const source = Math.random() < 0.5 ? parentA : parentB;
    while (rectangles.length < RECT_COUNT_MIN) {
      const srcRect = source.rectangles[Math.floor(Math.random() * source.rectangles.length)];
      rectangles.push({ ...srcRect });
    }
  }

  // Truncate to max
  if (rectangles.length > RECT_COUNT_MAX) {
    rectangles.length = RECT_COUNT_MAX;
  }

  // Reassign z-order
  for (let i = 0; i < rectangles.length; i++) {
    rectangles[i].z = i;
  }

  return { rectangles, fitness: null, scores: null };
}

/**
 * Perform crossover using a randomly chosen method.
 * Dispatches to tetris crossover if parents are tetris-mode individuals.
 * @param {number} gridDivisions - grid divisions for snapping (0 = disabled)
 */
export function crossover(parentA, parentB, paletteLength, gridDivisions = 0) {
  // Tetris mode dispatch
  if (parentA.mode === 'tetris' && parentB.mode === 'tetris') {
    return crossoverTetris(parentA, parentB, paletteLength);
  }

  let offspring;
  if (Math.random() < 0.5) {
    offspring = uniformCrossover(parentA, parentB, paletteLength);
  } else {
    offspring = spatialCrossover(parentA, parentB, paletteLength);
  }

  // Apply grid snapping to offspring rectangles
  if (gridDivisions > 0) {
    for (const rect of offspring.rectangles) {
      snapToGrid(rect, gridDivisions);
    }
  }

  return offspring;
}

/**
 * Mutate an individual in-place.
 * Dispatches to tetris mutation if individual is tetris-mode.
 * @param {Object} individual
 * @param {number} mutationRate - probability of mutating each rectangle
 * @param {number} paletteLength - number of colours in palette
 * @param {number} gridDivisions - grid divisions for snapping (0 = disabled)
 */
export function mutate(individual, mutationRate, paletteLength, gridDivisions = 0) {
  if (individual.mode === 'tetris') {
    mutateTetris(individual, mutationRate, paletteLength);
    return;
  }

  const rects = individual.rectangles;

  for (let i = 0; i < rects.length; i++) {
    if (Math.random() > mutationRate) continue;

    const mutationType = Math.random();

    if (mutationType < 0.25) {
      // Nudge position — 30 % of nudges drift toward the nearest
      // rule-of-thirds power point for gentle compositional pressure
      if (Math.random() < 0.3) {
        const powerPoints = [[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3]];
        let nearestDist = Infinity, nearest;
        for (const pp of powerPoints) {
          const d = (rects[i].x - pp[0]) ** 2 + (rects[i].y - pp[1]) ** 2;
          if (d < nearestDist) { nearestDist = d; nearest = pp; }
        }
        const factor = 0.1 + Math.random() * 0.2; // move 10-30 % of the way
        rects[i].x += (nearest[0] - rects[i].x) * factor;
        rects[i].y += (nearest[1] - rects[i].y) * factor;
      } else {
        rects[i].x += gaussRandom(0.05);
        rects[i].y += gaussRandom(0.05);
      }
      rects[i].x = Math.max(-0.2, Math.min(1.2, rects[i].x));
      rects[i].y = Math.max(-0.2, Math.min(1.2, rects[i].y));
    } else if (mutationType < 0.45) {
      // Resize
      rects[i].w *= 0.7 + Math.random() * 0.7; // 0.7–1.4
      rects[i].h *= 0.7 + Math.random() * 0.7;
      rects[i].w = Math.max(0.02, Math.min(0.7, rects[i].w));
      rects[i].h = Math.max(0.02, Math.min(0.7, rects[i].h));
    } else if (mutationType < 0.60) {
      // Recolour — either swap with another shape or pick a new colour
      if (rects.length > 1 && Math.random() < 0.35) {
        // Swap colours with another rectangle
        let j = Math.floor(Math.random() * rects.length);
        while (j === i) j = Math.floor(Math.random() * rects.length);
        const tmpC = rects[i].colourIndex;
        rects[i].colourIndex = rects[j].colourIndex;
        rects[j].colourIndex = tmpC;
      } else {
        // Pick a different colour from the palette
        let newColour = Math.floor(Math.random() * paletteLength);
        if (paletteLength > 1) {
          while (newColour === rects[i].colourIndex) {
            newColour = Math.floor(Math.random() * paletteLength);
          }
        }
        rects[i].colourIndex = newColour;
      }
    } else if (mutationType < 0.72) {
      // Swap z-order with another rectangle
      if (rects.length > 1) {
        let j = Math.floor(Math.random() * rects.length);
        while (j === i) j = Math.floor(Math.random() * rects.length);
        const tmpZ = rects[i].z;
        rects[i].z = rects[j].z;
        rects[j].z = tmpZ;
      }
    } else if (mutationType < 0.80) {
      // Aspect ratio shift (swap w and h)
      const tmp = rects[i].w;
      rects[i].w = rects[i].h;
      rects[i].h = tmp;
    } else if (mutationType < 0.87) {
      // Add rectangle
      if (rects.length < RECT_COUNT_MAX) {
        rects.push({
          x: Math.random(),
          y: Math.random(),
          w: 0.05 + Math.random() * 0.45,
          h: 0.05 + Math.random() * 0.45,
          colourIndex: Math.floor(Math.random() * paletteLength),
          z: rects.length
        });
      }
    } else if (mutationType < 0.94) {
      // Remove rectangle
      if (rects.length > RECT_COUNT_MIN) {
        rects.splice(i, 1);
        i--; // adjust index after removal
      }
    } else {
      // Duplicate: mirror or jitter
      if (rects.length < RECT_COUNT_MAX) {
        if (Math.random() < 0.5) {
          // Mirror duplicate — reflect across the vertical axis to aid symmetry
          rects.push({
            x: 1 - rects[i].x,
            y: rects[i].y + gaussRandom(0.02),
            w: rects[i].w,
            h: rects[i].h,
            colourIndex: rects[i].colourIndex,
            z: rects.length
          });
        } else {
          // Jitter duplicate — clone with small perturbation
          rects.push({
            x: rects[i].x + gaussRandom(0.05),
            y: rects[i].y + gaussRandom(0.05),
            w: rects[i].w * (0.8 + Math.random() * 0.4),
            h: rects[i].h * (0.8 + Math.random() * 0.4),
            colourIndex: rects[i].colourIndex,
            z: rects.length
          });
        }
      }
    }
  }

  // Apply grid snapping to all rectangles after mutation
  if (gridDivisions > 0) {
    for (const rect of rects) {
      snapToGrid(rect, gridDivisions);
    }
  }

  individual.fitness = null;
  individual.scores = null;
}
