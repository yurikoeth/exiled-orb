/**
 * Mapping of common mod text patterns to GGG Trade API stat IDs.
 *
 * The pattern is matched case-insensitively against the mod text.
 * The `#` in the pattern matches a numeric value.
 * Stat IDs sourced from https://www.pathofexile.com/api/trade/data/stats
 */
export interface StatMapping {
  pattern: RegExp;
  statId: string;
  /** If true, extract the number and use 80% as the min filter */
  extractMin: boolean;
}

// PoE1 + PoE2 shared stat IDs (most are shared between games)
export const STAT_MAPPINGS: StatMapping[] = [
  // --- Life ---
  { pattern: /\+(\d+) to maximum life/i, statId: "explicit.stat_3299347043", extractMin: true },
  {
    pattern: /(\d+)% increased maximum life/i,
    statId: "explicit.stat_983749596",
    extractMin: true,
  },

  // --- Energy Shield ---
  {
    pattern: /\+(\d+) to maximum energy shield/i,
    statId: "explicit.stat_3489782002",
    extractMin: true,
  },
  {
    pattern: /(\d+)% increased maximum energy shield/i,
    statId: "explicit.stat_2482852589",
    extractMin: true,
  },

  // --- Mana ---
  { pattern: /\+(\d+) to maximum mana/i, statId: "explicit.stat_1050105434", extractMin: true },

  // --- Resistances ---
  { pattern: /\+(\d+)% to fire resistance/i, statId: "explicit.stat_3372524247", extractMin: true },
  { pattern: /\+(\d+)% to cold resistance/i, statId: "explicit.stat_4220027924", extractMin: true },
  {
    pattern: /\+(\d+)% to lightning resistance/i,
    statId: "explicit.stat_1671376347",
    extractMin: true,
  },
  {
    pattern: /\+(\d+)% to chaos resistance/i,
    statId: "explicit.stat_2923486259",
    extractMin: true,
  },
  {
    pattern: /\+(\d+)% to all elemental resistances/i,
    statId: "explicit.stat_2901986750",
    extractMin: true,
  },
  {
    pattern: /\+(\d+)% to fire and cold resistances/i,
    statId: "explicit.stat_3441501978",
    extractMin: true,
  },
  {
    pattern: /\+(\d+)% to fire and lightning resistances/i,
    statId: "explicit.stat_1011760568",
    extractMin: true,
  },
  {
    pattern: /\+(\d+)% to cold and lightning resistances/i,
    statId: "explicit.stat_4277795662",
    extractMin: true,
  },

  // --- Attributes ---
  { pattern: /\+(\d+) to strength/i, statId: "explicit.stat_4080418644", extractMin: true },
  { pattern: /\+(\d+) to dexterity/i, statId: "explicit.stat_3261801346", extractMin: true },
  { pattern: /\+(\d+) to intelligence/i, statId: "explicit.stat_328541901", extractMin: true },
  { pattern: /\+(\d+) to all attributes/i, statId: "explicit.stat_1379411836", extractMin: true },

  // --- Physical Damage ---
  {
    pattern: /adds (\d+) to \d+ physical damage/i,
    statId: "explicit.stat_1940865751",
    extractMin: true,
  },
  {
    pattern: /(\d+)% increased physical damage/i,
    statId: "explicit.stat_1509134228",
    extractMin: true,
  },

  // --- Elemental Damage ---
  {
    pattern: /adds (\d+) to \d+ fire damage/i,
    statId: "explicit.stat_1573130764",
    extractMin: true,
  },
  {
    pattern: /adds (\d+) to \d+ cold damage/i,
    statId: "explicit.stat_1037193709",
    extractMin: true,
  },
  {
    pattern: /adds (\d+) to \d+ lightning damage/i,
    statId: "explicit.stat_538848803",
    extractMin: true,
  },
  {
    pattern: /(\d+)% increased elemental damage/i,
    statId: "explicit.stat_3141070085",
    extractMin: true,
  },

  // --- Spell Damage ---
  {
    pattern: /(\d+)% increased spell damage/i,
    statId: "explicit.stat_2974417149",
    extractMin: true,
  },
  {
    pattern: /adds (\d+) to \d+ fire damage to spells/i,
    statId: "explicit.stat_1133016593",
    extractMin: true,
  },
  {
    pattern: /adds (\d+) to \d+ cold damage to spells/i,
    statId: "explicit.stat_2469416729",
    extractMin: true,
  },
  {
    pattern: /adds (\d+) to \d+ lightning damage to spells/i,
    statId: "explicit.stat_2831165374",
    extractMin: true,
  },

  // --- Critical Strike ---
  {
    pattern: /(\d+)% increased critical strike chance/i,
    statId: "explicit.stat_587431675",
    extractMin: true,
  },
  {
    pattern: /\+(\d+)% to global critical strike multiplier/i,
    statId: "explicit.stat_3556824919",
    extractMin: true,
  },
  {
    pattern: /(\d+)% increased critical strike chance for spells/i,
    statId: "explicit.stat_737908626",
    extractMin: true,
  },

  // --- Attack Speed ---
  {
    pattern: /(\d+)% increased attack speed/i,
    statId: "explicit.stat_210067635",
    extractMin: true,
  },
  { pattern: /(\d+)% increased cast speed/i, statId: "explicit.stat_2891184298", extractMin: true },

  // --- Movement Speed ---
  {
    pattern: /(\d+)% increased movement speed/i,
    statId: "explicit.stat_2250533757",
    extractMin: true,
  },

  // --- Armour / Evasion ---
  { pattern: /\+(\d+) to armour/i, statId: "explicit.stat_809229260", extractMin: true },
  { pattern: /(\d+)% increased armour/i, statId: "explicit.stat_1062208444", extractMin: true },
  { pattern: /\+(\d+) to evasion rating/i, statId: "explicit.stat_2144192055", extractMin: true },
  {
    pattern: /(\d+)% increased evasion rating/i,
    statId: "explicit.stat_2106365538",
    extractMin: true,
  },

  // --- Gem Level ---
  {
    pattern: /\+(\d+) to level of all skill gems/i,
    statId: "explicit.stat_2843100721",
    extractMin: false,
  },
  {
    pattern: /\+(\d+) to level of all fire skill gems/i,
    statId: "explicit.stat_3120164895",
    extractMin: false,
  },
  {
    pattern: /\+(\d+) to level of all cold skill gems/i,
    statId: "explicit.stat_1514829491",
    extractMin: false,
  },
  {
    pattern: /\+(\d+) to level of all lightning skill gems/i,
    statId: "explicit.stat_1069149568",
    extractMin: false,
  },
  {
    pattern: /\+(\d+) to level of all chaos skill gems/i,
    statId: "explicit.stat_3604946673",
    extractMin: false,
  },
  {
    pattern: /\+(\d+) to level of all physical skill gems/i,
    statId: "explicit.stat_2452998583",
    extractMin: false,
  },

  // --- Life/Mana Leech ---
  {
    pattern: /(\d+(?:\.\d+)?)% of physical attack damage leeched as life/i,
    statId: "explicit.stat_3593843976",
    extractMin: false,
  },
  {
    pattern: /(\d+(?:\.\d+)?)% of physical attack damage leeched as mana/i,
    statId: "explicit.stat_3237948413",
    extractMin: false,
  },

  // --- Life/Mana Regen ---
  {
    pattern: /(\d+(?:\.\d+)?) life regenerated per second/i,
    statId: "explicit.stat_836936635",
    extractMin: true,
  },
  {
    pattern: /(\d+(?:\.\d+)?)% of life regenerated per second/i,
    statId: "explicit.stat_44972811",
    extractMin: true,
  },

  // --- Accuracy ---
  { pattern: /\+(\d+) to accuracy rating/i, statId: "explicit.stat_803737631", extractMin: true },

  // --- Block ---
  {
    pattern: /(\d+)% chance to block attack damage/i,
    statId: "explicit.stat_2530372417",
    extractMin: true,
  },
  {
    pattern: /(\d+)% chance to block spell damage/i,
    statId: "explicit.stat_561307714",
    extractMin: true,
  },

  // --- Suppress ---
  {
    pattern: /\+(\d+)% chance to suppress spell damage/i,
    statId: "explicit.stat_1896971621",
    extractMin: true,
  },

  // --- Damage Over Time ---
  {
    pattern: /(\d+)% increased damage over time/i,
    statId: "explicit.stat_967627487",
    extractMin: true,
  },

  // --- Minion ---
  {
    pattern: /(\d+)% increased minion damage/i,
    statId: "explicit.stat_1589917703",
    extractMin: true,
  },
  {
    pattern: /\+(\d+) to maximum number of summoned.*skeletons/i,
    statId: "explicit.stat_3707508061",
    extractMin: false,
  },
];

/**
 * Match a mod text against known stat mappings.
 * Returns the stat ID and computed min value, or null if no match.
 */
export function matchMod(modText: string): { statId: string; min: number } | null {
  for (const mapping of STAT_MAPPINGS) {
    const match = modText.match(mapping.pattern);
    if (match && match[1]) {
      const rawValue = parseFloat(match[1]);
      const min = mapping.extractMin ? Math.floor(rawValue * 0.8) : rawValue;
      return { statId: mapping.statId, min };
    }
  }
  return null;
}
