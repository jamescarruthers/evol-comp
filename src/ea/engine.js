// ea/engine.js — Evolutionary algorithm loop

import { createPopulation, cloneIndividual, createRandom } from '../genome/representation.js';
import { tournamentSelect, crossover, mutate } from '../genome/operators.js';
import { evaluate, DEFAULT_WEIGHTS } from '../fitness/index.js';

export const DEFAULT_PARAMS = {
  populationSize: 80,
  offspringPerGen: 60,
  tournamentSize: 4,
  mutationRate: 0.3,
  crossoverRate: 0.7,
  elitismCount: 4,
  maxGenerations: 500
};

export class EvolutionEngine {
  constructor(palette, params = {}, weights = null, gridDivisions = 0, bgColour = '#f5f5f0', tetrisMode = false, tetrisDivisions = 1) {
    this.palette = palette;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.weights = weights ? { ...weights } : { ...DEFAULT_WEIGHTS };
    this.gridDivisions = gridDivisions;
    this.bgColour = bgColour;
    this.tetrisMode = tetrisMode;
    this.tetrisDivisions = tetrisDivisions;
    this.population = [];
    this.generation = 0;
    this.history = []; // { best, avg, worst } per generation
    this.baseMutationRate = this.params.mutationRate;
    this.currentMutationRate = this.params.mutationRate;
  }

  /**
   * Initialise the population with random individuals.
   */
  init() {
    this.population = createPopulation(this.params.populationSize, this.palette, this.gridDivisions, this.tetrisMode, this.tetrisDivisions);
    this.generation = 0;
    this.history = [];
    this.currentMutationRate = this.params.mutationRate;

    // Evaluate initial population
    for (const ind of this.population) {
      evaluate(ind, this.palette, this.weights, this.bgColour);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
    this._recordHistory();
  }

  /**
   * Run one generation of evolution.
   */
  evolveOneGeneration() {
    const { populationSize, offspringPerGen, tournamentSize, crossoverRate, elitismCount } = this.params;

    // Sort by fitness
    this.population.sort((a, b) => b.fitness - a.fitness);

    const nextGen = [];

    // Elitism: keep top individuals unchanged
    for (let i = 0; i < Math.min(elitismCount, this.population.length); i++) {
      nextGen.push(cloneIndividual(this.population[i]));
    }

    // Fill remaining with offspring
    while (nextGen.length < populationSize) {
      const parentA = tournamentSelect(this.population, tournamentSize);
      const parentB = tournamentSelect(this.population, tournamentSize);

      let offspring;
      if (Math.random() < crossoverRate) {
        offspring = crossover(parentA, parentB, this.palette.length, this.gridDivisions);
      } else {
        // Clone the better parent
        offspring = cloneIndividual(parentA.fitness >= parentB.fitness ? parentA : parentB);
        offspring.fitness = null;
        offspring.scores = null;
      }

      mutate(offspring, this.currentMutationRate, this.palette.length, this.gridDivisions);
      evaluate(offspring, this.palette, this.weights, this.bgColour);
      nextGen.push(offspring);
    }

    this.population = nextGen;
    this.population.sort((a, b) => b.fitness - a.fitness);
    this.generation++;

    this._recordHistory();
    this._adaptMutationRate();
  }

  /**
   * Adaptive mutation rate based on fitness stagnation.
   */
  _adaptMutationRate() {
    const lookback = 10;
    if (this.history.length < lookback + 1) return;

    const recent = this.history.slice(-lookback);
    const improvement = recent[recent.length - 1].best - recent[0].best;

    if (improvement < 0.001) {
      // Stagnation — increase mutation rate
      this.currentMutationRate = Math.min(0.6, this.currentMutationRate * 1.2);

      // Immigration: inject random individuals (replace worst 10%)
      const immigrationCount = Math.floor(this.params.populationSize * 0.1);
      for (let i = 0; i < immigrationCount; i++) {
        const idx = this.population.length - 1 - i;
        if (idx >= this.params.elitismCount) {
          this.population[idx] = createRandom(this.palette, this.gridDivisions, this.tetrisMode, this.tetrisDivisions);
          evaluate(this.population[idx], this.palette, this.weights, this.bgColour);
        }
      }
    } else if (improvement > 0.01) {
      // Strong improvement — decrease mutation rate
      this.currentMutationRate = Math.max(0.1, this.currentMutationRate * 0.9);
    }
  }

  /**
   * Record history for the current generation.
   */
  _recordHistory() {
    if (this.population.length === 0) return;

    const fitnesses = this.population.map(ind => ind.fitness);
    this.history.push({
      best: fitnesses[0],
      avg: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worst: fitnesses[fitnesses.length - 1]
    });
  }

  getBest() {
    return this.population[0] || null;
  }

  getBestFitness() {
    return this.population[0]?.fitness || 0;
  }

  getAvgFitness() {
    if (this.population.length === 0) return 0;
    return this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length;
  }

  getTopN(n) {
    return this.population.slice(0, n);
  }

  /**
   * Update weights (user adjusts sliders while running).
   */
  setWeights(weights) {
    this.weights = { ...weights };
    // Re-evaluate entire population with new weights
    for (const ind of this.population) {
      evaluate(ind, this.palette, this.weights, this.bgColour);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  /**
   * Update palette (re-renders but genome stays the same).
   */
  setPalette(palette) {
    this.palette = palette;
    // Re-evaluate since colour-dependent fitness changes
    for (const ind of this.population) {
      evaluate(ind, this.palette, this.weights, this.bgColour);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  /**
   * Update background colour and re-evaluate population.
   */
  setBgColour(bgColour) {
    this.bgColour = bgColour;
    for (const ind of this.population) {
      evaluate(ind, this.palette, this.weights, this.bgColour);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  /**
   * Update grid divisions setting.
   */
  setGridDivisions(gridDivisions) {
    this.gridDivisions = gridDivisions;
  }

  /**
   * Update tetris nesting divisions.
   */
  setTetrisDivisions(tetrisDivisions) {
    this.tetrisDivisions = tetrisDivisions;
  }
}
