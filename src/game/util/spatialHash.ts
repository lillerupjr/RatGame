// src/game/util/spatialHash.ts

/**
 * Spatial Hash Grid for efficient collision detection.
 * 
 * Instead of O(n*m) brute force (every projectile vs every enemy),
 * we partition entities into grid cells and only check entities
 * in nearby cells, reducing complexity to approximately O(n + m).
 */

export type SpatialHash = {
  cellSize: number;
  cells: Map<number, number[]>;  // cell key -> array of entity indices
  // Cached bounds for quick clearing
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
};

/**
 * Creates a new spatial hash with the specified cell size.
 * Cell size should be roughly 2x the largest entity radius for best performance.
 * For enemies with radius ~20-30, a cell size of 64-128 works well.
 */
export function createSpatialHash(cellSize: number = 64): SpatialHash {
  return {
    cellSize,
    cells: new Map(),
    minCellX: 0,
    maxCellX: 0,
    minCellY: 0,
    maxCellY: 0,
  };
}

/**
 * Clears all entities from the spatial hash.
 * Call this at the start of each frame before inserting entities.
 */
export function clearSpatialHash(hash: SpatialHash): void {
  hash.cells.clear();
  hash.minCellX = 0;
  hash.maxCellX = 0;
  hash.minCellY = 0;
  hash.maxCellY = 0;
}

/**
 * Computes a unique key for a cell at (cx, cy).
 * Uses a simple pairing function that handles negative coordinates.
 */
function cellKey(cx: number, cy: number): number {
  // Shift to handle negatives, then use Cantor-like pairing
  const ax = cx + 0x8000; // shift by ~32k to make positive
  const ay = cy + 0x8000;
  return (ax << 16) | (ay & 0xFFFF);
}

/**
 * Returns the cell coordinates for a world position.
 */
function getCellCoords(hash: SpatialHash, x: number, y: number): [number, number] {
  const cx = Math.floor(x / hash.cellSize);
  const cy = Math.floor(y / hash.cellSize);
  return [cx, cy];
}

/**
 * Inserts an entity into the spatial hash.
 * For entities with radius, they may span multiple cells.
 * 
 * @param hash - The spatial hash
 * @param index - Entity index in the ECS arrays
 * @param x - Entity center X
 * @param y - Entity center Y
 * @param radius - Entity collision radius (0 for point entities)
 */
export function insertEntity(
  hash: SpatialHash,
  index: number,
  x: number,
  y: number,
  radius: number = 0
): void {
  const cs = hash.cellSize;
  
  // Calculate the bounding box in cell coordinates
  const minCx = Math.floor((x - radius) / cs);
  const maxCx = Math.floor((x + radius) / cs);
  const minCy = Math.floor((y - radius) / cs);
  const maxCy = Math.floor((y + radius) / cs);
  
  // Track bounds for potential optimizations
  if (hash.cells.size === 0) {
    hash.minCellX = minCx;
    hash.maxCellX = maxCx;
    hash.minCellY = minCy;
    hash.maxCellY = maxCy;
  } else {
    if (minCx < hash.minCellX) hash.minCellX = minCx;
    if (maxCx > hash.maxCellX) hash.maxCellX = maxCx;
    if (minCy < hash.minCellY) hash.minCellY = minCy;
    if (maxCy > hash.maxCellY) hash.maxCellY = maxCy;
  }
  
  // Insert into all cells the entity overlaps
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = cellKey(cx, cy);
      let cell = hash.cells.get(key);
      if (!cell) {
        cell = [];
        hash.cells.set(key, cell);
      }
      cell.push(index);
    }
  }
}

/**
 * Queries all entity indices that might collide with a circle at (x, y) with given radius.
 * Returns an array of entity indices (may contain duplicates if entity spans multiple cells).
 * 
 * @param hash - The spatial hash
 * @param x - Query center X
 * @param y - Query center Y
 * @param radius - Query radius
 * @returns Array of potentially colliding entity indices
 */
export function queryCircle(
  hash: SpatialHash,
  x: number,
  y: number,
  radius: number
): number[] {
  const cs = hash.cellSize;
  const results: number[] = [];
  
  // Calculate the bounding box in cell coordinates
  const minCx = Math.floor((x - radius) / cs);
  const maxCx = Math.floor((x + radius) / cs);
  const minCy = Math.floor((y - radius) / cs);
  const maxCy = Math.floor((y + radius) / cs);
  
  // Collect all entities in overlapping cells
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = cellKey(cx, cy);
      const cell = hash.cells.get(key);
      if (cell) {
        for (let i = 0; i < cell.length; i++) {
          results.push(cell[i]);
        }
      }
    }
  }
  
  return results;
}

/**
 * Queries all entity indices that might collide with a circle,
 * but returns a Set to eliminate duplicates (useful when entities span multiple cells).
 */
export function queryCircleUnique(
  hash: SpatialHash,
  x: number,
  y: number,
  radius: number
): Set<number> {
  const cs = hash.cellSize;
  const results = new Set<number>();
  
  const minCx = Math.floor((x - radius) / cs);
  const maxCx = Math.floor((x + radius) / cs);
  const minCy = Math.floor((y - radius) / cs);
  const maxCy = Math.floor((y + radius) / cs);
  
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = cellKey(cx, cy);
      const cell = hash.cells.get(key);
      if (cell) {
        for (let i = 0; i < cell.length; i++) {
          results.add(cell[i]);
        }
      }
    }
  }
  
  return results;
}

/**
 * Queries a point and returns entities in that cell.
 */
export function queryPoint(hash: SpatialHash, x: number, y: number): number[] {
  const [cx, cy] = getCellCoords(hash, x, y);
  const key = cellKey(cx, cy);
  return hash.cells.get(key) || [];
}
