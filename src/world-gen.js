// World generation - terrain, rivers, settlements, roads, POIs
import { SeededRandom, SimplexNoise } from './random.js';
import { hexRectGrid, hexKey, hexNeighbors, hexNeighbor, hexToPixel, hexDistance, hexLineDraw, oppositeEdge } from './hex.js';

// Terrain types
export const TERRAIN = {
  DEEP_WATER: 'deep_water',
  WATER: 'water',
  LAKE: 'lake',
  COAST: 'coast',
  BEACH: 'beach',
  PLAINS: 'plains',
  GRASSLAND: 'grassland',
  FOREST: 'forest',
  DENSE_FOREST: 'dense_forest',
  HILLS: 'hills',
  MOUNTAIN: 'mountain',
  HIGH_MOUNTAIN: 'high_mountain',
  SWAMP: 'swamp',
  DESERT: 'desert',
  TUNDRA: 'tundra',
};

// Settlement types
export const SETTLEMENT = {
  CITY: 'city',
  TOWN: 'town',
  VILLAGE: 'village',
};

// POI types
export const POI_TYPES = {
  RUINS: 'ruins',
  TOWER: 'tower',
  CAVE: 'cave',
  CAIRN: 'cairn',
  CASTLE: 'castle',
  MINE: 'mine',
  SHRINE: 'shrine',
  CAMP: 'camp',
  DRAGON_LAIR: 'dragon_lair',
  STANDING_STONES: 'standing_stones',
  SHIPWRECK: 'shipwreck',
  WIZARD_TOWER: 'wizard_tower',
  OBELISK: 'obelisk',
  TOMB: 'tomb',
  PYRAMID: 'pyramid',
  DEAD_FOREST: 'dead_forest',
  GREAT_TREE: 'great_tree',
  FAIRY_RING: 'fairy_ring',
  GIANT_SKELETON: 'giant_skeleton',
  METEOR_CRATER: 'meteor_crater',
  PIT: 'pit',
  BATTLEFIELD: 'battlefield',
  LOG_FORT: 'log_fort',
  COLOSSUS: 'colossus',
  LIGHTHOUSE: 'lighthouse',
  HARBOR: 'harbor',
  DOCKS: 'docks',
  INN: 'inn',
  TAVERN: 'tavern',
  TEMPLE: 'temple',
  FOUNTAIN: 'fountain',
  WELL: 'well',
  WINDMILL: 'windmill',
  EVIL_ALTAR: 'evil_altar',
  TOTEM: 'totem',
  TAR_PIT: 'tar_pit',
  CHASM: 'chasm',
};

// Road types
export const ROAD = {
  PAVED: 'paved',
  DIRT: 'dirt',
  PATH: 'path',
};

// Edge passability
export const PASSABILITY = {
  NORMAL: 'normal',
  BLOCKED: 'blocked',
  CHECK: 'check',
};

// Name generation word parts
const NAME_PREFIXES = [
  'Black', 'White', 'Grey', 'Red', 'Green', 'Gold', 'Silver', 'Iron',
  'Stone', 'Storm', 'Raven', 'Wolf', 'Bear', 'Eagle', 'Hawk', 'Elk',
  'Oak', 'Ash', 'Thorn', 'Moss', 'Fern', 'Frost', 'Sun', 'Moon',
  'Star', 'Wind', 'Cloud', 'Shadow', 'Bright', 'Dark', 'High', 'Low',
  'North', 'South', 'East', 'West', 'Long', 'Old', 'New', 'Far',
  'Deep', 'Broad', 'Swift', 'Still', 'Wild', 'Crown', 'Crag', 'Glen',
];

const TOWN_SUFFIXES = [
  'ton', 'ford', 'bury', 'wick', 'ham', 'worth', 'stead', 'gate',
  'bridge', 'haven', 'port', 'mouth', 'field', 'dale', 'vale', 'mere',
  'well', 'cross', 'watch', 'hold', 'keep', 'fall', 'march', 'helm',
];

const POI_NAMES = {
  ruins: ['Fallen Keep', 'Lost Temple', 'Broken Hall', 'Shattered Tower', 'Ancient Stones',
    'Forsaken Shrine', 'Crumbled Wall', 'Old Foundation', 'Ruined Chapel', 'Dead City'],
  tower: ['Watchtower', 'Signal Tower', 'Lonely Spire', 'Guard Tower', 'Beacon',
    'High Tower', 'Stone Pillar', 'Sentinel', 'Lookout', 'Tall Tower'],
  cave: ['Dark Hollow', 'Deep Cave', 'Bear Den', 'Spider Hole', 'Crystal Grotto',
    'Shadow Cave', 'Echo Chamber', 'Black Pit', 'Wolf Lair', 'Hidden Cave'],
  cairn: ['Stone Cairn', 'Old Marker', 'Waystone', 'Burial Mound', 'Standing Stones',
    'Ancient Cairn', 'Trail Marker', 'Grave Marker', 'Memorial', 'Stone Circle'],
  castle: ['Fort', 'Stronghold', 'Citadel', 'Bastion', 'Garrison',
    'Keep', 'Fortress', 'Redoubt', 'Bulwark', 'Holdfast'],
  mine: ['Old Mine', 'Iron Pit', 'Gold Dig', 'Deep Shaft', 'Silver Vein',
    'Copper Mine', 'Quarry', 'Stone Pit', 'Dark Mine', 'Lost Lode'],
  shrine: ['Wayside Shrine', 'Forest Altar', 'Holy Spring', 'Prayer Stone', 'Sacred Grove',
    'Blessed Pool', 'Spirit Tree', 'Temple Ruins', 'Offering Stone', 'Pilgrim Rest'],
  camp: ['Hunter Camp', 'Ranger Post', 'Outpost', 'Trapper Lodge', 'Woodcutter Camp',
    'Scout Post', 'Waystation', 'Shelter', 'Rest Stop', 'Campsite'],
  dragon_lair: ['Dragon Roost', 'Wyrm Den', 'Drake Hollow', 'Firepit', 'Smoldering Cave',
    'Scorched Lair', 'Burning Nest', 'Dragon Peak', 'Serpent Den', 'Wyvern Perch'],
  standing_stones: ['Stone Ring', 'Druid Circle', 'Ancient Henge', 'Moon Stones', 'Elder Ring',
    'Ritual Circle', 'Fey Ring', 'Sacred Stones', 'Ley Crossing', 'Star Stones'],
  shipwreck: ['Wreck of the Dawn', 'Lost Vessel', 'Broken Hull', 'Ghost Ship', 'Stranded Brig',
    'Sea Grave', 'Shattered Keel', 'Beached Hulk', 'Storm Wreck', 'Corsair Ruin'],
  wizard_tower: ['Arcane Spire', 'Mage Tower', 'Sorcerer Keep', 'Crystal Tower', 'Star Tower',
    'Enchanter Hall', 'Wizard Retreat', 'Spell Tower', 'Mystic Spire', 'Sage Tower'],
  obelisk: ['Black Obelisk', 'Sun Pillar', 'Moon Needle', 'Ancient Marker', 'Rune Stone',
    'Shadow Pillar', 'Thunder Stone', 'Wind Pillar', 'Frost Needle', 'Dawn Stone'],
  tomb: ['Barrow', 'Crypt', 'Catacomb', 'King Tomb', 'Old Sepulcher',
    'Bone Vault', 'Death Hall', 'Shadow Crypt', 'Lost Tomb', 'Sealed Vault'],
  pyramid: ['Great Pyramid', 'Sand Tomb', 'Sun Temple', 'Desert Monument', 'Ziggurat',
    'Stone Pyramid', 'Lost Ziggurat', 'Pharaoh Tomb', 'Step Pyramid', 'Sand Spire'],
  dead_forest: ['Blightwood', 'Ashgrove', 'Withered Stand', 'Deadwood', 'Bone Forest',
    'Charred Copse', 'Ghost Trees', 'Petrified Grove', 'Hollow Wood', 'Blight'],
  great_tree: ['World Tree', 'Elder Oak', 'Ancient Elm', 'Sky Tree', 'Heart Tree',
    'Great Willow', 'Mother Tree', 'Crown Oak', 'Titan Tree', 'Spirit Maple'],
  fairy_ring: ['Fairy Circle', 'Fey Ring', 'Pixie Circle', 'Enchanted Ring', 'Sprite Glade',
    'Twilight Ring', 'Mushroom Circle', 'Glamour Ring', 'Moon Ring', 'Wild Ring'],
  giant_skeleton: ['Titan Bones', 'Giant Remains', 'Colossus Bones', 'Fallen Giant', 'Old Bones',
    'Leviathan Rest', 'Behemoth Grave', 'Primeval Bones', 'Dragon Bones', 'Elder Remains'],
  meteor_crater: ['Star Fall', 'Sky Stone', 'Crater', 'Impact Site', 'Heaven Stone',
    'Fallen Star', 'Thunder Scar', 'Celestial Mark', 'Star Wound', 'Sky Scar'],
  pit: ['Dark Pit', 'Sinkhole', 'Chasm', 'Bottomless Pit', 'Abyss',
    'Hell Mouth', 'Deep Rift', 'Shadow Pit', 'Void Hole', 'Maw'],
  battlefield: ['Old Battlefield', 'War Field', 'Fallen Ground', 'Battle Plain', 'Bone Field',
    'Slaughter Ground', 'Last Stand', 'War Graves', 'Blood Field', 'Sword Field'],
  log_fort: ['Stockade', 'Timber Fort', 'Palisade', 'Log Keep', 'Wood Fort',
    'Border Post', 'Frontier Fort', 'Lumber Fort', 'Wooden Wall', 'Trapper Fort'],
  colossus: ['Broken Colossus', 'Fallen Idol', 'Shattered Titan', 'Ruined Statue', 'Stone Giant',
    'Toppled Sentinel', 'Old Guardian', 'Crumbling Effigy', 'Ancient Idol', 'Lost Colossus'],
  lighthouse: ['Old Lighthouse', 'Beacon Tower', 'Storm Light', 'Harbor Light', 'Sea Beacon',
    'Cliff Light', 'Watch Light', 'Lantern Tower', 'Coast Beacon', 'Signal Light'],
  harbor: ['Sheltered Harbor', 'Old Wharf', 'Fishing Harbor', 'Trade Harbor', 'Deep Anchorage',
    'Safe Harbor', 'Stone Quay', 'Sailor Rest', 'Anchor Bay', 'Ship Haven'],
  docks: ['Old Docks', 'Fishing Pier', 'Trade Wharf', 'Landing Stage', 'Stone Dock',
    'Timber Pier', 'River Dock', 'Boat Landing', 'Cargo Wharf', 'Ferry Landing'],
  inn: ['Wayfarers Inn', 'Traveler Rest', 'Roadside Inn', 'Warm Hearth', 'Pilgrim Lodge',
    'Crossroads Inn', 'Old Hostel', 'Wanderers Rest', 'Half Moon Inn', 'Golden Stag'],
  tavern: ['Rusty Tankard', 'Old Barrel', 'Thirsty Crow', 'Flagstone Alehouse', 'Iron Mug',
    'Broken Wheel', 'Copper Flagon', 'Stumbling Bear', 'Drowned Rat', 'Lucky Horse'],
  temple: ['Grand Temple', 'Stone Temple', 'Sun Temple', 'Moon Sanctuary', 'Old Cathedral',
    'High Altar', 'Sacred Hall', 'Pilgrim Temple', 'Dawn Temple', 'Star Sanctum'],
  fountain: ['Enchanted Fountain', 'Ancient Spring', 'Stone Fountain', 'Healing Waters', 'Old Well Spring',
    'Sacred Font', 'Crystal Spring', 'Moon Pool', 'Blessed Fountain', 'Wishing Well'],
  well: ['Deep Well', 'Stone Well', 'Old Cistern', 'Village Well', 'Sacred Well',
    'Wishing Well', 'Ancient Well', 'Iron Well', 'Spring Well', 'Desert Well'],
  windmill: ['Old Windmill', 'Stone Mill', 'Grain Mill', 'Hilltop Mill', 'Broken Windmill',
    'Flour Mill', 'Tower Mill', 'Wind Tower', 'Creaking Mill', 'Miller House'],
  evil_altar: ['Blood Altar', 'Dark Shrine', 'Profane Altar', 'Demon Altar', 'Cursed Stone',
    'Shadow Altar', 'Sacrificial Slab', 'Unholy Shrine', 'Fell Altar', 'Bone Altar'],
  totem: ['Skull Totem', 'War Totem', 'Spirit Pole', 'Bone Marker', 'Tribal Totem',
    'Death Totem', 'Ancestor Pole', 'Beast Totem', 'Shaman Post', 'Warning Totem'],
  tar_pit: ['Tar Pit', 'Bubbling Tar', 'Black Pool', 'Pitch Bog', 'Sticky Mire',
    'Dark Seep', 'Boiling Tar', 'Asphalt Pool', 'Fossil Pit', 'Tar Lake'],
  chasm: ['Great Chasm', 'Deep Rift', 'Abyss', 'Yawning Chasm', 'Shadow Rift',
    'Sundered Earth', 'Dark Crevasse', 'World Crack', 'Broken Ground', 'Void Chasm'],
};

