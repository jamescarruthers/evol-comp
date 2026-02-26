// fitness/balance.js — Visual balance / centre of mass scoring

/**
 * Score visual balance using centre-of-mass approach.
 * Darker and more saturated colours feel "heavier".
 * Perfect balance = centre of mass at canvas centre.
 */
export function scoreBalance(individual, palette, aspectRatio = 1) {
  const rects = individual.rectangles;
  if (rects.length === 0) return 0;

  let totalWeight = 0;
  let comX = 0;
  let comY = 0;

  for (const rect of rects) {
    const area = rect.w * rect.h;
    const colour = palette[rect.colourIndex];
    // Weight: area * (saturation * 0.7 + (1 - lightness) * 0.3)
    const weight = area * (colour.s * 0.7 + (1 - colour.l) * 0.3);
    comX += weight * rect.x;
    comY += weight * rect.y;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0.5;

  comX /= totalWeight;
  comY /= totalWeight;

  const dx = comX - aspectRatio / 2;
  const dy = comY - 0.5;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = Math.sqrt((aspectRatio / 2) ** 2 + 0.25);

  return 1 - (distance / maxDistance);
}
