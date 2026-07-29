import type { Game } from "../types/item.js";

export interface MapInfo {
  name: string;
  tier: number | null;
  game: Game;
  /** Known boss arena zone names (for detecting boss phase) */
  bossArenas: string[];
  /** Layout tags for quick reference */
  tags: string[];
}

/**
 * Known map/waystone zone names. Used to detect when a player enters a map
 * (as opposed to a town, hideout, or campaign zone).
 *
 * This is a curated list of the most popular/common maps. Not exhaustive.
 */
export const MAP_DATABASE: MapInfo[] = [
  // --- PoE1 Maps (Atlas of Worlds) ---
  {
    name: "Strand",
    tier: 1,
    game: "poe1",
    bossArenas: ["Strand Boss Room"],
    tags: ["linear", "open"],
  },
  { name: "Beach", tier: 1, game: "poe1", bossArenas: ["Tidal Island"], tags: ["linear", "open"] },
  { name: "Glacier", tier: 2, game: "poe1", bossArenas: ["Glacier Boss Room"], tags: ["open"] },
  {
    name: "Alleyways",
    tier: 2,
    game: "poe1",
    bossArenas: ["Alleyways Boss Room"],
    tags: ["linear"],
  },
  {
    name: "Burial Chambers",
    tier: 4,
    game: "poe1",
    bossArenas: ["Burial Chambers Boss Room"],
    tags: ["indoor", "narrow"],
  },
  {
    name: "Tower",
    tier: 5,
    game: "poe1",
    bossArenas: ["Tower Rooftop"],
    tags: ["indoor", "vertical"],
  },
  {
    name: "Jungle Valley",
    tier: 3,
    game: "poe1",
    bossArenas: ["Jungle Valley Boss Room"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Crimson Temple",
    tier: 14,
    game: "poe1",
    bossArenas: ["Crimson Temple Boss Room"],
    tags: ["indoor", "open-rooms"],
  },
  {
    name: "Dunes",
    tier: 5,
    game: "poe1",
    bossArenas: ["Dunes Boss Room"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Canyon",
    tier: 7,
    game: "poe1",
    bossArenas: ["Canyon Boss Room"],
    tags: ["semi-linear", "outdoor"],
  },
  {
    name: "City Square",
    tier: 6,
    game: "poe1",
    bossArenas: ["City Square Boss Room"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Underground Sea",
    tier: 8,
    game: "poe1",
    bossArenas: ["Underground Sea Boss Room"],
    tags: ["indoor", "maze"],
  },
  {
    name: "Toxic Sewer",
    tier: 7,
    game: "poe1",
    bossArenas: ["Toxic Sewer Boss Room"],
    tags: ["linear", "indoor"],
  },
  { name: "Precinct", tier: 12, game: "poe1", bossArenas: [], tags: ["open", "multi-boss"] },
  { name: "Bog", tier: 6, game: "poe1", bossArenas: ["Bog Boss Room"], tags: ["open", "outdoor"] },
  {
    name: "Mesa",
    tier: 3,
    game: "poe1",
    bossArenas: ["Mesa Boss Room"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Atoll",
    tier: 9,
    game: "poe1",
    bossArenas: ["Atoll Boss Room"],
    tags: ["circular", "outdoor"],
  },
  {
    name: "Cemetery",
    tier: 5,
    game: "poe1",
    bossArenas: ["Cemetery Boss Room"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Shore",
    tier: 10,
    game: "poe1",
    bossArenas: ["Shore Boss Room"],
    tags: ["linear", "outdoor"],
  },
  {
    name: "Promenade",
    tier: 11,
    game: "poe1",
    bossArenas: ["Promenade Boss Room"],
    tags: ["linear"],
  },
  {
    name: "Colonnade",
    tier: 10,
    game: "poe1",
    bossArenas: ["Colonnade Boss Room"],
    tags: ["linear", "open"],
  },
  {
    name: "Plateau",
    tier: 12,
    game: "poe1",
    bossArenas: ["Plateau Boss Room"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Tropical Island",
    tier: 4,
    game: "poe1",
    bossArenas: ["Tropical Island Boss Room"],
    tags: ["linear", "outdoor"],
  },
  { name: "Volcano", tier: 8, game: "poe1", bossArenas: ["Caldera"], tags: ["semi-linear"] },
  {
    name: "Lair",
    tier: 11,
    game: "poe1",
    bossArenas: ["Lair Boss Room"],
    tags: ["semi-linear", "indoor"],
  },
  {
    name: "Underground River",
    tier: 8,
    game: "poe1",
    bossArenas: ["Underground River Boss Room"],
    tags: ["linear", "indoor"],
  },
  {
    name: "Spider Forest",
    tier: 6,
    game: "poe1",
    bossArenas: ["Spider Forest Boss Room"],
    tags: ["outdoor", "open"],
  },
  {
    name: "Arachnid Tomb",
    tier: 8,
    game: "poe1",
    bossArenas: ["Arachnid Tomb Boss Room"],
    tags: ["indoor"],
  },
  {
    name: "Arcade",
    tier: 3,
    game: "poe1",
    bossArenas: ["Arcade Boss Room"],
    tags: ["indoor", "linear"],
  },
  { name: "Arsenal", tier: 8, game: "poe1", bossArenas: ["Arsenal Boss Room"], tags: ["indoor"] },
  { name: "Ashen Wood", tier: 6, game: "poe1", bossArenas: [], tags: ["outdoor", "open"] },
  {
    name: "Basilica",
    tier: 13,
    game: "poe1",
    bossArenas: ["Basilica Boss Room"],
    tags: ["indoor"],
  },
  {
    name: "Belfry",
    tier: 9,
    game: "poe1",
    bossArenas: ["Belfry Boss Room"],
    tags: ["indoor", "vertical"],
  },
  { name: "Caldera", tier: 14, game: "poe1", bossArenas: ["Caldera Boss Room"], tags: ["outdoor"] },
  { name: "Carcass", tier: 13, game: "poe1", bossArenas: ["Carcass Boss Room"], tags: ["indoor"] },
  { name: "Chateau", tier: 9, game: "poe1", bossArenas: ["Chateau Boss Room"], tags: ["indoor"] },
  { name: "Courtyard", tier: 13, game: "poe1", bossArenas: [], tags: ["outdoor", "multi-boss"] },
  {
    name: "Dark Forest",
    tier: 14,
    game: "poe1",
    bossArenas: ["Dark Forest Boss Room"],
    tags: ["outdoor"],
  },
  {
    name: "Graveyard",
    tier: 1,
    game: "poe1",
    bossArenas: ["Graveyard Boss Room"],
    tags: ["outdoor"],
  },
  {
    name: "Haunted Mansion",
    tier: 7,
    game: "poe1",
    bossArenas: ["Haunted Mansion Boss Room"],
    tags: ["indoor"],
  },
  { name: "Iceberg", tier: 10, game: "poe1", bossArenas: ["Iceberg Boss Room"], tags: ["indoor"] },
  {
    name: "Ivory Temple",
    tier: 12,
    game: "poe1",
    bossArenas: ["Ivory Temple Boss Room"],
    tags: ["indoor"],
  },
  {
    name: "Lava Chamber",
    tier: 9,
    game: "poe1",
    bossArenas: ["Lava Chamber Boss Room"],
    tags: ["indoor"],
  },
  {
    name: "Lighthouse",
    tier: 10,
    game: "poe1",
    bossArenas: ["Lighthouse Boss Room"],
    tags: ["indoor", "vertical"],
  },
  { name: "Marshes", tier: 3, game: "poe1", bossArenas: ["Marshes Boss Room"], tags: ["outdoor"] },
  { name: "Pen", tier: 1, game: "poe1", bossArenas: ["Pen Boss Room"], tags: ["outdoor", "open"] },
  {
    name: "Phantasmagoria",
    tier: 4,
    game: "poe1",
    bossArenas: ["Phantasmagoria Boss Room"],
    tags: ["indoor"],
  },
  { name: "Pier", tier: 6, game: "poe1", bossArenas: ["Pier Boss Room"], tags: ["linear"] },
  { name: "Pit", tier: 5, game: "poe1", bossArenas: ["Pit Boss Room"], tags: ["indoor"] },
  { name: "Port", tier: 7, game: "poe1", bossArenas: ["Port Boss Room"], tags: ["outdoor"] },
  {
    name: "Ramparts",
    tier: 4,
    game: "poe1",
    bossArenas: ["Ramparts Boss Room"],
    tags: ["outdoor", "linear"],
  },
  {
    name: "Shipyard",
    tier: 11,
    game: "poe1",
    bossArenas: ["Shipyard Boss Room"],
    tags: ["outdoor"],
  },
  { name: "Shrine", tier: 8, game: "poe1", bossArenas: ["Shrine Boss Room"], tags: ["indoor"] },
  { name: "Siege", tier: 11, game: "poe1", bossArenas: ["Siege Boss Room"], tags: ["outdoor"] },
  {
    name: "Sulphur Vents",
    tier: 7,
    game: "poe1",
    bossArenas: ["Sulphur Vents Boss Room"],
    tags: ["outdoor"],
  },
  {
    name: "Summit",
    tier: 14,
    game: "poe1",
    bossArenas: ["Summit Boss Room"],
    tags: ["outdoor", "vertical"],
  },
  { name: "Temple", tier: 9, game: "poe1", bossArenas: ["Temple Boss Room"], tags: ["indoor"] },
  {
    name: "Terrace",
    tier: 13,
    game: "poe1",
    bossArenas: ["Terrace Boss Room"],
    tags: ["outdoor", "open"],
  },
  { name: "Thicket", tier: 4, game: "poe1", bossArenas: ["Thicket Boss Room"], tags: ["outdoor"] },
  { name: "Vault", tier: 12, game: "poe1", bossArenas: ["Vault Boss Room"], tags: ["indoor"] },
  {
    name: "Wasteland",
    tier: 10,
    game: "poe1",
    bossArenas: ["Wasteland Boss Room"],
    tags: ["outdoor", "open"],
  },
  {
    name: "Waterways",
    tier: 13,
    game: "poe1",
    bossArenas: ["Waterways Boss Room"],
    tags: ["outdoor", "linear"],
  },

  // PoE1 Pinnacle Boss Zones
  {
    name: "Absence of Value and Meaning",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "sirus"],
  },
  {
    name: "The Maven's Crucible",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven"],
  },
  {
    name: "The Shaper's Realm",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "shaper"],
  },
  { name: "The Elder's Domain", tier: null, game: "poe1", bossArenas: [], tags: ["boss", "elder"] },
  {
    name: "Eye of the Storm",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "uber-elder"],
  },
  {
    name: "The Feared",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven-invitation"],
  },
  {
    name: "The Formed",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven-invitation"],
  },
  {
    name: "The Twisted",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven-invitation"],
  },
  {
    name: "The Forgotten",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven-invitation"],
  },
  {
    name: "The Hidden",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven-invitation"],
  },
  {
    name: "The Elderslayers",
    tier: null,
    game: "poe1",
    bossArenas: [],
    tags: ["boss", "maven-invitation"],
  },

  // --- PoE2 Waystones ---
  {
    name: "Meadow",
    tier: 1,
    game: "poe2",
    bossArenas: ["Meadow Boss Arena"],
    tags: ["open", "outdoor"],
  },
  {
    name: "Torchlit Mines",
    tier: 1,
    game: "poe2",
    bossArenas: ["Torchlit Mines Boss Arena"],
    tags: ["indoor", "linear"],
  },
  {
    name: "Infested Ruins",
    tier: 2,
    game: "poe2",
    bossArenas: ["Infested Ruins Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Sandworm Tunnels",
    tier: 2,
    game: "poe2",
    bossArenas: ["Sandworm Tunnels Boss Arena"],
    tags: ["indoor", "narrow"],
  },
  {
    name: "Flooded Cavern",
    tier: 3,
    game: "poe2",
    bossArenas: ["Flooded Cavern Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Dry Riverbed",
    tier: 3,
    game: "poe2",
    bossArenas: ["Dry Riverbed Boss Arena"],
    tags: ["outdoor", "open"],
  },
  {
    name: "Crimson Village",
    tier: 4,
    game: "poe2",
    bossArenas: ["Crimson Village Boss Arena"],
    tags: ["outdoor"],
  },
  {
    name: "Sinking Spire",
    tier: 5,
    game: "poe2",
    bossArenas: ["Sinking Spire Boss Arena"],
    tags: ["indoor", "vertical"],
  },
  {
    name: "Salt Mines",
    tier: 5,
    game: "poe2",
    bossArenas: ["Salt Mines Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Burning Remnants",
    tier: 6,
    game: "poe2",
    bossArenas: ["Burning Remnants Boss Arena"],
    tags: ["outdoor", "open"],
  },
  {
    name: "Blighted Bog",
    tier: 7,
    game: "poe2",
    bossArenas: ["Blighted Bog Boss Arena"],
    tags: ["outdoor"],
  },
  {
    name: "Forgotten Citadel",
    tier: 8,
    game: "poe2",
    bossArenas: ["Forgotten Citadel Boss Arena"],
    tags: ["indoor", "large"],
  },
  {
    name: "Mouldering Arena",
    tier: 9,
    game: "poe2",
    bossArenas: ["Mouldering Arena Boss Arena"],
    tags: ["indoor", "open"],
  },
  {
    name: "Sunken Ziggurat",
    tier: 10,
    game: "poe2",
    bossArenas: ["Sunken Ziggurat Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Spore Grotto",
    tier: 11,
    game: "poe2",
    bossArenas: ["Spore Grotto Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Blood Aqueduct",
    tier: 7,
    game: "poe2",
    bossArenas: ["Blood Aqueduct Boss Arena"],
    tags: ["linear", "outdoor"],
  },
  {
    name: "Haunted Shipyard",
    tier: 4,
    game: "poe2",
    bossArenas: ["Haunted Shipyard Boss Arena"],
    tags: ["outdoor"],
  },
  {
    name: "Ruined Cathedral",
    tier: 6,
    game: "poe2",
    bossArenas: ["Ruined Cathedral Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Fungal Hollow",
    tier: 8,
    game: "poe2",
    bossArenas: ["Fungal Hollow Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Scorched Summit",
    tier: 9,
    game: "poe2",
    bossArenas: ["Scorched Summit Boss Arena"],
    tags: ["outdoor", "vertical"],
  },
  {
    name: "Frozen Wastes",
    tier: 10,
    game: "poe2",
    bossArenas: ["Frozen Wastes Boss Arena"],
    tags: ["outdoor", "open"],
  },
  {
    name: "Bone Pit",
    tier: 3,
    game: "poe2",
    bossArenas: ["Bone Pit Boss Arena"],
    tags: ["indoor"],
  },
  {
    name: "Twilight Temple",
    tier: 11,
    game: "poe2",
    bossArenas: ["Twilight Temple Boss Arena"],
    tags: ["indoor", "large"],
  },
  {
    name: "Ashen Wastes",
    tier: 12,
    game: "poe2",
    bossArenas: ["Ashen Wastes Boss Arena"],
    tags: ["outdoor", "open"],
  },

  // PoE2 Pinnacle Boss Zones
  {
    name: "The Arbiter of Ash",
    tier: null,
    game: "poe2",
    bossArenas: [],
    tags: ["boss", "pinnacle"],
  },
  {
    name: "The Galvanic King",
    tier: null,
    game: "poe2",
    bossArenas: [],
    tags: ["boss", "pinnacle"],
  },
];

/**
 * Lookup a map by zone name. Matches if the zone name contains the map name
 * (e.g., "Strand Map" matches "Strand", "Tier 5 Strand" matches "Strand").
 */
export function findMap(zoneName: string, game?: Game): MapInfo | null {
  const lower = zoneName.toLowerCase();
  for (const map of MAP_DATABASE) {
    if (game && map.game !== game) continue;
    if (lower.includes(map.name.toLowerCase())) return map;
  }
  return null;
}

/**
 * Check if a zone name corresponds to a map zone (not a town, hideout, or campaign area).
 * Uses the map database + pattern matching for PoE1 "X Map" and PoE2 waystones.
 */
export function isMapZone(zoneName: string, game?: Game): boolean {
  if (findMap(zoneName, game)) return true;
  // PoE1: many map zones end with "Map" or contain "Map" in the zone name
  if (zoneName.toLowerCase().includes(" map")) return true;
  // PoE2: waystone zones don't have a consistent suffix, rely on database
  return false;
}

/** Check if a zone name is a known boss arena */
export function isBossArena(zoneName: string, game?: Game): boolean {
  for (const map of MAP_DATABASE) {
    if (game && map.game !== game) continue;
    for (const arena of map.bossArenas) {
      if (zoneName.toLowerCase().includes(arena.toLowerCase())) return true;
    }
  }
  return false;
}
