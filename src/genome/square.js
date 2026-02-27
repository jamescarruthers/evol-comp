// genome/square.js — Square tiling generation and operations
//
// Like tetris mode but pieces are axis-aligned squares of varying sizes
// (1×1, 2×2, 3×3, …).  The grid + pieces data structure is identical to
// tetris, so rendering, fitness conversion, and crossover are shared.

import { computeGridDims } from './tetris.js';

/**
 * Maximum square side length (in cells) for the tiling generator.
 * Larger values produce a wider range of piece sizes.
 */
const MAX_SQUARE_SIDE = 4;

/**
 * Generate a random square tiling that fills every cell of a
 * gridRows × gridCols grid with non-overlapping axis-aligned squares.
 *
 * Algorithm: scan cells in row-major order; for each unoccupied cell,
 * pick the largest square that fits (up to MAX_SQUARE_SIDE), then
 * randomly shrink it to introduce size variety.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {number} paletteLength
 * @returns {{ grid: number[][], pieces: Array<{id,cells,colourIndex}> }}
 */
export function generateSquareTiling(rows, cols, paletteLength) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const pieces = [];
  let pieceId = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== -1) continue;

      // Find the largest square that fits starting at (r, c)
      let maxSide = 1;
      outer:
      for (let s = 2; s <= MAX_SQUARE_SIDE; s++) {
        if (r + s > rows || c + s > cols) break;
        for (let dr = 0; dr < s; dr++) {
          for (let dc = 0; dc < s; dc++) {
            if (grid[r + dr][c + dc] !== -1) break outer;
          }
        }
        maxSide = s;
      }

      // Randomly pick a side length from 1..maxSide, biased toward variety
      const side = 1 + Math.floor(Math.random() * maxSide);

      const cells = [];
      for (let dr = 0; dr < side; dr++) {
        for (let dc = 0; dc < side; dc++) {
          grid[r + dr][c + dc] = pieceId;
          cells.push({ r: r + dr, c: c + dc });
        }
      }

      pieces.push({
        id: pieceId,
        cells,
        colourIndex: Math.floor(Math.random() * paletteLength)
      });
      pieceId++;
    }
  }

  return { grid, pieces };
}

/**
 * Generate a nested square tiling: coarse squares at base resolution,
 * with ~50% of pieces subdivided into finer square tilings.
 *
 * @param {number} baseRows
 * @param {number} baseCols
 * @param {number} paletteLength
 * @param {number} divisions - nesting factor (2 = each coarse cell → 2×2 sub-cells)
 */
