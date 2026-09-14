/**
 * Mod tier ranges for evaluating rare items.
 * T1 = best, T5 = worst of the top five. Values are the minimum roll for that
 * tier; `maxRolls` is the top of each tier's range. Used to rate mods on
 * Ctrl+C'd items.
 *
 * Tiers are SLOT-APPROXIMATE: each table takes the five best tiers of the
 * slot where the mod rolls highest (body armour for life, weapons for attack
 * speed, amulets for crit multi…). A ring's T1 life (70–79) therefore falls
 * below the T5 floor (80) and shows untiered — the score is a heuristic,
 * not a crafting reference.
 *
 * PoE1 numbers verified against poeaffix.net on 2026-09-02 unless a row says
 * UNVERIFIED (poeaffix had no data; values kept from the original table).
 * PoE2 numbers verified against poe2db where its keyword pages expose affix
 * tables (Life, Mana, Spirit, life regen); the rest are UNVERIFIED.
 */

import type { Game } from "../types/item.js";

export interface ModTierRange {
  pattern: RegExp;
  name: string;
  /** Category for grouping */
  category: "life" | "res" | "damage" | "defense" | "utility" | "crit" | "speed" | "gem" | "spirit";
  /** [T1min, T2min, T3min, T4min, T5min] — values below T5 are junk */
  tiers: [number, number, number, number, number];
  /** [T1max, T2max, T3max, T4max, T5max] — max roll for each tier */
  maxRolls: [number, number, number, number, number];
  /** How desirable is this mod in general? 1-10 */
  weight: number;
}

