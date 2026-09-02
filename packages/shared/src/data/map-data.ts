import type { Game } from "../types/item.js";

export interface MapInfo {
  name: string;
  /**
   * Always null. A map's tier is not a property of its name: PoE1 rotates
   * which maps sit at which tier every league, and a PoE2 waystone's tier is
   * whatever waystone was slotted. Callers derive the tier from the area
   * (monster) level via `tierFromAreaLevel`. The field stays so the shape is
   * stable for the speedrun store.
   */
  tier: number | null;
  game: Game;
  /**
   * Zone names of separate boss instances that belong to this map. Empty for
   * ordinary maps — in both games the map boss is fought inside the map
   * instance itself, so no fabricated "<name> Boss Room" entries.
   */
  bossArenas: string[];
  /** Classification tags: "boss", "pinnacle", "unique", "citadel". */
  tags: string[];
}

const poe1 = (name: string, tags: string[] = []): MapInfo => ({
  name,
  tier: null,
  game: "poe1",
  bossArenas: [],
  tags,
});
const poe2 = (name: string, tags: string[] = []): MapInfo => ({
  name,
  tier: null,
  game: "poe2",
  bossArenas: [],
  tags,
});

/**
 * Known map / waystone zone names, used to tell a map apart from a town,
 * hideout, or campaign zone.
 *
 * PoE1: a curated subset of the Atlas — coverage does not matter much because
 * PoE1 map zones carry the " Map" suffix (see `isMapZone`). Pinnacle arenas
 * are the current (post-3.17) area names, verified on poedb 2026-09-02:
 * Sirus → Eye of the Storm, The Elder → Absence of Value and Meaning, The
 * Maven → Absence of Mercy and Empathy, Shaper and Uber Elder → The Shaper's
 * Realm.
 *
 * PoE2: the full 0.5 map pool from poe2db (2026-09-02), plus unique maps,
 * citadels and pinnacle areas. PoE2 waystone zones have no suffix, so a map
 * missing from this list is not detected — keep it in sync with poe2db when
 * a patch adds maps.
 */
export const MAP_DATABASE: MapInfo[] = [
  // --- PoE1 Maps (Atlas of Worlds) ---
  ...[
    "Strand",
    "Beach",
    "Glacier",
    "Alleyways",
    "Burial Chambers",
    "Tower",
    "Jungle Valley",
    "Crimson Temple",
    "Dunes",
    "Canyon",
    "City Square",
    "Underground Sea",
    "Toxic Sewer",
    "Precinct",
    "Bog",
    "Mesa",
    "Atoll",
    "Cemetery",
    "Shore",
    "Promenade",
    "Colonnade",
    "Plateau",
    "Tropical Island",
    "Volcano",
    "Lair",
    "Underground River",
    "Spider Forest",
    "Arachnid Tomb",
    "Arcade",
    "Arsenal",
    "Ashen Wood",
    "Basilica",
    "Belfry",
    "Caldera",
    "Carcass",
    "Chateau",
    "Courtyard",
    "Dark Forest",
    "Graveyard",
    "Haunted Mansion",
    "Iceberg",
    "Ivory Temple",
    "Lava Chamber",
    "Lighthouse",
    "Marshes",
    "Pen",
    "Phantasmagoria",
    "Pier",
    "Pit",
    "Port",
    "Ramparts",
    "Shipyard",
    "Shrine",
    "Siege",
    "Sulphur Vents",
    "Summit",
    "Temple",
    "Terrace",
    "Thicket",
    "Vault",
    "Wasteland",
    "Waterways",
  ].map((n) => poe1(n)),

  // PoE1 pinnacle boss arenas (poedb, 2026-09-02)
  poe1("Eye of the Storm", ["boss", "pinnacle", "sirus"]),
  poe1("Absence of Value and Meaning", ["boss", "pinnacle", "elder"]),
  poe1("Absence of Mercy and Empathy", ["boss", "pinnacle", "maven"]),
  poe1("The Shaper's Realm", ["boss", "pinnacle", "shaper", "uber-elder"]),
  // Maven's Invitation areas
  poe1("The Feared", ["boss", "maven-invitation"]),
  poe1("The Formed", ["boss", "maven-invitation"]),
  poe1("The Twisted", ["boss", "maven-invitation"]),
  poe1("The Forgotten", ["boss", "maven-invitation"]),
  poe1("The Elderslayers", ["boss", "maven-invitation"]),

  // --- PoE2 Maps (0.5 map pool, poe2db 2026-09-02) ---
  ...[
    "Blooming Field",
    "Savannah",
    "Fortress",
    "Penitentiary",
    "Lost Towers",
    "Sandspit",
    "Forge",
    "Sulphuric Caverns",
    "Mire",
    "Woodland",
    "Sump",
    "Willow",
    "Headland",
    "Lofty Summit",
    "Necropolis",
    "Crypt",
    "Steaming Springs",
    "Seepage",
    "Riverside",
    "Steppe",
    "Slick",
    "Spider Woods",
    "Marrow",
    "Vaal City",
    "Bloodwood",
    "Cenotes",
    "Hidden Grotto",
    "Ravine",
    "Alpine Ridge",
    "Augury",
    "Bastille",
    "Creek",
    "Crimson Shores",
    "Decay",
    "Deserted",
    "Grimhaven",
    "Hive",
    "Inferno",
    "Mineshaft",
    "Oasis",
    "Outlands",
    "Rockpools",
    "Sinking Spire",
    "Vaal Village",
    "Rustbowl",
    "Backwash",
    "Burial Bog",
    "Wetlands",
    "Sun Temple",
    "Channel",
    "Molten Vault",
    "The Assembly",
    "Mesa",
    "Bluff",
    "Azmerian Ranges",
    "Frozen Falls",
    "Trenches",
    "The Jade Isles",
    "Sacred Reservoir",
    "Derelict Mansion",
    "Sealed Vault",
    "Confluence",
    "Overgrown",
    "Stronghold",
    "Rupture",
    "Spring",
    "Wayward Isle",
    "Epitaph",
    "Cliffside",
    "Sinkhole",
    "Caldera",
    "Flotsam",
    "Barren Atoll",
    "The Fallen Star",
    "Precursor Tower",
    "Sprawling Jungle",
    "Mournful Cliffside",
    "Secluded Temple",
    "Obscure Island",
    "Digsite",
    "Ice Cave",
    "Razed Fields",
    "Riverhold",
    "Rugosa",
    "Mortuary",
    "Canyon",
    "Ornate Chambers",
  ].map((n) => poe2(n)),

  // PoE2 unique maps
  poe2("Castaway", ["unique"]),
  poe2("Untainted Paradise", ["unique"]),
  poe2("Vaults of Kamasa", ["unique"]),
  poe2("The Viridian Wildwood", ["unique"]),
  poe2("The Silent Cave", ["unique"]),
  poe2("The Fractured Lake", ["unique"]),

  // PoE2 citadels (T15+) and pinnacle / powerful-boss areas
  poe2("The Iron Citadel", ["boss", "citadel"]),
  poe2("The Stone Citadel", ["boss", "citadel"]),
  poe2("The Copper Citadel", ["boss", "citadel"]),
  poe2("The Burning Monolith", ["boss", "pinnacle", "arbiter"]),
  poe2("The Origin Tower", ["boss", "pinnacle"]),
  poe2("The Patriarch Halls", ["boss", "pinnacle"]),
  poe2("The Matriarch Halls", ["boss", "pinnacle"]),
  poe2("Ruins of Kingsmarch", ["boss", "pinnacle"]),
  poe2("Caer Tarth", ["boss", "pinnacle"]),
  poe2("The Withered Willow", ["boss", "pinnacle"]),
  poe2("The Ezomyte Megaliths", ["boss"]),
];

