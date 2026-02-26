// fitness/edge.js — Off-canvas penalty scoring

/**
 * Penalise rectangles that are mostly off-canvas.
 * Allow up to 30% off-screen per rectangle (partial bleed is a valid compositional choice).
 */
export function scoreEdgePenalty(individual, aspectRatio = 1) {
  const rects = individual.rectangles;
  if (rects.length === 0) return 1;

  let penalty = 0;

  for (const rect of rects) {
    const left = rect.x - rect.w / 2;
    const right = rect.x + rect.w / 2;
    const top = rect.y - rect.h / 2;
    const bottom = rect.y + rect.h / 2;

    const area = rect.w * rect.h;
    if (area === 0) continue;

    // Clipped rectangle within [0, aspectRatio] × [0, 1]
    const clippedLeft = Math.max(0, left);
    const clippedRight = Math.min(aspectRatio, right);
    const clippedTop = Math.max(0, top);
    const clippedBottom = Math.min(1, bottom);

    const clippedW = Math.max(0, clippedRight - clippedLeft);
    const clippedH = Math.max(0, clippedBottom - clippedTop);
    const visibleArea = clippedW * clippedH;

    const offscreenFraction = 1 - (visibleArea / area);

    // Allow up to 30% off-screen
    penalty += Math.max(0, offscreenFraction - 0.3);
  }

  return Math.max(0, 1 - penalty / rects.length);
}
