import { describe, it, expect } from "vitest";
import { STAT_MAPPINGS, matchMod } from "../stat-mappings.js";

describe("matchMod", () => {
  it("maps a mod to its stat id and uses 80% of the roll as the minimum", () => {
    expect(matchMod("+120 to maximum Life")).toEqual({
      statId: "explicit.stat_3299347043",
      min: 96,
    });
    expect(matchMod("+46% to Fire Resistance")).toEqual({
      statId: "explicit.stat_3372524247",
      min: 36,
    });
  });

  it("keeps the exact value for non-scaling mods such as gem levels", () => {
    expect(matchMod("+1 to Level of all Skill Gems")).toEqual({
      statId: "explicit.stat_2843100721",
      min: 1,
    });
  });

  it("reads the current life regen wording", () => {
    expect(matchMod("Regenerate 20 Life per second")?.min).toBe(16);
    expect(matchMod("20 Life Regenerated per second")).toBeNull();
  });

  it("returns null for unknown mods", () => {
    expect(matchMod("Socketed Gems are Supported by Level 20 Fortify")).toBeNull();
  });

  it("has no duplicate stat ids", () => {
    const ids = STAT_MAPPINGS.map((m) => m.statId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
