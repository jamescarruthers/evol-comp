// renderer/canvas.js — Render genome to canvas

/**
 * Render an individual to a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} individual
 * @param {Array} palette - array of {rgb: [r,g,b]}
 * @param {number} width - canvas width in pixels
 * @param {number} height - canvas height in pixels
 */
export function renderIndividual(ctx, individual, palette, width, height) {
  // Background
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 0, width, height);

  // Sort by z-order (lower z draws first / further back)
  const sorted = [...individual.rectangles].sort((a, b) => a.z - b.z);

  for (const rect of sorted) {
    const colour = palette[rect.colourIndex % palette.length];
    const px = rect.x * width;
    const py = rect.y * height;
    const pw = rect.w * width;
    const ph = rect.h * height;

    ctx.fillStyle = `rgb(${colour.rgb[0]}, ${colour.rgb[1]}, ${colour.rgb[2]})`;
    ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
  }
}
