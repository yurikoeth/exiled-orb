import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../poe-ninja.js", () => ({
  getDivineRate: vi.fn(async () => 200),
}));

import { searchTrade, getTradeRateStatus } from "../ggg-trade.js";
import { getDivineRate } from "../poe-ninja.js";
import type { ParsedItem } from "../../types/item.js";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, headers: new Headers(), json: async () => body };
}

const ITEM: ParsedItem = {
  raw: "",
  game: "poe1",
  itemClass: "Body Armours",
  rarity: "Rare",
  name: "Doom Shell",
  baseType: "Astral Plate",
  itemLevel: 86,
  quality: null,
  sockets: null,
  links: null,
  implicits: [],
  explicits: [
    { text: "+120 to maximum Life", type: "explicit" },
    { text: "+46% to Fire Resistance", type: "explicit" },
    { text: "some unknown mod", type: "explicit" },
  ],
  enchants: [],
  corrupted: false,
  mirrored: false,
  unidentified: false,
  influences: [],
  stackSize: null,
  mapTier: null,
  gemLevel: null,
  requirements: {},
  properties: {},
};

describe("searchTrade (parked trade client)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(getDivineRate).mockResolvedValue(200);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts a search built from known stat ids, then prices the listings", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "abc", total: 25, result: ["1", "2", "3"] }))
      .mockResolvedValueOnce(
        jsonResponse({
          result: [
            { listing: { price: { amount: 100, currency: "chaos" } } },
            { listing: { price: { amount: 1, currency: "divine" } } },
            { listing: { price: { amount: 2, currency: "exalted" } } },
            { listing: {} },
          ],
        })
      );

    const result = await searchTrade(ITEM, "Allflame");

    const [searchUrl, searchInit] = fetchMock.mock.calls[0];
    expect(searchUrl).toBe("https://www.pathofexile.com/api/trade/search/Allflame");
    const body = JSON.parse(searchInit.body);
    expect(body.query.filters.type_filters.filters.type.option).toBe("Astral Plate");
    expect(body.query.filters.type_filters.filters.category.option).toBe("body.armours");
    // Only the two mods with stat mappings become filters; the min is 80% of the roll.
    expect(body.query.stats[0].filters).toEqual([
      { id: "explicit.stat_3299347043", value: { min: 96 } },
      { id: "explicit.stat_3372524247", value: { min: 36 } },
    ]);

    expect(fetchMock.mock.calls[1][0]).toBe("https://www.pathofexile.com/api/trade/fetch/1,2,3");
    expect(result.source).toBe("trade");
    expect(result.listingCount).toBe(25);
    expect(result.confidence).toBe("fuzzy");
    // chaos 100, 1 div = 200, 2 ex = 30 → avg 110, range [30, 200]
    expect(result.chaosValue).toBeCloseTo(110);
    expect(result.priceRange).toEqual([30, 200]);
    expect(result.divineValue).toBeCloseTo(0.55);
    expect(result.tradeUrl).toBe("https://www.pathofexile.com/trade/search/Allflame/abc");
  });

  it("uses the PoE2 trade endpoints for PoE2 items", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "x", total: 0, result: [] }));
    const result = await searchTrade({ ...ITEM, game: "poe2" }, "Runes of Aldur");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.pathofexile.com/api/trade2/search/Runes%20of%20Aldur"
    );
    expect(result.listingCount).toBe(0);
    expect(result.chaosValue).toBeNull();
    expect(result.tradeUrl).toContain("/trade2/search/");
  });

  it("returns an empty result when the search request fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
    const result = await searchTrade(ITEM, "Allflame");
    expect(result.confidence).toBe("none");
    expect(result.tradeUrl).toBeNull();
  });

  it("marks confidence low when the listing fetch fails but the search worked", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "abc", total: 3, result: ["1"] }))
      .mockResolvedValueOnce(jsonResponse({}, false));
    const result = await searchTrade(ITEM, "Allflame");
    expect(result.confidence).toBe("low");
    expect(result.listingCount).toBe(3);
  });

  it("never throws — network errors become an empty result", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const result = await searchTrade(ITEM, "Allflame");
    expect(result.source).toBe("trade");
    expect(result.chaosValue).toBeNull();
  });

  it("falls back to a 200c divine when poe.ninja is unreachable", async () => {
    vi.mocked(getDivineRate).mockRejectedValueOnce(new Error("ninja down"));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "abc", total: 1, result: ["1"] }))
      .mockResolvedValueOnce(
        jsonResponse({ result: [{ listing: { price: { amount: 1, currency: "divine" } } }] })
      );
    const result = await searchTrade(ITEM, "Allflame");
    expect(result.chaosValue).toBe(200);
  });
});

describe("getTradeRateStatus", () => {
  it("exposes the limiter status", () => {
    const status = getTradeRateStatus();
    expect(status).toBeDefined();
  });
});