// === PoE1 MOD DATABASE ===
// Order matters: evaluateMod returns the first pattern that matches, so the
// more specific wording ("…Critical Strike Chance for Spells") comes first.
const POE1_MODS: ModTierRange[] = [
  // LIFE — body armour tiers (Prime 120–129 … Athlete's 80–89)
  {
    pattern: /\+(\d+) to maximum Life/i,
    name: "Max Life",
    category: "life",
    tiers: [120, 110, 100, 90, 80],
    maxRolls: [129, 119, 109, 99, 89],
    weight: 10,
  },
  {
    // "Regenerate 20 Life per second" (wording since 3.16)
    pattern: /Regenerate (\d+(?:\.\d+)?) Life per second/i,
    name: "Life Regen",
    category: "life",
    tiers: [20, 16, 13, 10, 7],
    maxRolls: [25, 20, 16, 13, 10],
    weight: 5,
  },

  // ENERGY SHIELD
  {
    // UNVERIFIED — poeaffix lists no body-armour flat ES tiers.
    pattern: /\+(\d+) to maximum Energy Shield/i,
    name: "Max ES",
    category: "defense",
    tiers: [100, 80, 60, 45, 30],
    maxRolls: [110, 99, 79, 59, 44],
    weight: 8,
  },
  {
    // Amulet-only wording ("increased maximum Energy Shield"); body armour
    // prints "increased Energy Shield" and is not tiered here.
    pattern: /(\d+)% increased maximum Energy Shield/i,
    name: "% Max ES",
    category: "defense",
    tiers: [20, 17, 14, 11, 8],
    maxRolls: [22, 19, 16, 13, 10],
    weight: 7,
  },

  // RESISTANCES — of Tzteosh 46–48 … of the Kiln 24–29
  {
    pattern: /\+(\d+)% to Fire Resistance/i,
    name: "Fire Res",
    category: "res",
    tiers: [46, 42, 36, 30, 24],
    maxRolls: [48, 45, 41, 35, 29],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Cold Resistance/i,
    name: "Cold Res",
    category: "res",
    tiers: [46, 42, 36, 30, 24],
    maxRolls: [48, 45, 41, 35, 29],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Lightning Resistance/i,
    name: "Lightning Res",
    category: "res",
    tiers: [46, 42, 36, 30, 24],
    maxRolls: [48, 45, 41, 35, 29],
    weight: 7,
  },
  {
    // of Bameth 31–35 … of Banishment 11–15
    pattern: /\+(\d+)% to Chaos Resistance/i,
    name: "Chaos Res",
    category: "res",
    tiers: [31, 26, 21, 16, 11],
    maxRolls: [35, 30, 25, 20, 15],
    weight: 8,
  },
  {
    // of the Span 17–18 … of the Prism 6–8
    pattern: /\+(\d+)% to all Elemental Resistances/i,
    name: "All Ele Res",
    category: "res",
    tiers: [17, 15, 12, 9, 6],
    maxRolls: [18, 16, 14, 11, 8],
    weight: 9,
  },

  // ATTRIBUTES — of the Gods 51–55 … of the Gorilla 28–32
  {
    pattern: /\+(\d+) to Strength/i,
    name: "Strength",
    category: "utility",
    tiers: [51, 43, 38, 33, 28],
    maxRolls: [55, 50, 42, 37, 32],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Dexterity/i,
    name: "Dexterity",
    category: "utility",
    tiers: [51, 43, 38, 33, 28],
    maxRolls: [55, 50, 42, 37, 32],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Intelligence/i,
    name: "Intelligence",
    category: "utility",
    tiers: [51, 43, 38, 33, 28],
    maxRolls: [55, 50, 42, 37, 32],
    weight: 4,
  },
  {
    // Amulet: of the Multiverse 33–35 … of the Heavens 17–20
    pattern: /\+(\d+) to all Attributes/i,
    name: "All Attributes",
    category: "utility",
    tiers: [33, 29, 25, 21, 17],
    maxRolls: [35, 32, 28, 24, 20],
    weight: 6,
  },

  // PHYSICAL DAMAGE (weapons) — Merciless 170–179 … Vicious 85–109
  {
    pattern: /(\d+)% increased Physical Damage/i,
    name: "% Phys Damage",
    category: "damage",
    tiers: [170, 155, 135, 110, 85],
    maxRolls: [179, 169, 154, 134, 109],
    weight: 9,
  },
  {
    // One-hand low roll: Flaring 20–27 … Gleaming 9–13 (two-handers roll higher)
    pattern: /Adds (\d+) to \d+ Physical Damage/i,
    name: "Flat Phys",
    category: "damage",
    tiers: [20, 17, 14, 13, 9],
    maxRolls: [27, 24, 19, 17, 13],
    weight: 8,
  },

  // ELEMENTAL DAMAGE
  {
    // Ring/amulet "Elemental Damage with Attack Skills": Overpowering 37–42 … Catalyzing 5–10
    pattern: /(\d+)% increased Elemental Damage/i,
    name: "% Ele Damage",
    category: "damage",
    tiers: [37, 31, 21, 11, 5],
    maxRolls: [42, 36, 30, 20, 10],
    weight: 7,
  },
  {
    // Wand: Runic 75–79 … Professor's 40–49
    pattern: /(\d+)% increased Spell Damage/i,
    name: "% Spell Damage",
    category: "damage",
    tiers: [75, 70, 60, 50, 40],
    maxRolls: [79, 74, 69, 59, 49],
    weight: 8,
  },
  {
    // One-hand low roll: Cremating 45–61 … Flaming 21–28
    pattern: /Adds (\d+) to \d+ Fire Damage/i,
    name: "Flat Fire",
    category: "damage",
    tiers: [45, 38, 32, 26, 21],
    maxRolls: [61, 51, 42, 35, 28],
    weight: 6,
  },
  {
    // One-hand low roll: Entombing 37–50 … Freezing 17–23
    pattern: /Adds (\d+) to \d+ Cold Damage/i,
    name: "Flat Cold",
    category: "damage",
    tiers: [37, 31, 26, 22, 17],
    maxRolls: [50, 42, 35, 29, 23],
    weight: 6,
  },
  {
    // Lightning's low roll is 1–13 on every tier, so rate the HIGH roll:
    // Electrocuting 158–166 … Sparking 72–76
    pattern: /Adds \d+ to (\d+) Lightning Damage/i,
    name: "Flat Lightning",
    category: "damage",
    tiers: [158, 133, 110, 91, 72],
    maxRolls: [166, 140, 116, 96, 76],
    weight: 6,
  },

  // CRITICAL STRIKE
  {
    // Wand/sceptre local: of Unmaking 100–109 … of Havoc 20–39
    pattern: /(\d+)% increased Critical Strike Chance for Spells/i,
    name: "Spell Crit",
    category: "crit",
    tiers: [100, 80, 60, 40, 20],
    maxRolls: [109, 99, 79, 59, 39],
    weight: 7,
  },
  {
    // of Incision 35–38 … of Stinging 15–19
    pattern: /(\d+)% increased (?:Global )?Critical Strike Chance/i,
    name: "Crit Chance",
    category: "crit",
    tiers: [35, 30, 25, 20, 15],
    maxRolls: [38, 34, 29, 24, 19],
    weight: 7,
  },
  {
    // of Destruction 35–38 … of Anger 15–19
    pattern: /\+(\d+)% to (?:Global )?Critical Strike Multiplier/i,
    name: "Crit Multi",
    category: "crit",
    tiers: [35, 30, 25, 20, 15],
    maxRolls: [38, 34, 29, 24, 19],
    weight: 9,
  },

  // SPEED
  {
    // Weapon: of Celebration 26–27 … of Renown 14–16 (gloves cap at 16)
    pattern: /(\d+)% increased Attack Speed/i,
    name: "Attack Speed",
    category: "speed",
    tiers: [26, 23, 20, 17, 14],
    maxRolls: [27, 25, 22, 19, 16],
    weight: 8,
  },
  {
    // Wand: of Finesse 23–25 … of Expertise 11–13
    pattern: /(\d+)% increased Cast Speed/i,
    name: "Cast Speed",
    category: "speed",
    tiers: [23, 20, 17, 14, 11],
    maxRolls: [25, 22, 19, 16, 13],
    weight: 8,
  },
  {
    // Boots roll fixed steps: Hellion's 35, Cheetah's 30 … Sprinter's 15
    pattern: /(\d+)% increased Movement Speed/i,
    name: "Move Speed",
    category: "speed",
    tiers: [35, 30, 25, 20, 15],
    maxRolls: [35, 30, 25, 20, 15],
    weight: 9,
  },

  // DEFENCE
  {
    // Body armour: Carapaced 323–400 … Studded 11–35
    pattern: /\+(\d+) to Armour/i,
    name: "Flat Armour",
    category: "defense",
    tiers: [323, 139, 61, 36, 11],
    maxRolls: [400, 322, 138, 60, 35],
    weight: 4,
  },
  {
    // Impenetrable 101–110 … Buttressed 56–67
    pattern: /(\d+)% increased Armour/i,
    name: "% Armour",
    category: "defense",
    tiers: [101, 92, 80, 68, 56],
    maxRolls: [110, 100, 91, 79, 67],
    weight: 5,
  },
  {
    // UNVERIFIED — poeaffix lists only essence flat-evasion rolls.
    pattern: /\+(\d+) to Evasion Rating/i,
    name: "Flat Evasion",
    category: "defense",
    tiers: [500, 400, 300, 200, 100],
    maxRolls: [553, 499, 399, 299, 199],
    weight: 4,
  },
  {
    // UNVERIFIED — assumed to mirror the % Armour tiers.
    pattern: /(\d+)% increased Evasion Rating/i,
    name: "% Evasion",
    category: "defense",
    tiers: [101, 92, 80, 68, 56],
    maxRolls: [110, 100, 91, 79, 67],
    weight: 5,
  },
  {
    // UNVERIFIED — spell suppression tiers not on poeaffix.
    pattern: /\+(\d+)% chance to Suppress Spell Damage/i,
    name: "Spell Suppress",
    category: "defense",
    tiers: [20, 17, 14, 11, 8],
    maxRolls: [22, 19, 16, 13, 10],
    weight: 8,
  },

  // UTILITY
  {
    // Ultramarine 74–78 … Gentian 50–54? No: Chalybeous 55–59 is T5 here.
    pattern: /\+(\d+) to maximum Mana/i,
    name: "Max Mana",
    category: "utility",
    tiers: [74, 69, 65, 60, 55],
    maxRolls: [78, 73, 68, 64, 59],
    weight: 3,
  },
  {
    pattern: /\+(\d+) to Level of all (.+) Skill Gems/i,
    name: "Gem Level",
    category: "gem",
    tiers: [2, 1, 1, 1, 1],
    maxRolls: [2, 1, 1, 1, 1],
    weight: 10,
  },
  {
    pattern: /\+(\d+) to Level of all Skill Gems/i,
    name: "All Gem Level",
    category: "gem",
    tiers: [2, 1, 1, 1, 1],
    maxRolls: [2, 1, 1, 1, 1],
    weight: 10,
  },
  {
    // Weapon prefix: "+1/+2 to Level of Socketed Melee/Bow/Spell/... Gems"
    // (also matches the rarer unqualified "Socketed Gems" roll).
    pattern: /\+(\d+) to Level of Socketed (?:\w+ )?Gems/i,
    name: "Socketed Gem Lvl",
    category: "gem",
    tiers: [2, 1, 1, 1, 1],
    maxRolls: [2, 1, 1, 1, 1],
    weight: 9,
  },
  {
    // of Lioneye 401–500 … of the Marksman 166–200
    pattern: /\+(\d+) to Accuracy Rating/i,
    name: "Accuracy",
    category: "utility",
    tiers: [401, 321, 251, 201, 166],
    maxRolls: [500, 400, 320, 250, 200],
    weight: 4,
  },
];

