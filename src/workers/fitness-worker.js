// workers/fitness-worker.js — Web Worker for parallel fitness evaluation
//
// Receives batches of individuals and evaluates their fitness using the
// same scoring functions as the main thread.  Communicates via postMessage.

import { evaluate } from '../fitness/index.js';

self.onmessage = (e) => {
  const { type, id, individuals, palette, weights, bgColour, aspectRatio } = e.data;

  if (type === 'evaluate') {
    const results = [];
    for (const ind of individuals) {
      evaluate(ind, palette, weights, bgColour, aspectRatio);
      results.push({ fitness: ind.fitness, scores: ind.scores });
    }
    self.postMessage({ type: 'result', id, results });
  }
};
