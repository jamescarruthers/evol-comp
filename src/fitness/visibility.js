// fitness/visibility.js — Compute visible fraction of each shape
//
// For each rectangle, estimates how much of it is visible (not occluded
// by higher-z shapes).  Uses axis-aligned overlap areas — conservative
// when multiple occluders overlap each other (slightly under-reports
// visibility), which creates healthy evolutionary pressure against
// hidden shapes.

/**
 * Axis-aligned overlap area between two centre-defined rectangles.
 */
function overlapArea(a, b) {
  const aL = a.x - a.w / 2, aR = a.x + a.w / 2;
  const aT = a.y - a.h / 2, aB = a.y + a.h / 2;
  const bL = b.x - b.w / 2, bR = b.x + b.w / 2;
  const bT = b.y - b.h / 2, bB = b.y + b.h / 2;

  const w = Math.max(0, Math.min(aR, bR) - Math.max(aL, bL));
  const h = Math.max(0, Math.min(aB, bB) - Math.max(aT, bT));
  return w * h;
}

/**
 * Annotate every rectangle in `rects` with a `.visibility` property (0–1).
 *
 * visibility = 1  → fully visible
 * visibility = 0  → completely hidden behind higher-z shapes
 *
 * The value is an approximation: we sum pairwise overlap areas from all
 * higher-z rectangles.  When those occluders overlap *each other* the
 * hidden area is slightly over-counted, so visibility may read a little
 * lower than truth — a safe direction for fitness scoring.
 *
 * @param {Array} rects - rectangles with {x, y, w, h, z}
 */
export function computeVisibility(rects) {
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const area = rect.w * rect.h;
    if (area <= 0) {
      rect.visibility = 0;
      continue;
    }

    let occluded = 0;
    for (let j = 0; j < rects.length; j++) {
      if (j === i) continue;
      // Only shapes with strictly higher z occlude this one
      if (rects[j].z > rect.z) {
        occluded += overlapArea(rect, rects[j]);
      }
    }

    rect.visibility = Math.max(0, 1 - occluded / area);
  }
}
