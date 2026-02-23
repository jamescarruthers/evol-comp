// main.js — App entry point, UI wiring, animation loop

import { generatePalette, STRATEGIES } from './palette/generator.js';
import { EvolutionEngine, DEFAULT_PARAMS } from './ea/engine.js';
import { DEFAULT_WEIGHTS } from './fitness/index.js';
import { renderBest, renderGrid, renderChart, renderScoreBreakdown } from './renderer/display.js';
import { renderIndividual } from './renderer/canvas.js';
import { createRandom } from './genome/representation.js';

// ---- State ----
let palette = [];
let engine = null;
let running = false;
let selectedStrategy = 'random';
let selectedIndividual = null;
let weights = { ...DEFAULT_WEIGHTS };
let params = { ...DEFAULT_PARAMS };

// ---- DOM References ----
const bestCanvas = document.getElementById('best-canvas');
const bestScores = document.getElementById('best-scores');
const populationGrid = document.getElementById('population-grid');
const chartCanvas = document.getElementById('chart-canvas');
const genCounter = document.getElementById('gen-counter');
const fitnessDisplay = document.getElementById('fitness-display');
const avgDisplay = document.getElementById('avg-display');
const mutationDisplay = document.getElementById('mutation-display');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');
const paletteSwatches = document.getElementById('palette-swatches');

// ---- Palette ----
function refreshPalette() {
  palette = generatePalette(selectedStrategy);
  renderPaletteSwatches();

  // Show a random composition preview
  const preview = createRandom(palette);
  renderBest(preview, palette, bestCanvas);

  // If engine is running, update its palette
  if (engine) {
    engine.setPalette(palette);
  }
}

function renderPaletteSwatches() {
  paletteSwatches.innerHTML = '';
  for (let i = 0; i < palette.length; i++) {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    const c = palette[i].rgb;
    swatch.style.background = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    swatch.title = `HSL(${Math.round(palette[i].h)}, ${(palette[i].s * 100).toFixed(0)}%, ${(palette[i].l * 100).toFixed(0)}%)`;
    swatch.addEventListener('click', () => {
      // Regenerate just this colour within the current strategy
      refreshPalette();
    });
    paletteSwatches.appendChild(swatch);
  }
}

// Palette strategy buttons
document.querySelectorAll('.palette-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.palette-buttons button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedStrategy = btn.dataset.strategy;
    refreshPalette();
  });
});

// ---- Evolution Control ----
function startEvolution() {
  if (!engine) {
    engine = new EvolutionEngine(palette, params, weights);
    engine.init();
  }
  running = true;
  btnStart.textContent = 'Running...';
  btnStart.disabled = true;
  btnPause.disabled = false;
  btnReset.disabled = false;
  btnExport.disabled = false;
  tick();
}

function pauseEvolution() {
  running = false;
  btnStart.textContent = 'Resume';
  btnStart.disabled = false;
  btnPause.disabled = true;
}

function resetEvolution() {
  running = false;
  engine = null;
  selectedIndividual = null;
  genCounter.textContent = '0';
  fitnessDisplay.textContent = '0.000';
  avgDisplay.textContent = '0.000';
  mutationDisplay.textContent = params.mutationRate.toFixed(2);
  populationGrid.innerHTML = '';
  bestScores.innerHTML = '<p class="muted">Click "Start Evolution" to begin</p>';
  btnStart.textContent = 'Start Evolution';
  btnStart.disabled = false;
  btnPause.disabled = true;
  btnReset.disabled = true;
  btnExport.disabled = true;

  // Show random preview
  const preview = createRandom(palette);
  renderBest(preview, palette, bestCanvas);

  // Clear chart
  const ctx = chartCanvas.getContext('2d');
  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
}

