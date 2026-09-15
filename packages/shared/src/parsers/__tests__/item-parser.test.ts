import { describe, it, expect } from "vitest";
import { parseItem, isPoEItem } from "../item-parser.js";

// ===== Sample clipboard texts from PoE =====

const RARE_BODY_ARMOUR = `Item Class: Body Armours
Rarity: Rare
Doom Shell
Astral Plate
--------
Quality: +20% (augmented)
Armour: 802 (augmented)
--------
Requirements:
Level: 62
Str: 180
--------
Sockets: R-R-R-R-R-R
--------
Item Level: 84
--------
+12% to all Elemental Resistances (implicit)
--------
+92 to maximum Life
+42% to Fire Resistance
+38% to Cold Resistance
+33% to Lightning Resistance
18% increased Armour
--------
Corrupted`;

const UNIQUE_WEAPON = `Item Class: Daggers
Rarity: Unique
Heartbreaker
Royal Skean
--------
Dagger
Physical Damage: 22-86
Critical Hit Chance: 6.30%
Attacks per Second: 1.40
--------
Requirements:
Level: 50
Dex: 71
Int: 102
--------
Sockets: B-B-G
--------
Item Level: 72
--------
+50 to maximum Mana
Adds 1 to 40 Lightning Damage to Spells
Spell Damage modifiers apply to this Weapon's Attacks`;

const CURRENCY = `Item Class: Currency
Rarity: Currency
Chaos Orb
--------
Stack Size: 14/20
--------
Reforges a rare item with new random modifiers`;

const GEM = `Item Class: Gems
Rarity: Gem
Spark
--------
Spell, Projectile, Duration, Lightning
Level: 20
Mana Cost: 17
Cast Time: 0.65 sec
Critical Hit Chance: 5.00%
--------
Requirements:
Level: 70
Int: 155
--------
Deals 40 to 751 Lightning Damage
Projectiles have 12% chance to Pierce`;

const DIVINATION_CARD = `Item Class: Divination Cards
Rarity: Divination Card
The Doctor
--------
Stack Size: 1/8
--------
A Mirror of Kalandra`;

const MAP = `Item Class: Maps
Rarity: Rare
Ghastly Pit
Strand Map
--------
Map Tier: 16
Item Quantity: +78% (augmented)
Item Rarity: +34% (augmented)
Monster Pack Size: +22% (augmented)
Quality: +10% (augmented)
--------
Item Level: 83
--------
Monsters reflect 13% of Elemental Damage
Players cannot Regenerate Life, Mana or Energy Shield
+40% Monster Physical Damage
Monsters fire 2 additional Projectiles`;

const MAGIC_ITEM = `Item Class: Helmets
Rarity: Magic
Burnished Sallet of the Walrus
--------
Armour: 144
--------
Requirements:
Level: 37
Str: 42
--------
Item Level: 45
--------
+33 to maximum Life`;

// ===== Tests =====

describe("isPoEItem", () => {
  it("detects valid PoE item text", () => {
    expect(isPoEItem(RARE_BODY_ARMOUR)).toBe(true);
    expect(isPoEItem(CURRENCY)).toBe(true);
    expect(isPoEItem(GEM)).toBe(true);
    expect(isPoEItem(MAP)).toBe(true);
  });

  it("rejects non-item text", () => {
    expect(isPoEItem("Hello world")).toBe(false);
    expect(isPoEItem("")).toBe(false);
    expect(isPoEItem("Just some random clipboard content")).toBe(false);
  });
});