export function generateNestedSquareTiling(baseRows, baseCols, paletteLength, divisions) {
  const fineRows = baseRows * divisions;
  const fineCols = baseCols * divisions;
  const fineGrid = Array.from({ length: fineRows }, () => new Array(fineCols).fill(-1));
  const pieces = [];
  let pieceId = 0;

  // Step 1: Generate coarse tiling
  const coarse = generateSquareTiling(baseRows, baseCols, paletteLength);

  // Step 2: Decide which pieces to subdivide (~50%)
  const subdividedIds = new Set();
  for (const piece of coarse.pieces) {
    if (Math.random() < 0.5) subdividedIds.add(piece.id);
  }

  // Step 3: Place non-subdivided pieces as large blocks in the fine grid
  for (const piece of coarse.pieces) {
    if (subdividedIds.has(piece.id)) continue;

    const fineCells = [];
    for (const cell of piece.cells) {
      for (let dr = 0; dr < divisions; dr++) {
        for (let dc = 0; dc < divisions; dc++) {
          const fr = cell.r * divisions + dr;
          const fc = cell.c * divisions + dc;
          fineGrid[fr][fc] = pieceId;
          fineCells.push({ r: fr, c: fc });
        }
      }
    }

    pieces.push({ id: pieceId, cells: fineCells, colourIndex: piece.colourIndex, depth: 0 });
    pieceId++;
  }

  // Step 4: Fill subdivided pieces with small square pieces
  for (const piece of coarse.pieces) {
    if (!subdividedIds.has(piece.id)) continue;

    // Collect fine-grid cells belonging to this coarse piece
    const regionCells = [];
    for (const cell of piece.cells) {
      for (let dr = 0; dr < divisions; dr++) {
        for (let dc = 0; dc < divisions; dc++) {
          regionCells.push({ r: cell.r * divisions + dr, c: cell.c * divisions + dc });
        }
      }
    }

    // Build a lookup for fast occupancy checks within the region
    const regionSet = new Set(regionCells.map(c => c.r * fineCols + c.c));

    // Fill region with squares (scan order)
    regionCells.sort((a, b) => a.r !== b.r ? a.r - b.r : a.c - b.c);

    for (const startCell of regionCells) {
      const key = startCell.r * fineCols + startCell.c;
      if (!regionSet.has(key)) continue;
      if (fineGrid[startCell.r][startCell.c] !== -1) continue;

      // Find largest square that fits within this region
      let maxSide = 1;
      outer:
      for (let s = 2; s <= MAX_SQUARE_SIDE; s++) {
        for (let dr = 0; dr < s; dr++) {
          for (let dc = 0; dc < s; dc++) {
            const fr = startCell.r + dr;
            const fc = startCell.c + dc;
            if (fr >= fineRows || fc >= fineCols) break outer;
            if (!regionSet.has(fr * fineCols + fc)) break outer;
            if (fineGrid[fr][fc] !== -1) break outer;
          }
        }
        maxSide = s;
      }

      const side = 1 + Math.floor(Math.random() * maxSide);
      const cells = [];
      for (let dr = 0; dr < side; dr++) {
        for (let dc = 0; dc < side; dc++) {
          const fr = startCell.r + dr;
          const fc = startCell.c + dc;
          fineGrid[fr][fc] = pieceId;
          cells.push({ r: fr, c: fc });
        }
      }

      pieces.push({
        id: pieceId,
        cells,
        colourIndex: Math.floor(Math.random() * paletteLength),
        depth: 1
      });
      pieceId++;
    }
  }

  return { grid: fineGrid, pieces };
}

// ---- Individual creation / cloning ----

/**
 * Create a random square-mode individual.
 * @param {Array} palette
 * @param {number} gridSize - base grid divisions (shorter dimension)
 * @param {number} squareDivisions - nesting depth (1 = flat, 2+ = nested)
 * @param {number} aspectRatio - canvas width / height
 */
export function createRandomSquare(palette, gridSize, squareDivisions = 1, aspectRatio = 1) {
  const base = computeGridDims(gridSize, aspectRatio);

  if (squareDivisions > 1) {
    const fineRows = base.rows * squareDivisions;
    const fineCols = base.cols * squareDivisions;
    const { grid, pieces } = generateNestedSquareTiling(base.rows, base.cols, palette.length, squareDivisions);
    return {
      mode: 'square',
      grid,
      pieces,
      gridRows: fineRows,
      gridCols: fineCols,
      gridSize: Math.max(fineRows, fineCols),
      squareDivisions,
      baseGridSize: gridSize,
      fitness: null,
      scores: null
    };
  }

  const { grid, pieces } = generateSquareTiling(base.rows, base.cols, palette.length);
  return {
    mode: 'square',
    grid,
    pieces,
    gridRows: base.rows,
    gridCols: base.cols,
    gridSize: Math.max(base.rows, base.cols),
    squareDivisions: 1,
    baseGridSize: gridSize,
    fitness: null,
    scores: null
  };
}

/**
 * Deep-clone a square individual.
 */
export function cloneSquareIndividual(ind) {
  return {
    mode: 'square',
    grid: ind.grid.map(row => [...row]),
    pieces: ind.pieces.map(p => ({
      id: p.id,
      cells: p.cells.map(c => ({ ...c })),
      colourIndex: p.colourIndex,
      depth: p.depth || 0
    })),
    gridRows: ind.gridRows,
    gridCols: ind.gridCols,
    gridSize: ind.gridSize,
    squareDivisions: ind.squareDivisions || 1,
    baseGridSize: ind.baseGridSize || ind.gridSize,
    fitness: ind.fitness,
    scores: ind.scores ? { ...ind.scores } : null
  };
}

