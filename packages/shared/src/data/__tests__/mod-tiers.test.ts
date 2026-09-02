import { describe, it, expect } from "vitest";
import { getModDB, evaluateMod, evaluateItem } from "../mod-tiers.js";

describe("mod tier tables", () => {
  for (const game of ["poe1", "poe2"] as const) {
    describe(game, () => {
      it("has consistent tier ranges", () => {
        for (const range of getModDB(game)) {
          for (let i = 0; i < 5; i++) {
            expect(range.tiers[i], `${range.name} T${i + 1} min > max`).toBeLessThanOrEqual(
              range.maxRolls[i]
            );
            if (i > 0) {
              expect(range.tiers[i], `${range.name} tiers not descending`).toBeLessThanOrEqual(
                range.tiers[i - 1]
              );
              expect(
                range.maxRolls[i],
                `${range.name} maxRolls not descending`
              ).toBeLessThanOrEqual(range.maxRolls[i - 1]);
            }
          }
        }
      });
    });
  }
});

describe("evaluateMod (PoE1)", () => {
  it("reads the current life regen wording", () => {
    expect(evaluateMod("Regenerate 20 Life per second", "poe1")?.tier).toBe(1);
    expect(evaluateMod("Regenerate 7.5 Life per second", "poe1")?.tier).toBe(5);
    // The pre-3.16 wording is not something the game prints any more.
    expect(evaluateMod("20 Life Regenerated per second", "poe1")).toBeNull();
  });

  it("rates real PoE1 top tiers as T1", () => {
    expect(evaluateMod("+125 to maximum Life", "poe1")?.tier).toBe(1);
    expect(evaluateMod("+46% to Fire Resistance", "poe1")?.tier).toBe(1);
    expect(evaluateMod("+35% to Chaos Resistance", "poe1")?.tier).toBe(1);
    expect(evaluateMod("+55 to Strength", "poe1")?.tier).toBe(1);
    expect(evaluateMod("+38% to Global Critical Strike Multiplier", "poe1")?.tier).toBe(1);
    expect(evaluateMod("35% increased Movement Speed", "poe1")?.tier).toBe(1);
  });

  it("does not exceed the real roll cap", () => {
    const chaos = evaluateMod("+35% to Chaos Resistance", "poe1");
    expect(chaos?.rollPercent).toBe(100);
    const str = evaluateMod("+51 to Strength", "poe1");
    expect(str?.rollPercent).toBe(0);
  });

  it("rates flat lightning by its high roll", () => {
    const mod = evaluateMod("Adds 4 to 160 Lightning Damage", "poe1");
    expect(mod?.name).toBe("Flat Lightning");
    expect(mod?.tier).toBe(1);
  });

  it("keeps spell crit separate from global crit", () => {
    expect(evaluateMod("100% increased Critical Strike Chance for Spells", "poe1")?.name).toBe(
      "Spell Crit"
    );
    expect(evaluateMod("35% increased Global Critical Strike Chance", "poe1")?.name).toBe(
      "Crit Chance"
    );
  });
});

describe("evaluateMod (PoE2)", () => {
  it("reads Spirit in the game's wording", () => {
    expect(evaluateMod("+58 to Spirit", "poe2")?.tier).toBe(1);
    expect(evaluateMod("+48 to Spirit", "poe2")?.tier).toBe(4);
    expect(evaluateMod("+58 Spirit", "poe2")?.name).toBe("Spirit");
  });

  it("reads Critical Hit Chance / Critical Damage Bonus", () => {
    expect(evaluateMod("25% increased Critical Hit Chance", "poe2")?.name).toBe("Crit Chance");
    expect(evaluateMod("+40% to Critical Damage Bonus", "poe2")?.name).toBe("Crit Damage");
    expect(evaluateMod("25% increased Critical Strike Chance", "poe2")).toBeNull();
  });

  it("uses PoE2 life ranges", () => {
    expect(evaluateMod("+210 to maximum Life", "poe2")?.tier).toBe(1);
    expect(evaluateMod("+120 to maximum Life", "poe2")?.tier).toBe(5);
  });

  it("reads both life regen wordings", () => {
    expect(evaluateMod("Regenerate 34.2 Life per second", "poe2")?.tier).toBe(1);
    expect(evaluateMod("+34.2 Life Regeneration per second", "poe2")?.tier).toBe(1);
  });
});

describe("evaluateItem", () => {
  it("detects the life + res combo", () => {
    const item = evaluateItem(
      ["+120 to maximum Life", "+46% to Fire Resistance", "+45% to Cold Resistance"],
      86,
      null,
      null,
      "poe1"
    );
    expect(item.hasLifePlusRes).toBe(true);
    expect(item.t1Count).toBe(2);
  });
});