// === PoE2 MOD DATABASE ===
// Key differences from PoE1:
// - Much higher flat life (body armour Prime 200–214; rings cap at 119)
// - "Critical Hit Chance" / "Critical Damage Bonus" replace PoE1's
//   "Critical Strike Chance" / "Critical Strike Multiplier"
// - Spirit is a new resource on body armour, amulets and sceptres
// - No socket/link system on items, no spell suppression
// - Up to 13 in-game tiers; we score the top 5
const POE2_MODS: ModTierRange[] = [
  // LIFE — poe2db: Prime 200–214, Rapturous 190–199, Vigorous 175–189,
  // Fecund 150–174, Athlete's 120–149
  {
    pattern: /\+(\d+) to maximum Life/i,
    name: "Max Life",
    category: "life",
    tiers: [200, 190, 175, 150, 120],
    maxRolls: [214, 199, 189, 174, 149],
    weight: 10,
  },
  {
    // Amulet-only, 3–8% per poe2db; tier split UNVERIFIED.
    pattern: /(\d+)% increased maximum Life/i,
    name: "% Max Life",
    category: "life",
    tiers: [7, 6, 5, 4, 3],
    maxRolls: [8, 7, 6, 5, 4],
    weight: 8,
  },
  {
    // poe2db: of the Phoenix 33.1–36 … of Convalescence 13.1–18. PoE2 prints
    // either "Regenerate 5.2 Life per second" or "+5.2 Life Regeneration per
    // second" depending on the base; accept both.
    pattern: /(?:Regenerate )?\+?(\d+(?:\.\d+)?) Life(?: Regeneration)? per second/i,
    name: "Life Regen",
    category: "life",
    tiers: [33.1, 29.1, 23.1, 18.1, 13.1],
    maxRolls: [36, 33, 29, 23, 18],
    weight: 5,
  },

  // ENERGY SHIELD — UNVERIFIED
  {
    pattern: /\+(\d+) to maximum Energy Shield/i,
    name: "Max ES",
    category: "defense",
    tiers: [100, 80, 60, 45, 30],
    maxRolls: [110, 99, 79, 59, 44],
    weight: 8,
  },
  {
    pattern: /(\d+)% increased (?:maximum )?Energy Shield/i,
    name: "% Max ES",
    category: "defense",
    tiers: [101, 80, 60, 42, 25],
    maxRolls: [110, 100, 79, 59, 41],
    weight: 7,
  },

  // RESISTANCES — UNVERIFIED (poe2db keyword pages expose no affix table)
  {
    pattern: /\+(\d+)% to Fire Resistance/i,
    name: "Fire Res",
    category: "res",
    tiers: [41, 35, 29, 23, 17],
    maxRolls: [45, 40, 34, 28, 22],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Cold Resistance/i,
    name: "Cold Res",
    category: "res",
    tiers: [41, 35, 29, 23, 17],
    maxRolls: [45, 40, 34, 28, 22],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Lightning Resistance/i,
    name: "Lightning Res",
    category: "res",
    tiers: [41, 35, 29, 23, 17],
    maxRolls: [45, 40, 34, 28, 22],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Chaos Resistance/i,
    name: "Chaos Res",
    category: "res",
    tiers: [31, 26, 21, 16, 11],
    maxRolls: [35, 30, 25, 20, 15],
    weight: 8,
  },
  {
    pattern: /\+(\d+)% to all Elemental Resistances/i,
    name: "All Ele Res",
    category: "res",
    tiers: [16, 13, 11, 9, 7],
    maxRolls: [18, 15, 12, 10, 8],
    weight: 9,
  },

  // ATTRIBUTES — UNVERIFIED
  {
    pattern: /\+(\d+) to Strength/i,
    name: "Strength",
    category: "utility",
    tiers: [51, 43, 38, 33, 28],
    maxRolls: [55, 50, 42, 37, 32],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Dexterity/i,
    name: "Dexterity",
    category: "utility",
    tiers: [51, 43, 38, 33, 28],
    maxRolls: [55, 50, 42, 37, 32],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Intelligence/i,
    name: "Intelligence",
    category: "utility",
    tiers: [51, 43, 38, 33, 28],
    maxRolls: [55, 50, 42, 37, 32],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to all Attributes/i,
    name: "All Attributes",
    category: "utility",
    tiers: [16, 13, 10, 8, 5],
    maxRolls: [18, 15, 12, 9, 7],
    weight: 6,
  },

  // PHYSICAL DAMAGE — UNVERIFIED
  {
    pattern: /(\d+)% increased Physical Damage/i,
    name: "% Phys Damage",
    category: "damage",
    tiers: [170, 150, 130, 110, 90],
    maxRolls: [179, 169, 149, 129, 109],
    weight: 9,
  },
  {
    pattern: /Adds (\d+) to \d+ Physical Damage/i,
    name: "Flat Phys",
    category: "damage",
    tiers: [22, 17, 13, 10, 7],
    maxRolls: [27, 21, 16, 12, 9],
    weight: 8,
  },

  // ELEMENTAL DAMAGE — UNVERIFIED
  {
    pattern: /(\d+)% increased Elemental Damage/i,
    name: "% Ele Damage",
    category: "damage",
    tiers: [40, 33, 26, 20, 14],
    maxRolls: [46, 39, 32, 25, 19],
    weight: 7,
  },
  {
    pattern: /(\d+)% increased Spell Damage/i,
    name: "% Spell Damage",
    category: "damage",
    tiers: [80, 65, 50, 38, 26],
    maxRolls: [89, 79, 64, 49, 37],
    weight: 8,
  },
  {
    pattern: /Adds (\d+) to \d+ Fire Damage/i,
    name: "Flat Fire",
    category: "damage",
    tiers: [25, 19, 14, 10, 6],
    maxRolls: [30, 24, 18, 13, 9],
    weight: 6,
  },
  {
    pattern: /Adds (\d+) to \d+ Cold Damage/i,
    name: "Flat Cold",
    category: "damage",
    tiers: [22, 17, 13, 9, 5],
    maxRolls: [26, 21, 16, 12, 8],
    weight: 6,
  },
  {
    // Rate the high roll — the low roll is 1–4 on every tier.
    pattern: /Adds \d+ to (\d+) Lightning Damage/i,
    name: "Flat Lightning",
    category: "damage",
    tiers: [100, 80, 60, 40, 25],
    maxRolls: [120, 99, 79, 59, 39],
    weight: 6,
  },

  // CRITICAL — PoE2 wording is "Critical Hit Chance" / "Critical Damage Bonus".
  // Ranges UNVERIFIED.
  {
    pattern: /(\d+)% increased Critical Hit Chance for Spells/i,
    name: "Spell Crit",
    category: "crit",
    tiers: [100, 80, 60, 40, 20],
    maxRolls: [109, 99, 79, 59, 39],
    weight: 7,
  },
  {
    pattern: /(\d+)% increased Critical Hit Chance/i,
    name: "Crit Chance",
    category: "crit",
    tiers: [35, 28, 22, 16, 10],
    maxRolls: [38, 34, 27, 21, 15],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Critical Damage Bonus/i,
    name: "Crit Damage",
    category: "crit",
    tiers: [38, 32, 26, 20, 14],
    maxRolls: [42, 37, 31, 25, 19],
    weight: 9,
  },

  // SPEED — UNVERIFIED
  {
    pattern: /(\d+)% increased Attack Speed/i,
    name: "Attack Speed",
    category: "speed",
    tiers: [16, 13, 11, 9, 7],
    maxRolls: [18, 15, 12, 10, 8],
    weight: 8,
  },
  {
    pattern: /(\d+)% increased Cast Speed/i,
    name: "Cast Speed",
    category: "speed",
    tiers: [16, 13, 11, 9, 7],
    maxRolls: [18, 15, 12, 10, 8],
    weight: 8,
  },
  {
    pattern: /(\d+)% increased Movement Speed/i,
    name: "Move Speed",
    category: "speed",
    tiers: [35, 30, 25, 20, 15],
    maxRolls: [35, 30, 25, 20, 15],
    weight: 9,
  },

  // DEFENCE — UNVERIFIED
  {
    pattern: /\+(\d+) to Armour/i,
    name: "Flat Armour",
    category: "defense",
    tiers: [500, 400, 300, 200, 100],
    maxRolls: [553, 499, 399, 299, 199],
    weight: 4,
  },
  {
    pattern: /(\d+)% increased Armour/i,
    name: "% Armour",
    category: "defense",
    tiers: [100, 80, 60, 42, 25],
    maxRolls: [110, 99, 79, 59, 41],
    weight: 5,
  },
  {
    pattern: /\+(\d+) to Evasion Rating/i,
    name: "Flat Evasion",
    category: "defense",
    tiers: [500, 400, 300, 200, 100],
    maxRolls: [553, 499, 399, 299, 199],
    weight: 4,
  },
  {
    pattern: /(\d+)% increased Evasion Rating/i,
    name: "% Evasion",
    category: "defense",
    tiers: [100, 80, 60, 42, 25],
    maxRolls: [110, 99, 79, 59, 41],
    weight: 5,
  },

  // SPIRIT — poe2db: Queen's 57–61, Princess' 54–56, Duchess' 51–53,
  // Countess' 47–50, Marchioness' 43–46. Game prints "+45 to Spirit".
  {
    pattern: /\+(\d+) (?:to )?Spirit/i,
    name: "Spirit",
    category: "spirit",
    tiers: [57, 54, 51, 47, 43],
    maxRolls: [61, 56, 53, 50, 46],
    weight: 9,
  },

  // UTILITY
  {
    // poe2db: Ultramarine 180–189 … Chalybeous 105–124
    pattern: /\+(\d+) to maximum Mana/i,
    name: "Max Mana",
    category: "utility",
    tiers: [180, 165, 150, 125, 105],
    maxRolls: [189, 179, 164, 149, 124],
    weight: 3,
  },
  {
    // UNVERIFIED
    pattern: /\+(\d+) to Accuracy Rating/i,
    name: "Accuracy",
    category: "utility",
    tiers: [400, 325, 250, 175, 100],
    maxRolls: [455, 399, 324, 249, 174],
    weight: 4,
  },
];

