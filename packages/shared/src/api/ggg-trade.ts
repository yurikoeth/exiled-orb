import type { Game, ParsedItem, PriceResult } from "../types/index.js";
import { RateLimiter } from "./rate-limiter.js";
import { getDivineRate } from "./poe-ninja.js";
import { matchMod } from "../data/stat-mappings.js";

/** GGG Trade API base URLs */
const TRADE_API_URLS: Record<Game, string> = {
  poe1: "https://www.pathofexile.com/api/trade",
  poe2: "https://www.pathofexile.com/api/trade2",
};

/** GGG Trade website URLs (for linking) */
const TRADE_SITE_URLS: Record<Game, string> = {
  poe1: "https://www.pathofexile.com/trade",
  poe2: "https://www.pathofexile.com/trade2",
};

/** Rate limiter for GGG Trade API (12 requests per 10 seconds) */
const tradeLimiter = new RateLimiter(12, 10_000);

/** Build a trade search query for a rare item */
function buildRareQuery(item: ParsedItem, league: string) {
  const filters: Record<string, unknown> = {};

  // Type filter
  const typeFilters: Record<string, unknown> = {};
  if (item.baseType) {
    typeFilters.type = { option: item.baseType };
  }
  if (item.itemClass) {
    typeFilters.category = { option: item.itemClass.toLowerCase().replace(/\s+/g, ".") };
  }
  filters.type_filters = { filters: typeFilters };

  // Mod filters — match against known stat IDs
  const statFilters: Array<{ id: string; value: { min: number } }> = [];
  for (const mod of item.explicits) {
    const matched = matchMod(mod.text);
    if (matched) {
      statFilters.push({
        id: matched.statId,
        value: { min: matched.min },
      });
    }
  }
  // Limit to top 5 stat filters to avoid overly narrow searches
  const topFilters = statFilters.slice(0, 5);

  return {
    query: {
      status: { option: "online" },
      stats: topFilters.length > 0 ? [{ type: "and", filters: topFilters }] : [],
      filters,
    },
    sort: { price: "asc" },
  };
}

/** Convert a listing price to chaos equivalent */
function listingToChaos(price: { amount: number; currency: string }, divineRate: number): number {
  const amount = price.amount || 0;
  switch (price.currency) {
    case "divine":
      return amount * divineRate;
    case "chaos":
    case "chaos_orb":
      return amount;
    case "exalted":
    case "exalted_orb":
      // Exalted orbs are roughly 10-20c depending on league; use a rough estimate
      return amount * 15;
    case "vaal":
      return amount * 0.5;
    default:
      return amount; // assume chaos for unknown currencies
  }
}

/** Search the GGG Trade API for item prices */
export async function searchTrade(item: ParsedItem, league: string): Promise<PriceResult> {
  const baseApiUrl = TRADE_API_URLS[item.game];
  const baseSiteUrl = TRADE_SITE_URLS[item.game];

  try {
    // Get divine rate for accurate currency conversion
    let divineRate: number;
    try {
      divineRate = await getDivineRate(item.game, league);
    } catch {
      divineRate = 200; // fallback if poe.ninja is down
    }

    await tradeLimiter.acquire();

    const query = buildRareQuery(item, league);
    const searchUrl = `${baseApiUrl}/search/${encodeURIComponent(league)}`;

    const searchRes = await fetch(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });

    // Update rate limits from response headers
    tradeLimiter.updateFromHeaders(searchRes.headers);

    if (!searchRes.ok) {
      return makeEmptyResult(item, "none", null, null);
    }

    const searchData = await searchRes.json();
    const resultIds: string[] = searchData.result || [];
    const total: number = searchData.total || 0;
    const tradeSearchId: string = searchData.id || "";
    const tradeUrl = `${baseSiteUrl}/search/${encodeURIComponent(league)}/${tradeSearchId}`;

    if (resultIds.length === 0) {
      return makeEmptyResult(item, "none", 0, tradeUrl);
    }

    // Fetch first 10 results for price estimation
    await tradeLimiter.acquire();
    const fetchIds = resultIds.slice(0, 10).join(",");
    const fetchRes = await fetch(`${baseApiUrl}/fetch/${fetchIds}`, {
      headers: { "Content-Type": "application/json" },
    });
    tradeLimiter.updateFromHeaders(fetchRes.headers);

    if (!fetchRes.ok) {
      return makeEmptyResult(item, "low", total, tradeUrl);
    }

    const fetchData = await fetchRes.json();
    const listings = fetchData.result || [];

    // Extract and normalize prices to chaos
    const prices: number[] = [];
    for (const listing of listings) {
      const price = listing?.listing?.price;
      if (price) {
        prices.push(listingToChaos(price, divineRate));
      }
    }

    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

    return {
      item,
      source: "trade",
      chaosValue: avgPrice,
      divineValue: avgPrice && divineRate > 0 ? avgPrice / divineRate : null,
      confidence: total > 10 ? "fuzzy" : "low",
      listingCount: total,
      priceRange: minPrice !== null && maxPrice !== null ? [minPrice, maxPrice] : null,
      tradeUrl,
      timestamp: Date.now(),
    };
  } catch {
    return makeEmptyResult(item, "none", null, null);
  }
}

function makeEmptyResult(
  item: ParsedItem,
  confidence: PriceResult["confidence"],
  listingCount: number | null,
  tradeUrl: string | null
): PriceResult {
  return {
    item,
    source: "trade",
    chaosValue: null,
    divineValue: null,
    confidence,
    listingCount,
    priceRange: null,
    tradeUrl,
    timestamp: Date.now(),
  };
}

/** Get the trade limiter status */
export function getTradeRateStatus() {
  return tradeLimiter.status;
}
