import type { Game, PoeNinjaCategory, PoeNinjaItem, PriceCache } from "../types/index.js";

/** Default cache TTL: 5 minutes */
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * poe.ninja base URLs. Both games live under poe.ninja — the poe2.ninja
 * domain is NOT poe.ninja's (it serves an unrelated site). API verified
 * 2026-07-30 against https://poe.ninja/docs/api.
 */
export const NINJA_BASE_URLS: Record<Game, string> = {
  poe1: "https://poe.ninja/poe1/api/economy",
  poe2: "https://poe.ninja/poe2/api/economy",
};

/** Categories priced by trade in currency-style overviews */
export const NINJA_CURRENCY_CATEGORIES: ReadonlySet<string> = new Set(["Currency", "Fragment"]);

/**
 * Build a poe.ninja overview URL for a given game/league/category.
 * - PoE1 currency:  /poe1/api/economy/stash/current/currency/overview
 * - PoE2 currency:  /poe2/api/economy/exchange/current/overview
 * - items (both):   /<game>/api/economy/stash/current/item/overview
 */
export function buildNinjaUrl(game: Game, league: string, category: string): string {
  const base = NINJA_BASE_URLS[game];
  const query = `league=${encodeURIComponent(league)}&type=${encodeURIComponent(category)}`;
  if (NINJA_CURRENCY_CATEGORIES.has(category)) {
    return game === "poe2"
      ? `${base}/exchange/current/overview?${query}`
      : `${base}/stash/current/currency/overview?${query}`;
  }
  return `${base}/stash/current/item/overview?${query}`;
}

/** A poe.ninja price line normalized across both games and all endpoints. */
export interface NinjaLine {
  name: string;
  /** Value in chaos orbs (PoE2 exchange values are converted via core.rates). */
  chaosValue: number;
  /** Value in divine orbs when the API provides it (always, for PoE2 exchange). */
  divineValue: number;
  icon: string;
  /** 7-day change in % */
  change: number;
  listingCount: number;
  links?: number;
  gemLevel?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted API payloads */

/**
 * Normalize a poe.ninja JSON payload into NinjaLine[]. Handles:
 * - PoE1 currency overview (`currencyTypeName` / `chaosEquivalent` / `receiveSparkLine`)
 * - PoE1/PoE2 item overview (`name` / `chaosValue` / `sparkLine`)
 * - PoE2 exchange overview (`lines` in divines joined with `items` metadata,
 *   converted to chaos via `core.rates.chaos`)
 */
export function parseNinjaResponse(data: unknown): NinjaLine[] {
  const d = data as Record<string, any>;
  if (!d || typeof d !== "object") return [];

  // PoE2 exchange: values live in `lines` (denominated in the primary
  // currency, divines), display metadata in `items`, rates in `core.rates`.
  if (d.core && Array.isArray(d.items)) {
    const chaosPerDivine: number = d.core?.rates?.chaos ?? 0;
    const meta = new Map<string, any>(d.items.map((i: any) => [i.id, i]));
    return (Array.isArray(d.lines) ? d.lines : []).map((line: any): NinjaLine => {
      const m = meta.get(line.id);
      const divines = line.primaryValue ?? 0;
      return {
        name: m?.name ?? String(line.id ?? ""),
        chaosValue: chaosPerDivine > 0 ? divines * chaosPerDivine : divines,
        divineValue: divines,
        icon: m?.image ? `https://web.poecdn.com${m.image}` : "",
        change: line.sparkline?.totalChange ?? 0,
        listingCount: 0,
      };
    });
  }

  // PoE1 currency + item overviews: flat `lines` array.
  return (Array.isArray(d.lines) ? d.lines : []).map((line: any): NinjaLine => ({
    name: line.name ?? line.currencyTypeName ?? "",
    chaosValue: line.chaosValue ?? line.chaosEquivalent ?? line.receive?.value ?? 0,
    divineValue: line.divineValue ?? 0,
    icon: line.icon ?? "",
    change:
      line.sparkLine?.totalChange ??
      line.sparkline?.totalChange ??
      line.receiveSparkLine?.totalChange ??
      0,
    listingCount: line.listingCount ?? line.count ?? 0,
    links: line.links,
    gemLevel: line.gemLevel,
  }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

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

  const url = buildNinjaUrl(game, league, category);

  const response = await fetch(url, {
    headers: { "User-Agent": "exiled-orb/0.1.0" },
  });

  if (!response.ok) {
    throw new Error(`poe.ninja API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const items: PoeNinjaItem[] = parseNinjaResponse(json).map((line) => ({
    name: line.name,
    chaosValue: line.chaosValue,
    divineValue: line.divineValue,
    icon: line.icon,
    links: line.links,
    gemLevel: line.gemLevel,
    listingCount: line.listingCount,
  }));

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
