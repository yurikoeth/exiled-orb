import { describe, it, expect } from "vitest";
import { MAP_DATABASE, findMap, isMapZone, isBossArena, tierFromAreaLevel } from "../map-data.js";

describe("MAP_DATABASE", () => {
  it("never carries a tier — the area level is the only tier source", () => {
    for (const map of MAP_DATABASE) {
      expect(map.tier, map.name).toBeNull();
    }
  });

  it("has no placeholder boss arenas", () => {
    for (const map of MAP_DATABASE) {
      expect(map.bossArenas, map.name).toEqual([]);
    }
  });

  it("has no duplicate names within a game", () => {
    const seen = new Set<string>();
    for (const map of MAP_DATABASE) {
      const key = `${map.game}:${map.name.toLowerCase()}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("uses the current pinnacle arena names", () => {
    expect(findMap("Eye of the Storm", "poe1")?.tags).toContain("sirus");
    expect(findMap("Absence of Value and Meaning", "poe1")?.tags).toContain("elder");
    expect(findMap("Absence of Mercy and Empathy", "poe1")?.tags).toContain("maven");
    expect(findMap("The Shaper's Realm", "poe1")?.tags).toContain("uber-elder");
    expect(findMap("The Burning Monolith", "poe2")?.tags).toContain("pinnacle");
    // Legacy / fabricated names are gone.
    expect(findMap("The Maven's Crucible", "poe1")).toBeNull();
    expect(findMap("The Elder's Domain", "poe1")).toBeNull();
    expect(findMap("The Galvanic King", "poe2")).toBeNull();
    expect(findMap("Torchlit Mines", "poe2")).toBeNull();
  });
});

describe("findMap", () => {
  it("resolves every entry to itself when scoped to its game", () => {
    for (const map of MAP_DATABASE) {
      expect(findMap(map.name, map.game)?.name, `${map.name} (${map.game})`).toBe(map.name);
    }
  });

  it("scopes same-named maps to the requested game", () => {
    for (const name of ["Canyon", "Mesa", "Caldera"]) {
      expect(findMap(name, "poe1")?.game).toBe("poe1");
      expect(findMap(name, "poe2")?.game).toBe("poe2");
    }
  });

  it("matches decorated PoE1 zone names and prefers the longest contained name", () => {
    expect(findMap("Strand Map", "poe1")?.name).toBe("Strand");
    expect(findMap("Underground Sea Map", "poe1")?.name).toBe("Underground Sea");
    expect(findMap("The Withered Willow")?.name).toBe("The Withered Willow");
  });

  it("is exact-only for PoE2 so campaign zones do not read as maps", () => {
    expect(findMap("The Venom Crypts", "poe2")).toBeNull();
    expect(findMap("Chimeral Wetlands", "poe2")).toBeNull();
    expect(findMap("Crypt", "poe2")?.name).toBe("Crypt");
  });

  it("returns null for a zone that is not a map", () => {
    expect(findMap("Lioneye's Watch", "poe1")).toBeNull();
    expect(findMap("The Twilight Strand", "poe2")).toBeNull();
  });
});

describe("isMapZone", () => {
  it("recognises PoE2 waystones by database entry only", () => {
    expect(isMapZone("Sinking Spire", "poe2")).toBe(true);
    expect(isMapZone("The Venom Crypts", "poe2")).toBe(false);
    expect(isMapZone("Clearfell Encampment", "poe2")).toBe(false);
  });

  it("recognises PoE1 maps by the 'X Map' suffix", () => {
    expect(isMapZone("Underground Sea Map", "poe1")).toBe(true);
    expect(isMapZone("Lava Lake Map", "poe1")).toBe(true);
  });

  it("rejects hideouts and towns", () => {
    expect(isMapZone("Coastal Hideout", "poe1")).toBe(false);
    expect(isMapZone("Lioneye's Watch", "poe1")).toBe(false);
  });
});

describe("isBossArena", () => {
  it("no longer flags other maps or campaign zones as a boss arena", () => {
    // "Caldera" used to be Volcano's arena — it is a map in its own right.
    expect(isBossArena("Caldera Map", "poe1")).toBe(false);
    // "Tidal Island" used to be Beach's arena — it is an Act 1 zone.
    expect(isBossArena("The Tidal Island", "poe1")).toBe(false);
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