// ---- Mutation ----

/**
 * Mutate a square individual in-place.
 * @param {Object} mutationToggles - { colour, size, position } booleans
 */
export function mutateSquare(individual, mutationRate, paletteLength, mutationToggles) {
  const mt = mutationToggles || { colour: true, size: true, position: true };
  const { pieces } = individual;

  for (let attempt = 0; attempt < pieces.length; attempt++) {
    if (Math.random() > mutationRate) continue;

    const roll = Math.random();

    if (roll < 0.50) {
      // Recolour piece
      if (!mt.colour) continue;
      const idx = Math.floor(Math.random() * pieces.length);
      pieces[idx].colourIndex = Math.floor(Math.random() * paletteLength);
    } else if (roll < 0.80) {
      // Swap piece colours
      if (!mt.colour) continue;
      if (pieces.length >= 2) {
        const a = Math.floor(Math.random() * pieces.length);
        let b = Math.floor(Math.random() * pieces.length);
        while (b === a) b = Math.floor(Math.random() * pieces.length);
        const tmp = pieces[a].colourIndex;
        pieces[a].colourIndex = pieces[b].colourIndex;
        pieces[b].colourIndex = tmp;
      }
    } else {
      // Retile region with squares
      if (!mt.position) continue;
      retileSquareRegion(individual, paletteLength);
    }
  }

  individual.fitness = null;
  individual.scores = null;
}

/**
 * Re-tile a random rectangular sub-region of the grid with squares.
 */
function retileSquareRegion(individual, paletteLength) {
  const { grid, pieces, gridRows, gridCols } = individual;

  const regionSize = 2 + Math.floor(Math.random() * 3);
  const r0 = Math.floor(Math.random() * Math.max(1, gridRows - regionSize + 1));
  const c0 = Math.floor(Math.random() * Math.max(1, gridCols - regionSize + 1));
  const r1 = Math.min(r0 + regionSize, gridRows);
  const c1 = Math.min(c0 + regionSize, gridCols);

  const affectedIds = new Set();
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      affectedIds.add(grid[r][c]);
    }
  }

  // Collect all cells belonging to affected pieces
  const freeCells = new Set();
  for (const pid of affectedIds) {
    const piece = pieces.find(p => p.id === pid);
    if (!piece) continue;
    for (const cell of piece.cells) {
      freeCells.add(cell.r * gridCols + cell.c);
      grid[cell.r][cell.c] = -1;
    }
  }

  const removedIds = new Set(affectedIds);
  let newPieces = pieces.filter(p => !removedIds.has(p.id));

  let nextId = pieces.length > 0 ? Math.max(...pieces.map(p => p.id)) + 1 : 0;

  // Compute bounding box of free cells
  let minR = gridRows, maxR = 0, minC = gridCols, maxC = 0;
  for (const key of freeCells) {
    const r = Math.floor(key / gridCols);
    const c = key % gridCols;
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }

  // Fill with squares in scan order
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const key = r * gridCols + c;
      if (!freeCells.has(key)) continue;
      if (grid[r][c] !== -1) continue;

      // Find max square that fits within free cells
      let maxSide = 1;
      outer:
      for (let s = 2; s <= MAX_SQUARE_SIDE; s++) {
        for (let dr = 0; dr < s; dr++) {
          for (let dc = 0; dc < s; dc++) {
            const fr = r + dr;
            const fc = c + dc;
            if (fr >= gridRows || fc >= gridCols) break outer;
            if (!freeCells.has(fr * gridCols + fc)) break outer;
            if (grid[fr][fc] !== -1) break outer;
          }
        }
        maxSide = s;
      }

      const side = 1 + Math.floor(Math.random() * maxSide);
      const cells = [];
      for (let dr = 0; dr < side; dr++) {
        for (let dc = 0; dc < side; dc++) {
          grid[r + dr][c + dc] = nextId;
          cells.push({ r: r + dr, c: c + dc });
          freeCells.delete((r + dr) * gridCols + (c + dc));
        }
      }

      newPieces.push({
        id: nextId,
        cells,
        colourIndex: Math.floor(Math.random() * paletteLength)
      });
      nextId++;
    }
  }

  individual.pieces = newPieces;
}

