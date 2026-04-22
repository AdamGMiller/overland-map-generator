// Hex grid math utilities - flat-top axial coordinate system
// Reference: https://www.redblobgames.com/grids/hexagons/

/**
 * Flat-top hex grid using axial coordinates (q, r)
 *
 *    4___5         Corner angles (screen coords, y-down):
 *   /     \          0: 0°   (right)
 *  3       0         1: 60°  (lower-right)
 *   \     /          2: 120° (lower-left)
 *    2___1           3: 180° (left)
 *                    4: 240° (upper-left)
 *                    5: 300° (upper-right)
 *
 * Edge i connects corner i to corner (i+1)%6.
 * Direction i is the neighbor across edge i.
 */

// Direction vectors: direction i crosses edge i (clockwise from right)
const DIRECTIONS = [
  { q: 1, r: 0 },   // 0: E   (right)
  { q: 0, r: 1 },   // 1: SE  (lower-right)
  { q: -1, r: 1 },  // 2: SW  (lower-left)
  { q: -1, r: 0 },  // 3: W   (left)
  { q: 0, r: -1 },  // 4: NW  (upper-left)
  { q: 1, r: -1 },  // 5: NE  (upper-right)
];

export function hexKey(q, r) {
  return `${q},${r}`;
}

export function parseHexKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

/** Get the neighbor in the given direction (0-5) */
export function hexNeighbor(q, r, direction) {
  const d = DIRECTIONS[direction];
  return { q: q + d.q, r: r + d.r };
}

/** Get all 6 neighbors */
export function hexNeighbors(q, r) {
  return DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

/** Get the opposite edge index */
export function oppositeEdge(edge) {
  return (edge + 3) % 6;
}

/** Convert axial to pixel center (flat-top) */
export function hexToPixel(q, r, size) {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

/** Convert pixel to axial (flat-top) - fractional */
export function pixelToHex(x, y, size) {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound(q, r);
}

/** Round fractional hex coordinates to nearest hex */
export function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

/** Get the 6 corner points of a hex in pixel coordinates.
 *  Corner i is at angle (60° * i) from center.
 *  Edge i goes from corner i to corner (i+1)%6.
 */
export function hexCorners(q, r, size) {
  const center = hexToPixel(q, r, size);
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = Math.PI / 180 * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }
  return corners;
}

/** Get the two corner points for a given edge (0-5) */
export function hexEdgeCorners(q, r, size, edge) {
  const corners = hexCorners(q, r, size);
  return [corners[edge], corners[(edge + 1) % 6]];
}

/** Get midpoint of an edge */
export function hexEdgeMidpoint(q, r, size, edge) {
  const [c1, c2] = hexEdgeCorners(q, r, size, edge);
  return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
}

/** Hex distance between two hexes */
export function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

/** Get all hexes within radius of center hex */
export function hexRange(cq, cr, radius) {
  const results = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: cq + q, r: cr + r });
    }
  }
  return results;
}

/** 
 * Generate a rectangular grid of hexes (offset coordinates mapped to axial)
 * Returns array of {q, r} for a grid of cols × rows
 */
export function hexRectGrid(cols, rows) {
  const hexes = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Offset to axial conversion for flat-top, even-row offset
      const q = col;
      const r = row - Math.floor(col / 2);
      hexes.push({ q, r, col, row });
    }
  }
  return hexes;
}

/** Calculate the bounding box for a hex grid */
export function gridBounds(cols, rows, size) {
  const hexes = hexRectGrid(cols, rows);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const { q, r } of hexes) {
    const corners = hexCorners(q, r, size);
    for (const c of corners) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    }
  }

  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Line of sight / line between two hexes */
export function hexLineDraw(q1, r1, q2, r2) {
  const N = hexDistance(q1, r1, q2, r2);
  if (N === 0) return [{ q: q1, r: r1 }];
  
  const results = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const q = q1 + (q2 - q1) * t;
    const r = r1 + (r2 - r1) * t;
    results.push(hexRound(q, r));
  }
  return results;
}
