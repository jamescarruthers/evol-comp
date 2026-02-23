// genome/representation.js — Genome encoding/decoding

export const RECT_COUNT_MIN = 5;
export const RECT_COUNT_MAX = 20;

/**
 * Create a random individual (composition of rectangles).
 * @param {Array} palette - array of colour objects
 * @returns {Object} individual with rectangles array and null fitness
 */
export function createRandom(palette) {
  const count = RECT_COUNT_MIN + Math.floor(Math.random() * (RECT_COUNT_MAX - RECT_COUNT_MIN + 1));
  const rectangles = [];
  for (let i = 0; i < count; i++) {
    rectangles.push({
      x: Math.random(),
      y: Math.random(),
      w: 0.05 + Math.random() * 0.45,
      h: 0.05 + Math.random() * 0.45,
      colourIndex: Math.floor(Math.random() * palette.length),
      z: i
    });
  }
  return { rectangles, fitness: null, scores: null };
}

/**
 * Deep-clone an individual.
 */
export function cloneIndividual(individual) {
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
 * @returns {Array} population array
 */
export function createPopulation(size, palette) {
  const population = [];
  for (let i = 0; i < size; i++) {
    population.push(createRandom(palette));
  }
  return population;
}
