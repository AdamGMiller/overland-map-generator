// Overland Hex Map Generator - Public API
import { generateWorld, TERRAIN, SETTLEMENT, POI_TYPES, ROAD, PASSABILITY } from './world-gen.js';
import { MapRenderer } from './renderer.js';
import { hexKey, hexToPixel } from './hex.js';

export { TERRAIN, SETTLEMENT, POI_TYPES, ROAD, PASSABILITY };

/**
 * Main class for generating overland hex maps
 * 
 * @example
 * const map = new OverlandMap({ seed: 42, cols: 16, rows: 12 });
 * const svgString = map.toSVG();
 * // or in browser:
 * document.body.appendChild(map.render());
 */
export class OverlandMap {
  /**
   * @param {Object} options
   * @param {number} [options.seed] - Random seed (auto-generated if omitted)
   * @param {number} [options.cols=16] - Number of hex columns
   * @param {number} [options.rows=12] - Number of hex rows
   * @param {number} [options.hexSize=50] - Pixel radius per hex
   * @param {boolean} [options.showHexGrid=true] - Show hex grid overlay
   * @param {boolean} [options.showLabels=true] - Show settlement/POI labels
   * @param {boolean} [options.showPassability=false] - Show passability overlay
   * @param {number} [options.waterRatio=0.25] - Fraction of map that is water
   * @param {number} [options.mountainRatio=0.12] - Fraction of map that is mountains
   * @param {number} [options.forestDensity=0.35] - Forest density factor
   * @param {number} [options.numCities=2] - Number of cities
   * @param {number} [options.numTowns=4] - Number of towns
   * @param {number} [options.numVillages=3] - Number of villages
   * @param {number} [options.numPOIs=8] - Number of points of interest
   * @param {number} [options.numRivers=3] - Number of rivers
   * @param {Object} [options.iconSVGs] - Map of icon name to SVG string {castle, cave, keep, tower}
   */
  constructor(options = {}) {
    this.options = {
      seed: options.seed ?? Math.floor(Math.random() * 2147483647),
      cols: options.cols ?? 50,
      rows: options.rows ?? 50,
      hexSize: options.hexSize ?? 50,
      showHexGrid: options.showHexGrid ?? true,
      showLabels: options.showLabels ?? true,
      showPassability: options.showPassability ?? false,
      iconSVGs: options.iconSVGs ?? null,
      waterRatio: options.waterRatio ?? 0.25,
      mountainRatio: options.mountainRatio ?? 0.12,
      forestDensity: options.forestDensity ?? 0.35,
      numCities: options.numCities ?? 5,
      numTowns: options.numTowns ?? 10,
      numVillages: options.numVillages ?? 8,
      numPOIs: options.numPOIs ?? 20,
      numRivers: options.numRivers ?? 8,
    };

    // Validate minimum grid size
    if (this.options.cols < 2) this.options.cols = 2;
    if (this.options.rows < 2) this.options.rows = 2;

    this._worldData = null;
    this._renderer = null;
  }

  /** Get or generate world data */
  get worldData() {
    if (!this._worldData) {
      this._worldData = generateWorld(this.options);
    }
    return this._worldData;
  }

  /** Alias for worldData (convenience) */
  get world() {
    return this.worldData;
  }

  /** Get or create renderer */
  get renderer() {
    if (!this._renderer) {
      this._renderer = new MapRenderer(this.worldData, this.options);
    }
    return this._renderer;
  }

  /** The seed used for this map */
  get seed() {
    return this.options.seed;
  }

  /**
   * Render the map as an SVG string
   * @returns {string} Complete SVG markup
   */
  toSVG() {
    return this.renderer.toSVG();
  }

  /**
   * Render the map as an SVG DOM element (browser only)
   * @returns {SVGElement}
   */
  render() {
    return this.renderer.render();
  }

  /**
   * Get hex data for game use
   * @returns {Array<Object>} Array of hex objects with terrain, settlement, POI, and edge data
   */
  getHexData() {
    const data = [];
    for (const [key, hex] of this.worldData.hexMap) {
      const pixel = hexToPixel(hex.q, hex.r, this.options.hexSize);
      data.push({
        key,
        q: hex.q,
        r: hex.r,
        col: hex.col,
        row: hex.row,
        pixelX: pixel.x,
        pixelY: pixel.y,
        terrain: hex.terrain,
        elevation: hex.elevation,
        moisture: hex.moisture,
        isCoast: hex.isCoast || false,
        river: hex.river,
        settlement: hex.settlement ? { type: hex.settlement.type, name: hex.settlement.name } : null,
        poi: hex.poi ? { type: hex.poi.type, name: hex.poi.name } : null,
        roads: [...hex.roads],
        edges: { ...hex.edges },
      });
    }
    return data;
  }

  /**
   * Get summary statistics about the generated map
   * @returns {Object}
   */
  getStats() {
    const hexes = [...this.worldData.hexMap.values()];
    const terrainCounts = {};
    for (const hex of hexes) {
      terrainCounts[hex.terrain] = (terrainCounts[hex.terrain] || 0) + 1;
    }

    return {
      seed: this.options.seed,
      totalHexes: hexes.length,
      terrainCounts,
      settlements: this.worldData.settlements.map(s => ({
        name: s.name, type: s.type, q: s.q, r: s.r,
      })),
      pois: this.worldData.pois.map(p => ({
        name: p.name, type: p.type, q: p.q, r: p.r,
      })),
      rivers: this.worldData.rivers.length,
      roads: this.worldData.roads.length,
    };
  }

  /**
   * Regenerate with a new seed
   * @param {number} [newSeed] - New seed (random if omitted)
   * @returns {OverlandMap} New map instance
   */
  regenerate(newSeed) {
    return new OverlandMap({
      ...this.options,
      seed: newSeed ?? Math.floor(Math.random() * 2147483647),
    });
  }
}
