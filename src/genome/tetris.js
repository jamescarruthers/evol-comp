// genome/tetris.js — Tetris interlocking shape tiling generation and operations
//
// Grids are rectangular (gridRows × gridCols) so cells stay square on
// non-square canvases. The aspect ratio is propagated at creation time;
// after that every function reads dimensions from the individual.

/**
 * Generate a random tiling of a gridRows×gridCols grid with tetromino-like
 * polyomino pieces (connected groups of up to 4 cells). The tiling fills
 * every cell with no gaps.
 *
 * @param {number} rows - number of rows
 * @param {number} cols - number of columns
 * @param {number} paletteLength - number of colours in palette
 * @returns {{ grid: number[][], pieces: Array<{id,cells,colourIndex}> }}
 */
export function generateTiling(rows, cols, paletteLength) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const pieces = [];
  let pieceId = 0;

  const unoccupied = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      unoccupied.add(r * cols + c);
    }
  }

  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (unoccupied.size > 0) {
    const startKey = firstFromSet(unoccupied);
    const startR = Math.floor(startKey / cols);
    const startC = startKey % cols;

    const cells = [{ r: startR, c: startC }];
    const cellSet = new Set([startKey]);

    while (cells.length < 4) {
      const frontier = [];
      for (const cell of cells) {
        for (const [dr, dc] of DIRS) {
          const nr = cell.r + dr;
          const nc = cell.c + dc;
          const key = nr * cols + nc;
          if (
            nr >= 0 && nr < rows &&
            nc >= 0 && nc < cols &&
            unoccupied.has(key) &&
            !cellSet.has(key)
          ) {
            frontier.push({ r: nr, c: nc, key });
          }
        }
      }
      if (frontier.length === 0) break;
      const next = frontier[Math.floor(Math.random() * frontier.length)];
      cells.push({ r: next.r, c: next.c });
      cellSet.add(next.key);
    }

    for (const cell of cells) {
      grid[cell.r][cell.c] = pieceId;
      unoccupied.delete(cell.r * cols + cell.c);
    }

    pieces.push({
      id: pieceId,
      cells,
      colourIndex: Math.floor(Math.random() * paletteLength)
    });
    pieceId++;
  }

  return { grid, pieces };
}

/**
 * Generate a nested tiling: first tile at coarse resolution, then subdivide
 * some pieces into finer tetris pieces to create areas of detail.
 *
 * @param {number} baseRows - coarse row count
 * @param {number} baseCols - coarse column count
 * @param {number} paletteLength
 * @param {number} divisions - nesting factor (2 = each coarse cell → 2×2 sub-cells)
 */