describe("parseItem", () => {
  describe("Rare items", () => {
    it("parses a rare body armour correctly", () => {
      const item = parseItem(RARE_BODY_ARMOUR);

      expect(item.rarity).toBe("Rare");
      expect(item.name).toBe("Doom Shell");
      expect(item.baseType).toBe("Astral Plate");
      expect(item.itemClass).toBe("Body Armours");
      expect(item.itemLevel).toBe(84);
      expect(item.quality).toBe(20);
      expect(item.sockets).toBe("R-R-R-R-R-R");
      expect(item.links).toBe(6);
      expect(item.corrupted).toBe(true);
      expect(item.requirements.Level).toBe(62);
      expect(item.requirements.Str).toBe(180);
    });

    it("parses implicit and explicit mods", () => {
      const item = parseItem(RARE_BODY_ARMOUR);

      expect(item.implicits.length).toBeGreaterThanOrEqual(1);
      expect(item.implicits[0].text).toContain("Elemental Resistances");

      expect(item.explicits.length).toBeGreaterThanOrEqual(4);
      const modTexts = item.explicits.map((m) => m.text);
      expect(modTexts.some((t) => t.includes("maximum Life"))).toBe(true);
      expect(modTexts.some((t) => t.includes("Fire Resistance"))).toBe(true);
    });
  });

  describe("Unique items", () => {
    it("parses a unique weapon correctly", () => {
      const item = parseItem(UNIQUE_WEAPON);

      expect(item.rarity).toBe("Unique");
      expect(item.name).toBe("Heartbreaker");
      expect(item.baseType).toBe("Royal Skean");
      expect(item.itemClass).toBe("Daggers");
      expect(item.itemLevel).toBe(72);
    });
  });

  describe("Currency", () => {
    it("parses currency items", () => {
      const item = parseItem(CURRENCY);

      expect(item.rarity).toBe("Currency");
      expect(item.baseType).toBe("Chaos Orb");
      expect(item.itemClass).toBe("Currency");
      expect(item.stackSize).toBe(14);
    });
  });

  describe("Gems", () => {
    it("parses gem items", () => {
      const item = parseItem(GEM);

      expect(item.rarity).toBe("Gem");
      expect(item.baseType).toBe("Spark");
      expect(item.itemClass).toBe("Gems");
      expect(item.gemLevel).toBe(20);
    });
  });

  describe("Divination Cards", () => {
    it("parses divination cards", () => {
      const item = parseItem(DIVINATION_CARD);

      expect(item.rarity).toBe("Divination Card");
      expect(item.baseType).toBe("The Doctor");
      expect(item.itemClass).toBe("Divination Cards");
      expect(item.stackSize).toBe(1);
    });
  });

  describe("Maps", () => {
    it("parses maps with mods", () => {
      const item = parseItem(MAP);

      expect(item.rarity).toBe("Rare");
      expect(item.name).toBe("Ghastly Pit");
      expect(item.baseType).toBe("Strand Map");
      expect(item.itemClass).toBe("Maps");
      expect(item.mapTier).toBe(16);
      expect(item.itemLevel).toBe(83);
    });

    it("extracts map mods as explicits", () => {
      const item = parseItem(MAP);
      const modTexts = item.explicits.map((m) => m.text);

      expect(modTexts.some((t) => t.includes("reflect"))).toBe(true);
      expect(modTexts.some((t) => t.includes("Regenerate"))).toBe(true);
      expect(modTexts.some((t) => t.includes("Projectiles"))).toBe(true);
    });
  });

  describe("Magic items", () => {
    it("parses magic items", () => {
      const item = parseItem(MAGIC_ITEM);

      expect(item.rarity).toBe("Magic");
      expect(item.baseType).toBe("Burnished Sallet of the Walrus");
      expect(item.name).toBeNull();
      expect(item.itemClass).toBe("Helmets");
      expect(item.itemLevel).toBe(45);
    });
  });

  describe("Edge cases", () => {
    it("throws on empty text", () => {
      expect(() => parseItem("")).toThrow();
    });

    it("detects corrupted status", () => {
      const item = parseItem(RARE_BODY_ARMOUR);
      expect(item.corrupted).toBe(true);
    });

    it("non-corrupted item has corrupted=false", () => {
      const item = parseItem(UNIQUE_WEAPON);
      expect(item.corrupted).toBe(false);
    });
  });
});

// ===== Advanced mod descriptions (Alt-copy / in-game option) =====

const POE2_ADVANCED_SCEPTRE = `Item Class: Sceptres
Rarity: Rare
Plague Call
Rattling Sceptre
--------
Spirit: 120 (augmented)
--------
Requires: Level 26
--------
Sockets: S 
--------
Item Level: 41
--------
+9 to Intelligence (rune)
--------
Grants Skill: Level 11 Skeletal Warrior Minion
--------
{ Prefix Modifier "Heated" (Tier: 9) — Damage, Elemental, Fire, Attack }
Allies in your Presence deal 2(1-2) to 3(3-4) added Attack Fire Damage
{ Prefix Modifier "Lord's" (Tier: 8) }
20(20-26)% increased Spirit
{ Prefix Modifier "Honed" (Tier: 6) — Damage, Physical, Attack }
Allies in your Presence deal 5(4-6) to 8(8-11) added Attack Physical Damage
{ Suffix Modifier "of the Lion" (Tier: 5) — Attribute }
+20(17-20) to Strength
{ Suffix Modifier "of the Despot" (Tier: 3) — Minion, Gem }
+2 to Level of all Minion Skills
{ Suffix Modifier "of Joy" (Tier: 5) — Mana }
25(20-29)% increased Mana Regeneration Rate`;

describe("advanced mod descriptions", () => {
  const item = parseItem(POE2_ADVANCED_SCEPTRE);
  const texts = item.explicits.map((m) => m.text);

  it("drops the { Modifier … } metadata lines", () => {
    expect(texts.some((t) => t.startsWith("{"))).toBe(false);
  });

  it("strips roll ranges so mods read like a plain copy", () => {
    expect(texts).toContain("20% increased Spirit");
    expect(texts).toContain("+20 to Strength");
    expect(texts).toContain("Allies in your Presence deal 2 to 3 added Attack Fire Damage");
    expect(texts).toContain("25% increased Mana Regeneration Rate");
  });

  it("keeps the game's tier on each affix", () => {
    const byText = Object.fromEntries(item.explicits.map((m) => [m.text, m.gameTier]));
    expect(byText["20% increased Spirit"]).toBe(8);
    expect(byText["+20 to Strength"]).toBe(5);
    expect(byText["+2 to Level of all Minion Skills"]).toBe(3);
  });

  it("lists exactly the six affixes as explicits", () => {
    expect(item.explicits).toHaveLength(6);
    expect(texts.some((t) => t.startsWith("Spirit:") || t.startsWith("Requires:"))).toBe(false);
    expect(texts.some((t) => t.startsWith("Grants Skill:"))).toBe(false);
  });

  it("keeps the rune out of the affix list", () => {
    expect(texts.some((t) => t.includes("Intelligence"))).toBe(false);
    const rune = item.enchants.find((m) => m.type === "rune");
    expect(rune?.text).toBe("+9 to Intelligence");
  });

  it("reads PoE2 one-line requirements and properties", () => {
    expect(item.requirements.Level).toBe(26);
    expect(item.properties["Spirit"]).toBe("120 (augmented)");
    expect(item.properties["Grants Skill"]).toBe("Level 11 Skeletal Warrior Minion");
  });

  it("still detects the game and item basics", () => {
    expect(item.game).toBe("poe2");
    expect(item.rarity).toBe("Rare");
    expect(item.baseType).toBe("Rattling Sceptre");
    expect(item.itemLevel).toBe(41);
  });
});
