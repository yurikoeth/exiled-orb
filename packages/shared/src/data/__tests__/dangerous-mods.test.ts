import { describe, it, expect } from "vitest";
import { DANGEROUS_MODS, analyzeMod, analyzeMap } from "../dangerous-mods.js";
import type { Game } from "../../types/item.js";

/** Real mod lines as the games print them (poeaffix / poe2db, 2026-09-02). */
const REAL_LINES: [line: string, game: Game, shortName: string][] = [
  // PoE1
  ["Monsters reflect 18% of Elemental Damage", "poe1", "Ele Reflect"],
  ["Monsters reflect 18% of Physical Damage", "poe1", "Phys Reflect"],
  ["-12% maximum Player Resistances", "poe1", "-Max Res"],
  ["Players cannot Regenerate Life, Mana or Energy Shield", "poe1", "No Regen"],
  ["Cannot Leech Life from Monsters", "poe1", "No Leech"],
  ["25% increased Monster Movement Speed", "poe1", "Fast Monsters"],
  ["35% increased Monster Attack Speed", "poe1", "Fast Monsters"],
  ["40% more Monster Life", "poe1", "Monster Life"],
  ["Monsters have +40% chance to Suppress Spell Damage", "poe1", "Spell Suppress"],
  ["Monsters deal 90% extra Physical Damage as Fire", "poe1", "Extra Ele Dmg"],
  ["Players have 25% less Area of Effect", "poe1", "Less AoE"],
  ["Monsters have a 60% chance to avoid Poison, Impale, and Bleeding", "poe1", "Avoid Ailments"],
  ["Players are Cursed with Temporal Chains", "poe1", "Temp Chains"],
  ["Area has patches of Shocked Ground", "poe1", "Shocked Ground"],
  ["Players have 60% less Recovery Rate of Life and Energy Shield", "poe1", "Less Recovery"],
  ["Monsters fire 2 additional Projectiles", "poe1", "Extra Proj"],
  ["Players have 30% less Armour", "poe1", "Less Armour"],
  ["Monster Damage Penetrates 15% Elemental Resistances", "poe1", "Ele Pen"],
  // PoE2
  ["Monsters have 12% increased Attack, Cast and Movement Speed", "poe2", "Fast Monsters"],
  ["Monsters deal 20% of Damage as Extra Cold", "poe2", "Extra Ele Dmg"],
  ["-8% maximum Player Resistances", "poe2", "-Max Res"],
  ["Monsters have 20% chance to Poison on Hit", "poe2", "Poison"],
  ["Players are periodically Cursed with Enfeeble", "poe2", "Enfeeble"],
  ["Monster Damage Penetrates 12% Elemental Resistances", "poe2", "Ele Pen"],
  ["Monsters have 90% increased Stun Buildup", "poe2", "Stun Buildup"],
  ["Players have 30% less Recovery Rate of Life and Energy Shield", "poe2", "Less Recovery"],
  ["Monsters Break Armour equal to 25% of Physical Damage dealt", "poe2", "Armour Break"],
  ["20% more Monster Life", "poe2", "Monster Life"],
];

describe("DANGEROUS_MODS", () => {
  it("matches every real mod line for its game", () => {
    for (const [line, game, shortName] of REAL_LINES) {
      const result = analyzeMod(line, game);
      expect(result.match?.shortName, `${game}: ${line}`).toBe(shortName);
    }
  });

  it("does not report mods that do not exist in the other game", () => {
    // PoE2 has no reflect, no 'cannot regenerate', no spell suppression.
    expect(analyzeMod("Monsters reflect 18% of Elemental Damage", "poe2").match).toBeNull();
    expect(
      analyzeMod("Players cannot Regenerate Life, Mana or Energy Shield", "poe2").match
    ).toBeNull();
    expect(
      analyzeMod("Monsters have +40% chance to Suppress Spell Damage", "poe2").match
    ).toBeNull();
    // PoE1 phrases monster speed per stat, not as one combined line.
    expect(
      analyzeMod("Monsters have 12% increased Attack, Cast and Movement Speed", "poe1").match
    ).toBeNull();
  });

  it("no longer matches the invented wordings the old table used", () => {
    for (const game of ["poe1", "poe2"] as Game[]) {
      expect(analyzeMod("Players have 10% reduced Maximum Resistances", game).danger).toBe("safe");
      expect(analyzeMod("Monsters have 20% increased Attack Speed", game).danger).toBe("safe");
      expect(analyzeMod("Monsters have 40% more Life", game).danger).toBe("safe");
    }
  });

  it("tags every entry with at least one game", () => {
    for (const mod of DANGEROUS_MODS) {
      expect(mod.games.length, mod.shortName).toBeGreaterThan(0);
    }
  });
});

describe("analyzeMap", () => {
  it("reports the worst mod as the overall danger", () => {
    const result = analyzeMap(
      "Strand",
      ["40% more Monster Life", "Monsters reflect 18% of Elemental Damage"],
      "poe1",
      16
    );
    expect(result.overallDanger).toBe("deadly");
    expect(result.dangerCount).toBe(1);
  });

  it("personalises danger for the build", () => {
    const build = { damageTypes: ["elemental"] };
    const result = analyzeMod("Monsters reflect 18% of Physical Damage", "poe1", build);
    expect(result.danger).toBe("dangerous");
    expect(result.personalNote).toBe("Your build handles this well.");
  });
});
