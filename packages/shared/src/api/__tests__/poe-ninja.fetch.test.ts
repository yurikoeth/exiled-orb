import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchCategory, lookupPrice, getDivineRate, clearCache } from "../poe-ninja.js";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Too Many Requests",
    json: async () => body,
  };
}

const CURRENCY_PAYLOAD = {
  lines: [
    { currencyTypeName: "Divine Orb", chaosEquivalent: 180, receiveSparkLine: { totalChange: 2 } },
    { currencyTypeName: "Chaos Orb", chaosEquivalent: 1 },
  ],
};

const UNIQUE_PAYLOAD = {
  lines: [
    { name: "Tabula Rasa", chaosValue: 10, links: 6, listingCount: 300 },
    { name: "Tabula Rasa", chaosValue: 5, links: 0, listingCount: 900 },
    { name: "Kaom's Heart", chaosValue: 50, listingCount: 40 },
  ],
};

describe("poe.ninja fetch layer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    clearCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches once per game/league/category and serves the cache afterwards", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CURRENCY_PAYLOAD));
    const first = await fetchCategory("poe1", "Allflame", "Currency");
    const second = await fetchCategory("poe1", "Allflame", "Currency");
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("league=Allflame&type=Currency");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { "User-Agent": "exiled-orb/1.0.0" },
    });
  });

  it("keys the cache by league and game", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CURRENCY_PAYLOAD));
    await fetchCategory("poe1", "Allflame", "Currency");
    await fetchCategory("poe1", "Standard", "Currency");
    await fetchCategory("poe2", "Allflame", "Currency");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("re-fetches after the cache TTL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CURRENCY_PAYLOAD));
    await fetchCategory("poe1", "Allflame", "Currency");
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await fetchCategory("poe1", "Allflame", "Currency");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a non-2xx response and does not cache it", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 429));
    await expect(fetchCategory("poe1", "Allflame", "Currency")).rejects.toThrow(/429/);
    fetchMock.mockResolvedValueOnce(jsonResponse(CURRENCY_PAYLOAD));
    await expect(fetchCategory("poe1", "Allflame", "Currency")).resolves.toHaveLength(2);
  });

  it("clearCache forces the next call to hit the network", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CURRENCY_PAYLOAD));
    await fetchCategory("poe1", "Allflame", "Currency");
    clearCache();
    await fetchCategory("poe1", "Allflame", "Currency");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("lookupPrice", () => {
    it("matches case-insensitively and prefers the most-listed variant", async () => {
      fetchMock.mockResolvedValue(jsonResponse(UNIQUE_PAYLOAD));
      const hit = await lookupPrice("poe1", "Allflame", "UniqueArmour", "tabula rasa");
      expect(hit?.chaosValue).toBe(5);
      expect(hit?.listingCount).toBe(900);
    });

    it("filters by links when requested", async () => {
      fetchMock.mockResolvedValue(jsonResponse(UNIQUE_PAYLOAD));
      const hit = await lookupPrice("poe1", "Allflame", "UniqueArmour", "Tabula Rasa", {
        links: 6,
      });
      expect(hit?.chaosValue).toBe(10);
    });

    it("returns null when nothing matches", async () => {
      fetchMock.mockResolvedValue(jsonResponse(UNIQUE_PAYLOAD));
      expect(await lookupPrice("poe1", "Allflame", "UniqueArmour", "Headhunter")).toBeNull();
      expect(
        await lookupPrice("poe1", "Allflame", "UniqueArmour", "Tabula Rasa", { gemLevel: 21 })
      ).toBeNull();
    });
  });

  describe("getDivineRate", () => {
    it("reads the Divine Orb chaos value", async () => {
      fetchMock.mockResolvedValue(jsonResponse(CURRENCY_PAYLOAD));
      expect(await getDivineRate("poe1", "Allflame")).toBe(180);
    });

    it("returns 0 when Divine Orb is absent", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ lines: [] }));
      expect(await getDivineRate("poe1", "Allflame")).toBe(0);
    });
  });
});
