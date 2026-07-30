import { describe, it, expect } from "vitest";
import { buildNinjaUrl, parseNinjaResponse } from "../poe-ninja.js";
import { getCurrentLeague } from "../../data/seasons.js";

describe("buildNinjaUrl", () => {
  it("routes PoE1 currency to the stash currency overview", () => {
    expect(buildNinjaUrl("poe1", "Allflame", "Currency")).toBe(
      "https://poe.ninja/poe1/api/economy/stash/current/currency/overview?league=Allflame&type=Currency"
    );
  });

  it("routes PoE2 currency to the exchange overview", () => {
    expect(buildNinjaUrl("poe2", "Runes of Aldur", "Currency")).toBe(
      "https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency"
    );
  });

  it("routes items to the stash item overview for both games", () => {
    expect(buildNinjaUrl("poe1", "Allflame", "UniqueWeapon")).toBe(
      "https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=Allflame&type=UniqueWeapon"
    );
    expect(buildNinjaUrl("poe2", "Runes of Aldur", "UniqueWeapon")).toContain(
      "/poe2/api/economy/stash/current/item/overview?"
    );
  });
});

describe("parseNinjaResponse", () => {
  // Field shapes captured from the live API, 2026-07-30.

  it("parses PoE1 currency overview lines", () => {
    const lines = parseNinjaResponse({
      lines: [
        {
          currencyTypeName: "Divine Orb",
          chaosEquivalent: 187.5,
          receive: { value: 187.1 },
          receiveSparkLine: { totalChange: 3.2 },
        },
        {
          currencyTypeName: "Hinekora's Lock",
          receive: { value: 4200 },
          receiveSparkLine: { totalChange: -1.1 },
        },
      ],
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ name: "Divine Orb", chaosValue: 187.5, change: 3.2 });
    // chaosEquivalent missing → falls back to receive.value
    expect(lines[1]).toMatchObject({ name: "Hinekora's Lock", chaosValue: 4200 });
  });

  it("parses PoE1 item overview lines, including the sparkLine casing", () => {
    const lines = parseNinjaResponse({
      lines: [
        {
          name: "The Wellhook",
          chaosValue: 12.5,
          divineValue: 0.06,
          icon: "https://web.poecdn.com/x.png",
          sparkLine: { totalChange: -7.5 },
          listingCount: 42,
        },
      ],
    });
    expect(lines[0]).toMatchObject({
      name: "The Wellhook",
      chaosValue: 12.5,
      divineValue: 0.06,
      change: -7.5,
      listingCount: 42,
    });
  });

  it("joins PoE2 exchange lines with item metadata and converts via rates", () => {
    const lines = parseNinjaResponse({
      core: { primary: "divine", secondary: "chaos", rates: { exalted: 417.8, chaos: 8.72 } },
      items: [{ id: "divine", name: "Divine Orb", image: "/gen/image/abc.png" }],
      lines: [{ id: "divine", primaryValue: 1, sparkline: { totalChange: -4.92 } }],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Divine Orb");
    expect(lines[0].divineValue).toBe(1);
    expect(lines[0].chaosValue).toBeCloseTo(8.72);
    expect(lines[0].change).toBeCloseTo(-4.92);
    expect(lines[0].icon).toBe("https://web.poecdn.com/gen/image/abc.png");
  });

  it("falls back to the id when PoE2 metadata is missing", () => {
    const lines = parseNinjaResponse({
      core: { rates: {} },
      items: [],
      lines: [{ id: "greater-orb-of-transmutation", primaryValue: 0.0003 }],
    });
    expect(lines[0].name).toBe("greater-orb-of-transmutation");
    // no chaos rate → value stays in divines rather than becoming 0
    expect(lines[0].chaosValue).toBeCloseTo(0.0003);
  });

  it("returns empty for malformed payloads", () => {
    expect(parseNinjaResponse(null)).toEqual([]);
    expect(parseNinjaResponse("nope")).toEqual([]);
    expect(parseNinjaResponse({})).toEqual([]);
    expect(parseNinjaResponse({ lines: "not-an-array" })).toEqual([]);
  });
});

describe("getCurrentLeague", () => {
  it("uses the API league id when it differs from the display name", () => {
    // PoE2 0.5: display "Return of the Ancients", economy league "Runes of Aldur"
    expect(getCurrentLeague("poe2")).toBe("Runes of Aldur");
  });

  it("falls back to the season name when no id override exists", () => {
    expect(getCurrentLeague("poe1")).toBe("Allflame");
  });
});