/**
 * Look up a map by zone name.
 *
 * - An exact (case-insensitive) name match always wins.
 * - PoE1 zone names are decorated ("Strand Map"), so a PoE1 or game-less
 *   lookup also accepts a zone that CONTAINS a map name, preferring the
 *   longest one ("The Withered Willow" ⊃ "Willow").
 * - PoE2 waystone zones are exactly the map name, and several short map names
 *   ("Crypt", "Wetlands", "Forge") are substrings of campaign zones ("The
 *   Venom Crypts", "Chimeral Wetlands"), so a PoE2-scoped lookup is exact only.
 */
export function findMap(zoneName: string, game?: Game): MapInfo | null {
  const lower = zoneName.toLowerCase();
  let best: MapInfo | null = null;
  for (const map of MAP_DATABASE) {
    if (game && map.game !== game) continue;
    const name = map.name.toLowerCase();
    if (lower === name) return map;
    if (game === "poe2") continue;
    if (!lower.includes(name)) continue;
    if (!best || name.length > best.name.length) best = map;
  }
  return best;
}

/** Lowest area (monster) level of a tier-1 map, per game. */
const TIER_1_AREA_LEVEL: Record<Game, number> = {
  // PoE1: T1 maps are level 68 through T16 at level 83.
  poe1: 68,
  // PoE2: T1 waystones are level 65.
  poe2: 65,
};

/**
 * Derive a map tier from its area (monster) level. This is the ONLY source of
 * a tier — see `MapInfo.tier`. Area level is NOT the tier (a T16 PoE1 map is
 * level 83), so displaying one as the other is always wrong.
 *
 * Returns null for levels below tier 1 (campaign zones), so callers show no
 * tier rather than a nonsensical one.
 */
export function tierFromAreaLevel(areaLevel: number, game: Game): number | null {
  const tier = areaLevel - TIER_1_AREA_LEVEL[game] + 1;
  return tier >= 1 ? tier : null;
}

/**
 * Check if a zone name corresponds to a map zone (not a town, hideout, or campaign area).
 * Uses the map database + the PoE1 "X Map" suffix. PoE2 relies on the database alone.
 */
export function isMapZone(zoneName: string, game?: Game): boolean {
  if (findMap(zoneName, game)) return true;
  if (game !== "poe2" && zoneName.toLowerCase().includes(" map")) return true;
  return false;
}

/** Check if a zone name is a known separate boss arena of some map */
export function isBossArena(zoneName: string, game?: Game): boolean {
  const lower = zoneName.toLowerCase();
  for (const map of MAP_DATABASE) {
    if (game && map.game !== game) continue;
    for (const arena of map.bossArenas) {
      if (lower === arena.toLowerCase()) return true;
    }
  }
  return false;
}