function generateName(rng, usedNames = null) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const name = rng.pick(NAME_PREFIXES) + rng.pick(TOWN_SUFFIXES);
    if (!usedNames || !usedNames.has(name)) {
      if (usedNames) usedNames.add(name);
      return name;
    }
  }
  // Fallback with double prefix
  const name = rng.pick(NAME_PREFIXES) + rng.pick(NAME_PREFIXES).toLowerCase() + rng.pick(TOWN_SUFFIXES);
  if (usedNames) usedNames.add(name);
  return name;
}

function generatePOIName(rng, type, usedNames = null) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const prefix = rng.pick(NAME_PREFIXES);
    const specific = rng.pick(POI_NAMES[type] || POI_NAMES.ruins);
    const name = rng.chance(0.5) ? `${prefix} ${specific}` : specific;
    if (!usedNames || !usedNames.has(name)) {
      if (usedNames) usedNames.add(name);
      return name;
    }
  }
  // Fallback: use fantasy word prefix
  const word = generateFantasyWord(rng);
  const specific = rng.pick(POI_NAMES[type] || POI_NAMES.ruins);
  const name = `${word} ${specific}`;
  if (usedNames) usedNames.add(name);
  return name;
}

// --- Fantasy Name Generator for geographic features ---
const GEO_SYLLABLES = {
  onset: ['', 'b', 'br', 'c', 'd', 'dr', 'f', 'g', 'gl', 'gr', 'h', 'k',
    'l', 'm', 'n', 'p', 'r', 's', 'sh', 'st', 't', 'th', 'v', 'w', 'z'],
  nucleus: ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ou', 'ai', 'ia', 'ea'],
  coda: ['', '', '', 'n', 'r', 'l', 's', 'th', 'nd', 'rn', 'rd'],
};

const REGION_SUFFIXES = ['Land', 'Mark', 'Realm', 'Reach', 'Hold', 'March', 'Shire', 'Vale',
  'Wilds', 'Wastes', 'Frontier', 'Dominion'];
const MOUNTAIN_SUFFIXES = ['Peaks', 'Mountains', 'Range', 'Heights', 'Spine', 'Teeth', 'Crags',
  'Ridges', 'Wall', 'Horns'];
const OCEAN_SUFFIXES_LARGE = ['Ocean', 'Abyss', 'Deep', 'Expanse'];
const OCEAN_SUFFIXES_MED = ['Sea', 'Waters', 'Gulf', 'Bight'];
const OCEAN_SUFFIXES_SMALL = ['Bay', 'Strait', 'Channel', 'Inlet', 'Cove'];
const LAKE_SUFFIXES_LARGE = ['Lake', 'Loch', 'Lagoon'];
const LAKE_SUFFIXES_SMALL = ['Mere', 'Pool', 'Tarn', 'Pond'];
const RIVER_SUFFIXES_LARGE = ['River', 'Waters', 'Flow'];
const RIVER_SUFFIXES_SMALL = ['Creek', 'Run', 'Stream', 'Brook', 'Rill'];
const FOREST_SUFFIXES_LARGE = ['Forest', 'Greenwood', 'Timberland', 'Weald'];
const FOREST_SUFFIXES_SMALL = ['Wood', 'Thicket', 'Grove', 'Copse'];
const MOUNTAIN_SUFFIXES_LARGE = ['Mountains', 'Range', 'Spine', 'Massif'];
const MOUNTAIN_SUFFIXES_SMALL = ['Peaks', 'Heights', 'Crags', 'Ridges', 'Horns', 'Teeth', 'Wall'];
const DESERT_SUFFIXES_LARGE = ['Wastes', 'Expanse', 'Desolation'];
const DESERT_SUFFIXES_SMALL = ['Sands', 'Barrens', 'Dunes'];
const SWAMP_SUFFIXES_LARGE = ['Swamp', 'Wetlands', 'Marshes'];
const SWAMP_SUFFIXES_SMALL = ['Marsh', 'Bog', 'Fen', 'Mire'];
const TUNDRA_SUFFIXES_LARGE = ['Waste', 'Expanse', 'Barrens'];
const TUNDRA_SUFFIXES_SMALL = ['Reach', 'Frost', 'Fields'];
const COAST_SUFFIXES = ['Coast', 'Shore', 'Cape', 'Point', 'Headland'];

