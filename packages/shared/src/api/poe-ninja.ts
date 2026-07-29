import type { Game, PoeNinjaCategory, PoeNinjaItem, PriceCache } from "../types/index.js";

/** Default cache TTL: 5 minutes */
const DEFAULT_TTL = 5 * 60 * 1000;

/** poe.ninja base URLs */
export const NINJA_BASE_URLS: Record<Game, string> = {
  poe1: "https://poe.ninja/api/data",
  poe2: "https://poe2.ninja/api/data", // PoE2 has a separate domain
};

/** Categories served by the currencyoverview endpoint */
export const NINJA_CURRENCY_CATEGORIES: ReadonlySet<string> = new Set(["Currency", "Fragment"]);

/** Build a poe.ninja overview URL for a given game/league/category */
export function buildNinjaUrl(game: Game, league: string, category: string): string {
  const base = NINJA_BASE_URLS[game];
  const endpoint = NINJA_CURRENCY_CATEGORIES.has(category) ? "currencyoverview" : "itemoverview";
  return `${base}/${endpoint}?league=${encodeURIComponent(league)}&type=${category}`;
}

/** Map category names to poe.ninja API endpoints */
const CATEGORY_ENDPOINTS: Record<
  PoeNinjaCategory,
  { type: "currency" | "item"; overview: string }
> = {
  Currency: { type: "currency", overview: "currencyoverview" },
  Fragment: { type: "currency", overview: "currencyoverview" },
  DivinationCard: { type: "item", overview: "itemoverview" },
  Artifact: { type: "item", overview: "itemoverview" },
  Oil: { type: "item", overview: "itemoverview" },
  Incubator: { type: "item", overview: "itemoverview" },
  UniqueWeapon: { type: "item", overview: "itemoverview" },
  UniqueArmour: { type: "item", overview: "itemoverview" },
  UniqueAccessory: { type: "item", overview: "itemoverview" },
  UniqueFlask: { type: "item", overview: "itemoverview" },
  UniqueJewel: { type: "item", overview: "itemoverview" },
  UniqueMap: { type: "item", overview: "itemoverview" },
  SkillGem: { type: "item", overview: "itemoverview" },
  BaseType: { type: "item", overview: "itemoverview" },
  Map: { type: "item", overview: "itemoverview" },
  Essence: { type: "item", overview: "itemoverview" },
  Fossil: { type: "item", overview: "itemoverview" },
  Resonator: { type: "item", overview: "itemoverview" },
  Scarab: { type: "item", overview: "itemoverview" },
  Tattoo: { type: "item", overview: "itemoverview" },
  Omen: { type: "item", overview: "itemoverview" },
};

/** In-memory price cache */
const cache = new Map<string, PriceCache>();

function cacheKey(game: Game, league: string, category: PoeNinjaCategory): string {
  return `${game}:${league}:${category}`;
}

/** Fetch price data from poe.ninja for a given category */
export async function fetchCategory(
  game: Game,
  league: string,
  category: PoeNinjaCategory
): Promise<PoeNinjaItem[]> {
  const key = cacheKey(game, league, category);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.fetchedAt < cached.ttl) {
    return cached.data;
  }

  const endpoint = CATEGORY_ENDPOINTS[category];
  const url = buildNinjaUrl(game, league, category);

  const response = await fetch(url, {
    headers: { "User-Agent": "exiled-orb/0.1.0" },
  });

  if (!response.ok) {
    throw new Error(`poe.ninja API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  let items: PoeNinjaItem[];

  if (endpoint.type === "currency") {
    // Currency overview returns { lines: [{ currencyTypeName, chaosEquivalent, ... }] }
    items = (json.lines || []).map((line: Record<string, unknown>) => ({
      name: line.currencyTypeName as string,
      chaosValue: (line.chaosEquivalent as number) || 0,
      divineValue: 0, // Will compute from divine rate
      icon: (line.icon as string) || "",
      listingCount: (line.listingCount as number) || 0,
    }));
  } else {
    // Item overview returns { lines: [{ name, baseType, chaosValue, divineValue, ... }] }
    items = (json.lines || []).map((line: Record<string, unknown>) => ({
      name: (line.name as string) || "",
      baseType: line.baseType as string | undefined,
      chaosValue: (line.chaosValue as number) || 0,
      divineValue: (line.divineValue as number) || 0,
      icon: (line.icon as string) || "",
      links: line.links as number | undefined,
      gemLevel: line.gemLevel as number | undefined,
      gemQuality: line.gemQuality as number | undefined,
      variant: line.variant as string | undefined,
      listingCount: (line.listingCount as number) || 0,
    }));
  }

  cache.set(key, {
    category,
    league,
    game,
    data: items,
    fetchedAt: Date.now(),
    ttl: DEFAULT_TTL,
  });

  return items;
}

/** Look up a specific item by name in poe.ninja data */
export async function lookupPrice(
  game: Game,
  league: string,
  category: PoeNinjaCategory,
  name: string,
  opts?: { links?: number; gemLevel?: number; variant?: string }
): Promise<PoeNinjaItem | null> {
  const items = await fetchCategory(game, league, category);
  const nameLower = name.toLowerCase();

  const matches = items.filter((item) => {
    if (item.name.toLowerCase() !== nameLower) return false;
    if (opts?.links !== undefined && item.links !== opts.links) return false;
    if (opts?.gemLevel !== undefined && item.gemLevel !== opts.gemLevel) return false;
    if (opts?.variant !== undefined && item.variant !== opts.variant) return false;
    return true;
  });

  // Return best match (highest listing count)
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.listingCount - a.listingCount)[0];
}

/** Get the current divine orb rate in chaos */
export async function getDivineRate(game: Game, league: string): Promise<number> {
  const divine = await lookupPrice(game, league, "Currency", "Divine Orb");
  return divine?.chaosValue ?? 0;
}

/** Clear the price cache */
export function clearCache(): void {
  cache.clear();
}
