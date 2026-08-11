import { describe, it, expect } from "vitest";
import { MAP_DATABASE, findMap, isMapZone, isBossArena, tierFromAreaLevel } from "../map-data.js";

/**
 * PoE2 waystones whose names contain a shorter PoE1 map name. PoE1 entries
 * come first in MAP_DATABASE, so a first-match lookup resolved every one of
 * these to the wrong game's map — and reported that map's tier.
 */
const CROSS_GAME_SUBSTRINGS: [poe2: string, poe1: string][] = [
  ["Blighted Bog", "Bog"],
  ["Bone Pit", "Pit"],
  ["Haunted Shipyard", "Shipyard"],
  ["Scorched Summit", "Summit"],
  ["Twilight Temple", "Temple"],
];

describe("findMap", () => {
  it("prefers the longest match over the first one in the database", () => {
    for (const [poe2Name, poe1Name] of CROSS_GAME_SUBSTRINGS) {
      const match = findMap(poe2Name);
      expect(match?.name, `${poe2Name} must not resolve to ${poe1Name}`).toBe(poe2Name);
      expect(match?.game).toBe("poe2");
    }
  });

  it("scopes to the requested game", () => {
    expect(findMap("Bog", "poe1")?.game).toBe("poe1");
    expect(findMap("Blighted Bog", "poe2")?.name).toBe("Blighted Bog");
    // A PoE2-only waystone is not found when scoped to PoE1.
    expect(findMap("Blighted Bog", "poe1")?.name).not.toBe("Blighted Bog");
  });

  it("still matches decorated zone names", () => {
    expect(findMap("Strand Map", "poe1")?.name).toBe("Strand");
    expect(findMap("Tier 5 Strand", "poe1")?.name).toBe("Strand");
  });

  it("returns null for a zone that is not a map", () => {
    expect(findMap("Lioneye's Watch", "poe1")).toBeNull();
  });

  it("guards against new cross-game substring collisions", () => {
    // Any future entry that is a substring of another game's entry must still
    // resolve to itself — this is what keeps the fix from silently regressing.
    for (const map of MAP_DATABASE) {
      expect(findMap(map.name)?.name, `${map.name} (${map.game})`).toBe(map.name);
    }
  });
});

describe("isMapZone", () => {
  it("recognises PoE2 waystones by database entry", () => {
    expect(isMapZone("Blighted Bog", "poe2")).toBe(true);
  });

  it("recognises PoE1 maps by the 'X Map' suffix", () => {
    expect(isMapZone("Underground Sea Map", "poe1")).toBe(true);
  });

  it("rejects hideouts and towns", () => {
    expect(isMapZone("Coastal Hideout", "poe1")).toBe(false);
    expect(isMapZone("Lioneye's Watch", "poe1")).toBe(false);
  });
});

describe("isBossArena", () => {
  it("matches a known arena for the right game", () => {
    expect(isBossArena("Meadow Boss Arena", "poe2")).toBe(true);
    expect(isBossArena("Strand Boss Room", "poe1")).toBe(true);
  });

  it("does not match a plain map zone", () => {
    expect(isBossArena("Blighted Bog", "poe2")).toBe(false);
  });
});

describe("tierFromAreaLevel", () => {
  it("converts PoE1 area levels (T1 = 68, T16 = 83)", () => {
    expect(tierFromAreaLevel(68, "poe1")).toBe(1);
    expect(tierFromAreaLevel(72, "poe1")).toBe(5);
    expect(tierFromAreaLevel(83, "poe1")).toBe(16);
  });

  it("converts PoE2 area levels (T1 = 65)", () => {
    expect(tierFromAreaLevel(65, "poe2")).toBe(1);
    expect(tierFromAreaLevel(79, "poe2")).toBe(15);
  });

  it("returns null below tier 1 rather than a nonsensical tier", () => {
    expect(tierFromAreaLevel(60, "poe1")).toBeNull();
    expect(tierFromAreaLevel(1, "poe2")).toBeNull();
  });

  it("never returns the area level itself for a real map level", () => {
    // The bug being guarded: areaLevel was passed straight through as tier.
    expect(tierFromAreaLevel(83, "poe1")).not.toBe(83);
  });
});