function generateFantasyWord(rng, syllableCount = 0) {
  if (syllableCount === 0) syllableCount = rng.int(2, 3);
  let word = '';
  for (let i = 0; i < syllableCount; i++) {
    word += rng.pick(GEO_SYLLABLES.onset);
    word += rng.pick(GEO_SYLLABLES.nucleus);
    if (i === syllableCount - 1 || rng.chance(0.4)) {
      word += rng.pick(GEO_SYLLABLES.coda);
    }
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generateGeoName(rng, suffixes, usedNames = null) {
  // Retry up to 10 times to avoid duplicate names
  for (let attempt = 0; attempt < 10; attempt++) {
    let name;
    if (rng.chance(0.4)) {
      const adj = rng.pick(NAME_PREFIXES);
      const suffix = rng.pick(suffixes);
      name = `The ${adj} ${suffix}`;
    } else {
      const word = generateFantasyWord(rng);
      const suffix = rng.pick(suffixes);
      name = `${word} ${suffix}`;
    }
    if (!usedNames || !usedNames.has(name)) {
      if (usedNames) usedNames.add(name);
      return name;
    }
  }
  // Fallback: force a unique name with extra syllable
  const word = generateFantasyWord(rng, 3);
  const suffix = rng.pick(suffixes);
  const name = `${word} ${suffix}`;
  if (usedNames) usedNames.add(name);
  return name;
}

/**
 * Detect geographic features and assign names
 */
function detectGeographicFeatures(hexMap, rng, cols, rows, rivers, settlements, usedNames = null) {
  const features = {
    regions: [],      // Large terrain areas
    mountainRanges: [],
    waterBodies: [],  // Oceans/seas
    lakes: [],
    rivers: [],
    forests: [],
    coasts: [],
    islands: [],
    deserts: [],
    swamps: [],
    tundras: [],
  };

  // Use provided usedNames or create a local one
  if (!usedNames) usedNames = new Set();

  // --- Detect regions via flood-fill of similar terrain categories ---
  const regionVisited = new Set();
  const terrainCategory = (t) => {
    if (isWater(t)) return 'water';
    if (t === TERRAIN.MOUNTAIN || t === TERRAIN.HIGH_MOUNTAIN) return 'mountain';
    if (t === TERRAIN.FOREST || t === TERRAIN.DENSE_FOREST) return 'forest';
    if (t === TERRAIN.HILLS) return 'hills';
    if (t === TERRAIN.SWAMP) return 'swamp';
    if (t === TERRAIN.DESERT) return 'desert';
    if (t === TERRAIN.TUNDRA) return 'tundra';
    return 'land'; // plains, grassland, beach
  };

  function floodFill(startKey, category) {
    const group = [];
    const queue = [startKey];
    regionVisited.add(startKey);
    while (queue.length > 0) {
      const key = queue.shift();
      const hex = hexMap.get(key);
      if (!hex) continue;
      group.push(hex);
      for (const n of hexNeighbors(hex.q, hex.r)) {
        const nk = hexKey(n.q, n.r);
        if (regionVisited.has(nk)) continue;
        const nh = hexMap.get(nk);
        if (!nh) continue;
        if (terrainCategory(nh.terrain) === category) {
          regionVisited.add(nk);
          queue.push(nk);
        }
      }
    }
    return group;
  }

  // Flood fill all hexes
  for (const [key, hex] of hexMap) {
    if (regionVisited.has(key)) continue;
    const cat = terrainCategory(hex.terrain);
    const group = floodFill(key, cat);

    // Compute centroid
    let cx = 0, cy = 0;
    for (const h of group) { cx += h.col; cy += h.row; }
    cx /= group.length;
    cy /= group.length;
    // Find hex closest to centroid for label placement
    let best = group[0];
    let bestDist = Infinity;
    for (const h of group) {
      const d = (h.col - cx) ** 2 + (h.row - cy) ** 2;
      if (d < bestDist) { bestDist = d; best = h; }
    }

    const feature = {
      hexes: group,
      size: group.length,
      centerQ: best.q,
      centerR: best.r,
      category: cat,
    };

    // Minimum sizes for naming — use size-appropriate suffixes
    if (cat === 'water' && group.length >= 4) {
      const touchesEdge = group.some(h => h.col <= 0 || h.col >= cols - 1 || h.row <= 0 || h.row >= rows - 1);
      if (touchesEdge) {
        const suffixes = group.length >= 50 ? OCEAN_SUFFIXES_LARGE :
                         group.length >= 20 ? OCEAN_SUFFIXES_MED : OCEAN_SUFFIXES_SMALL;
        feature.name = generateGeoName(rng, suffixes, usedNames);
        features.waterBodies.push(feature);
      } else if (group.some(h => h.terrain === TERRAIN.LAKE) || !touchesEdge) {
        const suffixes = group.length >= 8 ? LAKE_SUFFIXES_LARGE : LAKE_SUFFIXES_SMALL;
        feature.name = generateGeoName(rng, suffixes, usedNames);
        features.lakes.push(feature);
      }
    } else if (cat === 'mountain' && group.length >= 3) {
      const suffixes = group.length >= 10 ? MOUNTAIN_SUFFIXES_LARGE : MOUNTAIN_SUFFIXES_SMALL;
      feature.name = generateGeoName(rng, suffixes, usedNames);
      features.mountainRanges.push(feature);
    } else if (cat === 'forest' && group.length >= 4) {
      const suffixes = group.length >= 12 ? FOREST_SUFFIXES_LARGE : FOREST_SUFFIXES_SMALL;
      feature.name = generateGeoName(rng, suffixes, usedNames);
      features.forests.push(feature);
    } else if (cat === 'desert' && group.length >= 3) {
      const suffixes = group.length >= 10 ? DESERT_SUFFIXES_LARGE : DESERT_SUFFIXES_SMALL;
      feature.name = generateGeoName(rng, suffixes, usedNames);
      features.deserts.push(feature);
    } else if (cat === 'swamp' && group.length >= 3) {
      const suffixes = group.length >= 8 ? SWAMP_SUFFIXES_LARGE : SWAMP_SUFFIXES_SMALL;
      feature.name = generateGeoName(rng, suffixes, usedNames);
      features.swamps.push(feature);
    } else if (cat === 'tundra' && group.length >= 4) {
      const suffixes = group.length >= 10 ? TUNDRA_SUFFIXES_LARGE : TUNDRA_SUFFIXES_SMALL;
      feature.name = generateGeoName(rng, suffixes, usedNames);
      features.tundras.push(feature);
    } else if (cat === 'land' && group.length >= 15) {
      feature.name = generateGeoName(rng, REGION_SUFFIXES, usedNames);
      features.regions.push(feature);
    }
  }

  // --- Name rivers (only those long enough to be clearly visible) ---
  for (const river of rivers) {
    if (river.length >= 5) {
      const midIdx = Math.floor(river.length / 2);
      const suffixes = river.length >= 8 ? RIVER_SUFFIXES_LARGE : RIVER_SUFFIXES_SMALL;
      features.rivers.push({
        name: generateGeoName(rng, suffixes, usedNames),
        path: river,
        centerQ: river[midIdx].q,
        centerR: river[midIdx].r,
        size: river.length,
      });
    }
  }

  // --- Detect islands (small land groups surrounded by water) ---
  const landVisited = new Set();
  const landGroups = [];
  for (const [key, hex] of hexMap) {
    if (landVisited.has(key) || isWater(hex.terrain)) continue;
    const group = [];
    const queue = [key];
    landVisited.add(key);
    while (queue.length > 0) {
      const k = queue.shift();
      const h = hexMap.get(k);
      if (!h) continue;
      group.push(h);
      for (const n of hexNeighbors(h.q, h.r)) {
        const nk = hexKey(n.q, n.r);
        if (landVisited.has(nk)) continue;
        const nh = hexMap.get(nk);
        if (!nh || isWater(nh.terrain)) continue;
        landVisited.add(nk);
        queue.push(nk);
      }
    }
    landGroups.push(group);
  }

  // Sort by size; the largest is the mainland, smaller ones are islands
  landGroups.sort((a, b) => b.length - a.length);
  for (let i = 1; i < landGroups.length; i++) {
    const group = landGroups[i];
    if (group.length < 1) continue;
    let cx = 0, cy = 0;
    for (const h of group) { cx += h.col; cy += h.row; }
    cx /= group.length; cy /= group.length;
    let best = group[0], bestDist = Infinity;
    for (const h of group) {
      const d = (h.col - cx) ** 2 + (h.row - cy) ** 2;
      if (d < bestDist) { bestDist = d; best = h; }
    }
    // Find a water hex adjacent to the island for label placement
    let labelQ = best.q, labelR = best.r;
    for (const h of group) {
      for (const n of hexNeighbors(h.q, h.r)) {
        const nh = hexMap.get(hexKey(n.q, n.r));
        if (nh && isWater(nh.terrain)) {
          labelQ = n.q;
          labelR = n.r;
          break;
        }
      }
      if (labelQ !== best.q || labelR !== best.r) break;
    }

    const suffixes = group.length >= 4 ? ['Island', 'Isle', 'Haven'] : ['Rock', 'Key', 'Islet'];
    features.islands.push({
      name: generateGeoName(rng, suffixes, usedNames),
      size: group.length,
      centerQ: best.q,
      centerR: best.r,
    });
  }

  // --- Detect named coastlines (long stretches of coast hexes) ---
  const coastHexes = [...hexMap.values()].filter(h => h.isCoast);
  if (coastHexes.length >= 8) {
    // Cluster coast hexes into named sections (simple: divide by quadrant)
    const quadrants = [[], [], [], []];
    for (const h of coastHexes) {
      const qx = h.col < cols / 2 ? 0 : 1;
      const qy = h.row < rows / 2 ? 0 : 1;
      quadrants[qy * 2 + qx].push(h);
    }
    for (const quad of quadrants) {
      if (quad.length >= 5) {
        let cx = 0, cy = 0;
        for (const h of quad) { cx += h.col; cy += h.row; }
        cx /= quad.length; cy /= quad.length;
        let best = quad[0], bestDist = Infinity;
        for (const h of quad) {
          const d = (h.col - cx) ** 2 + (h.row - cy) ** 2;
          if (d < bestDist) { bestDist = d; best = h; }
        }
        features.coasts.push({
          name: generateGeoName(rng, COAST_SUFFIXES, usedNames),
          size: quad.length,
          centerQ: best.q,
          centerR: best.r,
        });
      }
    }
  }

  // --- Stamp feature/region names onto each hex for tooltip display ---
  const allFeatureLists = [
    ['waterBodies', 'Water'], ['lakes', 'Lake'], ['mountainRanges', 'Mountains'],
    ['forests', 'Forest'], ['deserts', 'Desert'], ['swamps', 'Swamp'],
    ['tundras', 'Tundra'], ['islands', 'Island'], ['regions', 'Region'],
  ];
  for (const [listKey, typeLabel] of allFeatureLists) {
    for (const feat of features[listKey]) {
      if (!feat.name || !feat.hexes) continue;
      for (const h of feat.hexes) {
        const hex = hexMap.get(hexKey(h.q, h.r));
        if (hex) {
          if (!hex.featureNames) hex.featureNames = [];
          hex.featureNames.push(feat.name);
        }
      }
    }
  }
  // Rivers — stamp river name onto path hexes
  for (const rv of features.rivers) {
    if (!rv.name || !rv.path) continue;
    for (const h of rv.path) {
      const hex = hexMap.get(hexKey(h.q, h.r));
      if (hex) {
        if (!hex.featureNames) hex.featureNames = [];
        if (!hex.featureNames.includes(rv.name)) hex.featureNames.push(rv.name);
      }
    }
  }

  return features;
}

/**
 * Generate the complete world data
 */
export function generateWorld(options = {}) {
  const {
    seed = Date.now(),
    cols = 16,
    rows = 12,
    hexSize = 50,
    waterRatio = 0.25,
    mountainRatio = 0.12,
    forestDensity = 0.35,
    swampDensity = 0.08,
    numCities = 2,
    numTowns = 4,
    numVillages = 3,
    numPOIs = 8,
    numRivers = 3,
  } = options;

  const rng = new SeededRandom(seed);
  const elevNoise = new SimplexNoise(new SeededRandom(seed + 1));
  const moistNoise = new SimplexNoise(new SeededRandom(seed + 2));
  const detailNoise = new SimplexNoise(new SeededRandom(seed + 3));

  // 1. Create hex grid
  const gridHexes = hexRectGrid(cols, rows);
  const hexMap = new Map();

  for (const { q, r, col, row } of gridHexes) {
    hexMap.set(hexKey(q, r), {
      q, r, col, row,
      elevation: 0,
      moisture: 0,
      terrain: TERRAIN.PLAINS,
      settlement: null,
      poi: null,
      river: false,
      riverEdges: [],
      roads: [],
      roadEdges: [],
      edges: {},
    });
  }

  // 2. Generate elevation
  const elevScale = 0.08;
  const moistScale = 0.1;

  for (const [key, hex] of hexMap) {
    const nx = hex.col * elevScale;
    const ny = hex.row * elevScale;

    // Multi-octave elevation
    let elev = elevNoise.fractal(nx, ny, 4, 2, 0.5);
    // Add detail
    elev += 0.2 * detailNoise.noise2D(nx * 3, ny * 3);

    // Edge falloff - strong push toward water at edges
    const cx = hex.col / (cols - 1) * 2 - 1;
    const cy = hex.row / (rows - 1) * 2 - 1;
    const edgeDist = 1 - Math.max(Math.abs(cx), Math.abs(cy));
    const falloff = Math.pow(Math.max(0, edgeDist), 0.8);
    elev = elev * 0.6 + falloff * 0.7 - 0.2;

    // Mountain ridge near coast transition (natural border)
    if (edgeDist > 0.15 && edgeDist < 0.35) {
      const ridgeFactor = 1 - Math.abs(edgeDist - 0.25) / 0.1;
      elev += ridgeFactor * 0.15 * (0.5 + 0.5 * detailNoise.noise2D(nx * 2, ny * 2));
    }

    // Normalize to [0, 1]
    hex.elevation = Math.max(0, Math.min(1, (elev + 1) / 2));

    // Moisture
    const mx = hex.col * moistScale + 100;
    const my = hex.row * moistScale + 100;
    hex.moisture = (moistNoise.fractal(mx, my, 3, 2, 0.5) + 1) / 2;
  }

  // 3. Determine water threshold for desired water ratio
  const elevations = [...hexMap.values()].map(h => h.elevation).sort((a, b) => a - b);
  const waterThreshold = elevations[Math.floor(elevations.length * waterRatio)] || 0.35;
  const mountainThreshold = elevations[Math.floor(elevations.length * (1 - mountainRatio))] || 0.75;
  const hillThreshold = mountainThreshold - 0.08;

  // 4. Assign terrain types
  for (const [key, hex] of hexMap) {
    // Force map edges to impassable terrain (water, mountains, or tundra)
    const isEdge = hex.col <= 0 || hex.col >= cols - 1 || hex.row <= 0 || hex.row >= rows - 1;
    if (isEdge) {
      if (hex.elevation >= mountainThreshold) {
        hex.terrain = hex.elevation >= mountainThreshold + 0.06 ? TERRAIN.HIGH_MOUNTAIN : TERRAIN.MOUNTAIN;
      } else if (hex.row <= 0 || hex.row >= rows - 1) {
        // North/south edges: tundra or water
        hex.terrain = hex.elevation >= waterThreshold ? TERRAIN.TUNDRA : (hex.elevation < waterThreshold * 0.6 ? TERRAIN.DEEP_WATER : TERRAIN.WATER);
      } else {
        hex.terrain = hex.elevation < waterThreshold * 0.6 ? TERRAIN.DEEP_WATER : TERRAIN.WATER;
      }
      continue;
    }

    if (hex.elevation < waterThreshold * 0.6) {
      hex.terrain = TERRAIN.DEEP_WATER;
    } else if (hex.elevation < waterThreshold) {
      hex.terrain = TERRAIN.WATER;
    } else if (hex.elevation < waterThreshold + 0.04) {
      const neighbors = hexNeighbors(hex.q, hex.r);
      const hasWaterNeighbor = neighbors.some(n => {
        const nh = hexMap.get(hexKey(n.q, n.r));
        return nh && nh.elevation < waterThreshold;
      });
      hex.terrain = hasWaterNeighbor ? TERRAIN.BEACH : TERRAIN.PLAINS;
    } else if (hex.elevation >= mountainThreshold + 0.06) {
      hex.terrain = TERRAIN.HIGH_MOUNTAIN;
    } else if (hex.elevation >= mountainThreshold) {
      hex.terrain = TERRAIN.MOUNTAIN;
    } else if (hex.elevation >= hillThreshold) {
      hex.terrain = TERRAIN.HILLS;
    } else if (hex.moisture > 0.7 && hex.elevation < waterThreshold + 0.12) {
      hex.terrain = TERRAIN.SWAMP;
    } else if (hex.row <= 2 || hex.row >= rows - 3) {
      // Far north/south = tundra
      hex.terrain = TERRAIN.TUNDRA;
    } else if (hex.moisture < 0.2 && hex.elevation < hillThreshold - 0.05) {
      // Low moisture = desert
      hex.terrain = TERRAIN.DESERT;
    } else if (hex.moisture > 0.55) {
      hex.terrain = hex.moisture > 0.72 ? TERRAIN.DENSE_FOREST : TERRAIN.FOREST;
    } else if (hex.moisture > 0.35) {
      hex.terrain = TERRAIN.GRASSLAND;
    } else {
      hex.terrain = TERRAIN.PLAINS;
    }
  }

  // 4a. Break up large mountain blobs — create passes and valleys
  // Run multiple passes to ensure clusters get properly fragmented
  for (let pass = 0; pass < 3; pass++) {
    const mtnVisited = new Set();
    for (const [key, hex] of hexMap) {
      if (mtnVisited.has(key)) continue;
      if (hex.terrain !== TERRAIN.MOUNTAIN && hex.terrain !== TERRAIN.HIGH_MOUNTAIN) continue;
      const group = [];
      const queue = [key];
      mtnVisited.add(key);
      while (queue.length > 0) {
        const k = queue.shift();
        const h = hexMap.get(k);
        if (!h) continue;
        group.push(h);
        for (const n of hexNeighbors(h.q, h.r)) {
          const nk = hexKey(n.q, n.r);
          if (mtnVisited.has(nk)) continue;
          const nh = hexMap.get(nk);
          if (!nh) continue;
          if (nh.terrain === TERRAIN.MOUNTAIN || nh.terrain === TERRAIN.HIGH_MOUNTAIN) {
            mtnVisited.add(nk);
            queue.push(nk);
          }
        }
      }
      // Target max cluster size of ~12 hexes (a reasonable range segment)
      const maxSize = 12;
      if (group.length > maxSize) {
        // Sort by elevation — convert lowest mountains to hills first
        const sorted = [...group].sort((a, b) => a.elevation - b.elevation);
        // Remove enough to get close to maxSize, but at least 30%
        const removeCount = Math.max(
          Math.floor(group.length * 0.3),
          group.length - maxSize
        );
        let removed = 0;
        for (let i = 0; i < sorted.length && removed < removeCount; i++) {
          const h = sorted[i];
          // Skip edge hexes — keep map borders impassable
          if (h.col <= 0 || h.col >= cols - 1 || h.row <= 0 || h.row >= rows - 1) continue;
          h.terrain = TERRAIN.HILLS;
          removed++;
        }
      }
    }
  }

  // Mark coast hexes (land adjacent to water)
  for (const [key, hex] of hexMap) {
    if (isWater(hex.terrain)) continue;
    const neighbors = hexNeighbors(hex.q, hex.r);
    const hasWaterNeighbor = neighbors.some(n => {
      const nh = hexMap.get(hexKey(n.q, n.r));
      return nh && isWater(nh.terrain);
    });
    if (hasWaterNeighbor) {
      hex.isCoast = true;
    }
  }

  // 4b. Generate lakes (inland water bodies)
  generateLakes(hexMap, rng, detailNoise, cols, rows);

  // 4c. Generate islands in ocean areas
  generateIslands(hexMap, rng, detailNoise, waterThreshold, cols, rows);

  // Refresh coast markers after lakes and islands
  for (const [key, hex] of hexMap) {
    hex.isCoast = false;
    if (isWater(hex.terrain)) continue;
    const neighbors = hexNeighbors(hex.q, hex.r);
    const hasWaterNeighbor = neighbors.some(n => {
      const nh = hexMap.get(hexKey(n.q, n.r));
      return nh && isWater(nh.terrain);
    });
    if (hasWaterNeighbor) {
      hex.isCoast = true;
    }
  }

  // 5. Generate rivers
  const rivers = generateRivers(hexMap, rng, numRivers, waterThreshold, cols, rows);

  // Shared name dedup set across all naming
  const usedNames = new Set();

  // 6. Place settlements
  const settlements = placeSettlements(hexMap, rng, {
    numCities, numTowns, numVillages, cols, rows,
  }, usedNames);

  // 7. Generate roads
  const roads = generateRoads(hexMap, rng, settlements);

  // 8. Place POIs
  const pois = placePOIs(hexMap, rng, numPOIs, settlements, usedNames);

  // 9. Generate additional paths to some POIs
  generatePOIPaths(hexMap, rng, pois, settlements);

  // 9b. Place POIs on islands
  placeIslandPOIs(hexMap, rng, pois, settlements, cols, rows, usedNames);

  // 9c. Place hidden valley POIs
  placeHiddenValleyPOIs(hexMap, rng, pois, settlements, usedNames);

  // 10. Assign edge passability
  assignEdgePassability(hexMap);

  // 11. Detect and name geographic features
  const geoFeatures = detectGeographicFeatures(hexMap, rng, cols, rows, rivers, settlements, usedNames);

  // 12. Calculate hunting and fishing quality for each hex
  calculateForaging(hexMap);

  return {
    seed,
    cols,
    rows,
    hexSize,
    hexMap,
    rivers,
    settlements,
    roads,
    pois,
    geoFeatures,
  };
}

function isWater(terrain) {
  return terrain === TERRAIN.WATER || terrain === TERRAIN.DEEP_WATER || terrain === TERRAIN.LAKE;
}

function isLand(terrain) {
  return !isWater(terrain);
}

function isPassableLand(terrain) {
  return isLand(terrain) && terrain !== TERRAIN.HIGH_MOUNTAIN;
}

/**
 * Calculate hunting and fishing quality for each hex.
 * Ratings: 'excellent', 'good', 'fair', 'poor', 'none'
 */
function calculateForaging(hexMap) {
  // Check if any neighbor is water
  const hasAdjacentWater = (hex) => {
    for (const n of hexNeighbors(hex.q, hex.r)) {
      const nh = hexMap.get(hexKey(n.q, n.r));
      if (nh && isWater(nh.terrain)) return true;
    }
    return false;
  };

  for (const [, hex] of hexMap) {
    const t = hex.terrain;
    const hasRiver = hex.river;
    const nearWater = hasAdjacentWater(hex);

    // --- Hunting ---
    let hunting = 'none';
    switch (t) {
      case TERRAIN.FOREST:
      case TERRAIN.DENSE_FOREST:
        hunting = hasRiver ? 'excellent' : 'good';
        break;
      case TERRAIN.SWAMP:
        hunting = 'fair'; // some game but dangerous
        break;
      case TERRAIN.PLAINS:
      case TERRAIN.GRASSLAND:
        hunting = hasRiver ? 'good' : 'fair';
        break;
      case TERRAIN.HILLS:
        hunting = 'fair';
        break;
      case TERRAIN.BEACH:
        hunting = hasRiver || nearWater ? 'fair' : 'poor';
        break;
      case TERRAIN.MOUNTAIN:
        hunting = 'poor'; // mountain goats, sparse
        break;
      case TERRAIN.DESERT:
        hunting = 'poor';
        break;
      case TERRAIN.TUNDRA:
        hunting = hasRiver ? 'fair' : 'poor';
        break;
      case TERRAIN.HIGH_MOUNTAIN:
      case TERRAIN.WATER:
      case TERRAIN.DEEP_WATER:
      case TERRAIN.LAKE:
      case TERRAIN.COAST:
        hunting = 'none';
        break;
    }

    // --- Fishing ---
    let fishing = 'none';
    if (isWater(t) || t === TERRAIN.COAST) {
      // On water hexes: good to excellent depending on type
      fishing = t === TERRAIN.COAST ? 'excellent'
              : t === TERRAIN.LAKE ? 'excellent'
              : t === TERRAIN.WATER ? 'good'
              : 'fair'; // deep water — harder to fish
    } else if (hasRiver) {
      // River fishing
      switch (t) {
        case TERRAIN.FOREST:
        case TERRAIN.DENSE_FOREST:
          fishing = 'excellent'; // shaded streams teeming with fish
          break;
        case TERRAIN.SWAMP:
          fishing = 'excellent'; // marshes full of fish
          break;
        case TERRAIN.PLAINS:
        case TERRAIN.GRASSLAND:
          fishing = 'good';
          break;
        case TERRAIN.HILLS:
          fishing = 'good'; // mountain streams
          break;
        case TERRAIN.MOUNTAIN:
          fishing = 'fair'; // cold mountain streams
          break;
        default:
          fishing = 'fair';
      }
    } else if (nearWater) {
      // Adjacent to water — can fish from shore
      fishing = 'good';
    } else if (t === TERRAIN.SWAMP) {
      fishing = 'good'; // swamps have standing water with fish
    }

    hex.hunting = hunting;
    hex.fishing = fishing;
  }
}

/**
 * Generate inland lakes
 */
function generateLakes(hexMap, rng, noise, cols, rows) {
  const numLakes = Math.max(1, Math.floor(cols * rows / 80));
  const landHexes = [...hexMap.values()].filter(h =>
    isLand(h.terrain) && h.terrain !== TERRAIN.MOUNTAIN &&
    h.terrain !== TERRAIN.HIGH_MOUNTAIN && h.terrain !== TERRAIN.BEACH
  );

  for (let i = 0; i < numLakes; i++) {
    // Find a hex with relatively low elevation (valley) surrounded by land
    const candidates = landHexes.filter(h => {
      if (h.terrain === TERRAIN.LAKE) return false;
      if (h.isCoast) return false;
      // Must be away from map edges
      if (h.col < 2 || h.col > cols - 3 || h.row < 2 || h.row > rows - 3) return false;
      // Prefer lower elevation
      return h.elevation < 0.55 && h.moisture > 0.35;
    });

    if (candidates.length === 0) continue;
    const center = rng.pick(candidates);

    // Lake is 1-3 hexes
    center.terrain = TERRAIN.LAKE;
    const lakeSize = rng.int(1, 3);
    if (lakeSize >= 2) {
      const neighbors = hexNeighbors(center.q, center.r);
      rng.shuffle(neighbors);
      let added = 0;
      for (const n of neighbors) {
        if (added >= lakeSize - 1) break;
        const nh = hexMap.get(hexKey(n.q, n.r));
        if (nh && isLand(nh.terrain) && nh.terrain !== TERRAIN.MOUNTAIN && !nh.isCoast) {
          nh.terrain = TERRAIN.LAKE;
          added++;
        }
      }
    }
  }
}

/**
 * Generate small islands in ocean areas
 */
function generateIslands(hexMap, rng, noise, waterThreshold, cols, rows) {
  const numIslands = Math.max(1, Math.floor(cols * rows / 100));
  const waterHexes = [...hexMap.values()].filter(h =>
    (h.terrain === TERRAIN.WATER || h.terrain === TERRAIN.DEEP_WATER) &&
    h.col > 1 && h.col < cols - 2 && h.row > 1 && h.row < rows - 2
  );

  for (let i = 0; i < numIslands; i++) {
    // Find water hexes surrounded by water (deep ocean)
    const candidates = waterHexes.filter(h => {
      if (isLand(h.terrain)) return false;
      const neighbors = hexNeighbors(h.q, h.r);
      return neighbors.every(n => {
        const nh = hexMap.get(hexKey(n.q, n.r));
        return !nh || isWater(nh.terrain);
      });
    });

    if (candidates.length === 0) continue;
    const island = rng.pick(candidates);

    // Make it land
    island.terrain = rng.chance(0.6) ? TERRAIN.PLAINS : TERRAIN.HILLS;
    island.elevation = waterThreshold + rng.range(0.05, 0.15);
    island.isCoast = true;

    // Sometimes add 1-2 more hexes
    if (rng.chance(0.4)) {
      const neighbors = hexNeighbors(island.q, island.r);
      rng.shuffle(neighbors);
      const extra = rng.int(1, 2);
      let added = 0;
      for (const n of neighbors) {
        if (added >= extra) break;
        const nh = hexMap.get(hexKey(n.q, n.r));
        if (nh && isWater(nh.terrain)) {
          nh.terrain = rng.pick([TERRAIN.PLAINS, TERRAIN.FOREST, TERRAIN.BEACH]);
          nh.elevation = waterThreshold + rng.range(0.03, 0.1);
          nh.isCoast = true;
          added++;
        }
      }
    }
  }
}

/**
 * Generate rivers using flow-accumulation drainage network.
 * 1) Priority-flood to resolve pits and build cycle-free flow directions
 * 2) Accumulate flow weighted by moisture (precipitation proxy)
 * 3) Extract river paths from high-accumulation channels
 */
function generateRivers(hexMap, rng, numRivers, waterThreshold, cols, rows) {
  const allHexes = [...hexMap.values()];
  const landHexes = allHexes.filter(h => isLand(h.terrain));

  // --- Step 1: Priority-flood to fill depressions and assign flow directions ---
  // Each land hex gets a "filled" elevation >= its original, ensuring no interior pits.
  // Water hexes and map-edge hexes are natural outlets.
  const filledElev = new Map();   // hexKey -> filled elevation
  const flowDir = new Map();      // hexKey -> hexKey of downstream neighbor (or null for outlets)

  // Initialize: water hexes and edge hexes are outlets with their natural elevation
  // Priority queue: process from lowest filled elevation outward
  // Using a simple sorted array (fine for ~2500 hexes)
  const processed = new Set();
  const queue = []; // {key, elev}

  // Seed queue with outlets: water hexes and map-edge land hexes
  for (const hex of allHexes) {
    const key = hexKey(hex.q, hex.r);
    if (isWater(hex.terrain)) {
      filledElev.set(key, hex.elevation);
      flowDir.set(key, null);
      processed.add(key);
      queue.push({ key, elev: hex.elevation });
    } else if (hex.col <= 0 || hex.col >= cols - 1 || hex.row <= 0 || hex.row >= rows - 1) {
      filledElev.set(key, hex.elevation);
      flowDir.set(key, null);
      processed.add(key);
      queue.push({ key, elev: hex.elevation });
    }
  }

  // Sort queue ascending by elevation (process lowest first)
  queue.sort((a, b) => a.elev - b.elev);

  // Process: for each processed hex, check unprocessed neighbors.
  // If neighbor's real elevation >= current filled elevation, it can drain here naturally.
  // If neighbor's real elevation < current filled elevation, fill it up (pit filling).
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const curHex = hexMap.get(cur.key);
    if (!curHex) continue;

    const neighbors = hexNeighbors(curHex.q, curHex.r);
    for (const n of neighbors) {
      const nk = hexKey(n.q, n.r);
      if (processed.has(nk)) continue;
      const nh = hexMap.get(nk);
      if (!nh) continue;

      processed.add(nk);
      // Filled elevation: max of neighbor's actual elevation and current's filled elevation
      // This ensures water can always flow out (no interior pits)
      const fe = Math.max(nh.elevation, cur.elev + 0.0001);
      filledElev.set(nk, fe);
      flowDir.set(nk, cur.key); // this neighbor drains toward current hex

      // Insert into queue maintaining sort (simple insertion - good enough for <3000 items)
      let inserted = false;
      for (let j = qi; j < queue.length; j++) {
        if (fe <= queue[j].elev) {
          queue.splice(j, 0, { key: nk, elev: fe });
          inserted = true;
          break;
        }
      }
      if (!inserted) queue.push({ key: nk, elev: fe });
    }
  }

  // --- Step 2: Flow accumulation weighted by moisture ---
  const accumulation = new Map();
  for (const hex of allHexes) {
    accumulation.set(hexKey(hex.q, hex.r), 0);
  }

  // For each land hex, trace downstream and add its runoff contribution
  for (const hex of landHexes) {
    // Runoff weight: use moisture as a proxy for precipitation
    const runoff = 0.5 + hex.moisture * 0.5;
    let curKey = hexKey(hex.q, hex.r);
    const visited = new Set();

    while (curKey && !visited.has(curKey)) {
      visited.add(curKey);
      accumulation.set(curKey, (accumulation.get(curKey) || 0) + runoff);
      curKey = flowDir.get(curKey) || null;
    }
  }

  // --- Step 3: Determine threshold and extract river network ---
  // Collect accumulation values for land hexes only
  const landAccum = landHexes.map(h => accumulation.get(hexKey(h.q, h.r)) || 0);
  landAccum.sort((a, b) => a - b);

  // Use numRivers to control threshold: more rivers = lower percentile threshold
  // Base: top ~2% of accumulation forms rivers; numRivers scales this
  const basePct = 0.97;
  const scaledPct = Math.max(0.85, basePct - (numRivers - 5) * 0.012);
  const thresholdIdx = Math.floor(landAccum.length * scaledPct);
  const riverThreshold = landAccum[thresholdIdx] || 5;

  // Build set of river hex keys
  const riverHexKeys = new Set();
  for (const hex of landHexes) {
    const key = hexKey(hex.q, hex.r);
    if ((accumulation.get(key) || 0) >= riverThreshold) {
      riverHexKeys.add(key);
    }
  }

  // --- Step 4: Extract river paths by tracing from headwaters downstream ---
  // Headwaters: river hexes with no upstream river neighbor
  const headwaters = [];
  for (const key of riverHexKeys) {
    const hex = hexMap.get(key);
    if (!hex) continue;
    // Check if any neighbor flows INTO this hex and is also a river hex
    let hasUpstreamRiver = false;
    const neighbors = hexNeighbors(hex.q, hex.r);
    for (const n of neighbors) {
      const nk = hexKey(n.q, n.r);
      if (riverHexKeys.has(nk) && flowDir.get(nk) === key) {
        hasUpstreamRiver = true;
        break;
      }
    }
    if (!hasUpstreamRiver) {
      headwaters.push(key);
    }
  }

  // Trace each headwater downstream. Track which edges have been rendered
  // to avoid duplicating shared trunk segments.
  const rivers = [];
  const usedEdges = new Set(); // "key1-key2" edges already in a river path

  // Sort headwaters by accumulation (ascending) so major tributaries come later
  headwaters.sort((a, b) => (accumulation.get(a) || 0) - (accumulation.get(b) || 0));

  for (const startKey of headwaters) {
    const path = [];
    let curKey = startKey;
    const visited = new Set();

    while (curKey && !visited.has(curKey)) {
      visited.add(curKey);
      const hex = hexMap.get(curKey);
      if (!hex) break;

      path.push({ q: hex.q, r: hex.r, accumulation: accumulation.get(curKey) || 0 });

      // Stop if we hit water (include this water hex as terminal)
      if (isWater(hex.terrain)) break;

      const nextKey = flowDir.get(curKey);
      if (!nextKey) break;

      // Continue downstream even past the river threshold (to reach water)
      curKey = nextKey;
    }

    if (path.length < 3) continue;

    // Check this path has at least some new (non-duplicate) edges
    let hasNewEdge = false;
    for (let j = 0; j < path.length - 1; j++) {
      const k1 = hexKey(path[j].q, path[j].r);
      const k2 = hexKey(path[j + 1].q, path[j + 1].r);
      const edgeK = k1 < k2 ? `${k1}-${k2}` : `${k2}-${k1}`;
      if (!usedEdges.has(edgeK)) {
        hasNewEdge = true;
        break;
      }
    }
    if (!hasNewEdge) continue;

    // Mark edges as used
    for (let j = 0; j < path.length - 1; j++) {
      const k1 = hexKey(path[j].q, path[j].r);
      const k2 = hexKey(path[j + 1].q, path[j + 1].r);
      const edgeK = k1 < k2 ? `${k1}-${k2}` : `${k2}-${k1}`;
      usedEdges.add(edgeK);
    }

    rivers.push(path);
  }

  // --- Step 5: Commit river state to hexes ---
  for (const river of rivers) {
    for (const { q, r } of river) {
      const key = hexKey(q, r);
      const hexData = hexMap.get(key);
      if (hexData && isLand(hexData.terrain)) hexData.river = true;
    }
    // Mark river edges between consecutive hexes
    for (let j = 0; j < river.length - 1; j++) {
      const a = river[j];
      const b = river[j + 1];
      const hexA = hexMap.get(hexKey(a.q, a.r));
      const hexB = hexMap.get(hexKey(b.q, b.r));
      for (let e = 0; e < 6; e++) {
        const n = hexNeighbor(a.q, a.r, e);
        if (n.q === b.q && n.r === b.r) {
          if (hexA && !hexA.riverEdges.includes(e)) hexA.riverEdges.push(e);
          const opp = oppositeEdge(e);
          if (hexB && !hexB.riverEdges.includes(opp)) hexB.riverEdges.push(opp);
          break;
        }
      }
    }
  }

  // Increase moisture near rivers, scaled by stream size
  for (const [key, hex] of hexMap) {
    if (hex.river) {
      const acc = accumulation.get(key) || 0;
      const boost = Math.min(0.3, 0.1 + (acc / (riverThreshold * 3)) * 0.15);
      hex.moisture = Math.min(1, hex.moisture + boost);
      const neighbors = hexNeighbors(hex.q, hex.r);
      for (const n of neighbors) {
        const nh = hexMap.get(hexKey(n.q, n.r));
        if (nh) nh.moisture = Math.min(1, nh.moisture + boost * 0.4);
      }
    }
  }

  return rivers;
}

/**
 * Place settlements with realistic preferences
 */
function placeSettlements(hexMap, rng, opts, usedNames = null) {
  const { numCities, numTowns, numVillages, cols, rows } = opts;
  const settlements = [];
  const usedHexes = new Set();

  // Score hexes for settlement desirability
  function settlementScore(hex, type) {
    if (!isPassableLand(hex.terrain)) return -1;
    if (hex.terrain === TERRAIN.SWAMP) return -1;
    if (hex.terrain === TERRAIN.MOUNTAIN) return -1;
    if (hex.terrain === TERRAIN.DENSE_FOREST) return -1;
    if (usedHexes.has(hexKey(hex.q, hex.r))) return -1;

    let score = 0;

    if (hex.terrain === TERRAIN.DESERT) score -= 10;
    if (hex.terrain === TERRAIN.TUNDRA) score -= 10;

    // Cities strongly prefer coast and rivers
    if (type === SETTLEMENT.CITY) {
      if (hex.isCoast) score += 30;
      if (hex.river) score += 25;
      if (hex.terrain === TERRAIN.PLAINS || hex.terrain === TERRAIN.GRASSLAND) score += 10;
      // Prefer not being at map edges
      const cx = hex.col / (cols - 1);
      const cy = hex.row / (rows - 1);
      if (cx > 0.15 && cx < 0.85 && cy > 0.15 && cy < 0.85) score += 5;
    }

    // Towns prefer rivers, fertile land
    if (type === SETTLEMENT.TOWN) {
      if (hex.river) score += 20;
      if (hex.isCoast) score += 10;
      if (hex.terrain === TERRAIN.PLAINS || hex.terrain === TERRAIN.GRASSLAND) score += 15;
      if (hex.terrain === TERRAIN.FOREST) score += 5;
    }

    // Villages are more flexible
    if (type === SETTLEMENT.VILLAGE) {
      if (hex.terrain === TERRAIN.PLAINS || hex.terrain === TERRAIN.GRASSLAND) score += 10;
      if (hex.terrain === TERRAIN.FOREST) score += 8;
      if (hex.terrain === TERRAIN.HILLS) score += 5;
      if (hex.river) score += 8;
    }

    // Spacing: penalize being too close to other settlements
    for (const s of settlements) {
      const dist = hexDistance(hex.q, hex.r, s.q, s.r);
      if (dist < 2) return -1;
      if (dist < 3) score -= 15;
      if (dist < 4) score -= 5;
    }

    // Add randomness
    score += rng.next() * 10;

    return score;
  }

  function placeBatch(type, count) {
    const allHexes = [...hexMap.values()];
    for (let i = 0; i < count; i++) {
      const scored = allHexes
        .map(h => ({ hex: h, score: settlementScore(h, type) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) break;

      // Pick from top candidates with some randomness
      const topN = Math.min(5, scored.length);
      const pick = scored[rng.int(0, topN - 1)];
      const hex = pick.hex;

      const name = generateName(rng, usedNames);
      const settlement = { type, name, q: hex.q, r: hex.r };
      hex.settlement = settlement;
      settlements.push(settlement);
      usedHexes.add(hexKey(hex.q, hex.r));
    }
  }

  // Place in order of priority
  placeBatch(SETTLEMENT.CITY, numCities);
  placeBatch(SETTLEMENT.TOWN, numTowns);
  placeBatch(SETTLEMENT.VILLAGE, numVillages);

  return settlements;
}

/**
 * Generate roads between settlements using realistic network design.
 * Paved roads: minimum spanning tree between cities (by actual path cost).
 * Dirt roads: cities to nearby towns, towns to nearby towns.
 * Paths: towns to nearby villages.
 */
function generateRoads(hexMap, rng, settlements) {
  const roads = [];

  // Terrain movement costs — prefer existing roads
  function moveCost(hex) {
    if (!hex || isWater(hex.terrain)) return 100;
    // Heavily discount hexes with existing roads
    if (hex.roads && hex.roads.length > 0) {
      const best = hex.roads.reduce((b, r) => Math.min(b, r === ROAD.PAVED ? 0.3 : r === ROAD.DIRT ? 0.5 : 0.7), Infinity);
      return best;
    }
    switch (hex.terrain) {
      case TERRAIN.HIGH_MOUNTAIN: return 100;
      case TERRAIN.MOUNTAIN: return 8;
      case TERRAIN.HILLS: return 3;
      case TERRAIN.DENSE_FOREST: return 4;
      case TERRAIN.FOREST: return 3;
      case TERRAIN.SWAMP: return 5;
      case TERRAIN.BEACH: return 2;
      case TERRAIN.DESERT: return 3;
      case TERRAIN.TUNDRA: return 3;
      default: return 1;
    }
  }

  // A* pathfinding with closed set and iteration limit
  function findPath(startQ, startR, endQ, endR) {
    const startKey = hexKey(startQ, startR);
    const endKey = hexKey(endQ, endR);
    if (startKey === endKey) return [{ q: startQ, r: startR }];

    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();

    gScore.set(startKey, 0);
    openSet.set(startKey, { q: startQ, r: startR, f: hexDistance(startQ, startR, endQ, endR) });

    let iterations = 0;
    const maxIterations = hexMap.size * 3;

    while (openSet.size > 0 && iterations++ < maxIterations) {
      let currentKey = null;
      let currentF = Infinity;
      for (const [key, node] of openSet) {
        if (node.f < currentF) {
          currentF = node.f;
          currentKey = key;
        }
      }

      if (currentKey === endKey) {
        const path = [];
        let key = endKey;
        while (key) {
          const hex = hexMap.get(key);
          if (hex) path.unshift({ q: hex.q, r: hex.r });
          key = cameFrom.get(key);
        }
        return { path, cost: gScore.get(endKey) };
      }

      const current = openSet.get(currentKey);
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Determine previous direction for straightness bonus
      const prevKey = cameFrom.get(currentKey);
      let prevDq = 0, prevDr = 0;
      if (prevKey) {
        const prevHex = hexMap.get(prevKey);
        if (prevHex) {
          prevDq = current.q - prevHex.q;
          prevDr = current.r - prevHex.r;
        }
      }

      for (const n of hexNeighbors(current.q, current.r)) {
        const nKey = hexKey(n.q, n.r);
        if (closedSet.has(nKey)) continue;
        const nHex = hexMap.get(nKey);
        if (!nHex) continue;

        const cost = moveCost(nHex);
        if (cost >= 50) continue;

        // Add small penalty for direction changes to encourage straighter roads
        let dirPenalty = 0;
        if (prevKey) {
          const dq = n.q - current.q;
          const dr = n.r - current.r;
          if (dq !== prevDq || dr !== prevDr) {
            dirPenalty = 0.3;
          }
        }

        const tentativeG = (gScore.get(currentKey) || 0) + cost + dirPenalty;

        if (tentativeG < (gScore.get(nKey) || Infinity)) {
          cameFrom.set(nKey, currentKey);
          gScore.set(nKey, tentativeG);
          const f = tentativeG + hexDistance(n.q, n.r, endQ, endR);
          openSet.set(nKey, { q: n.q, r: n.r, f });
        }
      }
    }

    return null;
  }

  const cities = settlements.filter(s => s.type === SETTLEMENT.CITY);
  const towns = settlements.filter(s => s.type === SETTLEMENT.TOWN);
  const villages = settlements.filter(s => s.type === SETTLEMENT.VILLAGE);

  // --- Paved roads: MST between cities using actual path cost ---
  // Compute all feasible city-city paths and costs (no distance limit)
  const cityEdges = [];
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const result = findPath(cities[i].q, cities[i].r, cities[j].q, cities[j].r);
      if (result) {
        cityEdges.push({ i, j, path: result.path, cost: result.cost });
      }
    }
  }

  // Kruskal's MST on city edges — connects ALL cities into one network
  cityEdges.sort((a, b) => a.cost - b.cost);
  const parent = cities.map((_, i) => i);
  function find(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])); }
  function union(a, b) { parent[find(a)] = find(b); }

  let mstEdges = 0;
  const pavedEdges = [];
  for (const edge of cityEdges) {
    if (find(edge.i) !== find(edge.j)) {
      union(edge.i, edge.j);
      pavedEdges.push(edge);
      mstEdges++;
    }
  }

  // Add a few extra short paved connections for redundancy
  const extraPavedBudget = Math.min(3, Math.floor(cities.length / 2));
  let extraAdded = 0;
  for (const edge of cityEdges) {
    if (extraAdded >= extraPavedBudget) break;
    if (pavedEdges.includes(edge)) continue;
    if (edge.path.length <= 20) {
      pavedEdges.push(edge);
      extraAdded++;
    }
  }

  for (const edge of pavedEdges) {
    roads.push({ path: edge.path, type: ROAD.PAVED, from: cities[edge.i], to: cities[edge.j] });
    markRoadOnHexes(hexMap, edge.path, ROAD.PAVED);
  }

  // --- Dirt roads from cities to nearby towns ---
  for (const city of cities) {
    const nearTowns = towns
      .sort((a, b) => hexDistance(city.q, city.r, a.q, a.r) - hexDistance(city.q, city.r, b.q, b.r))
      .slice(0, 3);

    for (const town of nearTowns) {
      const result = findPath(city.q, city.r, town.q, town.r);
      if (result) {
        roads.push({ path: result.path, type: ROAD.DIRT, from: city, to: town });
        markRoadOnHexes(hexMap, result.path, ROAD.DIRT);
      }
    }
  }

  // --- Dirt roads between nearby towns (distance < 15) ---
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      if (hexDistance(towns[i].q, towns[i].r, towns[j].q, towns[j].r) < 15) {
        const result = findPath(towns[i].q, towns[i].r, towns[j].q, towns[j].r);
        if (result) {
          roads.push({ path: result.path, type: ROAD.DIRT, from: towns[i], to: towns[j] });
          markRoadOnHexes(hexMap, result.path, ROAD.DIRT);
        }
      }
    }
  }

  // --- Paths from towns to nearby villages ---
  for (const town of towns) {
    const nearVillages = villages
      .filter(v => hexDistance(town.q, town.r, v.q, v.r) < 12)
      .sort((a, b) => hexDistance(town.q, town.r, a.q, a.r) - hexDistance(town.q, town.r, b.q, b.r))
      .slice(0, 3);

    for (const village of nearVillages) {
      const result = findPath(town.q, town.r, village.q, village.r);
      if (result) {
        roads.push({ path: result.path, type: ROAD.PATH, from: town, to: village });
        markRoadOnHexes(hexMap, result.path, ROAD.PATH);
      }
    }
  }

  return roads;
}