// ---- Crossover ----

/**
 * Crossover two square individuals.
 */
export function crossoverSquare(parentA, parentB) {
  if (Math.random() < 0.5) {
    return colourCrossover(parentA, parentB);
  }
  return spatialSquareCrossover(parentA, parentB);
}

/**
 * Colour crossover: keep one parent's tiling, assign colours from the
 * other parent based on spatial overlap.
 */
function colourCrossover(parentA, parentB) {
  const child = cloneSquareIndividual(parentA);

  for (const piece of child.pieces) {
    if (piece.cells.length === 0) continue;
    const repCell = piece.cells[0];
    const otherPieceId = parentB.grid[repCell.r]?.[repCell.c];
    const otherPiece = otherPieceId != null
      ? parentB.pieces.find(p => p.id === otherPieceId)
      : null;

    if (otherPiece && Math.random() < 0.5) {
      piece.colourIndex = otherPiece.colourIndex;
    }
  }

  child.fitness = null;
  child.scores = null;
  return child;
}

/**
 * Spatial crossover: split the grid with a random line.
 */
function spatialSquareCrossover(parentA, parentB) {
  const vertical = Math.random() < 0.5;
  const splitDim = vertical ? parentA.gridCols : parentA.gridRows;
  const splitPos = Math.floor(splitDim * (0.3 + Math.random() * 0.4));

  const child = cloneSquareIndividual(parentA);

  for (const piece of child.pieces) {
    let cr = 0, cc = 0;
    for (const cell of piece.cells) {
      cr += cell.r;
      cc += cell.c;
    }
    cr /= piece.cells.length;
    cc /= piece.cells.length;

    const val = vertical ? cc : cr;
    if (val >= splitPos) {
      const repCell = piece.cells[0];
      const otherPieceId = parentB.grid[repCell.r]?.[repCell.c];
      const otherPiece = otherPieceId != null
        ? parentB.pieces.find(p => p.id === otherPieceId)
        : null;
      if (otherPiece) {
        piece.colourIndex = otherPiece.colourIndex;
      }
    }
  }

  child.fitness = null;
  child.scores = null;
  return child;
}

// ---- Conversion to pseudo-rectangles for fitness ----

/**
 * Convert a square individual's pieces to rectangle-like objects so that
 * existing fitness functions can evaluate them.
 *
 * Coordinates are normalised to 0–1 independently on each axis.
 */
export function squareToRects(individual) {
  const { pieces, gridRows, gridCols } = individual;
  const stepX = 1 / gridCols;
  const stepY = 1 / gridRows;

  return pieces.map((piece, i) => {
    let cx = 0, cy = 0;
    let minC = Infinity, maxC = -Infinity;
    let minR = Infinity, maxR = -Infinity;

    for (const cell of piece.cells) {
      cx += (cell.c + 0.5) * stepX;
      cy += (cell.r + 0.5) * stepY;
      minC = Math.min(minC, cell.c);
      maxC = Math.max(maxC, cell.c + 1);
      minR = Math.min(minR, cell.r);
      maxR = Math.max(maxR, cell.r + 1);
    }

    cx /= piece.cells.length;
    cy /= piece.cells.length;

    return {
      x: cx,
      y: cy,
      w: (maxC - minC) * stepX,
      h: (maxR - minR) * stepY,
      colourIndex: piece.colourIndex,
      z: i
    };
  });
}
