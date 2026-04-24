// Hand-drawn SVG renderer for overland hex maps
import { hexToPixel, hexCorners, hexEdgeMidpoint, hexKey, hexNeighbors, hexNeighbor } from './hex.js';
import { SeededRandom } from './random.js';
import { TERRAIN, SETTLEMENT, POI_TYPES, ROAD, PASSABILITY } from './world-gen.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function xmlEscape(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isWaterTerrain(terrain) {
  return terrain === TERRAIN.WATER || terrain === TERRAIN.DEEP_WATER || terrain === TERRAIN.LAKE;
}

function ptKey(x, y) {
  return `${Math.round(x * 10)},${Math.round(y * 10)}`;
}

/**
 * Build continuous polylines from edge segments by connecting shared vertices
 */
function buildEdgeChains(segments) {
  if (segments.length === 0) return [];

  // Build adjacency: for each vertex, which segments touch it
  const adj = new Map();
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const k1 = ptKey(s.x1, s.y1);
    const k2 = ptKey(s.x2, s.y2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push(i);
    adj.get(k2).push(i);
  }

  const used = new Set();
  const chains = [];

  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;

    // Walk forward from this segment
    const chain = [];
    let current = start;
    let currentEnd = ptKey(segments[start].x2, segments[start].y2);

    // Start with first point
    chain.push({ x: segments[start].x1, y: segments[start].y1 });
    chain.push({ x: segments[start].x2, y: segments[start].y2 });
    used.add(start);

    // Extend forward
    let extended = true;
    while (extended) {
      extended = false;
      const neighbors = adj.get(currentEnd) || [];
      for (const ni of neighbors) {
        if (used.has(ni)) continue;
        const s = segments[ni];
        const k1 = ptKey(s.x1, s.y1);
        const k2 = ptKey(s.x2, s.y2);
        if (k1 === currentEnd) {
          chain.push({ x: s.x2, y: s.y2 });
          currentEnd = k2;
        } else if (k2 === currentEnd) {
          chain.push({ x: s.x1, y: s.y1 });
          currentEnd = k1;
        } else {
          continue;
        }
        used.add(ni);
        extended = true;
        break;
      }
    }

    // Extend backward
    let currentStart = ptKey(chain[0].x, chain[0].y);
    extended = true;
    while (extended) {
      extended = false;
      const neighbors = adj.get(currentStart) || [];
      for (const ni of neighbors) {
        if (used.has(ni)) continue;
        const s = segments[ni];
        const k1 = ptKey(s.x1, s.y1);
        const k2 = ptKey(s.x2, s.y2);
        if (k1 === currentStart) {
          chain.unshift({ x: s.x2, y: s.y2 });
          currentStart = k2;
        } else if (k2 === currentStart) {
          chain.unshift({ x: s.x1, y: s.y1 });
          currentStart = k1;
        } else {
          continue;
        }
        used.add(ni);
        extended = true;
        break;
      }
    }

    if (chain.length >= 2) {
      chains.push(chain);
    }
  }

  return chains;
}

/**
 * Create an SVG element (works in browser; returns string markup for Node)
 */
function svgEl(tag, attrs = {}, children = []) {
  if (typeof document !== 'undefined') {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) el.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    }
    return el;
  }
  // Node.js string fallback
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ');
  const childStr = children.map(c => typeof c === 'string' ? c : (c || '')).join('');
  const selfClosing = ['path', 'circle', 'line', 'rect', 'ellipse', 'use', 'polyline', 'polygon'];
  if (selfClosing.includes(tag) && childStr === '') {
    return `<${tag} ${attrStr}/>`;
  }
  return `<${tag} ${attrStr}>${childStr}</${tag}>`;
}

/**
 * Wobble a point for hand-drawn effect
 */
function wobble(x, y, rng, amount = 1.5) {
  return {
    x: x + rng.gaussian() * amount,
    y: y + rng.gaussian() * amount,
  };
}

/**
 * Create a hand-drawn line path between points
 */