function markRoadOnHexes(hexMap, path, roadType) {
  for (let i = 0; i < path.length; i++) {
    const { q, r } = path[i];
    const hex = hexMap.get(hexKey(q, r));
    if (!hex) continue;
    if (!hex.roads.includes(roadType)) {
      hex.roads.push(roadType);
    }
    // Track which edges the road crosses
    if (i < path.length - 1) {
      const next = path[i + 1];
      for (let e = 0; e < 6; e++) {
        const n = hexNeighbor(q, r, e);
        if (n.q === next.q && n.r === next.r) {
          if (!hex.roadEdges.includes(e)) hex.roadEdges.push(e);
          const nextHex = hexMap.get(hexKey(next.q, next.r));
          if (nextHex) {
            const opp = oppositeEdge(e);
            if (!nextHex.roadEdges.includes(opp)) nextHex.roadEdges.push(opp);
          }
          break;
        }
      }
    }
  }
}

/**
 * Place points of interest
 */
function placePOIs(hexMap, rng, numPOIs, settlements, usedNames = null) {
  const pois = [];
  const usedHexes = new Set(settlements.map(s => hexKey(s.q, s.r)));

  // Include beach hexes too — some POIs (lighthouse, harbor, docks) need them
  const allHexes = [...hexMap.values()].filter(h => 
    (isLand(h.terrain) || h.terrain === TERRAIN.BEACH) && !usedHexes.has(hexKey(h.q, h.r))
  );

  const poiConfig = [
    { type: POI_TYPES.RUINS, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.FOREST, TERRAIN.HILLS, TERRAIN.DESERT], weight: 3 },
    { type: POI_TYPES.TOWER, terrains: [TERRAIN.HILLS, TERRAIN.PLAINS, TERRAIN.GRASSLAND], weight: 2 },
    { type: POI_TYPES.CAVE, terrains: [TERRAIN.MOUNTAIN, TERRAIN.HILLS, TERRAIN.HIGH_MOUNTAIN], weight: 2 },
    { type: POI_TYPES.CAIRN, terrains: [TERRAIN.PLAINS, TERRAIN.HILLS, TERRAIN.GRASSLAND, TERRAIN.TUNDRA], weight: 2 },
    { type: POI_TYPES.CASTLE, terrains: [TERRAIN.HILLS, TERRAIN.PLAINS], weight: 1 },
    { type: POI_TYPES.MINE, terrains: [TERRAIN.MOUNTAIN, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.SHRINE, terrains: [TERRAIN.FOREST, TERRAIN.DENSE_FOREST, TERRAIN.PLAINS], weight: 2 },
    { type: POI_TYPES.CAMP, terrains: [TERRAIN.FOREST, TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.TUNDRA], weight: 1 },
    { type: POI_TYPES.DRAGON_LAIR, terrains: [TERRAIN.MOUNTAIN, TERRAIN.HIGH_MOUNTAIN, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.STANDING_STONES, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.HILLS], weight: 2 },
    { type: POI_TYPES.WIZARD_TOWER, terrains: [TERRAIN.HILLS, TERRAIN.FOREST, TERRAIN.PLAINS], weight: 1 },
    { type: POI_TYPES.OBELISK, terrains: [TERRAIN.DESERT, TERRAIN.PLAINS, TERRAIN.TUNDRA], weight: 1 },
    { type: POI_TYPES.TOMB, terrains: [TERRAIN.HILLS, TERRAIN.PLAINS, TERRAIN.DESERT], weight: 2 },
    { type: POI_TYPES.PYRAMID, terrains: [TERRAIN.DESERT], weight: 2 },
    { type: POI_TYPES.DEAD_FOREST, terrains: [TERRAIN.SWAMP, TERRAIN.FOREST, TERRAIN.TUNDRA], weight: 1 },
    { type: POI_TYPES.GREAT_TREE, terrains: [TERRAIN.FOREST, TERRAIN.DENSE_FOREST], weight: 1 },
    { type: POI_TYPES.FAIRY_RING, terrains: [TERRAIN.FOREST, TERRAIN.DENSE_FOREST, TERRAIN.GRASSLAND], weight: 1 },
    { type: POI_TYPES.GIANT_SKELETON, terrains: [TERRAIN.DESERT, TERRAIN.PLAINS, TERRAIN.TUNDRA, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.METEOR_CRATER, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.DESERT, TERRAIN.TUNDRA], weight: 1 },
    { type: POI_TYPES.PIT, terrains: [TERRAIN.PLAINS, TERRAIN.HILLS, TERRAIN.FOREST], weight: 1 },
    { type: POI_TYPES.BATTLEFIELD, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.LOG_FORT, terrains: [TERRAIN.FOREST, TERRAIN.PLAINS, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.COLOSSUS, terrains: [TERRAIN.PLAINS, TERRAIN.HILLS, TERRAIN.DESERT, TERRAIN.GRASSLAND], weight: 1 },
    // Coastal POIs — requireCoast means hex must be adjacent to ocean/water
    { type: POI_TYPES.LIGHTHOUSE, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.HILLS, TERRAIN.BEACH], weight: 1, requireCoast: true },
    { type: POI_TYPES.HARBOR, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.BEACH], weight: 1, requireCoast: true },
    { type: POI_TYPES.DOCKS, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.BEACH, TERRAIN.SWAMP, TERRAIN.FOREST], weight: 1, requireCoast: true },
    // Inland POIs — requireRoad means hex must have a road passing through
    { type: POI_TYPES.INN, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.FOREST, TERRAIN.HILLS], weight: 2, requireRoad: true },
    { type: POI_TYPES.TAVERN, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.FOREST], weight: 2, requireRoad: true },
    { type: POI_TYPES.TEMPLE, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.HILLS, TERRAIN.FOREST, TERRAIN.DESERT], weight: 1 },
    { type: POI_TYPES.FOUNTAIN, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.DESERT], weight: 1 },
    { type: POI_TYPES.WELL, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.DESERT, TERRAIN.TUNDRA], weight: 1 },
    { type: POI_TYPES.WINDMILL, terrains: [TERRAIN.PLAINS, TERRAIN.GRASSLAND, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.EVIL_ALTAR, terrains: [TERRAIN.SWAMP, TERRAIN.DENSE_FOREST, TERRAIN.FOREST, TERRAIN.MOUNTAIN, TERRAIN.HILLS], weight: 1 },
    { type: POI_TYPES.TOTEM, terrains: [TERRAIN.FOREST, TERRAIN.DENSE_FOREST, TERRAIN.SWAMP, TERRAIN.PLAINS, TERRAIN.TUNDRA], weight: 1 },
    { type: POI_TYPES.TAR_PIT, terrains: [TERRAIN.SWAMP, TERRAIN.PLAINS, TERRAIN.DESERT], weight: 1 },
    { type: POI_TYPES.CHASM, terrains: [TERRAIN.MOUNTAIN, TERRAIN.HILLS, TERRAIN.PLAINS, TERRAIN.DESERT], weight: 1 },
  ];

  for (let i = 0; i < numPOIs; i++) {
    // Pick a POI type weighted randomly
    const totalWeight = poiConfig.reduce((s, c) => s + c.weight, 0);
    let r = rng.next() * totalWeight;
    let config = poiConfig[0];
    for (const c of poiConfig) {
      r -= c.weight;
      if (r <= 0) { config = c; break; }
    }

    // Find suitable hexes
    const candidates = allHexes.filter(h => {
      if (usedHexes.has(hexKey(h.q, h.r))) return false;
      if (!config.terrains.includes(h.terrain)) return false;
      // Coastal constraint: hex must be adjacent to water
      if (config.requireCoast && !h.isCoast) return false;
      // River constraint: hex must have a river flowing through it or be adjacent to one
      if (config.requireRiver) {
        const hasRiver = h.river || h.riverFlow > 0;
        if (!hasRiver) {
          // Check neighbors for rivers
          let neighborHasRiver = false;
          for (let e = 0; e < 6; e++) {
            const nb = hexNeighbor(h.q, h.r, e);
            const nbHex = hexMap.get(hexKey(nb.q, nb.r));
            if (nbHex && (nbHex.river || nbHex.riverFlow > 0)) { neighborHasRiver = true; break; }
          }
          if (!neighborHasRiver) return false;
        }
      }
      // Road constraint: hex must have a road
      if (config.requireRoad && (!h.roads || h.roads.length === 0)) return false;
      // Min distance from other POIs and settlements
      for (const p of pois) {
        if (hexDistance(h.q, h.r, p.q, p.r) < 2) return false;
      }
      for (const s of settlements) {
        if (hexDistance(h.q, h.r, s.q, s.r) < 2) return false;
      }
      return true;
    });

    if (candidates.length === 0) continue;

    const hex = rng.pick(candidates);
    const name = generatePOIName(rng, config.type, usedNames);
    const poi = { type: config.type, name, q: hex.q, r: hex.r };
    hex.poi = poi;
    pois.push(poi);
    usedHexes.add(hexKey(hex.q, hex.r));
  }

  // Place shipwrecks on beaches
  const beachHexes = [...hexMap.values()].filter(h =>
    h.terrain === TERRAIN.BEACH && !usedHexes.has(hexKey(h.q, h.r))
  );
  if (beachHexes.length > 0) {
    const numShipwrecks = Math.min(2, beachHexes.length);
    for (let i = 0; i < numShipwrecks; i++) {
      const candidates = beachHexes.filter(h => !usedHexes.has(hexKey(h.q, h.r)));
      if (candidates.length === 0) break;
      const hex = rng.pick(candidates);
      const name = generatePOIName(rng, POI_TYPES.SHIPWRECK, usedNames);
      const poi = { type: POI_TYPES.SHIPWRECK, name, q: hex.q, r: hex.r };
      hex.poi = poi;
      pois.push(poi);
      usedHexes.add(hexKey(hex.q, hex.r));
    }
  }

  return pois;
}