function exportPNG() {
  if (!engine) return;
  const best = selectedIndividual || engine.getBest();
  if (!best) return;

  // Render at high resolution
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 1600;
  exportCanvas.height = 1600;
  const ctx = exportCanvas.getContext('2d');
  renderIndividual(ctx, best, palette, 1600, 1600);

  const link = document.createElement('a');
  link.download = `composition-gen${engine.generation}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

btnStart.addEventListener('click', startEvolution);
btnPause.addEventListener('click', pauseEvolution);
btnReset.addEventListener('click', resetEvolution);
btnExport.addEventListener('click', exportPNG);

// ---- Animation Loop ----
function tick() {
  if (!running || !engine) return;

  // Run multiple generations per frame if fast enough
  const frameStart = performance.now();
  let gensThisFrame = 0;
  while (performance.now() - frameStart < 12 && gensThisFrame < 5) {
    engine.evolveOneGeneration();
    gensThisFrame++;
  }

  // Update display
  const best = engine.getBest();

  // Render best (or selected) individual
  const displayInd = selectedIndividual || best;
  renderBest(displayInd, palette, bestCanvas);
  renderScoreBreakdown(bestScores, displayInd?.scores, weights);

  // Render population grid every few generations
  if (engine.generation % 3 === 0) {
    renderGrid(engine.getTopN(20), palette, populationGrid, 80);

    // Re-attach click handlers
    populationGrid.querySelectorAll('canvas').forEach((thumb, idx) => {
      thumb.onclick = () => {
        populationGrid.querySelectorAll('canvas').forEach(t => t.classList.remove('selected'));
        thumb.classList.add('selected');
        const topN = engine.getTopN(20);
        if (topN[idx]) {
          selectedIndividual = topN[idx];
          renderBest(selectedIndividual, palette, bestCanvas);
          renderScoreBreakdown(bestScores, selectedIndividual.scores, weights);
        }
      };
    });
  }

  // Render chart
  renderChart(chartCanvas, engine.history);

  // Update stats
  genCounter.textContent = engine.generation;
  fitnessDisplay.textContent = engine.getBestFitness().toFixed(3);
  avgDisplay.textContent = engine.getAvgFitness().toFixed(3);
  mutationDisplay.textContent = engine.currentMutationRate.toFixed(2);

  requestAnimationFrame(tick);
}

// ---- Weight Sliders ----
const weightKeys = ['thirds', 'balance', 'symmetry', 'overlap', 'colour', 'variety', 'edge'];
for (const key of weightKeys) {
  const slider = document.getElementById(`weight-${key}`);
  const valSpan = document.getElementById(`val-${key}`);
  if (slider) {
    slider.addEventListener('input', () => {
      weights[key] = parseFloat(slider.value);
      valSpan.textContent = parseFloat(slider.value).toFixed(2);
      if (engine) {
        engine.setWeights(weights);
      }
    });
  }
}

// ---- EA Parameter Sliders ----
const paramMap = {
  'param-popSize': { key: 'populationSize', display: 'val-popSize', fmt: v => v.toString() },
  'param-mutRate': { key: 'mutationRate', display: 'val-mutRate', fmt: v => v.toFixed(2) },
  'param-crossRate': { key: 'crossoverRate', display: 'val-crossRate', fmt: v => v.toFixed(2) },
  'param-tournSize': { key: 'tournamentSize', display: 'val-tournSize', fmt: v => v.toString() },
  'param-elitism': { key: 'elitismCount', display: 'val-elitism', fmt: v => v.toString() }
};

for (const [sliderId, config] of Object.entries(paramMap)) {
  const slider = document.getElementById(sliderId);
  const valSpan = document.getElementById(config.display);
  if (slider) {
    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      params[config.key] = val;
      valSpan.textContent = config.fmt(val);
      if (engine) {
        engine.params[config.key] = val;
        if (config.key === 'mutationRate') {
          engine.baseMutationRate = val;
          engine.currentMutationRate = val;
        }
      }
    });
  }
}

// ---- Keyboard Shortcuts ----
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return; // Don't capture when typing in inputs

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (running) {
        pauseEvolution();
      } else {
        startEvolution();
      }
      break;
    case 'KeyR':
      resetEvolution();
      break;
    case 'KeyP':
      refreshPalette();
      break;
    case 'KeyE':
      exportPNG();
      break;
    case 'Escape':
      // Deselect individual, show best
      selectedIndividual = null;
      populationGrid.querySelectorAll('canvas').forEach(t => t.classList.remove('selected'));
      break;
  }
});

// ---- Initial Setup ----
refreshPalette();

// Set initial chart background
const chartCtx = chartCanvas.getContext('2d');
chartCtx.fillStyle = '#1a1a2e';
chartCtx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
chartCtx.fillStyle = '#888';
chartCtx.font = '12px monospace';
chartCtx.fillText('Fitness chart will appear here', chartCanvas.width / 2 - 100, chartCanvas.height / 2);