/** Get mod tier database for a specific game */
export function getModDB(game: Game = "poe1"): ModTierRange[] {
  return game === "poe2" ? POE2_MODS : POE1_MODS;
}

export interface ModEvaluation {
  modText: string;
  name: string;
  category: string;
  value: number;
  tier: number; // 1-5, or 0 if below T5
  tierMin: number;
  tierMax: number;
  rollPercent: number;
  weight: number;
}

export interface ItemEvaluation {
  mods: ModEvaluation[];
  score: number;
  verdict: "trash" | "decent" | "good" | "great" | "godly";
  summary: string;
  t1Count: number;
  t2Count: number;
  socketBonus: number;
  estimatedChaos: { min: number; max: number };
  hasTripleRes: boolean;
  hasLifePlusRes: boolean;
  hasSpeedPlusDamage: boolean;
}

/** Evaluate a single mod text against the tier database */
export function evaluateMod(modText: string, game: Game = "poe1"): ModEvaluation | null {
  const db = getModDB(game);
  for (const range of db) {
    const match = modText.match(range.pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1]);
      let modTier = 0;
      for (let i = 0; i < 5; i++) {
        if (value >= range.tiers[i]) {
          modTier = i + 1;
          break;
        }
      }
      if (modTier === 0) modTier = 6; // below T5

      const tierIdx = modTier <= 5 ? modTier - 1 : 4;
      const tierMin = range.tiers[tierIdx];
      const tierMax = range.maxRolls[tierIdx];
      const rollPercent =
        tierMax > tierMin ? Math.round(((value - tierMin) / (tierMax - tierMin)) * 100) : 100;

      return {
        modText,
        name: range.name,
        category: range.category,
        value,
        tier: modTier <= 5 ? modTier : 0,
        tierMin,
        tierMax,
        rollPercent: Math.max(0, Math.min(100, rollPercent)),
        weight: range.weight,
      };
    }
  }
  return null;
}