/**
 * Generate paths to notable POIs from nearest settlement
 */
function generatePOIPaths(hexMap, rng, pois, settlements) {
  const pathablePOIs = pois.filter(p =>
    [POI_TYPES.CASTLE, POI_TYPES.MINE, POI_TYPES.TOWER, POI_TYPES.WIZARD_TOWER, POI_TYPES.DRAGON_LAIR,
     POI_TYPES.LOG_FORT, POI_TYPES.TEMPLE, POI_TYPES.HARBOR, POI_TYPES.LIGHTHOUSE].includes(p.type)
  );

  function moveCost(hex) {
    if (!hex || isWater(hex.terrain)) return 100;
    switch (hex.terrain) {
      case TERRAIN.HIGH_MOUNTAIN: return 100;
      case TERRAIN.MOUNTAIN: return 8;
      case TERRAIN.HILLS: return 3;
      case TERRAIN.DENSE_FOREST: return 4;
      case TERRAIN.FOREST: return 3;
      case TERRAIN.SWAMP: return 5;
      case TERRAIN.DESERT: return 3;
      case TERRAIN.TUNDRA: return 3;
      default: return 1;
    }
  }

  function findPath(startQ, startR, endQ, endR) {
    const startKey = hexKey(startQ, startR);
    const endKey = hexKey(endQ, endR);
    if (startKey === endKey) return [{ q: startQ, r: startR }];

    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();

    gScore.set(startKey, 0);
    openSet.set(startKey, { q: startQ, r: startR, f: hexDistance(startQ, startR, endQ, endR) });

    let iterations = 0;
    const maxIterations = hexMap.size * 3;

    while (openSet.size > 0 && iterations++ < maxIterations) {
      let currentKey = null, currentF = Infinity;
      for (const [key, node] of openSet) {
        if (node.f < currentF) { currentF = node.f; currentKey = key; }
      }
      if (currentKey === endKey) {
        const path = [];
        let key = endKey;
        while (key) {
          const hex = hexMap.get(key);
          if (hex) path.unshift({ q: hex.q, r: hex.r });
          key = cameFrom.get(key);
        }
        return path;
      }
      const current = openSet.get(currentKey);
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      const prevKey = cameFrom.get(currentKey);
      let prevDq = 0, prevDr = 0;
      if (prevKey) {
        const prevHex = hexMap.get(prevKey);
        if (prevHex) { prevDq = current.q - prevHex.q; prevDr = current.r - prevHex.r; }
      }

      for (const n of hexNeighbors(current.q, current.r)) {
        const nKey = hexKey(n.q, n.r);
        if (closedSet.has(nKey)) continue;
        const nHex = hexMap.get(nKey);
        if (!nHex) continue;
        const cost = moveCost(nHex);
        if (cost >= 50) continue;
        let dirPenalty = 0;
        if (prevKey) {
          const dq = n.q - current.q;
          const dr = n.r - current.r;
          if (dq !== prevDq || dr !== prevDr) dirPenalty = 0.3;
        }
        const tentativeG = (gScore.get(currentKey) || 0) + cost + dirPenalty;
        if (tentativeG < (gScore.get(nKey) || Infinity)) {
          cameFrom.set(nKey, currentKey);
          gScore.set(nKey, tentativeG);
          openSet.set(nKey, { q: n.q, r: n.r, f: tentativeG + hexDistance(n.q, n.r, endQ, endR) });
        }
      }
    }
    return null;
  }

  for (const poi of pathablePOIs) {
    // Find nearest settlement
    let nearest = null, nearDist = Infinity;
    for (const s of settlements) {
      const d = hexDistance(poi.q, poi.r, s.q, s.r);
      if (d < nearDist) { nearDist = d; nearest = s; }
    }
    if (nearest && nearDist < 8) {
      const path = findPath(nearest.q, nearest.r, poi.q, poi.r);
      if (path) {
        markRoadOnHexes(hexMap, path, ROAD.PATH);
      }
    }
  }
}

