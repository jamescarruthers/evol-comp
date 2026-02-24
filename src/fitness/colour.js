// fitness/colour.js — Colour distribution & contrast scoring

import { deltaE00, rgbToLab } from '../palette/harmony.js';

/**
 * Compute axis-aligned overlap area between two rectangles.
 */
function overlaps(a, b) {
  const aLeft = a.x - a.w / 2, aRight = a.x + a.w / 2;
  const aTop = a.y - a.h / 2, aBottom = a.y + a.h / 2;
  const bLeft = b.x - b.w / 2, bRight = b.x + b.w / 2;
  const bTop = b.y - b.h / 2, bBottom = b.y + b.h / 2;

  const overlapW = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
  const overlapH = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
  return overlapW * overlapH > 0;
}

/**
 * Check if two rectangles are adjacent (within a small distance threshold).
 */
function adjacent(a, b, threshold) {
  const aLeft = a.x - a.w / 2, aRight = a.x + a.w / 2;
  const aTop = a.y - a.h / 2, aBottom = a.y + a.h / 2;
  const bLeft = b.x - b.w / 2, bRight = b.x + b.w / 2;
  const bTop = b.y - b.h / 2, bBottom = b.y + b.h / 2;

  const gapX = Math.max(0, Math.max(aLeft, bLeft) - Math.min(aRight, bRight));
  const gapY = Math.max(0, Math.max(aTop, bTop) - Math.min(aBottom, bBottom));

  return Math.sqrt(gapX * gapX + gapY * gapY) < threshold;
}

/**
 * Parse a CSS hex colour to [r, g, b] (0–255).
 */
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16)
  ];
}

/**
 * Score colour distribution and contrast, including background colour.
 * 1. Colour usage entropy (balance) — includes background visible area
 * 2. Colour contrast between adjacent/overlapping rectangles
 * 3. Contrast between rectangles and background
 * @param {Object} individual
 * @param {Array} palette - colour palette
 * @param {string} bgColour - CSS hex colour for the background
 */
export function scoreColour(individual, palette, bgColour = '#f5f5f0') {
  const rects = individual.rectangles;
  if (rects.length === 0 || palette.length === 0) return 0;

  const bgRgb = hexToRgb(bgColour);
  const bgLab = rgbToLab(bgRgb[0], bgRgb[1], bgRgb[2]);

  // 1. Colour usage entropy — include background as a colour channel
  const areaByColour = new Array(palette.length).fill(0);
  let totalRectArea = 0;

  for (const rect of rects) {
    const area = rect.w * rect.h;
    areaByColour[rect.colourIndex] += area;
    totalRectArea += area;
  }

  // Estimate visible background area (1 - coverage, clamped)
  const bgArea = Math.max(0, 1 - totalRectArea * 0.7); // approximate since overlaps reduce coverage

  const totalArea = totalRectArea + bgArea;
  let entropy = 0;
  if (totalArea > 0) {
    // Background entropy contribution
    const pBg = bgArea / totalArea;
    if (pBg > 0) {
      entropy -= pBg * Math.log2(pBg);
    }

    for (let i = 0; i < palette.length; i++) {
      const p = areaByColour[i] / totalArea;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
  }

  const maxEntropy = Math.log2(palette.length + 1); // +1 for background
  const entropyScore = maxEntropy > 0 ? entropy / maxEntropy : 1;

  // 2. Colour contrast between neighbouring rectangles
  let contrastSum = 0;
  let contrastCount = 0;

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (overlaps(rects[i], rects[j]) || adjacent(rects[i], rects[j], 0.05)) {
        const dE = deltaE00(
          palette[rects[i].colourIndex].lab,
          palette[rects[j].colourIndex].lab
        );
        contrastSum += Math.min(dE / 30, 1.0);
        contrastCount++;
      }
    }
  }

  // 3. Background contrast — each rectangle vs background
  for (const rect of rects) {
    const dE = deltaE00(palette[rect.colourIndex].lab, bgLab);
    contrastSum += Math.min(dE / 30, 1.0);
    contrastCount++;
  }

  const contrastScore = contrastCount > 0 ? contrastSum / contrastCount : 0.5;

  return 0.5 * entropyScore + 0.5 * contrastScore;
}
