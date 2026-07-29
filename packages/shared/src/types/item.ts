/** Which game the item belongs to */
export type Game = "poe1" | "poe2";

/** Item rarity levels */
export type Rarity =
  "Normal" | "Magic" | "Rare" | "Unique" | "Currency" | "Gem" | "Divination Card";

/** Influence types (PoE1 primarily) */
export type Influence = "Shaper" | "Elder" | "Crusader" | "Hunter" | "Redeemer" | "Warlord";

/** A single mod on an item */
export interface ItemMod {
  /** Raw mod text as shown in-game */
  text: string;
  /** Whether this is a prefix, suffix, implicit, enchant, etc. */
  type: "implicit" | "explicit" | "enchant" | "crafted" | "fractured" | "scourge";
}

/** Structured representation of a PoE item parsed from clipboard */
export interface ParsedItem {
  /** Raw clipboard text */
  raw: string;
  /** Which game this item is from */
  game: Game;
  /** Item class (e.g. "Body Armours", "Currency", "Maps") */
  itemClass: string;
  /** Rarity */
  rarity: Rarity;
  /** Item name (for rares/uniques — the top line) */
  name: string | null;
  /** Base type (e.g. "Astral Plate", "Chaos Orb") */
  baseType: string;
  /** Item level */
  itemLevel: number | null;
  /** Quality percentage */
  quality: number | null;
  /** Socket string (PoE1: "R-R-R-G-B B", PoE2: different system) */
  sockets: string | null;
  /** Number of linked sockets (PoE1) */
  links: number | null;
  /** Implicit mods */
  implicits: ItemMod[];
  /** Explicit mods */
  explicits: ItemMod[];
  /** Enchantments */
  enchants: ItemMod[];
  /** Whether the item is corrupted */
  corrupted: boolean;
  /** Whether the item is mirrored */
  mirrored: boolean;
  /** Whether the item is unidentified */
  unidentified: boolean;
  /** Influence types present */
  influences: Influence[];
  /** Stack size for currency/stackable items */
  stackSize: number | null;
  /** Map tier (for maps) */
  mapTier: number | null;
  /** Gem level (for gems) */
  gemLevel: number | null;
  /** Requirements */
  requirements: Record<string, number>;
  /** Properties section (armour, evasion, ES, DPS, etc.) */
  properties: Record<string, string>;
}

/** Result of a price check */
export interface PriceResult {
  /** The item that was checked */
  item: ParsedItem;
  /** Pricing strategy used */
  source: "poe.ninja" | "trade" | "unavailable";
  /** Estimated price in chaos orbs */
  chaosValue: number | null;
  /** Estimated price in divine orbs */
  divineValue: number | null;
  /** Confidence: exact match, fuzzy, or no match */
  confidence: "exact" | "fuzzy" | "low" | "none";
  /** Number of similar listings found (for trade API) */
  listingCount: number | null;
  /** Price range [min, max] in chaos */
  priceRange: [number, number] | null;
  /** URL to open full trade search */
  tradeUrl: string | null;
  /** Timestamp of the price check */
  timestamp: number;
}