/**
 * Place POIs on island hexes
 */
function placeIslandPOIs(hexMap, rng, pois, settlements, cols, rows, usedNames = null) {
  const usedHexes = new Set([
    ...settlements.map(s => hexKey(s.q, s.r)),
    ...pois.map(p => hexKey(p.q, p.r)),
  ]);

  // Find island hexes: land hexes where flood-fill doesn't reach the main continent
  // Simpler approach: find small connected land groups
  const visited = new Set();
  const landGroups = [];

  for (const [key, hex] of hexMap) {
    if (visited.has(key) || isWater(hex.terrain)) continue;
    // BFS to find connected land
    const group = [];
    const queue = [hex];
    visited.add(key);
    while (queue.length > 0) {
      const curr = queue.shift();
      group.push(curr);
      for (const n of hexNeighbors(curr.q, curr.r)) {
        const nk = hexKey(n.q, n.r);
        if (visited.has(nk)) continue;
        const nh = hexMap.get(nk);
        if (!nh || isWater(nh.terrain)) continue;
        visited.add(nk);
        queue.push(nh);
      }
    }
    landGroups.push(group);
  }

  // Sort by size, largest is main continent
  landGroups.sort((a, b) => b.length - a.length);

  // Place POIs on smaller land groups (islands)
  const islandTypes = [POI_TYPES.RUINS, POI_TYPES.SHRINE, POI_TYPES.TOMB, POI_TYPES.DRAGON_LAIR, POI_TYPES.STANDING_STONES];
  for (let g = 1; g < landGroups.length; g++) {
    const group = landGroups[g];
    if (group.length > 10) continue; // Too big to be an island
    const candidates = group.filter(h => !usedHexes.has(hexKey(h.q, h.r)) && !h.settlement && !h.poi);
    if (candidates.length === 0) continue;
    const hex = rng.pick(candidates);
    const type = rng.pick(islandTypes);
    const name = generatePOIName(rng, type, usedNames);
    const poi = { type, name, q: hex.q, r: hex.r };
    hex.poi = poi;
    pois.push(poi);
    usedHexes.add(hexKey(hex.q, hex.r));
  }
}

