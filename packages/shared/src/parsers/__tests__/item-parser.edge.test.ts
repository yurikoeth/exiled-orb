import { describe, it, expect } from "vitest";
import { parseItem, isPoEItem } from "../item-parser.js";

const RARE_LINKED = `Item Class: Body Armours
Rarity: Rare
Doom Shell
Astral Plate
--------
Quality: +20% (augmented)
Armour: 1200 (augmented)
--------
Requirements:
Level: 62
Str: 180
--------
Sockets: R-R-R-G-B B
--------
Item Level: 86
--------
+12% to all Elemental Resistances (implicit)
--------
+120 to maximum Life
+46% to Fire Resistance
+15% to Cold Resistance (crafted)
+30 to Strength (fractured)
--------
Elder Item
Shaper Item`;

const POE2_CROSSBOW = `Item Class: Crossbows
Rarity: Rare
Grim Core
Bombard Crossbow
--------
Physical Damage: 40-90
Critical Hit Chance: 5.00%
Attacks per Second: 1.60
--------
Requirements:
Level: 55
Str: 60
Dex: 60
--------
Item Level: 72
--------
+45 to Spirit
80% increased Physical Damage`;

const POE2_BODY = `Item Class: Body Armours
Rarity: Rare
Havoc Shell
Vaal Cuirass
--------
Item Level: 79
--------
+130 to maximum Life
+40% to Critical Damage Bonus`;

const GEM = `Item Class: Skill Gems
Rarity: Gem
Fireball
--------
Level: 20
Quality: +20% (augmented)
--------
Requirements:
Level: 70
Int: 155
--------
Corrupted`;

const CURRENCY_STACK = `Item Class: Stackable Currency
Rarity: Currency
Chaos Orb
--------
Stack Size: 37/40
--------
Reforges a rare item with new random modifiers`;

const MAGIC = `Item Class: Rings
Rarity: Magic
Sapphire Ring of the Walrus
--------
Item Level: 50
--------
+30% to Cold Resistance (implicit)
--------
+35% to Cold Resistance`;

const UNIDENTIFIED = `Item Class: Boots
Rarity: Rare
Titan Greaves
--------
Item Level: 84
--------
Unidentified`;

const MIRRORED = `Item Class: Wands
Rarity: Rare
Apocalypse Song
Imbued Wand
--------
Item Level: 85
--------
110% increased Spell Damage
--------
Mirrored`;

describe("parseItem — PoE1 structure", () => {
  const item = parseItem(RARE_LINKED);

  it("reads name, base, class and rarity", () => {
    expect(item.name).toBe("Doom Shell");
    expect(item.baseType).toBe("Astral Plate");
    expect(item.itemClass).toBe("Body Armours");
    expect(item.rarity).toBe("Rare");
    expect(item.game).toBe("poe1");
  });

  it("counts the longest link group", () => {
    expect(item.sockets).toBe("R-R-R-G-B B");
    expect(item.links).toBe(5);
  });

  it("reads quality, item level and requirements", () => {
    expect(item.quality).toBe(20);
    expect(item.itemLevel).toBe(86);
    expect(item.requirements).toEqual({ Level: 62, Str: 180 });
  });

  it("collects armour properties", () => {
    expect(item.properties.Armour).toBe("1200 (augmented)");
  });

  it("separates implicit, crafted and fractured mods", () => {
    expect(item.implicits.map((m) => m.text)).toEqual(["+12% to all Elemental Resistances"]);
    expect(item.explicits.map((m) => m.type)).toEqual([
      "explicit",
      "explicit",
      "crafted",
      "fractured",
    ]);
    expect(item.explicits[2].text).toBe("+15% to Cold Resistance");
  });

  it("detects influences", () => {
    expect(item.influences).toEqual(["Shaper", "Elder"]);
  });
});

describe("parseItem — PoE2 detection", () => {
  it("detects PoE2 from an exclusive item class", () => {
    const item = parseItem(POE2_CROSSBOW);
    expect(item.game).toBe("poe2");
    expect(item.properties["Critical Hit Chance"]).toBe("5.00%");
    expect(item.explicits.map((m) => m.text)).toEqual([
      "+45 to Spirit",
      "80% increased Physical Damage",
    ]);
  });

  it("detects PoE2 from Critical Damage Bonus on a shared item class", () => {
    expect(parseItem(POE2_BODY).game).toBe("poe2");
  });

  it("treats the old socket-link format as PoE1 regardless of other hints", () => {
    expect(parseItem(RARE_LINKED).game).toBe("poe1");
  });
});

describe("parseItem — other item kinds", () => {
  it("reads gem level from the gem section, not the requirements", () => {
    const gem = parseItem(GEM);
    expect(gem.rarity).toBe("Gem");
    expect(gem.gemLevel).toBe(20);
    expect(gem.quality).toBe(20);
    expect(gem.requirements.Level).toBe(70);
    expect(gem.corrupted).toBe(true);
  });

  it("reads the current stack size", () => {
    const cur = parseItem(CURRENCY_STACK);
    expect(cur.stackSize).toBe(37);
    expect(cur.name).toBeNull();
    expect(cur.baseType).toBe("Chaos Orb");
  });

  it("keeps a magic item's full name as the base type", () => {
    const ring = parseItem(MAGIC);
    expect(ring.name).toBeNull();
    expect(ring.baseType).toBe("Sapphire Ring of the Walrus");
    expect(ring.implicits).toHaveLength(1);
    expect(ring.explicits).toHaveLength(1);
  });

  it("flags unidentified and mirrored items", () => {
    expect(parseItem(UNIDENTIFIED).unidentified).toBe(true);
    expect(parseItem(UNIDENTIFIED).explicits).toEqual([]);
    expect(parseItem(MIRRORED).mirrored).toBe(true);
  });

  it("falls back to the base as the name for a rare with one header line", () => {
    const item = parseItem(`Item Class: Rings\nRarity: Rare\nOnly Line\n--------\nItem Level: 1`);
    expect(item.name).toBe("Only Line");
    expect(item.baseType).toBe("Only Line");
  });

  it("throws on whitespace-only input", () => {
    expect(() => parseItem("   \n  ")).toThrow();
  });
});

describe("isPoEItem", () => {
  it("accepts Item Class headers and Rarity + separator bodies", () => {
    expect(isPoEItem("Item Class: Rings\nRarity: Rare")).toBe(true);
    expect(isPoEItem("Rarity: Unique\nHeadhunter")).toBe(true);
    expect(isPoEItem("junk\nRarity: Rare\n--------\nmore")).toBe(true);
  });

  it("rejects text that merely mentions Rarity without structure", () => {
    expect(isPoEItem("the Rarity: of this drop is amazing")).toBe(false);
    expect(isPoEItem("https://example.com")).toBe(false);
  });
});