export function generateNestedTiling(baseRows, baseCols, paletteLength, divisions) {
  const fineRows = baseRows * divisions;
  const fineCols = baseCols * divisions;
  const fineGrid = Array.from({ length: fineRows }, () => new Array(fineCols).fill(-1));
  const pieces = [];
  let pieceId = 0;

  // Step 1: Generate coarse tiling
  const coarse = generateTiling(baseRows, baseCols, paletteLength);

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

  // Step 4: Fill subdivided pieces with small tetris pieces
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const piece of coarse.pieces) {
    if (!subdividedIds.has(piece.id)) continue;

    const freeCells = new Set();
    for (const cell of piece.cells) {
      for (let dr = 0; dr < divisions; dr++) {
        for (let dc = 0; dc < divisions; dc++) {
          const fr = cell.r * divisions + dr;
          const fc = cell.c * divisions + dc;
          freeCells.add(fr * fineCols + fc);
        }
      }
    }

    while (freeCells.size > 0) {
      let minKey = Infinity;
      for (const k of freeCells) if (k < minKey) minKey = k;

      const startR = Math.floor(minKey / fineCols);
      const startC = minKey % fineCols;

      const cells = [{ r: startR, c: startC }];
      const cellSet = new Set([minKey]);

      while (cells.length < 4) {
        const frontier = [];
        for (const c of cells) {
          for (const [dr, dc] of DIRS) {
            const nr = c.r + dr;
            const nc = c.c + dc;
            const key = nr * fineCols + nc;
            if (freeCells.has(key) && !cellSet.has(key)) {
              frontier.push({ r: nr, c: nc, key });
            }
          }
        }
        if (frontier.length === 0) break;
        const next = frontier[Math.floor(Math.random() * frontier.length)];
        cells.push({ r: next.r, c: next.c });
        cellSet.add(next.key);
      }

      for (const c of cells) {
        fineGrid[c.r][c.c] = pieceId;
        freeCells.delete(c.r * fineCols + c.c);
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

/** Pick the smallest key from a set (scan-order). */
function firstFromSet(set) {
  let min = Infinity;
  for (const k of set) if (k < min) min = k;
  return min;
}

// ---- Helpers to compute rectangular grid dimensions ----

/**
 * Compute gridRows and gridCols from a base grid size and the canvas
 * aspect ratio so that the tetris grid fills the entire canvas while
 * keeping cells square.
 *
 * `gridSize` becomes the shorter dimension; the longer dimension is
 * scaled proportionally to match the aspect ratio.
 */
export function computeGridDims(gridSize, aspectRatio = 1) {
  if (aspectRatio >= 1) {
    // Landscape or square: gridSize rows, more columns
    return { rows: gridSize, cols: Math.round(gridSize * aspectRatio) };
  }
  // Portrait: gridSize columns, more rows
  return { rows: Math.round(gridSize / aspectRatio), cols: gridSize };
}

// ---- Individual creation / cloning ----

/**
 * Create a random tetris-mode individual.
 * @param {Array} palette - colour palette
 * @param {number} gridSize - base grid divisions (becomes the shorter dimension)
 * @param {number} tetrisDivisions - nesting depth (1 = flat, 2+ = nested)
 * @param {number} aspectRatio - canvas width / height (default 1 for square)
 */
export function createRandomTetris(palette, gridSize, tetrisDivisions = 1, aspectRatio = 1) {
  const base = computeGridDims(gridSize, aspectRatio);

  if (tetrisDivisions > 1) {
    const fineRows = base.rows * tetrisDivisions;
    const fineCols = base.cols * tetrisDivisions;
    const { grid, pieces } = generateNestedTiling(base.rows, base.cols, palette.length, tetrisDivisions);
    return {
      mode: 'tetris',
      grid,
      pieces,
      gridRows: fineRows,
      gridCols: fineCols,
      gridSize: Math.max(fineRows, fineCols), // legacy compat
      tetrisDivisions,
      baseGridSize: gridSize,
      fitness: null,
      scores: null
    };
  }

  const { grid, pieces } = generateTiling(base.rows, base.cols, palette.length);
  return {
    mode: 'tetris',
    grid,
    pieces,
    gridRows: base.rows,
    gridCols: base.cols,
    gridSize: Math.max(base.rows, base.cols), // legacy compat
    tetrisDivisions: 1,
    baseGridSize: gridSize,
    fitness: null,
    scores: null
  };
}

/**
 * Deep-clone a tetris individual.
 */
export function cloneTetrisIndividual(ind) {
  return {
    mode: 'tetris',
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
    tetrisDivisions: ind.tetrisDivisions || 1,
    baseGridSize: ind.baseGridSize || ind.gridSize,
    fitness: ind.fitness,
    scores: ind.scores ? { ...ind.scores } : null
  };
}

// ---- Mutation ----

/**
 * Mutate a tetris individual in-place.
 */
export function mutateTetris(individual, mutationRate, paletteLength) {
  const { pieces } = individual;

  for (let attempt = 0; attempt < pieces.length; attempt++) {
    if (Math.random() > mutationRate) continue;

    const roll = Math.random();

    if (roll < 0.50) {
      const idx = Math.floor(Math.random() * pieces.length);
      pieces[idx].colourIndex = Math.floor(Math.random() * paletteLength);
    } else if (roll < 0.80) {
      if (pieces.length >= 2) {
        const a = Math.floor(Math.random() * pieces.length);
        let b = Math.floor(Math.random() * pieces.length);
        while (b === a) b = Math.floor(Math.random() * pieces.length);
        const tmp = pieces[a].colourIndex;
        pieces[a].colourIndex = pieces[b].colourIndex;
        pieces[b].colourIndex = tmp;
      }
    } else {
      retileRegion(individual, paletteLength);
    }
  }

  individual.fitness = null;
  individual.scores = null;
}

/**
 * Re-tile a random rectangular sub-region of the grid.
 */
function retileRegion(individual, paletteLength) {
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
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (freeCells.size > 0) {
    let minKey = Infinity;
    for (const k of freeCells) if (k < minKey) minKey = k;

    const startR = Math.floor(minKey / gridCols);
    const startC = minKey % gridCols;

    const cells = [{ r: startR, c: startC }];
    const cellSet = new Set([minKey]);

    while (cells.length < 4) {
      const frontier = [];
      for (const cell of cells) {
        for (const [dr, dc] of DIRS) {
          const nr = cell.r + dr;
          const nc = cell.c + dc;
          const key = nr * gridCols + nc;
          if (
            nr >= 0 && nr < gridRows &&
            nc >= 0 && nc < gridCols &&
            freeCells.has(key) &&
            !cellSet.has(key)
          ) {
            frontier.push({ r: nr, c: nc, key });
          }
        }
      }
      if (frontier.length === 0) break;
      const next = frontier[Math.floor(Math.random() * frontier.length)];
      cells.push({ r: next.r, c: next.c });
      cellSet.add(next.key);
    }

    for (const cell of cells) {
      grid[cell.r][cell.c] = nextId;
      freeCells.delete(cell.r * gridCols + cell.c);
    }

    newPieces.push({
      id: nextId,
      cells,
      colourIndex: Math.floor(Math.random() * paletteLength)
    });
    nextId++;
  }

  individual.pieces = newPieces;
}

// ---- Crossover ----

/**
 * Crossover two tetris individuals.
 */
export function crossoverTetris(parentA, parentB, paletteLength) {
  if (Math.random() < 0.5) {
    return colourCrossover(parentA, parentB);
  }
  return spatialTetrisCrossover(parentA, parentB);
}

/**
 * Colour crossover: keep one parent's tiling, assign colours from the
 * other parent based on spatial overlap.
 */
function colourCrossover(parentA, parentB) {
  const child = cloneTetrisIndividual(parentA);

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
function spatialTetrisCrossover(parentA, parentB) {
  const vertical = Math.random() < 0.5;
  const splitDim = vertical ? parentA.gridCols : parentA.gridRows;
  const splitPos = Math.floor(splitDim * (0.3 + Math.random() * 0.4));

  const child = cloneTetrisIndividual(parentA);

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
 * Convert a tetris individual's pieces to rectangle-like objects so that
 * existing fitness functions can evaluate them.
 *
 * Coordinates are normalised to 0–1 independently on each axis.
 */
export function tetrisToRects(individual) {
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