/**
 * Find hidden valleys surrounded by mountains and place POIs
 */
function placeHiddenValleyPOIs(hexMap, rng, pois, settlements, usedNames = null) {
  const usedHexes = new Set([
    ...settlements.map(s => hexKey(s.q, s.r)),
    ...pois.map(p => hexKey(p.q, p.r)),
  ]);

  const mtnTerrains = [TERRAIN.MOUNTAIN, TERRAIN.HIGH_MOUNTAIN, TERRAIN.HILLS];

  for (const [key, hex] of hexMap) {
    if (usedHexes.has(key)) continue;
    if (!isPassableLand(hex.terrain)) continue;
    if (mtnTerrains.includes(hex.terrain)) continue;

    // Check if surrounded by mountains/hills (at least 5 of 6 neighbors)
    const neighbors = hexNeighbors(hex.q, hex.r);
    let mtnCount = 0;
    let mtnNeighbor = null;
    for (const n of neighbors) {
      const nh = hexMap.get(hexKey(n.q, n.r));
      if (nh && mtnTerrains.includes(nh.terrain)) {
        mtnCount++;
        // Prefer MOUNTAIN (not HIGH_MOUNTAIN) for the cave
        if (nh.terrain === TERRAIN.MOUNTAIN && !usedHexes.has(hexKey(nh.q, nh.r))) {
          mtnNeighbor = nh;
        }
      }
    }

    if (mtnCount >= 5) {
      // Hidden valley found! Place a special POI with unique name
      const valleyType = rng.pick([POI_TYPES.RUINS, POI_TYPES.STANDING_STONES, POI_TYPES.SHRINE, POI_TYPES.TOMB]);
      const valleyNames = ['Hidden Valley', 'Lost Vale', 'Secret Glen', 'Sheltered Hollow', 'Forgotten Dale',
        'Misty Hollow', 'Veiled Gorge', 'Silent Vale', 'Sunken Glen', 'Shadow Dell'];
      let name;
      for (const n of valleyNames) {
        if (!usedNames || !usedNames.has(n)) {
          name = n;
          if (usedNames) usedNames.add(n);
          break;
        }
      }
      if (!name) {
        name = generatePOIName(rng, valleyType, usedNames);
      }
      const poi = { type: valleyType, name, q: hex.q, r: hex.r };
      hex.poi = poi;
      pois.push(poi);
      usedHexes.add(key);

      // Place a cave on an adjacent mountain
      if (mtnNeighbor && !usedHexes.has(hexKey(mtnNeighbor.q, mtnNeighbor.r))) {
        const caveName = generatePOIName(rng, POI_TYPES.CAVE, usedNames);
        const cavePoi = { type: POI_TYPES.CAVE, name: caveName, q: mtnNeighbor.q, r: mtnNeighbor.r };
        mtnNeighbor.poi = cavePoi;
        pois.push(cavePoi);
        usedHexes.add(hexKey(mtnNeighbor.q, mtnNeighbor.r));
      }
    }
  }
}

