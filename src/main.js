// main.js — App entry point, UI wiring, animation loop

import { generatePalette, STRATEGIES } from './palette/generator.js';
import { EvolutionEngine, DEFAULT_PARAMS } from './ea/engine.js';
import { DEFAULT_WEIGHTS } from './fitness/index.js';
import { renderBest, renderGrid, renderChart, renderScoreBreakdown } from './renderer/display.js';
import { renderIndividual } from './renderer/canvas.js';
import { applyAnalogueFilter } from './renderer/filter.js';
import { applyPixelArtFilter } from './renderer/xbr.js';
import { createRandom } from './genome/representation.js';

// ---- Aspect Ratio Presets ----
const ASPECT_PRESETS = {
  '1:1':     { w: 1,    h: 1,   canvasW: 400, canvasH: 400 },
  '4:3':     { w: 4,    h: 3,   canvasW: 480, canvasH: 360 },
  '3:2':     { w: 3,    h: 2,   canvasW: 510, canvasH: 340 },
  '16:9':    { w: 16,   h: 9,   canvasW: 560, canvasH: 315 },
  '21:9':    { w: 21,   h: 9,   canvasW: 630, canvasH: 270 },
  '2.39:1':  { w: 2.39, h: 1,   canvasW: 600, canvasH: 251 },
  '3:1':     { w: 3,    h: 1,   canvasW: 660, canvasH: 220 },
  '3:4':     { w: 3,    h: 4,   canvasW: 360, canvasH: 480 },
  '2:3':     { w: 2,    h: 3,   canvasW: 340, canvasH: 510 }
};

// ---- State ----
let palette = [];
let engine = null;
let running = false;
let selectedStrategy = 'random';
let selectedIndividual = null;
let weights = { ...DEFAULT_WEIGHTS };
let params = { ...DEFAULT_PARAMS };
let bgColour = '#f5f5f0';
let gridEnabled = false;
let gridDivisions = 8;
let tetrisMode = false;
let tetrisDivisions = 1;
let squareMode = false;
let squareDivisions = 1;
let filterEnabled = false;
let blurAmount = 0;
let sharpenAmount = 0;
let grainAmount = 0.25;
let vignetteAmount = 0.40;
let pixelFilterEnabled = false;
let pixelFilterScale = 4;
let currentAspect = '1:1';
let mutationToggles = { colour: true, size: true, position: true };
let generationInFlight = false; // true while async generation is computing

// ---- DOM References ----
const bestCanvas = document.getElementById('best-canvas');
const bestScores = document.getElementById('best-scores');
const populationGrid = document.getElementById('population-grid');
const chartCanvas = document.getElementById('chart-canvas');
const genCounter = document.getElementById('gen-counter');
const fitnessDisplay = document.getElementById('fitness-display');
const avgDisplay = document.getElementById('avg-display');
const mutationDisplay = document.getElementById('mutation-display');
const stagnationIndicator = document.getElementById('stagnation-indicator');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');
const paletteSwatches = document.getElementById('palette-swatches');
const bgColourInput = document.getElementById('bg-colour');
const bgColourVal = document.getElementById('val-bg-colour');
const gridToggle = document.getElementById('grid-toggle');
const gridDivisionsSlider = document.getElementById('grid-divisions');
const gridDivisionsVal = document.getElementById('val-grid-divisions');
const tetrisToggle = document.getElementById('tetris-toggle');
const tetrisDivisionsSlider = document.getElementById('tetris-divisions');
const tetrisDivisionsVal = document.getElementById('val-tetris-divisions');
const tetrisDivisionsRow = document.getElementById('tetris-divisions-row');
const squareToggle = document.getElementById('square-toggle');
const squareDivisionsSlider = document.getElementById('square-divisions');
const squareDivisionsVal = document.getElementById('val-square-divisions');
const squareDivisionsRow = document.getElementById('square-divisions-row');
const filterToggle = document.getElementById('filter-toggle');
const blurSlider = document.getElementById('blur-amount');
const blurVal = document.getElementById('val-blur-amount');
const blurRow = document.getElementById('blur-row');
const sharpenSlider = document.getElementById('sharpen-amount');
const sharpenVal = document.getElementById('val-sharpen-amount');
const sharpenRow = document.getElementById('sharpen-row');
const grainSlider = document.getElementById('grain-amount');
const grainVal = document.getElementById('val-grain-amount');
const grainRow = document.getElementById('grain-row');
const vignetteSlider = document.getElementById('vignette-amount');
const vignetteVal = document.getElementById('val-vignette-amount');
const vignetteRow = document.getElementById('vignette-row');
const pixelFilterToggle = document.getElementById('pixel-filter-toggle');
const pixelScaleSelect = document.getElementById('pixel-scale');
const pixelScaleRow = document.getElementById('pixel-scale-row');
const aspectRatioSelect = document.getElementById('aspect-ratio');
const toggleMutateColour = document.getElementById('toggle-mutate-colour');
const toggleMutateSize = document.getElementById('toggle-mutate-size');
const toggleMutatePosition = document.getElementById('toggle-mutate-position');

