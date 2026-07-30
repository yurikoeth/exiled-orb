import type {
  ParsedItem,
  PriceResult,
  PoeNinjaCategory,
  Game,
  NinjaLine,
} from "@exiled-orb/shared";
import { buildNinjaUrl, parseNinjaResponse, getCurrentLeague } from "@exiled-orb/shared";
import { useSettingsStore } from "../stores/settings-store";
import { fetchNinjaCached } from "../utils/ninja-cache";

/** Map item class/rarity to poe.ninja category */
function getCategory(item: ParsedItem): PoeNinjaCategory | null {
  if (item.rarity === "Currency") return "Currency";
  if (item.rarity === "Divination Card") return "DivinationCard";
  if (item.rarity === "Gem") return "SkillGem";

  if (item.rarity === "Unique") {
    const cls = item.itemClass.toLowerCase();
    if (
      cls.includes("weapon") ||
      cls.includes("bow") ||
      cls.includes("wand") ||
      cls.includes("staff") ||
      cls.includes("dagger") ||
      cls.includes("sceptre") ||
      cls.includes("mace") ||
      cls.includes("axe") ||
      cls.includes("sword") ||
      cls.includes("claw")
    )
      return "UniqueWeapon";
    if (
      cls.includes("armour") ||
      cls.includes("helmet") ||
      cls.includes("glove") ||
      cls.includes("boot") ||
      cls.includes("body") ||
      cls.includes("shield")
    )
      return "UniqueArmour";
    if (cls.includes("ring") || cls.includes("amulet") || cls.includes("belt"))
      return "UniqueAccessory";
    if (cls.includes("flask")) return "UniqueFlask";
    if (cls.includes("jewel")) return "UniqueJewel";
    if (cls.includes("map") || cls.includes("waystone")) return "UniqueMap";
    return "UniqueArmour"; // fallback
  }

  if (item.itemClass.toLowerCase().includes("map")) return "Map";

  const fragmentKeywords = ["fragment", "splinter", "emblem", "scarab", "offering"];
  if (fragmentKeywords.some((kw) => item.baseType.toLowerCase().includes(kw))) return "Fragment";

  return null;
}

/** Fetch from poe.ninja via Rust proxy (CORS) — cached 5 min per URL. */
async function ninjaFetch(game: Game, league: string, category: string): Promise<NinjaLine[]> {
  const url = buildNinjaUrl(game, league, category);

  try {
    const raw = await fetchNinjaCached(url);
    if (raw.trimStart().startsWith("<!")) {
      console.warn("[ExiledOrb] poe.ninja returned HTML (possibly wrong league or API error)");
      return [];
    }
    return parseNinjaResponse(JSON.parse(raw));
  } catch (err) {
    console.error("[ExiledOrb] poe.ninja fetch failed:", err);
    return [];
  }
}

/** Lookup a specific item on poe.ninja */
async function ninjaLookup(
  game: Game,
  league: string,
  category: string,
  name: string,
  opts?: { links?: number; gemLevel?: number }
): Promise<{ chaosValue: number; divineValue: number; listingCount: number } | null> {
  const lines = await ninjaFetch(game, league, category);
  if (lines.length === 0) return null;

  const lower = name.toLowerCase();

  for (const line of lines) {
    if (line.name.toLowerCase() !== lower) continue;

    // Check links filter
    if (opts?.links && line.links !== undefined && line.links !== opts.links) continue;
    // Check gem level filter
    if (opts?.gemLevel && line.gemLevel !== undefined && line.gemLevel !== opts.gemLevel) continue;

    return {
      chaosValue: line.chaosValue,
      divineValue: line.divineValue,
      listingCount: line.listingCount,
    };
  }

  return null;
}

/** Cached divine rate so PriceCheck component can use it */
let lastDivineRate = 200;

/** Get divine orb rate */
async function getDivineRate(game: Game, league: string): Promise<number> {
  const result = await ninjaLookup(game, league, "Currency", "Divine Orb");
  const rate = result?.chaosValue ?? 200;
  lastDivineRate = rate;
  return rate;
}

/** Get the last fetched divine rate (for display) */
export function getDivineRateCached(): number {
  return lastDivineRate;
}

/**
 * Check the price of a parsed item.
 * Routes to poe.ninja for known categories.
 */
export async function checkPrice(item: ParsedItem, league?: string): Promise<PriceResult> {
  if (!league) {
    // The stored league is a single value with no game attached (settings UI
    // pending); only trust it for PoE1 and resolve PoE2 from season data so
    // each game hits its own economy league.
    league =
      item.game === "poe1"
        ? useSettingsStore.getState().settings.league || getCurrentLeague("poe1")
        : getCurrentLeague("poe2");
  }
  const category = getCategory(item);
  console.log(
    `[ExiledOrb] Price check: "${item.name || item.baseType}" category=${category} league=${league} game=${item.game}`
  );

  if (category) {
    try {
      const lookupName = item.name || item.baseType;
      const ninjaItem = await ninjaLookup(item.game, league, category, lookupName, {
        links: item.links && item.links >= 5 ? item.links : undefined,
        gemLevel: item.gemLevel ?? undefined,
      });

      if (ninjaItem) {
        const divineRate = await getDivineRate(item.game, league);
        return {
          item,
          source: "poe.ninja",
          chaosValue: ninjaItem.chaosValue,
          divineValue: divineRate > 0 ? ninjaItem.chaosValue / divineRate : ninjaItem.divineValue,
          confidence: "exact",
          listingCount: ninjaItem.listingCount,
          priceRange: null,
          tradeUrl: null,
          timestamp: Date.now(),
        };
      }
    } catch (err) {
      console.error("[ExiledOrb] poe.ninja lookup failed:", err);
    }
  }

  // No price found
  return {
    item,
    source: "unavailable",
    chaosValue: null,
    divineValue: null,
    confidence: "none",
    listingCount: null,
    priceRange: null,
    tradeUrl: null,
    timestamp: Date.now(),
  };
}
