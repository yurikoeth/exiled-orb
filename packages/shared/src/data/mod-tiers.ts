/**
 * Mod tier ranges for evaluating rare items.
 * T1 = best, T5 = worst common. Values are the minimum roll for that tier.
 * Used to rate mods on Ctrl+C'd items.
 * Supports both PoE1 and PoE2 with separate tier databases.
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
const POE1_MODS: ModTierRange[] = [
  // LIFE
  {
    pattern: /\+(\d+) to maximum Life/i,
    name: "Max Life",
    category: "life",
    tiers: [90, 80, 70, 60, 50],
    maxRolls: [99, 89, 79, 69, 59],
    weight: 10,
  },
  {
    pattern: /(\d+)% increased maximum Life/i,
    name: "% Max Life",
    category: "life",
    tiers: [10, 8, 6, 5, 4],
    maxRolls: [12, 9, 7, 5, 4],
    weight: 8,
  },

  // ENERGY SHIELD
  {
    pattern: /\+(\d+) to maximum Energy Shield/i,
    name: "Max ES",
    category: "defense",
    tiers: [100, 80, 60, 45, 30],
    maxRolls: [110, 99, 79, 59, 44],
    weight: 8,
  },
  {
    pattern: /(\d+)% increased maximum Energy Shield/i,
    name: "% Max ES",
    category: "defense",
    tiers: [100, 80, 60, 42, 25],
    maxRolls: [110, 99, 79, 59, 41],
    weight: 7,
  },

  // RESISTANCES
  {
    pattern: /\+(\d+)% to Fire Resistance/i,
    name: "Fire Res",
    category: "res",
    tiers: [42, 36, 30, 24, 18],
    maxRolls: [45, 41, 35, 29, 23],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Cold Resistance/i,
    name: "Cold Res",
    category: "res",
    tiers: [42, 36, 30, 24, 18],
    maxRolls: [45, 41, 35, 29, 23],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Lightning Resistance/i,
    name: "Lightning Res",
    category: "res",
    tiers: [42, 36, 30, 24, 18],
    maxRolls: [45, 41, 35, 29, 23],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to Chaos Resistance/i,
    name: "Chaos Res",
    category: "res",
    tiers: [35, 29, 23, 17, 11],
    maxRolls: [38, 34, 28, 22, 16],
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

  // ATTRIBUTES
  {
    pattern: /\+(\d+) to Strength/i,
    name: "Strength",
    category: "utility",
    tiers: [55, 45, 35, 25, 15],
    maxRolls: [58, 54, 44, 34, 24],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Dexterity/i,
    name: "Dexterity",
    category: "utility",
    tiers: [55, 45, 35, 25, 15],
    maxRolls: [58, 54, 44, 34, 24],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Intelligence/i,
    name: "Intelligence",
    category: "utility",
    tiers: [55, 45, 35, 25, 15],
    maxRolls: [58, 54, 44, 34, 24],
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

  // PHYSICAL DAMAGE (weapons)
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

  // ELEMENTAL DAMAGE
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
    pattern: /Adds (\d+) to \d+ Lightning Damage/i,
    name: "Flat Lightning",
    category: "damage",
    tiers: [5, 4, 3, 2, 1],
    maxRolls: [8, 6, 4, 3, 2],
    weight: 6,
  },

  // CRITICAL STRIKE
  {
    pattern: /(\d+)% increased Critical Strike Chance/i,
    name: "Crit Chance",
    category: "crit",
    tiers: [35, 28, 22, 16, 10],
    maxRolls: [38, 34, 27, 21, 15],
    weight: 7,
  },
  {
    pattern: /\+(\d+)% to (?:Global )?Critical Strike Multiplier/i,
    name: "Crit Multi",
    category: "crit",
    tiers: [38, 32, 26, 20, 14],
    maxRolls: [42, 37, 31, 25, 19],
    weight: 9,
  },

  // SPEED
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
    tiers: [30, 25, 20, 15, 10],
    maxRolls: [35, 29, 24, 19, 14],
    weight: 9,
  },

  // DEFENCE
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

  // UTILITY
  {
    pattern: /\+(\d+) to maximum Mana/i,
    name: "Max Mana",
    category: "utility",
    tiers: [75, 65, 55, 45, 35],
    maxRolls: [79, 74, 64, 54, 44],
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
    pattern: /\+(\d+) to Accuracy Rating/i,
    name: "Accuracy",
    category: "utility",
    tiers: [400, 325, 250, 175, 100],
    maxRolls: [455, 399, 324, 249, 174],
    weight: 4,
  },
  {
    pattern: /(\d+(?:\.\d+)?) Life Regenerated per second/i,
    name: "Life Regen",
    category: "life",
    tiers: [20, 15, 10, 7, 4],
    maxRolls: [24, 19, 14, 9, 6],
    weight: 5,
  },
  {
    pattern: /\+(\d+)% chance to Suppress Spell Damage/i,
    name: "Spell Suppress",
    category: "defense",
    tiers: [20, 17, 14, 11, 8],
    maxRolls: [22, 19, 16, 13, 10],
    weight: 8,
  },
];

// === PoE2 MOD DATABASE ===
// Key differences from PoE1:
// - Higher life rolls (body armour T1: 120-130, boots T1: 80-89)
// - "Critical Damage Bonus" replaces "Critical Strike Multiplier"
// - Spirit is a new resource (replaces mana reservation)
// - No socket/link system (sockets are on gems)
// - Spell Suppression doesn't exist
// - Up to 13 tiers in-game, but we use top 5 for scoring
const POE2_MODS: ModTierRange[] = [
  // LIFE — higher ranges than PoE1 (body armour: up to 130, boots: up to 89)
  {
    pattern: /\+(\d+) to maximum Life/i,
    name: "Max Life",
    category: "life",
    tiers: [120, 100, 80, 60, 40],
    maxRolls: [130, 119, 99, 79, 59],
    weight: 10,
  },
  {
    pattern: /(\d+)% increased maximum Life/i,
    name: "% Max Life",
    category: "life",
    tiers: [10, 8, 6, 5, 4],
    maxRolls: [12, 9, 7, 5, 4],
    weight: 8,
  },

  // ENERGY SHIELD
  {
    pattern: /\+(\d+) to maximum Energy Shield/i,
    name: "Max ES",
    category: "defense",
    tiers: [100, 80, 60, 45, 30],
    maxRolls: [110, 99, 79, 59, 44],
    weight: 8,
  },
  {
    pattern: /(\d+)% increased maximum Energy Shield/i,
    name: "% Max ES",
    category: "defense",
    tiers: [101, 80, 60, 42, 25],
    maxRolls: [110, 100, 79, 59, 41],
    weight: 7,
  },

  // RESISTANCES — similar to PoE1 (T1: 41-45)
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
    tiers: [35, 29, 23, 17, 11],
    maxRolls: [38, 34, 28, 22, 16],
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

  // ATTRIBUTES
  {
    pattern: /\+(\d+) to Strength/i,
    name: "Strength",
    category: "utility",
    tiers: [55, 45, 35, 25, 15],
    maxRolls: [58, 54, 44, 34, 24],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Dexterity/i,
    name: "Dexterity",
    category: "utility",
    tiers: [55, 45, 35, 25, 15],
    maxRolls: [58, 54, 44, 34, 24],
    weight: 4,
  },
  {
    pattern: /\+(\d+) to Intelligence/i,
    name: "Intelligence",
    category: "utility",
    tiers: [55, 45, 35, 25, 15],
    maxRolls: [58, 54, 44, 34, 24],
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

  // PHYSICAL DAMAGE — similar to PoE1
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

  // ELEMENTAL DAMAGE
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
    pattern: /Adds (\d+) to \d+ Lightning Damage/i,
    name: "Flat Lightning",
    category: "damage",
    tiers: [5, 4, 3, 2, 1],
    maxRolls: [8, 6, 4, 3, 2],
    weight: 6,
  },

  // CRITICAL — PoE2 uses "Critical Damage Bonus" not "Critical Strike Multiplier"
  {
    pattern: /(\d+)% increased Critical Strike Chance/i,
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

  // SPEED
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
    tiers: [30, 25, 20, 15, 10],
    maxRolls: [35, 29, 24, 19, 14],
    weight: 9,
  },

  // DEFENCE
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

  // SPIRIT — PoE2 only (replaces mana reservation)
  {
    pattern: /\+(\d+) Spirit/i,
    name: "Spirit",
    category: "spirit",
    tiers: [50, 40, 30, 20, 10],
    maxRolls: [60, 49, 39, 29, 19],
    weight: 9,
  },

  // UTILITY
  {
    pattern: /\+(\d+) to maximum Mana/i,
    name: "Max Mana",
    category: "utility",
    tiers: [75, 65, 55, 45, 35],
    maxRolls: [79, 74, 64, 54, 44],
    weight: 3,
  },
  {
    pattern: /\+(\d+) to Accuracy Rating/i,
    name: "Accuracy",
    category: "utility",
    tiers: [400, 325, 250, 175, 100],
    maxRolls: [455, 399, 324, 249, 174],
    weight: 4,
  },
  {
    pattern: /(\d+(?:\.\d+)?) Life Regenerated per second/i,
    name: "Life Regen",
    category: "life",
    tiers: [20, 15, 10, 7, 4],
    maxRolls: [24, 19, 14, 9, 6],
    weight: 5,
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
