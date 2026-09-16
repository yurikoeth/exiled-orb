import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchNinjaCached = vi.hoisted(() => vi.fn<(url: string) => Promise<string>>());
vi.mock("../../utils/ninja-cache", () => ({ fetchNinjaCached, clearNinjaCache: vi.fn() }));

import { checkPrice, getDivineRateCached } from "../usePriceCheck";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "@exiled-orb/shared";
import type { ParsedItem } from "@exiled-orb/shared";

function item(overrides: Partial<ParsedItem>): ParsedItem {
  return {
    raw: "",
    game: "poe1",
    itemClass: "",
    rarity: "Rare",
    name: null,
    baseType: "",
    itemLevel: null,
    quality: null,
    sockets: null,
    links: null,
    implicits: [],
    explicits: [],
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
    ...overrides,
  };
}

const CURRENCY = JSON.stringify({
  lines: [
    { currencyTypeName: "Divine Orb", chaosEquivalent: 150, count: 10 },
    { currencyTypeName: "Chaos Orb", chaosEquivalent: 1 },
  ],
});

/** Serve payloads by the `type=` query parameter of the requested URL. */
function serve(byType: Record<string, string>) {
  fetchNinjaCached.mockImplementation(async (url) => {
    const type = new URL(url).searchParams.get("type") ?? "";
    return byType[type] ?? '{"lines":[]}';
  });
}

describe("checkPrice", () => {
  beforeEach(() => {
    fetchNinjaCached.mockReset();
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("prices currency from the currency overview and converts to divines", async () => {
    serve({ Currency: CURRENCY });
    const result = await checkPrice(
      item({ rarity: "Currency", itemClass: "Stackable Currency", baseType: "Divine Orb" })
    );
    expect(result).toMatchObject({
      source: "poe.ninja",
      chaosValue: 150,
      divineValue: 1,
      confidence: "exact",
      listingCount: 10,
    });
    expect(getDivineRateCached()).toBe(150);
  });

  it("uses the season league for the item's game unless overridden", async () => {
    serve({ Currency: CURRENCY });
    await checkPrice(item({ rarity: "Currency", baseType: "Chaos Orb", game: "poe2" }));
    expect(fetchNinjaCached.mock.calls[0][0]).toContain("league=Runes%20of%20Aldur");

    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, leagues: { poe1: "Standard", poe2: null } },
    });
    fetchNinjaCached.mockClear();
    await checkPrice(item({ rarity: "Currency", baseType: "Chaos Orb", game: "poe1" }));
    expect(fetchNinjaCached.mock.calls[0][0]).toContain("league=Standard");

    fetchNinjaCached.mockClear();
    await checkPrice(item({ rarity: "Currency", baseType: "Chaos Orb" }), "Hardcore");
    expect(fetchNinjaCached.mock.calls[0][0]).toContain("league=Hardcore");
  });

  it("routes uniques to the right category and honours 5/6-link variants", async () => {
    serve({
      UniqueArmour: JSON.stringify({
        lines: [
          { name: "Tabula Rasa", chaosValue: 5, links: 0, listingCount: 900 },
          { name: "Tabula Rasa", chaosValue: 10, links: 6, listingCount: 300 },
        ],
      }),
      UniqueWeapon: JSON.stringify({ lines: [{ name: "Starforge", chaosValue: 400 }] }),
      UniqueAccessory: JSON.stringify({ lines: [{ name: "Headhunter", chaosValue: 9000 }] }),
      Currency: CURRENCY,
    });
    const six = await checkPrice(
      item({ rarity: "Unique", itemClass: "Body Armours", name: "Tabula Rasa", links: 6 })
    );
    expect(six.chaosValue).toBe(10);
    const four = await checkPrice(
      item({ rarity: "Unique", itemClass: "Body Armours", name: "Tabula Rasa", links: 4 })
    );
    expect(four.chaosValue).toBe(5);
    expect(
      (
        await checkPrice(
          item({ rarity: "Unique", itemClass: "Two Hand Swords", name: "Starforge" })
        )
      ).chaosValue
    ).toBe(400);
    expect(
      (await checkPrice(item({ rarity: "Unique", itemClass: "Belts", name: "Headhunter" })))
        .chaosValue
    ).toBe(9000);
    expect(fetchNinjaCached.mock.calls.map((c) => new URL(c[0]).searchParams.get("type"))).toEqual(
      expect.arrayContaining(["UniqueArmour", "UniqueWeapon", "UniqueAccessory"])
    );
  });

  it("routes gems, cards, maps and fragments", async () => {
    serve({
      SkillGem: JSON.stringify({
        lines: [
          { name: "Enlighten Support", chaosValue: 50, gemLevel: 3 },
          { name: "Enlighten Support", chaosValue: 300, gemLevel: 4 },
        ],
      }),
      DivinationCard: JSON.stringify({ lines: [{ name: "The Doctor", chaosValue: 800 }] }),
      Map: JSON.stringify({ lines: [{ name: "Strand Map", chaosValue: 2 }] }),
      Fragment: JSON.stringify({ lines: [{ name: "Timeless Karui Splinter", chaosValue: 3 }] }),
      Currency: CURRENCY,
    });
    expect(
      (
        await checkPrice(
          item({
            rarity: "Gem",
            itemClass: "Support Gems",
            baseType: "Enlighten Support",
            gemLevel: 4,
          })
        )
      ).chaosValue
    ).toBe(300);
    expect(
      (await checkPrice(item({ rarity: "Divination Card", baseType: "The Doctor" }))).chaosValue
    ).toBe(800);
    expect(
      (await checkPrice(item({ rarity: "Normal", itemClass: "Maps", baseType: "Strand Map" })))
        .chaosValue
    ).toBe(2);
    expect(
      (await checkPrice(item({ rarity: "Normal", baseType: "Timeless Karui Splinter" }))).chaosValue
    ).toBe(3);
  });

  it("returns unavailable for rares, unknown items, and HTML/garbage responses", async () => {
    serve({ Currency: CURRENCY });
    const rare = await checkPrice(
      item({ rarity: "Rare", itemClass: "Rings", baseType: "Ruby Ring" })
    );
    expect(rare).toMatchObject({ source: "unavailable", chaosValue: null, confidence: "none" });
    // Rares never hit an item category — only the (cached) Currency overview
    // is fetched, for the divine/exalted rates the estimate is printed in.
    expect(fetchNinjaCached).toHaveBeenCalledTimes(1);
    expect(fetchNinjaCached.mock.calls[0][0]).toContain("type=Currency");

    const unknown = await checkPrice(item({ rarity: "Currency", baseType: "Made Up Orb" }));
    expect(unknown.source).toBe("unavailable");

    fetchNinjaCached.mockResolvedValue("<!DOCTYPE html><html>error</html>");
    expect((await checkPrice(item({ rarity: "Currency", baseType: "Chaos Orb" }))).source).toBe(
      "unavailable"
    );
    fetchNinjaCached.mockRejectedValue(new Error("proxy down"));
    expect((await checkPrice(item({ rarity: "Currency", baseType: "Chaos Orb" }))).source).toBe(
      "unavailable"
    );
  });
});
