// renderer/canvas.js — Render genome to canvas

/**
 * Render an individual to a canvas context.
 * Dispatches to the appropriate renderer based on individual mode.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} individual
 * @param {Array} palette - array of {rgb: [r,g,b]}
 * @param {number} width - canvas width in pixels
 * @param {number} height - canvas height in pixels
 * @param {string} bgColour - CSS colour string for the background
 */
export function renderIndividual(ctx, individual, palette, width, height, bgColour = '#f5f5f0') {
  if (individual.mode === 'tetris') {
    renderTetrisIndividual(ctx, individual, palette, width, height, bgColour);
    return;
  }

  // Background
  ctx.fillStyle = bgColour;
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

/**
 * Render a tetris-tiled individual.
 * Cells are always square; the grid is centred within the canvas.
 */
function renderTetrisIndividual(ctx, individual, palette, width, height, bgColour) {
  const { grid, pieces, gridRows, gridCols } = individual;

  // Square cells — pick the size that fits, centre the grid
  const cellSize = Math.min(width / gridCols, height / gridRows);
  const offsetX = (width - gridCols * cellSize) / 2;
  const offsetY = (height - gridRows * cellSize) / 2;
  const gap = Math.max(1, Math.round(cellSize * 0.06));

  // Background
  ctx.fillStyle = bgColour;
  ctx.fillRect(0, 0, width, height);

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const pieceId = grid[r][c];
      if (pieceId < 0) continue;

      const piece = pieces.find(p => p.id === pieceId);
      if (!piece) continue;

      const colour = palette[piece.colourIndex % palette.length];
      ctx.fillStyle = `rgb(${colour.rgb[0]}, ${colour.rgb[1]}, ${colour.rgb[2]})`;

      const x = offsetX + c * cellSize;
      const y = offsetY + r * cellSize;

      const gapTop = (r === 0 || grid[r - 1][c] !== pieceId) ? gap : 0;
      const gapLeft = (c === 0 || grid[r][c - 1] !== pieceId) ? gap : 0;
      const gapBottom = (r === gridRows - 1 || grid[r + 1][c] !== pieceId) ? gap : 0;
      const gapRight = (c === gridCols - 1 || grid[r][c + 1] !== pieceId) ? gap : 0;

      ctx.fillRect(
        x + gapLeft,
        y + gapTop,
        cellSize - gapLeft - gapRight,
        cellSize - gapTop - gapBottom
      );
    }
  }
}
