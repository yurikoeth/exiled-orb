import { describe, it, expect } from "vitest";
import { evaluateItem } from "../mod-tiers.js";

// A PoE1 body-armour roll set that scores well on tiers alone.
const STRONG_MODS = ["+125 to maximum Life", "+45% to Fire Resistance", "+44% to Cold Resistance"];

describe("evaluateItem — item-level discount", () => {
  it("prices the same mods far lower on leveling gear than on endgame gear", () => {
    const leveling = evaluateItem(STRONG_MODS, 29, null, null, "poe1");
    const endgame = evaluateItem(STRONG_MODS, 86, null, null, "poe1");
    expect(leveling.estimatedChaos.max).toBeLessThanOrEqual(3);
    expect(leveling.estimatedChaos.min).toBeLessThanOrEqual(1);
    expect(endgame.estimatedChaos.max).toBeGreaterThan(leveling.estimatedChaos.max);
  });

  it("uses a softer cap between ilvl 50 and endgame, none at endgame", () => {
    const mid = evaluateItem(STRONG_MODS, 60, null, null, "poe1");
    expect(mid.estimatedChaos.max).toBeLessThanOrEqual(10);
    const poe2Endgame = evaluateItem(["+200 to maximum Life"], 65, null, null, "poe2");
    const poe2Leveling = evaluateItem(["+200 to maximum Life"], 64, null, null, "poe2");
    expect(poe2Leveling.estimatedChaos.max).toBeLessThanOrEqual(10);
    expect(poe2Endgame.estimatedChaos.max).toBeGreaterThanOrEqual(poe2Leveling.estimatedChaos.max);
  });

  it("leaves items with no item level alone", () => {
    const unknown = evaluateItem(STRONG_MODS, null, null, null, "poe1");
    const endgame = evaluateItem(STRONG_MODS, 86, null, null, "poe1");
    expect(unknown.estimatedChaos).toEqual(endgame.estimatedChaos);
  });
});
