// Web Worker for offloading map generation and SVG rendering
import { generateWorld } from './world-gen.js';
import { MapRenderer } from './renderer.js';
import { hexKey, hexToPixel } from './hex.js';

/**
 * Serialize world data for transfer to main thread.
 * Converts Map objects to arrays of [key, value] pairs.
 */
function serializeWorldData(world) {
  return {
    seed: world.seed,
    cols: world.cols,
    rows: world.rows,
    hexSize: world.hexSize,
    hexMapEntries: [...world.hexMap.entries()],
    rivers: world.rivers,
    settlements: world.settlements,
    roads: world.roads,
    pois: world.pois,
    geoFeatures: world.geoFeatures,
  };
}

/**
 * Reconstruct world data from serialized form.
 * Recreates Map objects from arrays.
 */
export function deserializeWorldData(data) {
  return {
    seed: data.seed,
    cols: data.cols,
    rows: data.rows,
    hexSize: data.hexSize,
    hexMap: new Map(data.hexMapEntries),
    rivers: data.rivers,
    settlements: data.settlements,
    roads: data.roads,
    pois: data.pois,
    geoFeatures: data.geoFeatures,
  };
}

self.onmessage = function(e) {
  const { type, options, id } = e.data;

  if (type === 'generate') {
    try {
      const startTime = performance.now();

      // Phase 1: Generate world
      const worldData = generateWorld(options);
      const genTime = performance.now() - startTime;

      // Phase 2: Render SVG
      const renderer = new MapRenderer(worldData, options);
      const svgString = renderer.toSVG();
      const renderTime = performance.now() - startTime - genTime;

      // Phase 3: Compute stats
      const hexes = [...worldData.hexMap.values()];
      const terrainCounts = {};
      for (const hex of hexes) {
        terrainCounts[hex.terrain] = (terrainCounts[hex.terrain] || 0) + 1;
      }
      const stats = {
        seed: options.seed,
        totalHexes: hexes.length,
        terrainCounts,
        settlements: worldData.settlements.map(s => ({
          name: s.name, type: s.type, q: s.q, r: s.r,
        })),
        pois: worldData.pois.map(p => ({
          name: p.name, type: p.type, q: p.q, r: p.r,
        })),
        rivers: worldData.rivers.length,
        roads: worldData.roads.length,
      };

      // Serialize world data for hover/interaction on main thread
      const serializedWorld = serializeWorldData(worldData);
      const chunkBounds = renderer.getChunkBounds();

      self.postMessage({
        type: 'result',
        id,
        svgString,
        worldData: serializedWorld,
        chunkBounds,
        stats,
        seed: worldData.seed,
        timing: {
          generation: Math.round(genTime),
          rendering: Math.round(renderTime),
          total: Math.round(performance.now() - startTime),
        },
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        error: err.message,
        stack: err.stack,
      });
    }
  }
};