/**
 * Assign edge passability based on terrain and features
 */
function assignEdgePassability(hexMap) {
  for (const [key, hex] of hexMap) {
    for (let edge = 0; edge < 6; edge++) {
      const neighbor = hexNeighbor(hex.q, hex.r, edge);
      const nh = hexMap.get(hexKey(neighbor.q, neighbor.r));

      if (!nh) {
        hex.edges[edge] = PASSABILITY.BLOCKED;
        continue;
      }

      // Water edges are blocked
      if (isWater(hex.terrain) || isWater(nh.terrain)) {
        hex.edges[edge] = PASSABILITY.BLOCKED;
        continue;
      }

      // High mountain edges are blocked
      if (hex.terrain === TERRAIN.HIGH_MOUNTAIN || nh.terrain === TERRAIN.HIGH_MOUNTAIN) {
        hex.edges[edge] = PASSABILITY.BLOCKED;
        continue;
      }

      // River crossings need checks (unless there's a road/bridge on this edge)
      if (hex.riverEdges.includes(edge)) {
        const hasRoadOnEdge = hex.roadEdges.includes(edge);
        hex.edges[edge] = hasRoadOnEdge ? PASSABILITY.NORMAL : PASSABILITY.CHECK;
        continue;
      }

      // Mountain entry needs check
      if (nh.terrain === TERRAIN.MOUNTAIN) {
        hex.edges[edge] = PASSABILITY.CHECK;
        continue;
      }

      // Swamp needs check
      if (nh.terrain === TERRAIN.SWAMP) {
        hex.edges[edge] = PASSABILITY.CHECK;
        continue;
      }

      // Desert needs check
      if (nh.terrain === TERRAIN.DESERT) {
        hex.edges[edge] = PASSABILITY.CHECK;
        continue;
      }

      hex.edges[edge] = PASSABILITY.NORMAL;
    }
  }
}