/** Evaluate all mods on an item and compute an overall score */
export function evaluateItem(
  mods: string[],
  itemLevel?: number | null,
  sockets?: number | null,
  links?: number | null,
  game: Game = "poe1"
): ItemEvaluation {
  const evaluated: ModEvaluation[] = [];

  for (const mod of mods) {
    const result = evaluateMod(mod, game);
    if (result) {
      evaluated.push(result);
    }
  }

  // Count tiers
  const t1Count = evaluated.filter((m) => m.tier === 1).length;
  const t2Count = evaluated.filter((m) => m.tier === 2).length;
  const t3Count = evaluated.filter((m) => m.tier === 3).length;

  // Detect combos
  const resMods = evaluated.filter((m) => m.category === "res" && m.tier <= 3);
  const hasTripleRes = resMods.length >= 3;
  const hasLifeMod = evaluated.some((m) => m.category === "life" && m.tier <= 2);
  const hasLifePlusRes = hasLifeMod && resMods.length >= 2;
  const hasSpeedPlusDamage =
    evaluated.some((m) => m.category === "speed" && m.tier <= 2) &&
    evaluated.some((m) => (m.category === "damage" || m.category === "crit") && m.tier <= 2);

  // Compute score (0-100)
  let score = 0;
  for (const mod of evaluated) {
    if (mod.tier === 0) continue;
    const tierScore = (6 - mod.tier) * 4; // T1=20, T2=16, T3=12, T4=8, T5=4
    score += tierScore * (mod.weight / 10);
  }

  // Socket/link bonus — PoE1 only (PoE2 has no item sockets)
  let socketBonus = 0;
  if (game === "poe1") {
    if (links && links >= 6) socketBonus = 25;
    else if (links && links >= 5) socketBonus = 10;
    else if (sockets && sockets >= 6) socketBonus = 5;
  }

  // Spirit bonus for PoE2
  const hasSpirit = evaluated.some((m) => m.category === "spirit" && m.tier <= 2);
  if (hasSpirit && hasLifeMod) score += 15;

  // Bonus for combos
  if (hasTripleRes) score += 15;
  if (hasLifePlusRes) score += 20;
  if (hasSpeedPlusDamage) score += 15;
  if (t1Count >= 3) score += 20;
  score += socketBonus;

  score = Math.min(100, Math.round(score));

  // Verdict
  let verdict: ItemEvaluation["verdict"];
  if (score >= 80) verdict = "godly";
  else if (score >= 60) verdict = "great";
  else if (score >= 40) verdict = "good";
  else if (score >= 20) verdict = "decent";
  else verdict = "trash";

  // Summary
  const parts: string[] = [];
  if (t1Count > 0) parts.push(`${t1Count}x T1`);
  if (t2Count > 0) parts.push(`${t2Count}x T2`);
  if (t3Count > 0) parts.push(`${t3Count}x T3`);
  if (hasTripleRes) parts.push("triple res");
  if (hasLifePlusRes) parts.push("life+res combo");
  if (hasSpirit) parts.push("spirit");

  if (game === "poe1" && socketBonus > 0) {
    parts.push(links && links >= 6 ? "6-link" : links && links >= 5 ? "5-link" : "6 sockets");
  }
  const summary = parts.length > 0 ? parts.join(", ") : "no notable mods";

  // === PRICE ESTIMATION ===
  let priceMin = 1;
  let priceMax = 1;

  for (const mod of evaluated) {
    if (mod.tier === 0 || mod.tier > 3) continue;
    const baseValue = mod.weight * 3;
    const rollBonus = 1 + mod.rollPercent / 200;

    if (mod.tier === 1) {
      priceMin += baseValue * 0.7 * rollBonus;
      priceMax += baseValue * 2.5 * rollBonus;
    } else if (mod.tier === 2) {
      priceMin += baseValue * 0.2;
      priceMax += baseValue * 0.8;
    } else if (mod.tier === 3) {
      priceMin += baseValue * 0.05;
      priceMax += baseValue * 0.2;
    }
  }

  // Combo multipliers
  if (hasLifePlusRes) {
    priceMin *= 1.5;
    priceMax *= 2;
  }
  if (hasTripleRes) {
    priceMin *= 1.3;
    priceMax *= 1.8;
  }
  if (hasSpeedPlusDamage) {
    priceMin *= 1.5;
    priceMax *= 2.5;
  }
  if (t1Count >= 3) {
    priceMin *= 2;
    priceMax *= 4;
  }
  if (t1Count >= 4) {
    priceMin *= 2;
    priceMax *= 5;
  }

  // Socket/link multipliers (PoE1 only)
  if (game === "poe1") {
    if (links && links >= 6) {
      priceMin *= 3;
      priceMax *= 5;
    } else if (links && links >= 5) {
      priceMin *= 1.5;
      priceMax *= 2;
    }
  }

  if (verdict === "trash") {
    priceMin = 0;
    priceMax = 1;
  } else if (verdict === "decent") {
    priceMax = Math.min(priceMax, 30);
  }

  if (priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  const estimatedChaos = { min: Math.round(priceMin), max: Math.round(priceMax) };

  return {
    mods: evaluated,
    score,
    verdict,
    summary,
    t1Count,
    t2Count,
    socketBonus,
    estimatedChaos,
    hasTripleRes,
    hasLifePlusRes,
    hasSpeedPlusDamage,
  };
}
