// ea/engine.js — Evolutionary algorithm loop

import { createPopulation, cloneIndividual, createRandom } from '../genome/representation.js';
import { tournamentSelect, crossover, mutate } from '../genome/operators.js';
import { evaluate, DEFAULT_WEIGHTS } from '../fitness/index.js';

/** Stagnation tier thresholds (consecutive stagnant generations). */
const STAGNATION_MILD     = 10;
const STAGNATION_MODERATE = 25;
const STAGNATION_SEVERE   = 50;

/** Fitness std-dev below this means the population has converged. */
const DIVERSITY_THRESHOLD = 0.005;

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
  constructor(palette, params = {}, weights = null, gridDivisions = 0, bgColour = '#f5f5f0', tetrisMode = false, tetrisDivisions = 1, aspectRatio = 1) {
    this.palette = palette;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.weights = weights ? { ...weights } : { ...DEFAULT_WEIGHTS };
    this.gridDivisions = gridDivisions;
    this.bgColour = bgColour;
    this.tetrisMode = tetrisMode;
    this.tetrisDivisions = tetrisDivisions;
    this.aspectRatio = aspectRatio;
    this.population = [];
    this.generation = 0;
    this.history = []; // { best, avg, worst } per generation
    this.baseMutationRate = this.params.mutationRate;
    this.currentMutationRate = this.params.mutationRate;
    this.stagnationCount = 0;
    this.stagnationTier = 0; // 0 = none, 1 = mild, 2 = moderate, 3 = severe
  }

  /**
   * Initialise the population with random individuals.
   */
  init() {
    this.population = createPopulation(this.params.populationSize, this.palette, this.gridDivisions, this.tetrisMode, this.tetrisDivisions, this.aspectRatio);
    this.generation = 0;
    this.history = [];
    this.currentMutationRate = this.params.mutationRate;
    this.stagnationCount = 0;
    this.stagnationTier = 0;

    // Evaluate initial population
    for (const ind of this.population) {
      evaluate(ind, this.palette, this.weights, this.bgColour, this.aspectRatio);
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
        offspring = crossover(parentA, parentB, this.palette.length, this.gridDivisions, this.aspectRatio);
      } else {
        // Clone the better parent
        offspring = cloneIndividual(parentA.fitness >= parentB.fitness ? parentA : parentB);
        offspring.fitness = null;
        offspring.scores = null;
      }

      mutate(offspring, this.currentMutationRate, this.palette.length, this.gridDivisions, this.aspectRatio);
      evaluate(offspring, this.palette, this.weights, this.bgColour, this.aspectRatio);
      nextGen.push(offspring);
    }

    this.population = nextGen;
    this.population.sort((a, b) => b.fitness - a.fitness);
    this.generation++;

    this._recordHistory();
    this._handleStagnation();
  }

  /**
   * Detect stagnation and apply escalating interventions to break out of
   * local optima.  Three tiers respond with increasing aggression:
   *   Tier 1 (mild)     — bump mutation rate, 10 % immigration
   *   Tier 2 (moderate) — spike mutation, 25 % immigration, hyper-mutate mid-pop
   *   Tier 3 (severe)   — cataclysm: keep elites, replace everything else
   */
  _handleStagnation() {
    const lookback = 10;
    if (this.history.length < lookback + 1) return;

    const recent = this.history.slice(-lookback);
    const improvement = recent[recent.length - 1].best - recent[0].best;
    const diversityLow = this._isDiversityLow();

    // --- Update stagnation counter ---
    if (improvement < 0.001 || diversityLow) {
      this.stagnationCount++;
    } else if (improvement > 0.01) {
      // Strong progress — cool down quickly
      this.stagnationCount = Math.max(0, this.stagnationCount - 3);
      this.currentMutationRate = Math.max(0.1, this.currentMutationRate * 0.9);
    } else {
      // Modest progress — cool down slowly
      this.stagnationCount = Math.max(0, this.stagnationCount - 1);
    }

    // --- Tiered response ---
    if (this.stagnationCount >= STAGNATION_SEVERE) {
      this.stagnationTier = 3;
      this._cataclysm();
    } else if (this.stagnationCount >= STAGNATION_MODERATE) {
      this.stagnationTier = 2;
      this._aggressiveIntervention();
    } else if (this.stagnationCount >= STAGNATION_MILD) {
      this.stagnationTier = 1;
      this._mildIntervention();
    } else {
      this.stagnationTier = 0;
    }
  }

  /**
   * Check whether the population has converged (low fitness diversity).
   */
  _isDiversityLow() {
    if (this.population.length < 2) return false;
    const fitnesses = this.population.map(ind => ind.fitness);
    const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const variance = fitnesses.reduce((sum, f) => sum + (f - mean) ** 2, 0) / fitnesses.length;
    return Math.sqrt(variance) < DIVERSITY_THRESHOLD;
  }

  /**
   * Tier 1 — gentle nudge: boost mutation rate, inject 10 % random immigrants.
   */
  _mildIntervention() {
    this.currentMutationRate = Math.min(0.6, this.currentMutationRate * 1.2);

    const immigrationCount = Math.floor(this.params.populationSize * 0.1);
    for (let i = 0; i < immigrationCount; i++) {
      const idx = this.population.length - 1 - i;
      if (idx >= this.params.elitismCount) {
        this.population[idx] = createRandom(this.palette, this.gridDivisions, this.tetrisMode, this.tetrisDivisions, this.aspectRatio);
        evaluate(this.population[idx], this.palette, this.weights, this.bgColour, this.aspectRatio);
      }
    }
  }

  /**
   * Tier 2 — aggressive shake-up: spike mutation, 25 % immigration, and
   * hyper-mutate the middle of the population (between elites and immigrants).
   */
  _aggressiveIntervention() {
    this.currentMutationRate = Math.min(0.8, this.currentMutationRate * 1.5);

    // Replace worst 25 % with fresh random individuals
    const immigrationCount = Math.floor(this.params.populationSize * 0.25);
    for (let i = 0; i < immigrationCount; i++) {
      const idx = this.population.length - 1 - i;
      if (idx >= this.params.elitismCount) {
        this.population[idx] = createRandom(this.palette, this.gridDivisions, this.tetrisMode, this.tetrisDivisions, this.aspectRatio);
        evaluate(this.population[idx], this.palette, this.weights, this.bgColour, this.aspectRatio);
      }
    }

    // Hyper-mutate the middle band (not elites, not fresh immigrants)
    const midStart = this.params.elitismCount;
    const midEnd = this.population.length - immigrationCount;
    for (let i = midStart; i < midEnd; i++) {
      mutate(this.population[i], 0.9, this.palette.length, this.gridDivisions, this.aspectRatio);
      evaluate(this.population[i], this.palette, this.weights, this.bgColour, this.aspectRatio);
    }
  }

  /**
   * Tier 3 — cataclysm: preserve only the elite few, replace the entire rest
   * of the population with fresh random individuals, and reset stagnation.
   */
  _cataclysm() {
    const keepCount = Math.max(this.params.elitismCount, 2);

    for (let i = keepCount; i < this.population.length; i++) {
      this.population[i] = createRandom(this.palette, this.gridDivisions, this.tetrisMode, this.tetrisDivisions, this.aspectRatio);
      evaluate(this.population[i], this.palette, this.weights, this.bgColour, this.aspectRatio);
    }

    // Reset mutation to base with a small boost to keep exploring
    this.currentMutationRate = Math.min(0.5, this.baseMutationRate * 1.5);

    // Reset stagnation so the cycle can begin afresh
    this.stagnationCount = 0;

    this.population.sort((a, b) => b.fitness - a.fitness);
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
      evaluate(ind, this.palette, this.weights, this.bgColour, this.aspectRatio);
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
      evaluate(ind, this.palette, this.weights, this.bgColour, this.aspectRatio);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  /**
   * Update background colour and re-evaluate population.
   */
  setBgColour(bgColour) {
    this.bgColour = bgColour;
    for (const ind of this.population) {
      evaluate(ind, this.palette, this.weights, this.bgColour, this.aspectRatio);
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