function handDrawnPath(points, rng, wobbleAmount = 1.2, closed = false) {
  if (points.length < 2) return '';
  const parts = [];
  const p0 = wobble(points[0].x, points[0].y, rng, wobbleAmount);
  parts.push(`M${p0.x.toFixed(1)},${p0.y.toFixed(1)}`);

  for (let i = 1; i < points.length; i++) {
    const p = wobble(points[i].x, points[i].y, rng, wobbleAmount);
    // Add slight curve for hand-drawn feel
    const prev = points[i - 1];
    const midX = (prev.x + points[i].x) / 2 + rng.gaussian() * wobbleAmount * 0.8;
    const midY = (prev.y + points[i].y) / 2 + rng.gaussian() * wobbleAmount * 0.8;
    parts.push(`Q${midX.toFixed(1)},${midY.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }

  if (closed) parts.push('Z');
  return parts.join(' ');
}

/**
 * Create a smooth hand-drawn curve through points
 */
function handDrawnCurve(points, rng, wobbleAmount = 2) {
  if (points.length < 2) return '';
  const parts = [];
  const p0 = wobble(points[0].x, points[0].y, rng, wobbleAmount);
  parts.push(`M${p0.x.toFixed(1)},${p0.y.toFixed(1)}`);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1] || curr;

    const cp1x = prev.x + (curr.x - prev.x) * 0.5 + rng.gaussian() * wobbleAmount;
    const cp1y = prev.y + (curr.y - prev.y) * 0.5 + rng.gaussian() * wobbleAmount;
    const cp2x = curr.x - (next.x - prev.x) * 0.15 + rng.gaussian() * wobbleAmount * 0.5;
    const cp2y = curr.y - (next.y - prev.y) * 0.15 + rng.gaussian() * wobbleAmount * 0.5;
    const px = curr.x + rng.gaussian() * wobbleAmount * 0.5;
    const py = curr.y + rng.gaussian() * wobbleAmount * 0.5;

    parts.push(`C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`);
  }

  return parts.join(' ');
}

/**
 * Main renderer class
 */
export class MapRenderer {
  static CHUNK_SIZE = 8; // hexes per chunk side

  constructor(worldData, options = {}) {
    this.world = worldData;
    this.hexSize = worldData.hexSize;
    this.rng = new SeededRandom(worldData.seed + 999);
    this.showHexGrid = options.showHexGrid !== false;
    this.showLabels = options.showLabels !== false;
    this.showPassability = options.showPassability || false;
    this.blackAndWhite = options.blackAndWhite || false;
    this.iconSVGs = options.iconSVGs || null;

    // Calculate bounds
    const allHexes = [...worldData.hexMap.values()];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const hex of allHexes) {
      const corners = hexCorners(hex.q, hex.r, this.hexSize);
      for (const c of corners) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x);
        maxY = Math.max(maxY, c.y);
      }
    }

    this.padding = 30;
    this.bounds = {
      minX: minX - this.padding,
      minY: minY - this.padding,
      maxX: maxX + this.padding,
      maxY: maxY + this.padding,
    };
    this.width = this.bounds.maxX - this.bounds.minX;
    this.height = this.bounds.maxY - this.bounds.minY;

    // Build set of hexes occupied by settlements or POIs (skip terrain features there)
    this._occupiedHexes = new Set();
    for (const s of worldData.settlements) {
      this._occupiedHexes.add(hexKey(s.q, s.r));
    }
    for (const p of worldData.pois) {
      this._occupiedHexes.add(hexKey(p.q, p.r));
    }

    // Precompute chunk pixel bounds for viewport culling
    this._chunkBounds = this._computeChunkBounds();
  }

  /** Get chunk key for a hex coordinate */
  _chunkKey(q, r) {
    const cs = MapRenderer.CHUNK_SIZE;
    return `${Math.floor(q / cs)},${Math.floor(r / cs)}`;
  }

  /** Compute pixel bounds for each chunk (used by viewport culling on main thread) */
  _computeChunkBounds() {
    const chunks = new Map();
    const cs = MapRenderer.CHUNK_SIZE;
    for (const [, hex] of this.world.hexMap) {
      const ck = this._chunkKey(hex.q, hex.r);
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      if (!chunks.has(ck)) {
        chunks.set(ck, { minX: center.x, minY: center.y, maxX: center.x, maxY: center.y });
      } else {
        const b = chunks.get(ck);
        b.minX = Math.min(b.minX, center.x);
        b.minY = Math.min(b.minY, center.y);
        b.maxX = Math.max(b.maxX, center.x);
        b.maxY = Math.max(b.maxY, center.y);
      }
    }
    // Expand by hex size to cover full hex area
    const pad = this.hexSize * 1.5;
    for (const [, b] of chunks) {
      b.minX -= pad; b.minY -= pad;
      b.maxX += pad; b.maxY += pad;
    }
    return chunks;
  }

  /** Get chunk bounds as serializable object (for main thread viewport culling) */
  getChunkBounds() {
    const result = {};
    for (const [k, b] of this._chunkBounds) {
      result[k] = b;
    }
    return result;
  }

  /**
   * Group hex-based SVG fragments by chunk.
   * @param {Array<{q: number, r: number, svg: string}>} items
   * @param {string} layerId - SVG group id
   * @param {string} [cssClass] - optional CSS class for the layer
   * @returns {string} SVG string with chunked groups
   */
  _chunkedLayer(items, layerId, cssClass) {
    const chunks = new Map();
    for (const item of items) {
      const ck = this._chunkKey(item.q, item.r);
      if (!chunks.has(ck)) chunks.set(ck, []);
      chunks.get(ck).push(item.svg);
    }
    const cls = cssClass ? ` class="${cssClass}"` : '';
    const groups = [];
    for (const [ck, svgs] of chunks) {
      groups.push(`<g class="chunk" data-ck="${ck}">${svgs.join('\n')}</g>`);
    }
    return `<g id="${layerId}"${cls}>${groups.join('\n')}</g>`;
  }

  /**
   * Render the complete map as an SVG string
   */
  toSVG() {
    const layers = [];

    // Background
    layers.push(this._renderBackground());

    // Water fills
    layers.push(this._renderWater());

    // Terrain background shading
    layers.push(this._renderTerrainShading());

    // Coastlines
    layers.push(this._renderCoastlines());

    // Terrain textures
    layers.push(this._renderTerrainTexture());

    // Swamps
    layers.push(this._renderSwamps());

    // Forests
    layers.push(this._renderForests());

    // Hills
    layers.push(this._renderHills());

    // Mountains
    layers.push(this._renderMountains());

    // Rivers
    layers.push(this._renderRivers());

    // Roads
    layers.push(this._renderRoads());

    // Settlements
    layers.push(this._renderSettlements());

    // POIs
    layers.push(this._renderPOIs());

    // Labels
    if (this.showLabels) {
      layers.push(this._renderLabels());
    }

    // Hex grid overlay
    if (this.showHexGrid) {
      layers.push(this._renderHexGrid());
    }

    // Passability overlay
    if (this.showPassability) {
      layers.push(this._renderPassability());
    }

    const defs = this._renderDefs();
    const vb = `${this.bounds.minX.toFixed(0)} ${this.bounds.minY.toFixed(0)} ${this.width.toFixed(0)} ${this.height.toFixed(0)}`;
    const bwClass = this.blackAndWhite ? ' class="bw-mode"' : '';
    const bgColor = this.blackAndWhite ? '#ffffff' : '#f5f0e6';
    const bwStyle = this.blackAndWhite ? `
<style>
  /* Background & terrain */
  .bw-mode #background rect { fill: #ffffff !important; }
  .bw-mode #terrain-shading polygon { fill: none !important; }

  /* Water: light gray fill with visible wave lines */
  .bw-mode #water path:not([fill="none"]) { fill: #e0e0e0 !important; }
  .bw-mode #water path[fill="none"] { stroke: #888 !important; opacity: 0.5 !important; }
  .bw-mode #water circle { fill: #ccc !important; }

  /* Beach: very light gray */
  .bw-mode #water path[fill="#efe8d4"] { fill: #f4f4f4 !important; }
  .bw-mode #water circle[fill="#c8b898"] { fill: #aaa !important; }

  /* Coastlines: crisp black */
  .bw-mode #coastlines path { stroke: #000 !important; }

  /* Rivers: dark lines */
  .bw-mode #rivers path { stroke: #333 !important; }
  .bw-mode #rivers circle { fill: #ddd !important; stroke: #333 !important; }

  /* Roads: all black/dark gray */
  .bw-mode #roads path { stroke: #222 !important; }
  .bw-mode #roads path[stroke="#f5f0e6"] { stroke: #fff !important; }
  .bw-mode #roads circle { fill: #222 !important; stroke: #222 !important; }
  .bw-mode #roads circle[fill="#f5f0e6"] { fill: #fff !important; }

  /* Trees, hills, mountains: black ink */
  .bw-mode #forests line { stroke: #222 !important; }
  .bw-mode #forests path { fill: #fff !important; stroke: #222 !important; }
  .bw-mode #hills path { stroke: #222 !important; }
  .bw-mode #hills path[fill="#f5f0e6"] { fill: #fff !important; }
  .bw-mode #hills line { stroke: #222 !important; }
  .bw-mode #mountains path { stroke: #222 !important; }
  .bw-mode #mountains path[fill="#f5f0e6"] { fill: #fff !important; }
  .bw-mode #mountains path[fill="#5a4a3a"] { fill: #222 !important; }
  .bw-mode #mountains line { stroke: #222 !important; }

  /* Swamps */
  .bw-mode #swamps line { stroke: #222 !important; }

  /* Terrain texture */
  .bw-mode #terrain-texture line { stroke: #555 !important; }
  .bw-mode #terrain-texture circle { fill: #888 !important; }

  /* Hex grid */
  .bw-mode #hex-grid polygon { stroke: #999 !important; }

  /* Labels: black text, white outline */
  .bw-mode text { fill: #111 !important; stroke: #fff !important; }
  .bw-mode .label-water text { fill: #444 !important; }
  .bw-mode .label-river text { fill: #444 !important; }
  .bw-mode .label-region text { fill: #333 !important; }

  /* Icons: ensure pure B&W — white fills stay white, colored fills go black */
  .bw-mode #settlements path, .bw-mode #pois path { filter: grayscale(1); }

  /* Passability */
  .bw-mode #passability text[fill="#c03030"] { fill: #000 !important; }
  .bw-mode #passability text[fill="#c0a030"] { fill: #666 !important; }
</style>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${SVG_NS}" viewBox="${vb}" width="${this.width.toFixed(0)}" height="${this.height.toFixed(0)}" style="background:${bgColor}"${bwClass}>
${bwStyle}
${defs}
${layers.join('\n')}
</svg>`;
  }

  /**
   * Render to DOM element (browser only)
   */
  render() {
    if (typeof document === 'undefined') {
      throw new Error('render() requires a browser environment. Use toSVG() for string output.');
    }
    const container = document.createElement('div');
    container.innerHTML = this.toSVG();
    return container.firstElementChild;
  }

  _renderDefs() {
    return `<defs>
  <filter id="pencil" x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <pattern id="water-pattern" patternUnits="userSpaceOnUse" width="12" height="12">
    <line x1="0" y1="4" x2="6" y2="4" stroke="#8ba" stroke-width="0.5" opacity="0.3"/>
    <line x1="6" y1="8" x2="12" y2="8" stroke="#8ba" stroke-width="0.5" opacity="0.3"/>
  </pattern>
  <pattern id="sand-pattern" patternUnits="userSpaceOnUse" width="8" height="8">
    <circle cx="2" cy="2" r="0.4" fill="#a98" opacity="0.3"/>
    <circle cx="6" cy="6" r="0.3" fill="#a98" opacity="0.2"/>
  </pattern>
</defs>`;
  }

  _renderBackground() {
    return `<g id="background">
  <rect x="${this.bounds.minX}" y="${this.bounds.minY}" width="${this.width}" height="${this.height}" fill="#f5f0e6"/>
</g>`;
  }

  _renderWater() {
    const rng = new SeededRandom(this.world.seed + 100);
    const items = [];

    for (const [, hex] of this.world.hexMap) {
      if (hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.DEEP_WATER && hex.terrain !== TERRAIN.LAKE) continue;
      const corners = hexCorners(hex.q, hex.r, this.hexSize);
      const path = handDrawnPath(corners, rng, 0.5, true);
      const fill = hex.terrain === TERRAIN.DEEP_WATER ? '#d4dfe8' :
                   hex.terrain === TERRAIN.LAKE ? '#d0e0ea' : '#dce8ed';
      let svg = `<path d="${path}" fill="${fill}" stroke="none"/>`;

      // Water lines
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize * 0.3;
      const lineCount = hex.terrain === TERRAIN.LAKE ? 2 : 3;
      for (let i = 0; i < lineCount; i++) {
        const y = center.y - s + i * s;
        const x1 = center.x - s * 0.6 + rng.gaussian() * 2;
        const x2 = center.x + s * 0.6 + rng.gaussian() * 2;
        const my = y + rng.gaussian() * 1.5;
        svg += `<path d="M${x1.toFixed(1)},${y.toFixed(1)} Q${center.x.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y.toFixed(1)}" fill="none" stroke="#9ab" stroke-width="0.5" opacity="0.4"/>`;
      }
      items.push({ q: hex.q, r: hex.r, svg });
    }

    // Beach fills
    for (const [, hex] of this.world.hexMap) {
      if (hex.terrain !== TERRAIN.BEACH) continue;
      const corners = hexCorners(hex.q, hex.r, this.hexSize);
      const path = handDrawnPath(corners, rng, 0.5, true);
      let svg = `<path d="${path}" fill="#efe8d4" stroke="none"/>`;
      // Sand dots
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize * 0.35;
      const dotCount = rng.int(8, 15);
      for (let i = 0; i < dotCount; i++) {
        const dx = center.x + rng.gaussian() * s;
        const dy = center.y + rng.gaussian() * s;
        const dr = rng.range(0.3, 0.8);
        svg += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${dr.toFixed(1)}" fill="#c8b898" opacity="0.4"/>`;
      }
      items.push({ q: hex.q, r: hex.r, svg });
    }

    return this._chunkedLayer(items, 'water');
  }

  _renderTerrainShading() {
    const rng = new SeededRandom(this.world.seed + 150);
    const items = [];
    const terrainColors = {
      [TERRAIN.FOREST]: 'rgba(90, 120, 70, 0.12)',
      [TERRAIN.DENSE_FOREST]: 'rgba(70, 100, 55, 0.15)',
      [TERRAIN.HILLS]: 'rgba(140, 120, 90, 0.12)',
      [TERRAIN.MOUNTAIN]: 'rgba(120, 110, 100, 0.15)',
      [TERRAIN.HIGH_MOUNTAIN]: 'rgba(100, 95, 90, 0.18)',
      [TERRAIN.SWAMP]: 'rgba(100, 110, 60, 0.15)',
      [TERRAIN.GRASSLAND]: 'rgba(120, 140, 90, 0.06)',
      [TERRAIN.DESERT]: 'rgba(200, 170, 100, 0.15)',
      [TERRAIN.TUNDRA]: 'rgba(180, 200, 220, 0.15)',
    };

    for (const [, hex] of this.world.hexMap) {
      const fill = terrainColors[hex.terrain];
      if (!fill) continue;
      const corners = hexCorners(hex.q, hex.r, this.hexSize);
      const pts = corners.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
      items.push({ q: hex.q, r: hex.r, svg: `<polygon points="${pts}" fill="${fill}" stroke="none"/>` });
    }

    return this._chunkedLayer(items, 'terrain-shading');
  }

  _renderCoastlines() {
    const rng = new SeededRandom(this.world.seed + 200);
    const parts = [];

    // Collect all coast edge segments as vertex pairs keyed by their corner positions
    const edgeSegments = [];
    for (const [, hex] of this.world.hexMap) {
      if (isWaterTerrain(hex.terrain)) continue;
      if (!hex.isCoast) continue;

      for (let edge = 0; edge < 6; edge++) {
        const neighbor = hexNeighbor(hex.q, hex.r, edge);
        const nh = this.world.hexMap.get(hexKey(neighbor.q, neighbor.r));
        if (!nh) continue;
        if (!isWaterTerrain(nh.terrain)) continue;

        const corners = hexCorners(hex.q, hex.r, this.hexSize);
        const c1 = corners[edge];
        const c2 = corners[(edge + 1) % 6];
        edgeSegments.push({
          x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y,
          landHex: hex, waterHex: nh,
        });
      }
    }

    // Build continuous polylines from edge segments
    const chains = buildEdgeChains(edgeSegments);

    for (const chain of chains) {
      // Use Catmull-Rom spline for smooth, natural coastlines
      if (chain.length < 2) continue;

      // Subdivide the chain to add extra midpoints for smoother curves
      const subdivided = [];
      for (let i = 0; i < chain.length; i++) {
        subdivided.push(chain[i]);
        if (i < chain.length - 1) {
          subdivided.push({
            x: (chain[i].x + chain[i + 1].x) / 2 + rng.gaussian() * 1.5,
            y: (chain[i].y + chain[i + 1].y) / 2 + rng.gaussian() * 1.5,
          });
        }
      }

      // Build Catmull-Rom spline through subdivided points
      const splinePts = this._catmullRomSpline(subdivided, 4);

      // Render as smooth SVG path
      let pathD = `M${splinePts[0].x.toFixed(1)},${splinePts[0].y.toFixed(1)}`;
      for (let i = 1; i < splinePts.length; i++) {
        pathD += ` L${splinePts[i].x.toFixed(1)},${splinePts[i].y.toFixed(1)}`;
      }
      parts.push(`<path d="${pathD}" fill="none" stroke="#3a3028" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);

      // Secondary parallel line offset into water for depth
      const offsetPts = splinePts.map(p => ({
        x: p.x + rng.gaussian() * 0.6,
        y: p.y + rng.gaussian() * 0.6 + 4,
      }));
      let pathD2 = `M${offsetPts[0].x.toFixed(1)},${offsetPts[0].y.toFixed(1)}`;
      for (let i = 1; i < offsetPts.length; i++) {
        pathD2 += ` L${offsetPts[i].x.toFixed(1)},${offsetPts[i].y.toFixed(1)}`;
      }
      parts.push(`<path d="${pathD2}" fill="none" stroke="#3a3028" stroke-width="0.6" stroke-linecap="round" opacity="0.3"/>`);
    }

    return `<g id="coastlines">${parts.join('\n')}</g>`;
  }

  _renderTerrainTexture() {
    const rng = new SeededRandom(this.world.seed + 300);
    const items = [];

    for (const [, hex] of this.world.hexMap) {
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize;
      let svg = '';

      if (hex.terrain === TERRAIN.PLAINS || hex.terrain === TERRAIN.GRASSLAND) {
        const count = hex.terrain === TERRAIN.GRASSLAND ? rng.int(3, 6) : rng.int(1, 3);
        for (let i = 0; i < count; i++) {
          const x = center.x + rng.gaussian() * s * 0.35;
          const y = center.y + rng.gaussian() * s * 0.35;
          svg += this._drawGrassTuft(x, y, rng);
        }
      }

      if (hex.terrain === TERRAIN.DESERT) {
        const ds = this.hexSize * 0.35;
        for (let j = 0; j < 8; j++) {
          const dx = center.x + rng.gaussian() * ds;
          const dy = center.y + rng.gaussian() * ds;
          svg += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${rng.range(0.3, 0.8).toFixed(1)}" fill="#c0a060" opacity="0.4"/>`;
        }
        const dy = center.y + rng.range(-ds * 0.3, ds * 0.3);
        const x1 = center.x - ds * 0.7;
        const x2 = center.x + ds * 0.7;
        const cy = dy - rng.range(2, 5);
        svg += `<path d="M${x1.toFixed(1)},${dy.toFixed(1)} Q${center.x.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${dy.toFixed(1)}" fill="none" stroke="#c0a060" stroke-width="0.6" opacity="0.5"/>`;
      }

      if (hex.terrain === TERRAIN.TUNDRA) {
        const ts = this.hexSize * 0.3;
        for (let j = 0; j < 5; j++) {
          const sx = center.x + rng.gaussian() * ts;
          const sy = center.y + rng.gaussian() * ts;
          const r = rng.range(0.5, 1.5);
          svg += `<line x1="${(sx-r).toFixed(1)}" y1="${sy.toFixed(1)}" x2="${(sx+r).toFixed(1)}" y2="${sy.toFixed(1)}" stroke="#8aa0b0" stroke-width="0.4" opacity="0.5"/>`;
          svg += `<line x1="${sx.toFixed(1)}" y1="${(sy-r).toFixed(1)}" x2="${sx.toFixed(1)}" y2="${(sy+r).toFixed(1)}" stroke="#8aa0b0" stroke-width="0.4" opacity="0.5"/>`;
        }
      }

      if (hex.terrain !== TERRAIN.WATER && hex.terrain !== TERRAIN.DEEP_WATER) {
        const dotCount = rng.int(0, 4);
        for (let i = 0; i < dotCount; i++) {
          const x = center.x + rng.gaussian() * s * 0.35;
          const y = center.y + rng.gaussian() * s * 0.35;
          const r = rng.range(0.3, 0.8);
          svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#5a4a3a" opacity="0.2"/>`;
        }
      }

      if (svg) items.push({ q: hex.q, r: hex.r, svg });
    }

    return this._chunkedLayer(items, 'terrain-texture');
  }

  _drawGrassTuft(x, y, rng) {
    const h = rng.range(3, 6);
    const spread = rng.range(1, 2.5);
    const parts = [];
    const blades = rng.int(2, 4);
    for (let i = 0; i < blades; i++) {
      const bx = x + (i - blades / 2) * spread;
      const by = y;
      const tx = bx + rng.gaussian() * 1.5;
      const ty = by - h;
      parts.push(`<path d="M${bx.toFixed(1)},${by.toFixed(1)} Q${(bx + tx) / 2 + rng.gaussian()},${(by + ty) / 2} ${tx.toFixed(1)},${ty.toFixed(1)}" fill="none" stroke="#5a6a4a" stroke-width="0.6" opacity="0.5"/>`);
    }
    return parts.join('');
  }

  _renderSwamps() {
    const rng = new SeededRandom(this.world.seed + 350);
    const items = [];

    for (const [, hex] of this.world.hexMap) {
      if (hex.terrain !== TERRAIN.SWAMP) continue;
      if (this._occupiedHexes.has(hexKey(hex.q, hex.r))) continue;
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize * 0.4;

      let svg = '';
      const symbolCount = rng.int(3, 5);
      for (let i = 0; i < symbolCount; i++) {
        const sx = center.x + rng.gaussian() * s * 0.7;
        const sy = center.y + rng.gaussian() * s * 0.7;
        svg += this._drawSwampSymbol(sx, sy, rng);
      }
      items.push({ q: hex.q, r: hex.r, svg });
    }

    return this._chunkedLayer(items, 'swamps');
  }

  _drawSwampSymbol(x, y, rng) {
    const lineW = rng.range(8, 14);
    const reedH = rng.range(5, 9);
    let svg = '';
    // Horizontal water line
    svg += `<line x1="${(x - lineW / 2).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + lineW / 2).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#4a5a3a" stroke-width="0.8"/>`;
    // Three vertical reeds sticking up
    for (let i = -1; i <= 1; i++) {
      const rx = x + i * (lineW / 4) + rng.gaussian() * 0.5;
      const rh = reedH + rng.gaussian() * 1.5;
      const lean = rng.gaussian() * 1.5;
      svg += `<line x1="${rx.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(rx + lean).toFixed(1)}" y2="${(y - rh).toFixed(1)}" stroke="#4a5a3a" stroke-width="0.7"/>`;
    }
    return svg;
  }

  _renderForests() {
    const rng = new SeededRandom(this.world.seed + 400);
    const items = [];
    const isForest = t => t === TERRAIN.FOREST || t === TERRAIN.DENSE_FOREST;

    for (const [, hex] of this.world.hexMap) {
      if (!isForest(hex.terrain)) continue;
      if (this._occupiedHexes.has(hexKey(hex.q, hex.r))) continue;
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize;

      const treeCount = hex.terrain === TERRAIN.DENSE_FOREST ? rng.int(5, 8) : rng.int(3, 5);
      const treeType = rng.chance(0.3) ? 'conifer' : 'deciduous';

      for (let i = 0; i < treeCount; i++) {
        const tx = center.x + rng.gaussian() * s * 0.25;
        const ty = center.y + rng.gaussian() * s * 0.25;
        const svg = (treeType === 'deciduous' || rng.chance(0.3))
          ? this._drawDeciduousTree(tx, ty, rng)
          : this._drawConiferTree(tx, ty, rng);
        items.push({ y: ty, svg, q: hex.q, r: hex.r });
      }

      // Draw trees on edges toward adjacent forest hexes
      const neighbors = hexNeighbors(hex.q, hex.r);
      for (let d = 0; d < 6; d++) {
        const n = neighbors[d];
        const nh = this.world.hexMap.get(hexKey(n.q, n.r));
        if (!nh || !isForest(nh.terrain)) continue;
        if (hexKey(hex.q, hex.r) > hexKey(n.q, n.r)) continue;

        const nCenter = hexToPixel(n.q, n.r, this.hexSize);
        const midX = (center.x + nCenter.x) / 2;
        const midY = (center.y + nCenter.y) / 2;
        const edgeTrees = rng.int(1, 3);
        for (let i = 0; i < edgeTrees; i++) {
          const tx = midX + rng.gaussian() * s * 0.15;
          const ty = midY + rng.gaussian() * s * 0.15;
          const svg = (treeType === 'deciduous' || rng.chance(0.3))
            ? this._drawDeciduousTree(tx, ty, rng)
            : this._drawConiferTree(tx, ty, rng);
          items.push({ y: ty, svg, q: hex.q, r: hex.r });
        }
      }
    }

    // Sort by Y so trees in front overlap those behind, then chunk
    items.sort((a, b) => a.y - b.y);
    return this._chunkedLayer(items, 'forests');
  }

  _drawDeciduousTree(x, y, rng) {
    const size = rng.range(3.5, 5.5);
    const trunkH = rng.range(2, 3.5);
    // Trunk
    let svg = `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - trunkH).toFixed(1)}" stroke="#5a4a3a" stroke-width="0.8"/>`;
    // Canopy — single bumpy outline for a fluffy look (no interior lines)
    const cx = x + rng.gaussian() * 0.3;
    const cy = y - trunkH - size * 0.55;
    const lobeCount = rng.int(5, 7);
    // Build a bumpy canopy path: each lobe is an outward arc
    const pts = [];
    for (let i = 0; i < lobeCount; i++) {
      const a0 = (i / lobeCount) * Math.PI * 2;
      const a1 = ((i + 1) / lobeCount) * Math.PI * 2;
      const aMid = (a0 + a1) / 2 + rng.gaussian() * 0.15;
      const rBase = size * 0.7 + rng.gaussian() * 0.3;
      const rBulge = rBase + size * rng.range(0.2, 0.45);
      pts.push({ x: cx + Math.cos(a0) * rBase, y: cy + Math.sin(a0) * rBase * 0.85 });
      pts.push({ x: cx + Math.cos(aMid) * rBulge, y: cy + Math.sin(aMid) * rBulge * 0.85 });
    }
    // Build smooth path through points
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const cpx = (p0.x + p1.x) / 2;
      const cpy = (p0.y + p1.y) / 2;
      d += ` Q${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${cpx.toFixed(1)},${cpy.toFixed(1)}`;
    }
    d += 'Z';
    svg += `<path d="${d}" fill="#f5f0e6" stroke="#4a5a3a" stroke-width="0.8" stroke-linejoin="round"/>`;
    return svg;
  }

  _drawConiferTree(x, y, rng) {
    const h = rng.range(8, 13);
    const w = rng.range(4, 6);
    // Simple triangle tree
    const top = { x: x + rng.gaussian() * 0.5, y: y - h };
    const left = { x: x - w / 2 + rng.gaussian() * 0.5, y };
    const right = { x: x + w / 2 + rng.gaussian() * 0.5, y };
    const path = `M${top.x.toFixed(1)},${top.y.toFixed(1)} L${left.x.toFixed(1)},${left.y.toFixed(1)} L${right.x.toFixed(1)},${right.y.toFixed(1)} Z`;
    let svg = `<path d="${path}" fill="#f5f0e6" stroke="#4a5a3a" stroke-width="0.8"/>`;
    // Trunk
    svg += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 2).toFixed(1)}" stroke="#5a4a3a" stroke-width="0.8"/>`;
    return svg;
  }

  _renderHills() {
    const rng = new SeededRandom(this.world.seed + 500);
    const items = [];
    const isHillTerrain = t => t === TERRAIN.HILLS;

    for (const [, hex] of this.world.hexMap) {
      if (!isHillTerrain(hex.terrain)) continue;
      if (this._occupiedHexes.has(hexKey(hex.q, hex.r))) continue;
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize;

      const hillCount = rng.int(2, 4);
      for (let i = 0; i < hillCount; i++) {
        const hx = center.x + rng.gaussian() * s * 0.3;
        const hy = center.y + rng.gaussian() * s * 0.3;
        items.push({ y: hy, svg: this._drawHill(hx, hy, rng), q: hex.q, r: hex.r });
      }

      // Draw hills between adjacent hill hexes for blending
      const neighbors = hexNeighbors(hex.q, hex.r);
      for (let d = 0; d < 6; d++) {
        const n = neighbors[d];
        const nh = this.world.hexMap.get(hexKey(n.q, n.r));
        if (!nh || !isHillTerrain(nh.terrain)) continue;
        if (hexKey(hex.q, hex.r) > hexKey(n.q, n.r)) continue;

        const nCenter = hexToPixel(n.q, n.r, this.hexSize);
        const midX = (center.x + nCenter.x) / 2;
        const midY = (center.y + nCenter.y) / 2;
        const hx = midX + rng.gaussian() * s * 0.12;
        const hy = midY + rng.gaussian() * s * 0.12;
        items.push({ y: hy, svg: this._drawHill(hx, hy, rng), q: hex.q, r: hex.r });
      }
    }

    items.sort((a, b) => a.y - b.y);
    return this._chunkedLayer(items, 'hills');
  }

  _drawHill(x, y, rng) {
    const w = rng.range(13, 22);
    const h = rng.range(6, 11);
    const left = { x: x - w / 2, y };
    const right = { x: x + w / 2, y };
    const peak = { x: x + rng.gaussian() * 2, y: y - h };

    // Background fill to hide hills behind this one
    let svg = `<path d="M${left.x.toFixed(1)},${left.y.toFixed(1)} Q${(left.x + peak.x) / 2 + rng.gaussian()},${peak.y.toFixed(1)} ${peak.x.toFixed(1)},${peak.y.toFixed(1)} Q${(peak.x + right.x) / 2 + rng.gaussian()},${peak.y.toFixed(1)} ${right.x.toFixed(1)},${right.y.toFixed(1)} Z" fill="#f5f0e6" stroke="none"/>`;
    // Outline
    svg += `<path d="M${left.x.toFixed(1)},${left.y.toFixed(1)} Q${(left.x + peak.x) / 2 + rng.gaussian()},${peak.y.toFixed(1)} ${peak.x.toFixed(1)},${peak.y.toFixed(1)} Q${(peak.x + right.x) / 2 + rng.gaussian()},${peak.y.toFixed(1)} ${right.x.toFixed(1)},${right.y.toFixed(1)}" fill="none" stroke="#5a4a3a" stroke-width="1.2"/>`;

    // Hatching on right side
    const hatchCount = rng.int(2, 4);
    for (let i = 0; i < hatchCount; i++) {
      const t = 0.5 + (i + 1) / (hatchCount + 1) * 0.4;
      const hx = x + (w / 2) * (t - 0.2);
      const hLen = h * (1 - t) * 0.8;
      svg += `<line x1="${hx.toFixed(1)}" y1="${(y - hLen).toFixed(1)}" x2="${hx.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#5a4a3a" stroke-width="0.5" opacity="0.5"/>`;
    }

    return svg;
  }

  _renderMountains() {
    const rng = new SeededRandom(this.world.seed + 600);
    const items = [];
    const isMtn = t => t === TERRAIN.MOUNTAIN || t === TERRAIN.HIGH_MOUNTAIN;

    for (const [, hex] of this.world.hexMap) {
      if (!isMtn(hex.terrain)) continue;
      if (this._occupiedHexes.has(hexKey(hex.q, hex.r))) continue;
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const s = this.hexSize;
      const isHigh = hex.terrain === TERRAIN.HIGH_MOUNTAIN;

      const mtnCount = isHigh ? rng.int(2, 4) : rng.int(2, 3);
      for (let i = 0; i < mtnCount; i++) {
        const mx = center.x + rng.gaussian() * s * 0.3;
        const my = center.y + rng.gaussian() * s * 0.25;
        items.push({ y: my, svg: this._drawMountain(mx, my, rng, isHigh), q: hex.q, r: hex.r });
      }

      // Draw mountains between adjacent mountain hexes
      const neighbors = hexNeighbors(hex.q, hex.r);
      for (let d = 0; d < 6; d++) {
        const n = neighbors[d];
        const nh = this.world.hexMap.get(hexKey(n.q, n.r));
        if (!nh || !isMtn(nh.terrain)) continue;
        if (hexKey(hex.q, hex.r) > hexKey(n.q, n.r)) continue;

        const nCenter = hexToPixel(n.q, n.r, this.hexSize);
        const midX = (center.x + nCenter.x) / 2;
        const midY = (center.y + nCenter.y) / 2;
        const mx = midX + rng.gaussian() * s * 0.15;
        const my = midY + rng.gaussian() * s * 0.15;
        items.push({ y: my, svg: this._drawMountain(
          mx, my, rng, isHigh && nh.terrain === TERRAIN.HIGH_MOUNTAIN
        ), q: hex.q, r: hex.r });
      }
    }

    items.sort((a, b) => a.y - b.y);
    return this._chunkedLayer(items, 'mountains');
  }

  _drawMountain(x, y, rng, isHigh = false) {
    const h = rng.range(isHigh ? 20 : 14, isHigh ? 32 : 24);
    const w = rng.range(isHigh ? 18 : 14, isHigh ? 28 : 22);

    const peak = { x: x + rng.gaussian() * 2, y: y - h };
    const left = { x: x - w / 2 + rng.gaussian(), y: y + rng.gaussian() };
    const right = { x: x + w / 2 + rng.gaussian(), y: y + rng.gaussian() };

    let svg = '';

    // Background fill to hide mountains behind this one
    const fillPath = `M${left.x.toFixed(1)},${left.y.toFixed(1)} L${peak.x.toFixed(1)},${peak.y.toFixed(1)} L${right.x.toFixed(1)},${right.y.toFixed(1)} Z`;
    svg += `<path d="${fillPath}" fill="#f5f0e6" stroke="none"/>`;

    // Mountain outline
    const path = `M${left.x.toFixed(1)},${left.y.toFixed(1)} L${peak.x.toFixed(1)},${peak.y.toFixed(1)} L${right.x.toFixed(1)},${right.y.toFixed(1)}`;

    // Filled dark side (right slope)
    if (isHigh) {
      const darkPath = `M${peak.x.toFixed(1)},${peak.y.toFixed(1)} L${right.x.toFixed(1)},${right.y.toFixed(1)} L${x.toFixed(1)},${y.toFixed(1)} Z`;
      svg += `<path d="${darkPath}" fill="#5a4a3a" opacity="0.3"/>`;
    }

    // Main outline
    svg += `<path d="${path}" fill="none" stroke="#3a3028" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Hatching on right slope
    const hatchCount = rng.int(3, 6);
    for (let i = 0; i < hatchCount; i++) {
      const t = (i + 1) / (hatchCount + 2);
      const hx1 = peak.x + (right.x - peak.x) * t + rng.gaussian() * 0.5;
      const hy1 = peak.y + (right.y - peak.y) * t + rng.gaussian() * 0.5;
      const hLen = h * 0.15 * (1 - t * 0.5);
      svg += `<line x1="${hx1.toFixed(1)}" y1="${hy1.toFixed(1)}" x2="${(hx1 + 1).toFixed(1)}" y2="${(hy1 + hLen).toFixed(1)}" stroke="#3a3028" stroke-width="0.6" opacity="0.6"/>`;
    }

    // Snow cap for high mountains
    if (isHigh) {
      const snowT = 0.25; // fraction down from peak
      // Compute points on the mountain edges at snowT
      const sl = {
        x: peak.x + (left.x - peak.x) * snowT,
        y: peak.y + (left.y - peak.y) * snowT,
      };
      const sr = {
        x: peak.x + (right.x - peak.x) * snowT,
        y: peak.y + (right.y - peak.y) * snowT,
      };
      svg += `<path d="M${sl.x.toFixed(1)},${sl.y.toFixed(1)} L${peak.x.toFixed(1)},${peak.y.toFixed(1)} L${sr.x.toFixed(1)},${sr.y.toFixed(1)}" fill="#f5f0e6" stroke="#3a3028" stroke-width="0.8"/>`;
    }

    return svg;
  }

  _renderRivers() {
    const rng = new SeededRandom(this.world.seed + 700);
    const parts = [];

    // --- Build merged river edge graph ---
    // For each hex-pair edge, track max accumulation (avoids duplicate rendering at confluences)
    const edgeAccum = new Map(); // "k1|k2" -> max accumulation at that edge
    const hexAccum = new Map();  // hexKey -> max accumulation from any river through it

    for (const river of this.world.rivers) {
      for (let i = 0; i < river.length; i++) {
        const pt = river[i];
        const k = hexKey(pt.q, pt.r);
        const acc = pt.accumulation || 1;
        hexAccum.set(k, Math.max(hexAccum.get(k) || 0, acc));

        if (i < river.length - 1) {
          const next = river[i + 1];
          const k2 = hexKey(next.q, next.r);
          const edgeK = k < k2 ? `${k}|${k2}` : `${k2}|${k}`;
          const edgeAcc = Math.max(acc, next.accumulation || 1);
          edgeAccum.set(edgeK, Math.max(edgeAccum.get(edgeK) || 0, edgeAcc));
        }
      }
    }

    // Find global max accumulation for normalizing widths
    let maxAccum = 1;
    for (const acc of hexAccum.values()) {
      if (acc > maxAccum) maxAccum = acc;
    }

    // --- Build adjacency graph and trace river chains ---
    const adj = new Map();
    for (const [edgeK] of edgeAccum) {
      const [k1, k2] = edgeK.split('|');
      if (!adj.has(k1)) adj.set(k1, new Set());
      if (!adj.has(k2)) adj.set(k2, new Set());
      adj.get(k1).add(k2);
      adj.get(k2).add(k1);
    }

    // Trace chains from endpoints/junctions (similar to road chain building)
    const usedEdges = new Set();
    const chains = [];

    const endpoints = [];
    for (const [k, neighbors] of adj) {
      if (neighbors.size !== 2) endpoints.push(k);
    }

    for (const start of endpoints) {
      for (const firstNeighbor of adj.get(start)) {
        const ek = start < firstNeighbor ? `${start}|${firstNeighbor}` : `${firstNeighbor}|${start}`;
        if (usedEdges.has(ek)) continue;

        const chain = [start];
        let prev = start;
        let cur = firstNeighbor;

        while (true) {
          const ek2 = prev < cur ? `${prev}|${cur}` : `${cur}|${prev}`;
          usedEdges.add(ek2);
          chain.push(cur);

          const neighbors = adj.get(cur);
          if (!neighbors || neighbors.size !== 2) break;

          let next = null;
          for (const n of neighbors) {
            if (n !== prev) { next = n; break; }
          }
          if (!next) break;

          const ek3 = cur < next ? `${cur}|${next}` : `${next}|${cur}`;
          if (usedEdges.has(ek3)) break;

          prev = cur;
          cur = next;
        }

        if (chain.length >= 2) chains.push(chain);
      }
    }

    // Handle closed loops
    for (const [k, neighbors] of adj) {
      for (const n of neighbors) {
        const ek = k < n ? `${k}|${n}` : `${n}|${k}`;
        if (usedEdges.has(ek)) continue;

        const chain = [k];
        let prev = k;
        let cur = n;
        while (true) {
          const ek2 = prev < cur ? `${prev}|${cur}` : `${cur}|${prev}`;
          usedEdges.add(ek2);
          chain.push(cur);
          if (cur === k) break;

          const nbrs = adj.get(cur);
          let next = null;
          for (const nb of nbrs) {
            if (nb !== prev) {
              const ek3 = cur < nb ? `${cur}|${nb}` : `${nb}|${cur}`;
              if (!usedEdges.has(ek3)) { next = nb; break; }
            }
          }
          if (!next) break;
          prev = cur;
          cur = next;
        }
        if (chain.length >= 2) chains.push(chain);
      }
    }

    // --- Render each chain as a spline with accumulation-based width ---
    for (const chain of chains) {
      // Convert to pixel coords with accumulation
      const rawPoints = [];
      let endsInWater = false;
      let lastLandIdx = -1;

      for (let i = 0; i < chain.length; i++) {
        const hex = this.world.hexMap.get(chain[i]);
        if (!hex) continue;
        const center = hexToPixel(hex.q, hex.r, this.hexSize);
        const acc = hexAccum.get(chain[i]) || 1;

        if (isWaterTerrain(hex.terrain)) {
          endsInWater = true;
          // Move endpoint to edge between last land and water
          if (lastLandIdx >= 0 && rawPoints.length > 0) {
            const lastPt = rawPoints[rawPoints.length - 1];
            rawPoints.push({
              x: (lastPt.x + center.x) / 2,
              y: (lastPt.y + center.y) / 2,
              accumulation: acc,
            });
          }
          break;
        }

        rawPoints.push({
          x: center.x + rng.gaussian() * 2,
          y: center.y + rng.gaussian() * 2,
          accumulation: acc,
        });
        lastLandIdx = i;
      }

      if (rawPoints.length < 2) continue;

      // Add meander to interior points
      const meanderedPts = rawPoints.map((p, i) => {
        if (i === 0 || i === rawPoints.length - 1) return p;
        const prev = rawPoints[i - 1];
        const next = rawPoints[i + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const offset = len * 0.15 * (rng.next() - 0.5);
        return { x: p.x + nx * offset, y: p.y + ny * offset, accumulation: p.accumulation };
      });

      // Generate Catmull-Rom spline
      const splinePoints = [];
      const numSubdivisions = 6;
      const cpts = [meanderedPts[0], ...meanderedPts, meanderedPts[meanderedPts.length - 1]];

      for (let i = 1; i < cpts.length - 2; i++) {
        const p0 = cpts[i - 1], p1 = cpts[i], p2 = cpts[i + 1], p3 = cpts[i + 2];
        for (let t = 0; t < numSubdivisions; t++) {
          const u = t / numSubdivisions;
          const u2 = u * u;
          const u3 = u2 * u;
          const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
          const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
          const accum = p1.accumulation + (p2.accumulation - p1.accumulation) * u;
          splinePoints.push({ x, y, accumulation: accum });
        }
      }
      splinePoints.push(cpts[cpts.length - 2]);

      if (splinePoints.length < 2) continue;

      // Draw river segments with accumulation-based width
      const totalSegs = splinePoints.length - 1;
      for (let i = 0; i < totalSegs; i++) {
        const pt = splinePoints[i];
        const normAccum = Math.sqrt((pt.accumulation || 1) / maxAccum);
        const width = 0.8 + normAccum * 4.2;

        const p1 = splinePoints[i];
        const p2 = splinePoints[i + 1];
        const seg = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
        parts.push(`<path d="${seg}" fill="none" stroke="#8cb4c8" stroke-width="${width.toFixed(1)}" stroke-linecap="round"/>`);
      }

      // Center detail line
      let centerPath = `M${splinePoints[0].x.toFixed(1)},${splinePoints[0].y.toFixed(1)}`;
      for (let i = 1; i < splinePoints.length; i++) {
        centerPath += ` L${splinePoints[i].x.toFixed(1)},${splinePoints[i].y.toFixed(1)}`;
      }
      parts.push(`<path d="${centerPath}" fill="none" stroke="#6a9ab0" stroke-width="0.5" stroke-linecap="round" opacity="0.3"/>`);
    }

    // --- Draw irregular ponds at river confluences where 3+ edges meet ---
    const pondRng = new SeededRandom(this.world.seed + 1500);
    for (const [k, neighbors] of adj) {
      if (neighbors.size < 3) continue;
      const hex = this.world.hexMap.get(k);
      if (!hex || isWaterTerrain(hex.terrain)) continue;
      const center = hexToPixel(hex.q, hex.r, this.hexSize);
      const acc = hexAccum.get(k) || 1;
      const normAccum = Math.sqrt(acc / maxAccum);
      const baseR = (0.8 + normAccum * 4.2) * 0.7;
      // Draw a small irregular pond (wobbly ellipse with 8 control points)
      const numPts = 8;
      const pondPts = [];
      for (let i = 0; i < numPts; i++) {
        const angle = (i / numPts) * Math.PI * 2;
        const rVar = baseR * (0.7 + pondRng.next() * 0.6);
        const rx = rVar * (1.0 + pondRng.next() * 0.3);
        const ry = rVar * (0.6 + pondRng.next() * 0.4);
        pondPts.push({
          x: center.x + Math.cos(angle) * rx,
          y: center.y + Math.sin(angle) * ry,
        });
      }
      // Smooth closed shape
      let d = `M ${pondPts[0].x.toFixed(1)} ${pondPts[0].y.toFixed(1)}`;
      for (let i = 0; i < numPts; i++) {
        const p0 = pondPts[(i - 1 + numPts) % numPts];
        const p1 = pondPts[i];
        const p2 = pondPts[(i + 1) % numPts];
        const p3 = pondPts[(i + 2) % numPts];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      d += ' Z';
      parts.push(`<path d="${d}" fill="#8cb4c8" stroke="none"/>`);
    }

    return `<g id="rivers">${parts.join('\n')}</g>`;
  }

  _renderRoads() {
    const rng = new SeededRandom(this.world.seed + 800);
    const parts = [];

    // Build edge-level road map to deduplicate: for each hex-pair edge, track best road type
    const roadPriority = { [ROAD.PAVED]: 3, [ROAD.DIRT]: 2, [ROAD.PATH]: 1 };
    const edgeRoads = new Map();

    for (const road of this.world.roads) {
      if (road.path.length < 2) continue;
      for (let i = 0; i < road.path.length - 1; i++) {
        const h1 = road.path[i];
        const h2 = road.path[i + 1];
        const k1 = hexKey(h1.q, h1.r);
        const k2 = hexKey(h2.q, h2.r);
        const edgeK = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        const existing = edgeRoads.get(edgeK);
        if (!existing || roadPriority[road.type] > roadPriority[existing]) {
          edgeRoads.set(edgeK, road.type);
        }
      }
    }

    // Build stable hex positions
    const hexPositions = new Map();
    const posRng = new SeededRandom(this.world.seed + 801);
    const getHexPos = (q, r) => {
      const k = hexKey(q, r);
      if (!hexPositions.has(k)) {
        const center = hexToPixel(q, r, this.hexSize);
        hexPositions.set(k, {
          x: center.x + posRng.gaussian() * 1.5,
          y: center.y + posRng.gaussian() * 1.5,
        });
      }
      return hexPositions.get(k);
    };

    // Build adjacency graph per road type for chain tracing
    for (const roadType of [ROAD.PATH, ROAD.DIRT, ROAD.PAVED]) {
      // Collect edges of this type
      const adj = new Map(); // hexKey -> Set of adjacent hexKeys via this road type
      for (const [edgeK, type] of edgeRoads) {
        if (type !== roadType) continue;
        const [k1, k2] = edgeK.split('|');
        if (!adj.has(k1)) adj.set(k1, new Set());
        if (!adj.has(k2)) adj.set(k2, new Set());
        adj.get(k1).add(k2);
        adj.get(k2).add(k1);
      }

      if (adj.size === 0) continue;

      // Trace chains: start from degree-1 or degree-3+ nodes, trace along degree-2 nodes
      const usedEdges = new Set();
      const chains = [];

      // Find endpoints (degree != 2) and degree-2 interior nodes
      const endpoints = [];
      for (const [k, neighbors] of adj) {
        if (neighbors.size !== 2) endpoints.push(k);
      }

      // Trace from each endpoint
      for (const start of endpoints) {
        for (const firstNeighbor of adj.get(start)) {
          const ek = start < firstNeighbor ? `${start}|${firstNeighbor}` : `${firstNeighbor}|${start}`;
          if (usedEdges.has(ek)) continue;

          const chain = [start];
          let prev = start;
          let cur = firstNeighbor;

          while (true) {
            const ek2 = prev < cur ? `${prev}|${cur}` : `${cur}|${prev}`;
            usedEdges.add(ek2);
            chain.push(cur);

            const neighbors = adj.get(cur);
            if (!neighbors || neighbors.size !== 2) break; // reached another endpoint/junction

            // Find the next node (not prev)
            let next = null;
            for (const n of neighbors) {
              if (n !== prev) { next = n; break; }
            }
            if (!next) break;

            const ek3 = cur < next ? `${cur}|${next}` : `${next}|${cur}`;
            if (usedEdges.has(ek3)) break;

            prev = cur;
            cur = next;
          }

          if (chain.length >= 2) chains.push(chain);
        }
      }

      // Handle closed loops (all degree-2, no endpoints)
      for (const [k, neighbors] of adj) {
        for (const n of neighbors) {
          const ek = k < n ? `${k}|${n}` : `${n}|${k}`;
          if (usedEdges.has(ek)) continue;

          const chain = [k];
          let prev = k;
          let cur = n;
          while (true) {
            const ek2 = prev < cur ? `${prev}|${cur}` : `${cur}|${prev}`;
            usedEdges.add(ek2);
            chain.push(cur);
            if (cur === k) break; // loop closed

            const nbrs = adj.get(cur);
            let next = null;
            for (const nb of nbrs) {
              if (nb !== prev) {
                const ek3 = cur < nb ? `${cur}|${nb}` : `${nb}|${cur}`;
                if (!usedEdges.has(ek3)) { next = nb; break; }
              }
            }
            if (!next) break;
            prev = cur;
            cur = next;
          }
          if (chain.length >= 2) chains.push(chain);
        }
      }

      // Render each chain as a Catmull-Rom spline
      for (const chain of chains) {
        const pts = chain.map(k => {
          const hex = this.world.hexMap.get(k);
          if (!hex) return null;
          return getHexPos(hex.q, hex.r);
        }).filter(p => p !== null);

        if (pts.length < 2) continue;

        // Generate Catmull-Rom spline
        const splinePoints = this._catmullRomSpline(pts, 4);

        // Build SVG path
        let pathD = `M${splinePoints[0].x.toFixed(1)},${splinePoints[0].y.toFixed(1)}`;
        for (let i = 1; i < splinePoints.length; i++) {
          pathD += ` L${splinePoints[i].x.toFixed(1)},${splinePoints[i].y.toFixed(1)}`;
        }

        switch (roadType) {
          case ROAD.PAVED:
            parts.push(`<path d="${pathD}" fill="none" stroke="#4a3a2a" stroke-width="2.2" stroke-linecap="butt" stroke-linejoin="round"/>`);
            parts.push(`<path d="${pathD}" fill="none" stroke="#f5f0e6" stroke-width="0.8" stroke-linecap="butt" stroke-linejoin="round"/>`);
            break;
          case ROAD.DIRT:
            parts.push(`<path d="${pathD}" fill="none" stroke="#6a5a4a" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="6,3"/>`);
            break;
          case ROAD.PATH:
            parts.push(`<path d="${pathD}" fill="none" stroke="#7a6a5a" stroke-width="1" stroke-linecap="round" stroke-dasharray="2,4"/>`);
            break;
        }
      }

      // Draw junction circles at nodes where 3+ edges meet
      for (const [k, neighbors] of adj) {
        if (neighbors.size < 3) continue;
        const hex = this.world.hexMap.get(k);
        if (!hex) continue;
        const pos = getHexPos(hex.q, hex.r);
        switch (roadType) {
          case ROAD.PAVED:
            parts.push(`<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="1.2" fill="#4a3a2a"/>`);
            parts.push(`<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="0.5" fill="#f5f0e6"/>`);
            break;
          case ROAD.DIRT:
            parts.push(`<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="0.9" fill="#6a5a4a"/>`);
            break;
          case ROAD.PATH:
            parts.push(`<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="0.6" fill="#7a6a5a"/>`);
            break;
        }
      }
    }

    return `<g id="roads">${parts.join('\n')}</g>`;
  }

  /**
   * Generate centripetal Catmull-Rom spline through a set of control points.
   * Returns an array of {x, y} points along the spline.
   */
  _catmullRomSpline(pts, subdivisions = 6) {
    if (pts.length < 2) return pts;
    const splinePoints = [];
    // Duplicate first and last for boundary handling
    const cpts = [pts[0], ...pts, pts[pts.length - 1]];

    for (let i = 1; i < cpts.length - 2; i++) {
      const p0 = cpts[i - 1], p1 = cpts[i], p2 = cpts[i + 1], p3 = cpts[i + 2];

      // Centripetal parameterization (alpha = 0.5)
      const d1 = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y)) || 0.001;
      const d2 = Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y)) || 0.001;
      const d3 = Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y)) || 0.001;

      // Tangent computation using centripetal parameterization
      const t1x = (p2.x - p0.x) / (d1 + d2) * d2 - (p1.x - p0.x) / d1 * d2 / (d1 + d2);
      const t1y = (p2.y - p0.y) / (d1 + d2) * d2 - (p1.y - p0.y) / d1 * d2 / (d1 + d2);

      for (let t = 0; t < subdivisions; t++) {
        const u = t / subdivisions;
        const u2 = u * u;
        const u3 = u2 * u;
        // Standard Catmull-Rom matrix
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
        splinePoints.push({ x, y });
      }
    }
    // Add last point
    splinePoints.push(cpts[cpts.length - 2]);
    return splinePoints;
  }

  _renderBridges() {
    const parts = [];
    const drawn = new Set();

    // Find hex edges where a road crosses a river
    for (const [, hex] of this.world.hexMap) {
      for (let edge = 0; edge < 6; edge++) {
        if (!hex.riverEdges.includes(edge)) continue;
        if (!hex.roadEdges.includes(edge)) continue;

        const neighbor = hexNeighbor(hex.q, hex.r, edge);
        const nh = this.world.hexMap.get(hexKey(neighbor.q, neighbor.r));
        if (!nh) continue;

        // Only draw bridge once per edge pair
        const hk = hexKey(hex.q, hex.r);
        const nk = hexKey(neighbor.q, neighbor.r);
        const edgeK = hk < nk ? hk + '-' + nk : nk + '-' + hk;
        if (drawn.has(edgeK)) continue;
        drawn.add(edgeK);

        // Check if the road is crossing the river (not running parallel)
        // A road is "crossing" if the hex on one side has the river continuing
        // in a different direction than the road
        const hexRiverDirs = hex.riverEdges.filter(e => e !== edge);
        const hexRoadDirs = hex.roadEdges.filter(e => e !== edge);
        // If river and road share other edges on this hex, they run parallel — skip bridge
        const sharedOtherEdges = hexRiverDirs.filter(e => hexRoadDirs.includes(e));
        if (sharedOtherEdges.length > 0 && hexRoadDirs.length <= 2) continue;

        // Draw bridge at edge midpoint
        const center1 = hexToPixel(hex.q, hex.r, this.hexSize);
        const center2 = hexToPixel(neighbor.q, neighbor.r, this.hexSize);
        const mx = (center1.x + center2.x) / 2;
        const my = (center1.y + center2.y) / 2;

        // Compute angle perpendicular to the road direction (bridge spans across the river)
        const roadAngle = Math.atan2(center2.y - center1.y, center2.x - center1.x) * 180 / Math.PI;

        const bw = 10;
        const bh = 5;
        parts.push(`<g transform="translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${roadAngle.toFixed(1)})">`);
        // Bridge deck
        parts.push(`<rect x="${(-bw/2).toFixed(1)}" y="${(-bh/2).toFixed(1)}" width="${bw}" height="${bh}" fill="#c8b080" stroke="#5a4a3a" stroke-width="0.8" rx="1"/>`);
        // Planks across
        for (let p = -4; p <= 4; p += 2) {
          parts.push(`<line x1="${p}" y1="${(-bh/2).toFixed(1)}" x2="${p}" y2="${(bh/2).toFixed(1)}" stroke="#8a7a5a" stroke-width="0.4"/>`);
        }
        // Railings
        parts.push(`<line x1="${(-bw/2).toFixed(1)}" y1="${(-bh/2).toFixed(1)}" x2="${(bw/2).toFixed(1)}" y2="${(-bh/2).toFixed(1)}" stroke="#5a4a3a" stroke-width="1.2"/>`);
        parts.push(`<line x1="${(-bw/2).toFixed(1)}" y1="${(bh/2).toFixed(1)}" x2="${(bw/2).toFixed(1)}" y2="${(bh/2).toFixed(1)}" stroke="#5a4a3a" stroke-width="1.2"/>`);
        parts.push('</g>');
      }
    }

    return `<g id="bridges">${parts.join('\n')}</g>`;
  }

  _renderSettlements() {
    const rng = new SeededRandom(this.world.seed + 900);
    const parts = [];

    // Map settlement types to icon filenames
    // Coastal variants are selected when settlement is on a coast hex
    const settlementIconMap = {
      [SETTLEMENT.CITY]: { default: ['city-1', 'castle'], coastal: ['city-coastal-1'] },
      [SETTLEMENT.TOWN]: { default: ['town-1', 'town-2', 'town-3', 'town-4', 'town-5', 'keep', 'keep-2', 'keep-4'], coastal: ['town-coastal-1'] },
      [SETTLEMENT.VILLAGE]: { default: ['village-1', 'village-2', 'village-3', 'village-4', 'cabin', 'cabin-2', 'cabin-3', 'cabin-4', 'huts'], coastal: ['village-coastal-1'] },
    };

    for (const settlement of this.world.settlements) {
      const center = hexToPixel(settlement.q, settlement.r, this.hexSize);
      const typeCls = settlement.type === SETTLEMENT.CITY ? 'settlement-city' :
                      settlement.type === SETTLEMENT.TOWN ? 'settlement-town' : 'settlement-village';
      let content = '';
      
      const mapping = settlementIconMap[settlement.type];
      const hex = this.world.hexMap.get(hexKey(settlement.q, settlement.r));
      const isCoastal = hex && hex.isCoast;
      const candidateLists = isCoastal ? [mapping.coastal, mapping.default] : [mapping.default];
      let iconKey = null;
      for (const candidates of candidateLists) {
        const available = candidates.filter(k => this.iconSVGs[k]);
        if (available.length > 0) {
          iconKey = available[(settlement.q * 7 + settlement.r * 13) % available.length];
          break;
        }
      }
      if (iconKey && this.iconSVGs[iconKey]) {
        const size = settlement.type === SETTLEMENT.CITY ? this.hexSize * 1.1 :
                     settlement.type === SETTLEMENT.TOWN ? this.hexSize * 0.85 :
                     this.hexSize * 0.7;
        content = this._renderSVGIcon(this.iconSVGs[iconKey], center.x, center.y, size);
      }

      parts.push(`<g class="${typeCls}">${content}</g>`);
    }

    return `<g id="settlements">${parts.join('\n')}</g>`;
  }

  /**
   * Render an inline SVG icon at a position, keeping all paths including
   * white fills (which form the icon interior). The first path typically
   * includes a full-frame background rectangle which provides a white backdrop.
   */
  _renderSVGIcon(svgData, x, y, size, yAnchor = 'center') {
    // Parse viewBox from the SVG
    const vbMatch = svgData.match(/viewBox="([^"]+)"/);
    if (!vbMatch) return '';
    const [vbX, vbY, vbW, vbH] = vbMatch[1].split(/\s+/).map(Number);
    
    // Extract all path elements — keep everything for proper rendering
    const pathRegex = /<path\s+([\s\S]*?)\/>/g;
    const paths = [];
    let m;
    while ((m = pathRegex.exec(svgData)) !== null) {
      paths.push(m[0]);
    }
    
    if (paths.length === 0) return '';
    
    // Calculate scale to fit icon in the given size, preserving aspect ratio
    const aspect = vbW / vbH;
    let renderW, renderH;
    if (aspect > 1) {
      renderW = size;
      renderH = size / aspect;
    } else {
      renderH = size;
      renderW = size * aspect;
    }
    
    const scale = renderW / vbW;
    const tx = x - renderW / 2;
    // 'center' = centered on (x,y), 'bottom' = bottom edge at y
    const ty = yAnchor === 'bottom' ? y - renderH : y - renderH / 2;
    
    return `<g transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${scale.toFixed(4)})">\n${paths.join('\n')}\n</g>`;
  }

  _renderPOIs() {
    const rng = new SeededRandom(this.world.seed + 950);
    const parts = [];

    // Map POI types to icon filenames (matching filenames in /icons/)
    const poiIconMap = {
      [POI_TYPES.CAVE]: ['cave', 'cave-primitive'],
      [POI_TYPES.TOWER]: ['tower', 'watch-tower'],
      [POI_TYPES.WIZARD_TOWER]: 'wizard-tower',
      [POI_TYPES.CASTLE]: ['evil-castle-1', 'evil-castle-2', 'castle'],
      [POI_TYPES.RUINS]: ['ruins', 'ruins-2', 'ruins-3', 'ruins-4', 'ruins-5', 'ruins-6', 'ruins-7', 'aqueduct-ruins', 'ruined-church', 'ruined-tower'],
      [POI_TYPES.MINE]: ['mine-1', 'mine-2', 'mine-3'],
      [POI_TYPES.SHRINE]: ['shrine-1', 'shrine-2'],
      [POI_TYPES.CAMP]: ['tent-camp', 'camp'],
      [POI_TYPES.DRAGON_LAIR]: 'dragon-lair',
      [POI_TYPES.STANDING_STONES]: 'standing-stones',
      [POI_TYPES.SHIPWRECK]: ['shipwreck-1', 'shipwreck-2'],
      [POI_TYPES.OBELISK]: ['obelisk', 'broken-obelisk'],
      [POI_TYPES.TOMB]: ['tomb-1', 'tomb-2', 'tomb-3', 'graveyard'],
      [POI_TYPES.CAIRN]: 'cairn',
      [POI_TYPES.PYRAMID]: ['pyramid', 'ziggaraut', 'ziggaraut-ruins'],
      [POI_TYPES.DEAD_FOREST]: ['dead-forest', 'dead-tree-2'],
      [POI_TYPES.GREAT_TREE]: ['great-tree', 'floating-tree'],
      [POI_TYPES.FAIRY_RING]: 'fairy-ring',
      [POI_TYPES.GIANT_SKELETON]: 'giant-skeleton',
      [POI_TYPES.METEOR_CRATER]: 'meteor-crater',
      [POI_TYPES.PIT]: ['pit', 'pit-2'],
      [POI_TYPES.BATTLEFIELD]: 'old-battlefield',
      [POI_TYPES.LOG_FORT]: ['log-fort', 'skull-fortification'],
      [POI_TYPES.COLOSSUS]: 'broken-colossus',
      [POI_TYPES.LIGHTHOUSE]: 'lighthouse',
      [POI_TYPES.HARBOR]: 'harbor-1',
      [POI_TYPES.DOCKS]: 'docks',
      [POI_TYPES.INN]: 'inn',
      [POI_TYPES.TAVERN]: 'tavern',
      [POI_TYPES.TEMPLE]: 'temple-1',
      [POI_TYPES.FOUNTAIN]: 'fountain',
      [POI_TYPES.WELL]: 'well',
      [POI_TYPES.WINDMILL]: 'windmill',
      [POI_TYPES.EVIL_ALTAR]: ['evil-altar', 'evil-altar-2'],
      [POI_TYPES.TOTEM]: 'skull-totem',
      [POI_TYPES.TAR_PIT]: 'tar-pit',
      [POI_TYPES.CHASM]: 'chasm',
    };

    for (const poi of this.world.pois) {
      const center = hexToPixel(poi.q, poi.r, this.hexSize);
      
      let iconKey = poiIconMap[poi.type];
      if (Array.isArray(iconKey)) {
        const available = iconKey.filter(k => this.iconSVGs[k]);
        iconKey = available.length > 0 ? available[(poi.q * 7 + poi.r * 13) % available.length] : null;
      }
      if (iconKey && this.iconSVGs[iconKey]) {
        const size = this.hexSize * 0.8;
        const iconBottomY = center.y + 10;
        parts.push(this._renderSVGIcon(this.iconSVGs[iconKey], center.x, iconBottomY, size, 'bottom'));
      }
    }

    return `<g id="pois">${parts.join('\n')}</g>`;
  }

  _renderLabels() {
    const rng = new SeededRandom(this.world.seed + 1000);
    const parts = [];

    // --- Label overlap avoidance ---
    // Track placed label bounding boxes (in pixel coords)
    const placedLabels = []; // {x, y, hw, hh} — center x/y, half-width, half-height
    const hs = this.hexSize;

    const overlaps = (x, y, hw, hh) => {
      for (const lbl of placedLabels) {
        if (Math.abs(x - lbl.x) < hw + lbl.hw && Math.abs(y - lbl.y) < hh + lbl.hh) {
          return true;
        }
      }
      return false;
    };

    const placeLabel = (x, y, text, fontSize, letterSpacing = 0) => {
      // Account for letter-spacing in width estimate
      const charWidth = fontSize * 0.4;
      const hw = text.length * charWidth + (text.length - 1) * letterSpacing * 0.5 + fontSize * 0.5;
      const hh = fontSize * 0.8;
      if (overlaps(x, y, hw, hh)) return false;
      placedLabels.push({ x, y, hw, hh });
      return true;
    };

    // Helper: text with white outline
    const outlinedText = (x, y, text, fontSize, fill, extra = '') => {
      const common = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" ${extra}`;
      return `<text ${common} fill="${fill}" stroke="#f5f0e6" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${xmlEscape(text)}</text>`;
    };

    const gf = this.world.geoFeatures;

    if (gf) {
      // --- Large region names (visible when zoomed out, fade when zoomed in) ---
      for (const region of gf.regions) {
        // Compute pixel positions of all hexes in this region
        const pixPts = region.hexes.map(h => hexToPixel(h.q, h.r, hs));

        // Compute centroid
        let mx = 0, my = 0;
        for (const p of pixPts) { mx += p.x; my += p.y; }
        mx /= pixPts.length; my /= pixPts.length;

        // Find the principal axis using covariance of hex positions
        let cxx = 0, cxy = 0, cyy = 0;
        for (const p of pixPts) {
          const dx = p.x - mx, dy = p.y - my;
          cxx += dx * dx; cxy += dx * dy; cyy += dy * dy;
        }
        const angle = Math.atan2(2 * cxy, cxx - cyy) / 2;
        const clampedDeg = Math.max(-45, Math.min(45, angle * 180 / Math.PI));

        // Compute extent along the principal axis
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        let minProj = Infinity, maxProj = -Infinity;
        for (const p of pixPts) {
          const proj = (p.x - mx) * cosA + (p.y - my) * sinA;
          minProj = Math.min(minProj, proj);
          maxProj = Math.max(maxProj, proj);
        }
        const axisLength = maxProj - minProj;

        // Scale font to fit within the region — cap based on available space
        const maxFontForRegion = axisLength / (region.name.length * 0.5 + 2);
        const fontSize = Math.min(48, Math.max(14, Math.min(24 + region.size * 0.2, maxFontForRegion)));

        // Compute letter-spacing to spread text within region
        const baseTextWidth = region.name.length * fontSize * 0.5;
        const availableWidth = axisLength * 0.75;
        if (baseTextWidth > availableWidth * 1.3) continue; // text simply doesn't fit — skip
        const letterSpacing = baseTextWidth < availableWidth
          ? Math.min(10, (availableWidth - baseTextWidth) / Math.max(1, region.name.length - 1))
          : 2;

        // Use the hex center closest to the centroid (guarantees position is on land)
        const sorted = [...pixPts].sort((a, b) =>
          ((a.x - mx) ** 2 + (a.y - my) ** 2) - ((b.x - mx) ** 2 + (b.y - my) ** 2)
        );
        const center = sorted[0];
        if (!placeLabel(center.x, center.y, region.name, fontSize, letterSpacing)) continue;

        const transform = Math.abs(clampedDeg) > 2 ? `transform="rotate(${clampedDeg.toFixed(1)}, ${center.x.toFixed(1)}, ${center.y.toFixed(1)})"` : '';
        parts.push(`<g class="label-region" ${transform}>${outlinedText(center.x, center.y, region.name, fontSize, '#3a2a1a', `font-style="italic" letter-spacing="${letterSpacing.toFixed(0)}" opacity="0.55"`)}</g>`);
      }

      // Helper: place a label within a geographic feature using centroid + principal axis
      // Skips if text doesn't fit within the feature's extent
      const placeFeatureLabel = (feature, fontSize, cssClass, fill, extraAttrs) => {
        const pixPts = feature.hexes.map(h => hexToPixel(h.q, h.r, hs));
        let mx = 0, my = 0;
        for (const p of pixPts) { mx += p.x; my += p.y; }
        mx /= pixPts.length; my /= pixPts.length;

        // Compute bounding extent to check if label can fit
        let minX = Infinity, maxX = -Infinity;
        for (const p of pixPts) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        }
        const extentW = maxX - minX + hs;
        const textEstW = feature.name.length * fontSize * 0.45;
        if (textEstW > extentW * 1.1) return false; // doesn't fit — skip

        // Principal axis angle
        let cxx = 0, cxy = 0, cyy = 0;
        for (const p of pixPts) {
          const dx = p.x - mx, dy = p.y - my;
          cxx += dx * dx; cxy += dx * dy; cyy += dy * dy;
        }
        const angle = Math.atan2(2 * cxy, cxx - cyy) / 2;
        const angleDeg = Math.max(-30, Math.min(30, angle * 180 / Math.PI));

        // Only try positions at actual hex centers within the feature (sorted by distance from centroid)
        // This ensures land labels stay on land, water labels stay on water
        const sorted = [...pixPts].sort((a, b) =>
          ((a.x - mx) ** 2 + (a.y - my) ** 2) - ((b.x - mx) ** 2 + (b.y - my) ** 2)
        );
        const candidates = sorted.slice(0, Math.min(8, sorted.length));

        for (const pos of candidates) {
          if (placeLabel(pos.x, pos.y, feature.name, fontSize)) {
            const transform = Math.abs(angleDeg) > 3 ? `transform="rotate(${angleDeg.toFixed(1)}, ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})"` : '';
            parts.push(`<g class="${cssClass}" ${transform}>${outlinedText(pos.x, pos.y, feature.name, fontSize, fill, extraAttrs)}</g>`);
            return true;
          }
        }
        return false;
      };

      // --- Water body names (sized by hex count, positioned within water) ---
      for (const wb of gf.waterBodies) {
        const fontSize = Math.min(26, 12 + wb.size * 0.08);
        placeFeatureLabel(wb, fontSize, 'label-water', '#3a5a7a', 'font-style="italic" letter-spacing="3" opacity="0.55"');
      }

      // --- Mountain range names ---
      for (const mr of gf.mountainRanges) {
        const fontSize = Math.min(15, 8 + mr.size * 0.2);
        placeFeatureLabel(mr, fontSize, 'label-mountain', '#6a5a4a', 'font-weight="bold" letter-spacing="2" opacity="0.65"');
      }

      // --- Forest names ---
      for (const f of gf.forests) {
        const fontSize = Math.min(13, 7 + f.size * 0.12);
        placeFeatureLabel(f, fontSize, 'label-forest', '#3a5a3a', 'font-style="italic" letter-spacing="1" opacity="0.55"');
      }

      // --- Desert names ---
      for (const d of gf.deserts) {
        const fontSize = Math.min(14, 8 + d.size * 0.12);
        placeFeatureLabel(d, fontSize, 'label-desert', '#8a6a3a', 'font-style="italic" letter-spacing="2" opacity="0.55"');
      }

      // --- Swamp names ---
      for (const s of gf.swamps) {
        const fontSize = Math.min(11, 7 + s.size * 0.12);
        placeFeatureLabel(s, fontSize, 'label-swamp', '#5a6a3a', 'font-style="italic" opacity="0.55"');
      }

      // --- Tundra names ---
      for (const t of gf.tundras) {
        const fontSize = Math.min(12, 8 + t.size * 0.08);
        placeFeatureLabel(t, fontSize, 'label-tundra', '#6a7a8a', 'font-style="italic" letter-spacing="2" opacity="0.45"');
      }

      // --- Lake names (placed within lake) ---
      for (const l of gf.lakes) {
        const fontSize = Math.min(12, 8 + l.size * 0.2);
        placeFeatureLabel(l, fontSize, 'label-lake', '#3a5a7a', 'font-style="italic" opacity="0.65"');
      }

      // --- Island names (placed close to island: try above first, then below, then sides) ---
      for (const isl of gf.islands) {
        const center = hexToPixel(isl.centerQ, isl.centerR, hs);
        const fontSize = Math.min(10, 6 + isl.size * 0.4);
        const vGap = hs * 0.65 + fontSize * 0.5; // tight vertical gap

        // Try positions in priority order: above, below, then around
        const candidates = [
          { x: center.x, y: center.y - vGap },                   // above
          { x: center.x, y: center.y + vGap + fontSize * 0.3 },  // below
          { x: center.x + hs * 1.0, y: center.y - vGap * 0.5 }, // upper-right
          { x: center.x - hs * 1.0, y: center.y - vGap * 0.5 }, // upper-left
          { x: center.x + hs * 1.0, y: center.y + vGap * 0.5 }, // lower-right
          { x: center.x - hs * 1.0, y: center.y + vGap * 0.5 }, // lower-left
        ];

        for (const pos of candidates) {
          if (placeLabel(pos.x, pos.y, isl.name, fontSize)) {
            parts.push(`<g class="label-island">${outlinedText(pos.x, pos.y, isl.name, fontSize, '#4a5a6a', 'font-style="italic" opacity="0.65"')}</g>`);
            break;
          }
        }
      }

      // --- Coast names ---
      for (const c of gf.coasts) {
        const center = hexToPixel(c.centerQ, c.centerR, hs);
        if (!placeLabel(center.x, center.y, c.name, 8)) continue;
        parts.push(`<g class="label-coast">${outlinedText(center.x, center.y, c.name, 8, '#5a6a7a', 'font-style="italic" opacity="0.45"')}</g>`);
      }

      // --- River names (placed along river, rotated, with overlap check) ---
      // Sort rivers by size (largest first) so main rivers get named, tributaries skip shared hexes
      const sortedRivers = [...gf.rivers].sort((a, b) => b.size - a.size);
      const namedRiverHexes = new Set(); // track hexes that already have a river name nearby

      for (const rv of sortedRivers) {
        // Skip if this river's center hex is already named by a larger river (merged tributary)
        const centerKey = `${rv.centerQ},${rv.centerR}`;
        if (namedRiverHexes.has(centerKey)) continue;

        // Try placing at midpoint, then try alternate positions along the river
        const fontSize = Math.min(9, 6 + rv.size * 0.15);
        let placed = false;

        for (let tryIdx = 0; tryIdx < 3 && !placed; tryIdx++) {
          const pathIdx = Math.floor(rv.path.length * (0.5 + tryIdx * 0.15));
          if (pathIdx >= rv.path.length) break;
          const pt = rv.path[Math.min(pathIdx, rv.path.length - 1)];
          const center = hexToPixel(pt.q, pt.r, hs);

          // Skip positions near settlements or POIs
          const ptKey = `${pt.q},${pt.r}`;
          const ptHex = this.world.hexMap.get(ptKey);
          if (ptHex && (ptHex.settlement || ptHex.poi)) continue;

          const labelY = center.y - 6;
          if (!placeLabel(center.x, labelY, rv.name, fontSize)) continue;

          // Compute rotation angle
          let angle = 0;
          const pi = Math.min(pathIdx, rv.path.length - 2);
          if (pi > 0) {
            const prev = hexToPixel(rv.path[pi - 1].q, rv.path[pi - 1].r, hs);
            const next = hexToPixel(rv.path[pi + 1].q, rv.path[pi + 1].r, hs);
            angle = Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI;
            if (angle > 90) angle -= 180;
            if (angle < -90) angle += 180;
          }
          parts.push(`<g class="label-river"><text x="${center.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" fill="#3a5a7a" stroke="#f5f0e6" stroke-width="4" stroke-linejoin="round" paint-order="stroke" font-style="italic" opacity="0.65" transform="rotate(${angle.toFixed(0)},${center.x.toFixed(1)},${labelY.toFixed(1)})">${xmlEscape(rv.name)}</text></g>`);
          placed = true;
        }

        // Mark all hexes in this river as named to prevent tributaries from labeling near the same spot
        if (placed) {
          for (const h of rv.path) {
            namedRiverHexes.add(`${h.q},${h.r}`);
            // Also mark neighbors to create spacing
            for (const n of hexNeighbors(h.q, h.r)) {
              namedRiverHexes.add(`${n.q},${n.r}`);
            }
          }
        }
      }
    }

    // --- Settlement labels (always visible, size based on importance) ---
    for (const settlement of this.world.settlements) {
      const center = hexToPixel(settlement.q, settlement.r, hs);
      const fontSize = settlement.type === SETTLEMENT.CITY ? 16 :
                       settlement.type === SETTLEMENT.TOWN ? 13 : 9;
      const yOffset = settlement.type === SETTLEMENT.CITY ? 28 :
                      settlement.type === SETTLEMENT.TOWN ? 22 : 16;
      const fontWeight = settlement.type === SETTLEMENT.CITY ? 'font-weight="bold"' : '';
      const cls = settlement.type === SETTLEMENT.CITY ? 'label-city' :
                  settlement.type === SETTLEMENT.TOWN ? 'label-town' : 'label-village';

      // Settlements always get placed (don't skip for overlap)
      placeLabel(center.x, center.y + yOffset, settlement.name, fontSize);
      parts.push(`<g class="${cls}">${outlinedText(center.x, center.y + yOffset, settlement.name, fontSize, '#3a3028', `font-style="italic" ${fontWeight}`)}</g>`);
    }

    // --- POI labels (always show) ---
    for (const poi of this.world.pois) {
      const center = hexToPixel(poi.q, poi.r, hs);
      // Force-place POI labels like settlements (don't skip for overlap)
      placeLabel(center.x, center.y + 16, poi.name, 9);
      parts.push(`<g class="label-poi">${outlinedText(center.x, center.y + 16, poi.name, 9, '#6a5a4a', 'font-style="italic"')}</g>`);
    }

    return `<g id="labels">${parts.join('\n')}</g>`;
  }

  _renderHexGrid() {
    const rng = new SeededRandom(this.world.seed + 1100);
    const items = [];

    for (const [, hex] of this.world.hexMap) {
      const corners = hexCorners(hex.q, hex.r, this.hexSize);
      const pts = corners.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
      items.push({ q: hex.q, r: hex.r, svg: `<polygon points="${pts}" fill="none" stroke="#8a7a6a" stroke-width="0.4" opacity="0.4"/>` });
    }

    return this._chunkedLayer(items, 'hex-grid');
  }

  _renderPassability() {
    const items = [];
    const s = this.hexSize;

    for (const [, hex] of this.world.hexMap) {
      let svg = '';
      for (let edge = 0; edge < 6; edge++) {
        const passability = hex.edges[edge];
        if (!passability || passability === PASSABILITY.NORMAL) continue;

        const mid = hexEdgeMidpoint(hex.q, hex.r, s, edge);
        const color = passability === PASSABILITY.BLOCKED ? '#c03030' : '#c0a030';
        const symbol = passability === PASSABILITY.BLOCKED ? '✕' : '⚠';

        svg += `<text x="${mid.x.toFixed(1)}" y="${(mid.y + 2).toFixed(1)}" text-anchor="middle" font-size="6" fill="${color}" opacity="0.6">${symbol}</text>`;
      }
      if (svg) items.push({ q: hex.q, r: hex.r, svg });
    }

    return this._chunkedLayer(items, 'passability');
  }
}
