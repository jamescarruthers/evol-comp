// genome/tetris.js — Tetris interlocking shape tiling generation and operations

/**
 * Generate a random tiling of a gridSize×gridSize grid with tetromino-like
 * polyomino pieces (connected groups of up to 4 cells). The tiling fills
 * every cell with no gaps.
 *
 * Uses a greedy random-walk approach: pick an unoccupied cell, grow a
 * connected piece of up to 4 cells from it, assign a colour, repeat.
 *
 * @param {number} gridSize - grid divisions (e.g. 8 → 8×8 grid)
 * @param {number} paletteLength - number of colours in palette
 * @returns {{ grid: number[][], pieces: Array<{id:number, cells:Array<{r:number,c:number}>, colourIndex:number}> }}
 */
export function generateTiling(gridSize, paletteLength) {
  // -1 = unoccupied
  const grid = Array.from({ length: gridSize }, () => new Array(gridSize).fill(-1));
  const pieces = [];
  let pieceId = 0;

  // Track unoccupied cells for efficient selection
  const unoccupied = new Set();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      unoccupied.add(r * gridSize + c);
    }
  }

  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (unoccupied.size > 0) {
    // Pick the first remaining unoccupied cell (scan order gives more
    // uniform coverage than random selection)
    const startKey = firstFromSet(unoccupied);
    const startR = Math.floor(startKey / gridSize);
    const startC = startKey % gridSize;

    const cells = [{ r: startR, c: startC }];
    const cellSet = new Set([startKey]);
    const targetSize = 4;

    // Grow piece via random walk through unoccupied neighbours
    while (cells.length < targetSize) {
      const frontier = [];
      for (const cell of cells) {
        for (const [dr, dc] of DIRS) {
          const nr = cell.r + dr;
          const nc = cell.c + dc;
          const key = nr * gridSize + nc;
          if (
            nr >= 0 && nr < gridSize &&
            nc >= 0 && nc < gridSize &&
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

    // Mark cells occupied
    for (const cell of cells) {
      const key = cell.r * gridSize + cell.c;
      grid[cell.r][cell.c] = pieceId;
      unoccupied.delete(key);
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
 * @param {number} baseGridSize - coarse grid size (e.g. 8)
 * @param {number} paletteLength - number of colours in palette
 * @param {number} divisions - nesting level (2 = each coarse cell → 2×2 sub-cells, etc.)
 * @returns {{ grid: number[][], pieces: Array<{id:number, cells:Array<{r:number,c:number}>, colourIndex:number, depth:number}> }}
 */
export function generateNestedTiling(baseGridSize, paletteLength, divisions) {
  const fineSize = baseGridSize * divisions;
  const fineGrid = Array.from({ length: fineSize }, () => new Array(fineSize).fill(-1));
  const pieces = [];
  let pieceId = 0;

  // Step 1: Generate coarse tiling
  const coarse = generateTiling(baseGridSize, paletteLength);

  // Step 2: Decide which pieces to subdivide (~50%)
  const subdivideProb = 0.5;
  const subdividedIds = new Set();
  for (const piece of coarse.pieces) {
    if (Math.random() < subdivideProb) {
      subdividedIds.add(piece.id);
    }
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

    pieces.push({
      id: pieceId,
      cells: fineCells,
      colourIndex: piece.colourIndex,
      depth: 0
    });
    pieceId++;
  }

  // Step 4: Fill subdivided pieces with small tetris pieces
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const piece of coarse.pieces) {
    if (!subdividedIds.has(piece.id)) continue;

    // Collect all fine cells belonging to this coarse piece
    const freeCells = new Set();
    for (const cell of piece.cells) {
      for (let dr = 0; dr < divisions; dr++) {
        for (let dc = 0; dc < divisions; dc++) {
          const fr = cell.r * divisions + dr;
          const fc = cell.c * divisions + dc;
          freeCells.add(fr * fineSize + fc);
        }
      }
    }

    // Tile these cells with small tetromino-like pieces
    while (freeCells.size > 0) {
      let minKey = Infinity;
      for (const k of freeCells) if (k < minKey) minKey = k;

      const startR = Math.floor(minKey / fineSize);
      const startC = minKey % fineSize;

      const cells = [{ r: startR, c: startC }];
      const cellSet = new Set([minKey]);

      while (cells.length < 4) {
        const frontier = [];
        for (const c of cells) {
          for (const [dr, dc] of DIRS) {
            const nr = c.r + dr;
            const nc = c.c + dc;
            const key = nr * fineSize + nc;
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
        const key = c.r * fineSize + c.c;
        fineGrid[c.r][c.c] = pieceId;
        freeCells.delete(key);
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
  for (const k of set) {
    if (k < min) min = k;
  }
  return min;
}

// ---- Individual creation / cloning ----

/**
 * Create a random tetris-mode individual.
 * @param {Array} palette - colour palette
 * @param {number} gridSize - base grid divisions
 * @param {number} tetrisDivisions - nesting depth (1 = flat, 2+ = nested)
 */
export function createRandomTetris(palette, gridSize, tetrisDivisions = 1) {
  if (tetrisDivisions > 1) {
    const fineSize = gridSize * tetrisDivisions;
    const { grid, pieces } = generateNestedTiling(gridSize, palette.length, tetrisDivisions);
    return {
      mode: 'tetris',
      grid,
      pieces,
      gridSize: fineSize,
      tetrisDivisions,
      baseGridSize: gridSize,
      fitness: null,
      scores: null
    };
  }

  const { grid, pieces } = generateTiling(gridSize, palette.length);
  return {
    mode: 'tetris',
    grid,
    pieces,
    gridSize,
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
 * Possible mutations:
 *  - Recolour a random piece
 *  - Swap colours of two pieces
 *  - Re-tile a random rectangular sub-region
 */
export function mutateTetris(individual, mutationRate, paletteLength) {
  const { pieces, gridSize } = individual;

  // Apply several independent mutations probabilistically
  for (let attempt = 0; attempt < pieces.length; attempt++) {
    if (Math.random() > mutationRate) continue;

    const roll = Math.random();

    if (roll < 0.50) {
      // Recolour a random piece
      const idx = Math.floor(Math.random() * pieces.length);
      pieces[idx].colourIndex = Math.floor(Math.random() * paletteLength);
    } else if (roll < 0.80) {
      // Swap colours of two random pieces
      if (pieces.length >= 2) {
        const a = Math.floor(Math.random() * pieces.length);
        let b = Math.floor(Math.random() * pieces.length);
        while (b === a) b = Math.floor(Math.random() * pieces.length);
        const tmp = pieces[a].colourIndex;
        pieces[a].colourIndex = pieces[b].colourIndex;
        pieces[b].colourIndex = tmp;
      }
    } else {
      // Re-tile a random sub-region (structural mutation)
      retileRegion(individual, paletteLength);
    }
  }

  individual.fitness = null;
  individual.scores = null;
}

/**
 * Re-tile a random rectangular sub-region of the grid.
 * Picks a random rectangle (2–4 cells wide/tall), collects all pieces
 * that overlap it, removes them, and re-tiles the freed cells.
 */
function retileRegion(individual, paletteLength) {
  const { grid, pieces, gridSize } = individual;

  // Random sub-region
  const regionSize = 2 + Math.floor(Math.random() * 3); // 2–4
  const r0 = Math.floor(Math.random() * Math.max(1, gridSize - regionSize + 1));
  const c0 = Math.floor(Math.random() * Math.max(1, gridSize - regionSize + 1));
  const r1 = Math.min(r0 + regionSize, gridSize);
  const c1 = Math.min(c0 + regionSize, gridSize);

  // Collect piece IDs that have ANY cell in the region
  const affectedIds = new Set();
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      affectedIds.add(grid[r][c]);
    }
  }

  // Collect ALL cells belonging to affected pieces (they may extend outside the region)
  const freeCells = new Set();
  for (const pid of affectedIds) {
    const piece = pieces.find(p => p.id === pid);
    if (!piece) continue;
    for (const cell of piece.cells) {
      freeCells.add(cell.r * gridSize + cell.c);
      grid[cell.r][cell.c] = -1;
    }
  }

  // Remove affected pieces from the array
  const removedIds = new Set(affectedIds);
  const oldColours = new Map();
  for (const pid of removedIds) {
    const p = pieces.find(pp => pp.id === pid);
    if (p) oldColours.set(pid, p.colourIndex);
  }

  // Filter out removed pieces
  let newPieces = pieces.filter(p => !removedIds.has(p.id));

  // Re-tile the freed cells
  let nextId = pieces.length > 0 ? Math.max(...pieces.map(p => p.id)) + 1 : 0;
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (freeCells.size > 0) {
    let minKey = Infinity;
    for (const k of freeCells) {
      if (k < minKey) minKey = k;
    }

    const startR = Math.floor(minKey / gridSize);
    const startC = minKey % gridSize;

    const cells = [{ r: startR, c: startC }];
    const cellSet = new Set([minKey]);

    while (cells.length < 4) {
      const frontier = [];
      for (const cell of cells) {
        for (const [dr, dc] of DIRS) {
          const nr = cell.r + dr;
          const nc = cell.c + dc;
          const key = nr * gridSize + nc;
          if (
            nr >= 0 && nr < gridSize &&
            nc >= 0 && nc < gridSize &&
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
      const key = cell.r * gridSize + cell.c;
      grid[cell.r][cell.c] = nextId;
      freeCells.delete(key);
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
 * Strategy: take the tiling structure from one parent and mix colour
 * assignments from both parents based on spatial position.
 */
export function crossoverTetris(parentA, parentB, paletteLength, gridSize) {
  const roll = Math.random();

  if (roll < 0.5) {
    return colourCrossover(parentA, parentB, paletteLength, gridSize);
  } else {
    return spatialTetrisCrossover(parentA, parentB, paletteLength, gridSize);
  }
}

/**
 * Colour crossover: keep one parent's tiling, assign colours from the
 * other parent based on spatial overlap.
 */
function colourCrossover(parentA, parentB, paletteLength, gridSize) {
  // Use parentA's tiling structure
  const child = cloneTetrisIndividual(parentA);

  // For each piece, look at the centre cell and take the colour from
  // whichever parent occupies that position
  for (const piece of child.pieces) {
    if (piece.cells.length === 0) continue;
    // Pick a representative cell (first cell)
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
 * Pieces whose centroid falls on each side come from the respective parent.
 * The resulting tiling is rebuilt to fill gaps at the boundary.
 */
function spatialTetrisCrossover(parentA, parentB, paletteLength, gridSize) {
  // Take tiling from parentA but recolour pieces on one half
  // using parentB's colour map
  const vertical = Math.random() < 0.5;
  const splitPos = Math.floor(gridSize * (0.3 + Math.random() * 0.4));

  const child = cloneTetrisIndividual(parentA);

  for (const piece of child.pieces) {
    // Compute centroid
    let cr = 0, cc = 0;
    for (const cell of piece.cells) {
      cr += cell.r;
      cc += cell.c;
    }
    cr /= piece.cells.length;
    cc /= piece.cells.length;

    const val = vertical ? cc : cr;
    if (val >= splitPos) {
      // Take colour from parentB at this position
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
 * Each piece becomes one pseudo-rectangle at its centroid with bounding-box
 * dimensions. Coordinates are normalised to 0–1.
 */
export function tetrisToRects(individual) {
  const { pieces, gridSize } = individual;
  const step = 1 / gridSize;

  return pieces.map((piece, i) => {
    let cx = 0, cy = 0;
    let minC = Infinity, maxC = -Infinity;
    let minR = Infinity, maxR = -Infinity;

    for (const cell of piece.cells) {
      cx += (cell.c + 0.5) * step;
      cy += (cell.r + 0.5) * step;
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
      w: (maxC - minC) * step,
      h: (maxR - minR) * step,
      colourIndex: piece.colourIndex,
      z: i
    };
  });
}
