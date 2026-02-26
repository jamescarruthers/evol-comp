// fitness/detail.js — Detail distribution scoring
//
// Measures how attractively "detail" (small shapes / high piece density)
// is distributed across the canvas. Rewards compositions where detail
// varies spatially, concentrates near compositional power points, and
// transitions smoothly rather than jumping erratically.

import { gaussianScore } from '../palette/harmony.js';

const REGIONS = 4; // divide canvas into 4×4 spatial regions

/**
 * Score the spatial distribution of detail across the composition.
 *
 * For each of 16 regions, computes a "detail level" based on how many
 * pieces are present and how small they are. Then scores three aspects:
 *
 *  1. Detail variety   — uneven distribution (some dense, some sparse)
 *  2. Focal quality    — high-detail areas near rule-of-thirds power points
 *  3. Spatial coherence — detail changes gradually, not erratically
 *
 * @param {Object} individual - individual with .rectangles array
 * @returns {number} score 0–1
 */
export function scoreDetail(individual) {
  const rects = individual.rectangles;
  if (!rects || rects.length < 2) return 0.5;

  // Count pieces and total area per region
  const regionPieceCount = new Float64Array(REGIONS * REGIONS);
  const regionTotalArea = new Float64Array(REGIONS * REGIONS);

  for (const rect of rects) {
    const rx = Math.max(0, Math.min(0.999, rect.x));
    const ry = Math.max(0, Math.min(0.999, rect.y));
    const rr = Math.floor(ry * REGIONS);
    const rc = Math.floor(rx * REGIONS);
    const idx = rr * REGIONS + rc;

    regionPieceCount[idx]++;
    regionTotalArea[idx] += rect.w * rect.h;
  }

  // Compute detail level per region: more pieces + smaller average = more detail
  const detailLevels = new Float64Array(REGIONS * REGIONS);
  for (let i = 0; i < REGIONS * REGIONS; i++) {
    if (regionPieceCount[i] === 0) {
      detailLevels[i] = 0;
    } else {
      const avgArea = regionTotalArea[i] / regionPieceCount[i];
      // detail ∝ count / avgArea — regions with many small pieces score high
      detailLevels[i] = regionPieceCount[i] / Math.max(0.001, avgArea);
    }
  }

  // Normalise to 0–1
  let maxDetail = 0;
  for (let i = 0; i < detailLevels.length; i++) {
    if (detailLevels[i] > maxDetail) maxDetail = detailLevels[i];
  }
  if (maxDetail < 0.001) return 0.5;

  const norm = new Float64Array(detailLevels.length);
  for (let i = 0; i < detailLevels.length; i++) {
    norm[i] = detailLevels[i] / maxDetail;
  }

  // --- 1. Detail variety (40%) ---
  // Entropy of the detail distribution — reward moderate entropy
  // (not all uniform, not all concentrated in one spot)
  let total = 0;
  for (let i = 0; i < norm.length; i++) total += norm[i];

  let entropy = 0;
  if (total > 0) {
    for (let i = 0; i < norm.length; i++) {
      const p = norm[i] / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    entropy /= Math.log2(REGIONS * REGIONS); // normalise to 0–1
  }
  // Peak at ~0.7 — varied but not completely uniform
  const varietyScore = gaussianScore(entropy, 0.7, 0.2);

  // --- 2. Focal quality (35%) ---
  // High detail near the four rule-of-thirds power points
  const powerPoints = [
    [1 / 3, 1 / 3], [2 / 3, 1 / 3],
    [1 / 3, 2 / 3], [2 / 3, 2 / 3]
  ];

  let focalScore = 0;
  for (const [px, py] of powerPoints) {
    const r = Math.floor(py * REGIONS);
    const c = Math.floor(px * REGIONS);
    focalScore += norm[r * REGIONS + c];
  }
  focalScore /= powerPoints.length;

  // --- 3. Spatial coherence (25%) ---
  // Neighbouring regions should transition smoothly
  let coherence = 0;
  let pairs = 0;
  for (let r = 0; r < REGIONS; r++) {
    for (let c = 0; c < REGIONS; c++) {
      const idx = r * REGIONS + c;
      if (c < REGIONS - 1) {
        coherence += 1 - Math.abs(norm[idx] - norm[idx + 1]);
        pairs++;
      }
      if (r < REGIONS - 1) {
        coherence += 1 - Math.abs(norm[idx] - norm[(r + 1) * REGIONS + c]);
        pairs++;
      }
    }
  }
  coherence /= pairs;

  return 0.40 * varietyScore + 0.35 * focalScore + 0.25 * coherence;
}
