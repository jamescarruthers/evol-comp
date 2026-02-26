// genome/representation.js — Genome encoding/decoding

import { createRandomTetris, cloneTetrisIndividual } from './tetris.js';

export const RECT_COUNT_MIN = 5;
export const RECT_COUNT_MAX = 20;

/**
 * Snap a value to the nearest grid line.
 * @param {number} val - normalised value (0–1)
 * @param {number} gridDivisions - number of grid divisions (0 = no grid)
 * @returns {number} snapped value
 */
function snapVal(val, gridDivisions) {
  if (!gridDivisions || gridDivisions <= 0) return val;
  return Math.round(val * gridDivisions) / gridDivisions;
}

/**
 * Snap a rectangle's corners to the grid, then derive centre and size.
 * Ensures minimum size of one grid cell.
 * @param {Object} rect - rectangle with {x, y, w, h, ...}
 * @param {number} gridDivisions - number of grid divisions (0 = disabled)
 * @returns {Object} the same rect, mutated in place
 */
export function snapToGrid(rect, gridDivisions) {
  if (!gridDivisions || gridDivisions <= 0) return rect;

  const step = 1 / gridDivisions;

  // Compute corners
  let left = rect.x - rect.w / 2;
  let right = rect.x + rect.w / 2;
  let top = rect.y - rect.h / 2;
  let bottom = rect.y + rect.h / 2;

  // Snap corners to grid
  left = snapVal(left, gridDivisions);
  right = snapVal(right, gridDivisions);
  top = snapVal(top, gridDivisions);
  bottom = snapVal(bottom, gridDivisions);

  // Ensure minimum one grid cell
  if (right <= left) right = left + step;
  if (bottom <= top) bottom = top + step;

  // Derive centre and size
  rect.x = (left + right) / 2;
  rect.y = (top + bottom) / 2;
  rect.w = right - left;
  rect.h = bottom - top;

  return rect;
}

/**
 * Create a random individual (composition of rectangles, or tetris tiling).
 * @param {Array} palette - array of colour objects
 * @param {number} gridDivisions - grid divisions (0 = no grid)
 * @param {boolean} tetrisMode - if true, create a tetris-tiled individual
 * @param {number} tetrisDivisions - nesting depth for tetris (1 = flat, 2+ = nested)
 * @returns {Object} individual with rectangles array and null fitness
 */
export function createRandom(palette, gridDivisions = 0, tetrisMode = false, tetrisDivisions = 1, aspectRatio = 1) {
  if (tetrisMode) {
    const gs = gridDivisions > 0 ? gridDivisions : 8;
    return createRandomTetris(palette, gs, tetrisDivisions, aspectRatio);
  }

  const count = RECT_COUNT_MIN + Math.floor(Math.random() * (RECT_COUNT_MAX - RECT_COUNT_MIN + 1));
  const rectangles = [];
  for (let i = 0; i < count; i++) {
    const rect = {
      x: Math.random(),
      y: Math.random(),
      w: 0.05 + Math.random() * 0.45,
      h: 0.05 + Math.random() * 0.45,
      colourIndex: Math.floor(Math.random() * palette.length),
      z: i
    };
    snapToGrid(rect, gridDivisions);
    rectangles.push(rect);
  }
  return { rectangles, fitness: null, scores: null };
}

/**
 * Deep-clone an individual (rectangle or tetris mode).
 */
export function cloneIndividual(individual) {
  if (individual.mode === 'tetris') {
    return cloneTetrisIndividual(individual);
  }
  return {
    rectangles: individual.rectangles.map(r => ({ ...r })),
    fitness: individual.fitness,
    scores: individual.scores ? { ...individual.scores } : null
  };
}

/**
 * Create an initial population of random individuals.
 * @param {number} size - population size
 * @param {Array} palette - colour palette
 * @param {number} gridDivisions - grid divisions (0 = no grid)
 * @param {boolean} tetrisMode - if true, create tetris-tiled individuals
 * @param {number} tetrisDivisions - nesting depth for tetris (1 = flat, 2+ = nested)
 * @returns {Array} population array
 */
export function createPopulation(size, palette, gridDivisions = 0, tetrisMode = false, tetrisDivisions = 1, aspectRatio = 1) {
  const population = [];
  for (let i = 0; i < size; i++) {
    population.push(createRandom(palette, gridDivisions, tetrisMode, tetrisDivisions, aspectRatio));
  }
  return population;
}