const STAGNATION_LABELS = ['', 'Stagnant', 'Shaking up', 'Cataclysm!'];
const STAGNATION_CLASSES = ['stagnation-none', 'stagnation-mild', 'stagnation-moderate', 'stagnation-severe'];

/** Current effective grid divisions (0 if disabled). */
function effectiveGrid() {
  return gridEnabled ? gridDivisions : 0;
}

/** Current canvas aspect ratio (width / height). */
function effectiveAspect() {
  const preset = ASPECT_PRESETS[currentAspect];
  return preset.canvasW / preset.canvasH;
}

// ---- Palette ----
function refreshPalette() {
  palette = generatePalette(selectedStrategy);
  renderPaletteSwatches();

  // Show a random composition preview
  const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
  renderBest(preview, palette, bestCanvas, bgColour);
  applyFilterToBest();

  // If engine is running, update its palette
  if (engine) {
    if (engine._useWorkers) {
      engine.setPaletteAsync(palette);
    } else {
      engine.setPalette(palette);
    }
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

// ---- Background Colour ----
bgColourInput.addEventListener('input', () => {
  bgColour = bgColourInput.value;
  bgColourVal.textContent = bgColour;
  bestCanvas.style.background = bgColour;

  if (engine) {
    if (engine._useWorkers) {
      engine.setBgColourAsync(bgColour);
    } else {
      engine.setBgColour(bgColour);
    }
  }

  // Re-render preview
  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
    renderScoreBreakdown(bestScores, displayInd.scores, weights);
  }
});

// ---- Grid Snapping ----
gridToggle.addEventListener('change', () => {
  gridEnabled = gridToggle.checked;
  gridDivisionsSlider.disabled = !gridEnabled;

  if (engine) {
    engine.setGridDivisions(effectiveGrid());
  }
});

gridDivisionsSlider.addEventListener('input', () => {
  gridDivisions = parseInt(gridDivisionsSlider.value, 10);
  gridDivisionsVal.textContent = gridDivisions.toString();

  if (engine && gridEnabled) {
    engine.setGridDivisions(gridDivisions);
  }
});

// ---- Tetris Mode ----
tetrisToggle.addEventListener('change', () => {
  tetrisMode = tetrisToggle.checked;

  // Show/hide tetris divisions slider
  tetrisDivisionsRow.style.display = tetrisMode ? 'flex' : 'none';

  // Tetris and square are mutually exclusive
  if (tetrisMode && squareMode) {
    squareMode = false;
    squareToggle.checked = false;
    squareDivisionsRow.style.display = 'none';
  }

  // Tetris mode requires a grid — auto-enable if needed
  if (tetrisMode && !gridEnabled) {
    gridEnabled = true;
    gridToggle.checked = true;
    gridDivisionsSlider.disabled = false;
  }

  // Reset the engine so the population is rebuilt with the new mode
  if (engine) {
    resetEvolution();
  }

  // Show a preview with the new mode
  const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
  renderBest(preview, palette, bestCanvas, bgColour);
  applyFilterToBest();
});

// ---- Tetris Shape Divisions ----
tetrisDivisionsSlider.addEventListener('input', () => {
  tetrisDivisions = parseInt(tetrisDivisionsSlider.value, 10);
  tetrisDivisionsVal.textContent = tetrisDivisions.toString();

  if (engine) {
    engine.setTetrisDivisions(tetrisDivisions);
    resetEvolution();
  }

  // Show a preview
  if (tetrisMode) {
    const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
    renderBest(preview, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

// ---- Analogue Filter ----
/** Apply pixel filter and/or analogue filter to the best-canvas if enabled. */
function applyFilterToBest() {
  if (!pixelFilterEnabled && !filterEnabled) return;
  const ctx = bestCanvas.getContext('2d');
  if (pixelFilterEnabled) {
    applyPixelArtFilter(ctx, bestCanvas.width, bestCanvas.height, { scaleFactor: pixelFilterScale });
  }
  if (filterEnabled) {
    applyAnalogueFilter(ctx, bestCanvas.width, bestCanvas.height, {
      blurAmount,
      sharpenAmount,
      grainAmount,
      vignetteAmount
    });
  }
}

filterToggle.addEventListener('change', () => {
  filterEnabled = filterToggle.checked;
  const show = filterEnabled ? 'flex' : 'none';
  blurRow.style.display = show;
  sharpenRow.style.display = show;
  grainRow.style.display = show;
  vignetteRow.style.display = show;

  // Re-render with filter applied
  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

grainSlider.addEventListener('input', () => {
  grainAmount = parseFloat(grainSlider.value);
  grainVal.textContent = grainAmount.toFixed(2);

  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

vignetteSlider.addEventListener('input', () => {
  vignetteAmount = parseFloat(vignetteSlider.value);
  vignetteVal.textContent = vignetteAmount.toFixed(2);

  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

blurSlider.addEventListener('input', () => {
  blurAmount = parseFloat(blurSlider.value);
  blurVal.textContent = blurAmount.toFixed(2);

  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

sharpenSlider.addEventListener('input', () => {
  sharpenAmount = parseFloat(sharpenSlider.value);
  sharpenVal.textContent = sharpenAmount.toFixed(2);

  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

// ---- Pixel Filter ----
pixelFilterToggle.addEventListener('change', () => {
  pixelFilterEnabled = pixelFilterToggle.checked;
  pixelScaleRow.style.display = pixelFilterEnabled ? 'flex' : 'none';

  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

pixelScaleSelect.addEventListener('change', () => {
  pixelFilterScale = parseInt(pixelScaleSelect.value, 10);

  const displayInd = selectedIndividual || (engine ? engine.getBest() : null);
  if (displayInd) {
    renderBest(displayInd, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

// ---- Square Mode ----
squareToggle.addEventListener('change', () => {
  squareMode = squareToggle.checked;

  // Show/hide square divisions slider
  squareDivisionsRow.style.display = squareMode ? 'flex' : 'none';

  // Square mode requires a grid — auto-enable if needed
  if (squareMode && !gridEnabled) {
    gridEnabled = true;
    gridToggle.checked = true;
    gridDivisionsSlider.disabled = false;
  }

  // Square and tetris are mutually exclusive
  if (squareMode && tetrisMode) {
    tetrisMode = false;
    tetrisToggle.checked = false;
    tetrisDivisionsRow.style.display = 'none';
  }

  // Reset the engine so the population is rebuilt with the new mode
  if (engine) {
    resetEvolution();
  }

  // Show a preview with the new mode
  const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
  renderBest(preview, palette, bestCanvas, bgColour);
  applyFilterToBest();
});

// ---- Square Divisions ----
squareDivisionsSlider.addEventListener('input', () => {
  squareDivisions = parseInt(squareDivisionsSlider.value, 10);
  squareDivisionsVal.textContent = squareDivisions.toString();

  if (engine) {
    engine.setSquareDivisions(squareDivisions);
    resetEvolution();
  }

  // Show a preview
  if (squareMode) {
    const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
    renderBest(preview, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
});

// ---- Mutation Toggles ----
function onMutationToggleChange() {
  mutationToggles.colour = toggleMutateColour.checked;
  mutationToggles.size = toggleMutateSize.checked;
  mutationToggles.position = toggleMutatePosition.checked;
  if (engine) {
    engine.setMutationToggles(mutationToggles);
  }
}

toggleMutateColour.addEventListener('change', onMutationToggleChange);
toggleMutateSize.addEventListener('change', onMutationToggleChange);
toggleMutatePosition.addEventListener('change', onMutationToggleChange);

// ---- Canvas Aspect Ratio ----
function applyAspectRatio(key) {
  const preset = ASPECT_PRESETS[key];
  if (!preset) return;
  currentAspect = key;

  // Update canvas internal dimensions
  bestCanvas.width = preset.canvasW;
  bestCanvas.height = preset.canvasH;

  // Update CSS display size
  bestCanvas.style.width = preset.canvasW + 'px';
  bestCanvas.style.height = preset.canvasH + 'px';

  // Update main grid layout for the new canvas width
  document.querySelector('main').style.gridTemplateColumns = preset.canvasW + 'px 1fr';

  // Reset and re-render
  if (engine) {
    resetEvolution();
  } else {
    const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
    renderBest(preview, palette, bestCanvas, bgColour);
    applyFilterToBest();
  }
}

aspectRatioSelect.addEventListener('change', () => {
  applyAspectRatio(aspectRatioSelect.value);
});

// ---- Evolution Control ----
async function startEvolution() {
  if (!engine) {
    engine = new EvolutionEngine(palette, params, weights, effectiveGrid(), bgColour, tetrisMode, tetrisDivisions, effectiveAspect(), mutationToggles, squareMode, squareDivisions);
    engine.enableWorkers();
    btnStart.textContent = 'Initialising...';
    btnStart.disabled = true;
    await engine.initAsync();
  }
  running = true;
  generationInFlight = false;
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
  generationInFlight = false;
  if (engine) {
    engine.disableWorkers();
  }
  engine = null;
  selectedIndividual = null;
  genCounter.textContent = '0';
  fitnessDisplay.textContent = '0.000';
  avgDisplay.textContent = '0.000';
  mutationDisplay.textContent = params.mutationRate.toFixed(2);
  stagnationIndicator.textContent = '';
  stagnationIndicator.className = 'stagnation-none';
  populationGrid.innerHTML = '';
  bestScores.innerHTML = '<p class="muted">Click "Start Evolution" to begin</p>';
  btnStart.textContent = 'Start Evolution';
  btnStart.disabled = false;
  btnPause.disabled = true;
  btnReset.disabled = true;
  btnExport.disabled = true;

  // Show random preview
  const preview = createRandom(palette, effectiveGrid(), tetrisMode, tetrisDivisions, effectiveAspect(), squareMode, squareDivisions);
  renderBest(preview, palette, bestCanvas, bgColour);
  applyFilterToBest();

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

  // Render at high resolution, preserving aspect ratio
  const preset = ASPECT_PRESETS[currentAspect];
  const scale = 4; // 4× the display resolution
  const exportW = preset.canvasW * scale;
  const exportH = preset.canvasH * scale;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportW;
  exportCanvas.height = exportH;
  const ctx = exportCanvas.getContext('2d');
  renderIndividual(ctx, best, palette, exportW, exportH, bgColour);
  if (pixelFilterEnabled) {
    applyPixelArtFilter(ctx, exportW, exportH, { scaleFactor: pixelFilterScale });
  }
  if (filterEnabled) {
    applyAnalogueFilter(ctx, exportW, exportH, { blurAmount, sharpenAmount, grainAmount, vignetteAmount });
  }

  const link = document.createElement('a');
  link.download = `composition-gen${engine.generation}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

btnStart.addEventListener('click', startEvolution);
btnPause.addEventListener('click', pauseEvolution);
btnReset.addEventListener('click', resetEvolution);
btnExport.addEventListener('click', exportPNG);

// ---- Display Update (shared by both sync and async paths) ----
function updateDisplay() {
  if (!engine) return;

  const best = engine.getBest();
  const displayInd = selectedIndividual || best;
  renderBest(displayInd, palette, bestCanvas, bgColour);
  applyFilterToBest();
  renderScoreBreakdown(bestScores, displayInd?.scores, weights);

  // Render population grid every few generations
  if (engine.generation % 3 === 0) {
    const preset = ASPECT_PRESETS[currentAspect];
    const thumbW = 80;
    const thumbH = Math.round(80 * (preset.canvasH / preset.canvasW));
    renderGrid(engine.getTopN(20), palette, populationGrid, thumbW, bgColour, thumbH);

    populationGrid.querySelectorAll('canvas').forEach((thumb, idx) => {
      thumb.onclick = () => {
        populationGrid.querySelectorAll('canvas').forEach(t => t.classList.remove('selected'));
        thumb.classList.add('selected');
        const topN = engine.getTopN(20);
        if (topN[idx]) {
          selectedIndividual = topN[idx];
          renderBest(selectedIndividual, palette, bestCanvas, bgColour);
          applyFilterToBest();
          renderScoreBreakdown(bestScores, selectedIndividual.scores, weights);
        }
      };
    });
  }

  renderChart(chartCanvas, engine.history);

  genCounter.textContent = engine.generation;
  fitnessDisplay.textContent = engine.getBestFitness().toFixed(3);
  avgDisplay.textContent = engine.getAvgFitness().toFixed(3);
  mutationDisplay.textContent = engine.currentMutationRate.toFixed(2);

  const tier = engine.stagnationTier || 0;
  stagnationIndicator.textContent = STAGNATION_LABELS[tier];
  stagnationIndicator.className = STAGNATION_CLASSES[tier];
}

// ---- Animation Loop ----
// With web workers: dispatch one async generation, render when it completes,
// then yield a frame to the browser before starting the next generation.
// The fitness evaluation runs off the main thread so the UI stays responsive.
function tick() {
  if (!running || !engine) return;

  if (!generationInFlight) {
    generationInFlight = true;

    engine.evolveOneGenerationAsync().then(() => {
      generationInFlight = false;

      if (!running || !engine) return;
      updateDisplay();
      requestAnimationFrame(tick);
    });
  } else {
    // Generation still computing — keep the loop alive
    requestAnimationFrame(tick);
  }
}

// ---- Weight Sliders ----
const weightKeys = ['thirds', 'balance', 'symmetry', 'overlap', 'colour', 'variety', 'edge', 'detail', 'clumping', 'detailClumping'];
for (const key of weightKeys) {
  const slider = document.getElementById(`weight-${key}`);
  const valSpan = document.getElementById(`val-${key}`);
  if (slider) {
    slider.addEventListener('input', () => {
      weights[key] = parseFloat(slider.value);
      valSpan.textContent = parseFloat(slider.value).toFixed(2);
      if (engine) {
        if (engine._useWorkers) {
          engine.setWeightsAsync(weights);
        } else {
          engine.setWeights(weights);
        }
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
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

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
    case 'KeyT':
      tetrisToggle.checked = !tetrisToggle.checked;
      tetrisToggle.dispatchEvent(new Event('change'));
      break;
    case 'KeyS':
      squareToggle.checked = !squareToggle.checked;
      squareToggle.dispatchEvent(new Event('change'));
      break;
    case 'Escape':
      // Deselect individual, show best
      selectedIndividual = null;
      populationGrid.querySelectorAll('canvas').forEach(t => t.classList.remove('selected'));
      break;
  }
});

// ---- Initial Setup ----
bestCanvas.style.background = bgColour;
refreshPalette();

// Set initial chart background
const chartCtx = chartCanvas.getContext('2d');
chartCtx.fillStyle = '#1a1a2e';
chartCtx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
chartCtx.fillStyle = '#888';
chartCtx.font = '12px monospace';
chartCtx.fillText('Fitness chart will appear here', chartCanvas.width / 2 - 100, chartCanvas.height / 2);
