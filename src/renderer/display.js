// renderer/display.js — Render population grid + best individual + fitness chart

import { renderIndividual } from './canvas.js';

/**
 * Render the best individual to the main preview canvas.
 */
export function renderBest(individual, palette, canvas, bgColour = '#f5f5f0') {
  if (!individual) return;
  const ctx = canvas.getContext('2d');
  renderIndividual(ctx, individual, palette, canvas.width, canvas.height, bgColour);
}

/**
 * Render top N individuals as thumbnails in the population grid.
 * @param {Array} individuals - top N individuals
 * @param {Array} palette
 * @param {HTMLElement} gridContainer - container element for grid canvases
 * @param {number} thumbSize - size of each thumbnail in pixels
 * @param {string} bgColour - background colour
 */
export function renderGrid(individuals, palette, gridContainer, thumbW = 80, bgColour = '#f5f5f0', thumbH = 0) {
  const th = thumbH || thumbW;

  // Ensure we have the right number of canvases
  const existing = gridContainer.querySelectorAll('canvas');
  while (existing.length > individuals.length) {
    gridContainer.removeChild(gridContainer.lastChild);
  }

  for (let i = 0; i < individuals.length; i++) {
    let canvas;
    if (i < existing.length) {
      canvas = existing[i];
    } else {
      canvas = document.createElement('canvas');
      canvas.className = 'grid-thumb';
      canvas.dataset.index = i;
      gridContainer.appendChild(canvas);
    }

    canvas.width = thumbW;
    canvas.height = th;
    canvas.style.aspectRatio = thumbW + ' / ' + th;

    const ctx = canvas.getContext('2d');
    renderIndividual(ctx, individuals[i], palette, thumbW, th, bgColour);
  }
}

/**
 * Render the fitness chart (best/avg/worst over generations).
 * @param {HTMLCanvasElement} chartCanvas
 * @param {Array} history - array of { best, avg, worst }
 */
export function renderChart(chartCanvas, history) {
  const ctx = chartCanvas.getContext('2d');
  const w = chartCanvas.width;
  const h = chartCanvas.height;
  const padding = { top: 20, right: 15, bottom: 30, left: 45 };

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  if (history.length < 2) {
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('Waiting for data...', w / 2 - 60, h / 2);
    return;
  }

  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  // Find y range
  let yMin = 0;
  let yMax = 1;

  // Grid lines
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + plotH * (1 - i / 5);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText((i / 5).toFixed(1), padding.left - 5, y + 3);
  }

  // Axes labels
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Generation', w / 2, h - 5);

  // Plot lines
  const drawLine = (data, key, colour) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = key === 'best' ? 2 : 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (i / (data.length - 1)) * plotW;
      const y = padding.top + plotH * (1 - (data[i][key] - yMin) / (yMax - yMin));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawLine(history, 'best', '#4ecdc4');
  drawLine(history, 'avg', '#ffd93d');
  drawLine(history, 'worst', '#ff6b6b');

  // Legend
  const legendY = padding.top + 5;
  const legends = [
    { label: 'Best', colour: '#4ecdc4' },
    { label: 'Avg', colour: '#ffd93d' },
    { label: 'Worst', colour: '#ff6b6b' }
  ];
  ctx.font = '10px monospace';
  let legendX = w - padding.right - 140;
  for (const leg of legends) {
    ctx.fillStyle = leg.colour;
    ctx.fillRect(legendX, legendY, 12, 8);
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'left';
    ctx.fillText(leg.label, legendX + 16, legendY + 8);
    legendX += 48;
  }

  // Generation ticks on x-axis
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  const totalGens = history.length - 1;
  const tickCount = Math.min(5, totalGens);
  for (let i = 0; i <= tickCount; i++) {
    const gen = Math.round((i / tickCount) * totalGens);
    const x = padding.left + (gen / totalGens) * plotW;
    ctx.fillText(gen.toString(), x, h - padding.bottom + 15);
  }
}

/**
 * Render sub-score breakdown bars for the selected individual.
 * @param {HTMLElement} container
 * @param {Object} scores - { thirds, balance, symmetry, overlap, colour, variety, edge }
 * @param {Object} weights
 */
export function renderScoreBreakdown(container, scores, weights) {
  if (!scores) {
    container.innerHTML = '<p class="muted">No individual selected</p>';
    return;
  }

  const labels = {
    thirds: 'Rule of Thirds',
    balance: 'Visual Balance',
    symmetry: 'Symmetry',
    overlap: 'Overlap Quality',
    colour: 'Colour Dist.',
    variety: 'Size Variety',
    edge: 'Edge Penalty',
    detail: 'Detail Dist.',
    clumping: 'Colour Clumping'
  };

  let html = '';
  for (const [key, label] of Object.entries(labels)) {
    const score = scores[key] || 0;
    const weight = weights[key] || 0;
    const weighted = score * weight;
    const pct = (score * 100).toFixed(0);
    html += `
      <div class="score-row">
        <span class="score-label">${label}</span>
        <div class="score-bar-container">
          <div class="score-bar" style="width: ${pct}%; background: hsl(${score * 120}, 70%, 45%)"></div>
        </div>
        <span class="score-value">${score.toFixed(2)}</span>
      </div>`;
  }

  container.innerHTML = html;
}
