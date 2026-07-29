import type { DangerousMod } from "../types/map.js";

/**
 * Curated database of dangerous map mods.
 * Each entry matches a mod text pattern and provides danger context.
 */
export const DANGEROUS_MODS: DangerousMod[] = [
  // ===== DEADLY (will likely kill you) =====
  {
    pattern: /Monsters reflect (\d+)% of Elemental Damage/i,
    shortName: "Ele Reflect",
    danger: "deadly",
    description:
      "Monsters reflect elemental damage back to you. Instant death for elemental builds.",
    dangerousFor: ["elemental", "spell", "ignite", "cold DoT", "lightning"],
    safeFor: ["physical", "chaos DoT", "minion", "totem", "trap", "mine"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters reflect (\d+)% of Physical Damage/i,
    shortName: "Phys Reflect",
    danger: "deadly",
    description: "Monsters reflect physical damage back to you. Instant death for physical builds.",
    dangerousFor: ["physical", "attack", "impale"],
    safeFor: ["elemental", "chaos DoT", "minion", "totem", "trap", "mine"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players cannot Regenerate Life, Mana or Energy Shield/i,
    shortName: "No Regen",
    danger: "deadly",
    description:
      "Disables all regeneration. Deadly for builds relying on life/mana regen or ES recharge.",
    dangerousFor: ["regen", "RF", "ES recharge", "mana regen"],
    safeFor: ["leech", "life on hit", "life flask", "blood magic"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have (\d+)% chance to Avoid Poison, Impale, and Bleeding/i,
    shortName: "Avoid Ailments",
    danger: "deadly",
    description:
      "Monsters resist poison, impale, and bleed. Cripples builds relying on these mechanics.",
    dangerousFor: ["poison", "bleed", "impale"],
    safeFor: ["hit-based", "elemental", "minion"],
    games: ["poe1"],
  },

  // ===== DANGEROUS (significant risk) =====
  {
    pattern: /Players have (\d+)% less Recovery Rate of Life and Energy Shield/i,
    shortName: "Less Recovery",
    danger: "dangerous",
    description: "Severely reduces healing and ES recovery. Makes sustain very difficult.",
    dangerousFor: ["leech", "regen", "ES recharge", "life flask"],
    safeFor: ["high evasion", "block", "dodge"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players have (\d+)% reduced Maximum Resistances/i,
    shortName: "-Max Res",
    danger: "dangerous",
    description:
      "Lowers your maximum elemental resistances. You take significantly more elemental damage.",
    dangerousFor: ["low EHP", "CI"],
    safeFor: ["high max res", "physical mitigation"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters fire (\d+) additional Projectiles/i,
    shortName: "Extra Proj",
    danger: "dangerous",
    description:
      "Monsters shoot extra projectiles. Ranged enemies become much more deadly, especially shotgunning.",
    dangerousFor: ["melee", "low evasion", "low block"],
    safeFor: ["high evasion", "max block", "ranged"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Area contains two unique Bosses/i,
    shortName: "Twinned Boss",
    danger: "dangerous",
    description: "The map boss is duplicated. Double boss damage, double boss mechanics.",
    dangerousFor: ["low DPS", "squishy builds"],
    safeFor: ["high DPS", "tanky builds"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters' skills Chain (\d+) additional times/i,
    shortName: "Chain",
    danger: "dangerous",
    description:
      "Monster projectiles chain between targets. Very dangerous with summons, totems, or in parties.",
    dangerousFor: ["minion", "totem", "party play"],
    safeFor: ["solo", "no secondary targets"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players are Cursed with Temporal Chains/i,
    shortName: "Temp Chains",
    danger: "dangerous",
    description:
      "You are permanently slowed. Affects movement, attack, and cast speed significantly.",
    dangerousFor: ["all builds"],
    safeFor: ["curse immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players are Cursed with Elemental Weakness/i,
    shortName: "Ele Weakness",
    danger: "dangerous",
    description: "Your elemental resistances are lowered. You may be below 75% resist cap.",
    dangerousFor: ["low overcapped res"],
    safeFor: ["highly overcapped res", "curse immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players are Cursed with Vulnerability/i,
    shortName: "Vulnerability",
    danger: "dangerous",
    description: "You take increased physical damage and have increased chance to be stunned.",
    dangerousFor: ["low phys mitigation", "stun vulnerable"],
    safeFor: ["high armour", "stun immune"],
    games: ["poe1", "poe2"],
  },

  // ===== CAUTION (be aware) =====
  {
    pattern: /Monsters have (\d+)% increased Area of Effect/i,
    shortName: "Monster AoE",
    danger: "caution",
    description: "Monster attacks cover larger areas. Harder to dodge ground effects and slams.",
    dangerousFor: ["melee"],
    safeFor: ["ranged", "high mobility"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have (\d+)% increased Attack Speed/i,
    shortName: "Fast Monsters",
    danger: "caution",
    description: "Monsters attack faster. More incoming damage per second.",
    dangerousFor: ["low defenses"],
    safeFor: ["high block", "high evasion"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have (\d+)% increased Movement Speed/i,
    shortName: "Fast Monsters",
    danger: "caution",
    description: "Monsters move faster. Harder to kite and maintain distance.",
    dangerousFor: ["slow builds", "totems"],
    safeFor: ["high mobility", "minion"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players cannot Leech/i,
    shortName: "No Leech",
    danger: "deadly",
    description: "Disables all leech. Fatal for leech-dependent builds.",
    dangerousFor: ["leech", "life leech", "mana leech"],
    safeFor: ["regen", "life flask", "ES recharge"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters Poison on Hit/i,
    shortName: "Poison",
    danger: "caution",
    description: "All monsters poison you on hit. Stacking poison can be lethal over time.",
    dangerousFor: ["low chaos res"],
    safeFor: ["high chaos res", "poison immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Area has patches of Burning Ground/i,
    shortName: "Burning Ground",
    danger: "caution",
    description: "Fire damage over time from ground patches.",
    dangerousFor: ["low fire res", "stationary builds"],
    safeFor: ["high fire res", "mobile builds"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Area has patches of Chilled Ground/i,
    shortName: "Chilled Ground",
    danger: "caution",
    description: "Slowing ground patches. Reduces movement speed.",
    dangerousFor: ["slow builds"],
    safeFor: ["chill immune", "freeze immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Area has patches of Shocked Ground/i,
    shortName: "Shocked Ground",
    danger: "caution",
    description: "Ground patches that cause you to take increased damage.",
    dangerousFor: ["all builds"],
    safeFor: ["shock immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have (\d+)% chance to Suppress Spell Damage/i,
    shortName: "Spell Suppress",
    danger: "caution",
    description: "Monsters suppress some of your spell damage, reducing effectiveness.",
    dangerousFor: ["spell builds"],
    safeFor: ["attack builds", "minion"],
    games: ["poe2"],
  },
  // === PoE2-specific waystone mods ===
  {
    pattern: /Monsters Penetrate (\d+)% Elemental Resistances/i,
    shortName: "Ele Pen",
    danger: "dangerous",
    description:
      "Monsters bypass your elemental resistances. Very deadly for builds relying on res stacking.",
    dangerousFor: ["elemental", "low res"],
    safeFor: ["armour stacking", "block"],
    games: ["poe2"],
  },
  {
    pattern: /Monsters.*Overwhelm (\d+)% Physical Damage Reduction/i,
    shortName: "Phys Overwhelm",
    danger: "dangerous",
    description: "Monsters bypass physical damage reduction. Dangerous for armour builds.",
    dangerousFor: ["armour", "physical mitigation"],
    safeFor: ["evasion", "dodge"],
    games: ["poe2"],
  },
  {
    pattern: /Players have (\d+)% less Armour/i,
    shortName: "Less Armour",
    danger: "caution",
    description: "Reduced armour makes physical hits hurt more.",
    dangerousFor: ["armour"],
    safeFor: ["evasion", "energy shield"],
    games: ["poe2"],
  },
  {
    pattern: /Players have (\d+)% less Evasion Rating/i,
    shortName: "Less Evasion",
    danger: "caution",
    description: "Reduced evasion means getting hit more often.",
    dangerousFor: ["evasion"],
    safeFor: ["armour", "energy shield"],
    games: ["poe2"],
  },
  {
    pattern: /Monsters have (\d+)% more Life/i,
    shortName: "Monster Life",
    danger: "caution",
    description: "Monsters are tankier. Slows clear speed and boss fights.",
    dangerousFor: ["low dps"],
    safeFor: [],
    games: ["poe2"],
  },
  {
    pattern: /Players have (\d+)% reduced Effect of Non-Curse Auras/i,
    shortName: "Less Auras",
    danger: "caution",
    description: "Aura effectiveness reduced. Impacts builds that rely on aura stacking.",
    dangerousFor: ["aura stacking"],
    safeFor: [],
    games: ["poe2"],
  },
];

/** Build profile tags used for personalized danger assessment */
interface BuildTags {
  damageTypes?: string[];
  defenseTypes?: string[];
  recoveryTypes?: string[];
}

/**
 * Analyze a single mod line against the dangerous mods database.
 * If a build profile is provided, danger levels are personalized:
 * - Mods that match the build's dangerousFor tags are elevated
 * - Mods that match the build's safeFor tags are reduced
 */
export function analyzeMod(
  modText: string,
  game: import("../types/item.js").Game = "poe1",
  build?: BuildTags
) {
  for (const dangerMod of DANGEROUS_MODS) {
    if (!dangerMod.games.includes(game)) continue;
    if (dangerMod.pattern.test(modText)) {
      let danger = dangerMod.danger;
      let personalNote: string | null = null;

      if (build) {
        const allBuildTags = [
          ...(build.damageTypes ?? []),
          ...(build.defenseTypes ?? []),
          ...(build.recoveryTypes ?? []),
        ];

        // Check if this mod is specifically dangerous for the build
        const isDangerousForBuild = dangerMod.dangerousFor.some((tag) =>
          allBuildTags.some((bt) => tag.toLowerCase().includes(bt.toLowerCase()))
        );

        // Check if this mod is safe for the build
        const isSafeForBuild = dangerMod.safeFor.some((tag) =>
          allBuildTags.some((bt) => tag.toLowerCase().includes(bt.toLowerCase()))
        );

        if (isDangerousForBuild && !isSafeForBuild) {
          // Elevate danger level
          if (danger === "caution") danger = "dangerous";
          else if (danger === "dangerous") danger = "deadly";
          personalNote = "Dangerous for your build!";
        } else if (isSafeForBuild && !isDangerousForBuild) {
          // Reduce danger level
          if (danger === "deadly") danger = "dangerous";
          else if (danger === "dangerous") danger = "caution";
          personalNote = "Your build handles this well.";
        }
      }

      return {
        modText,
        match: dangerMod,
        danger,
        personalNote,
      };
    }
  }
  return { modText, match: null, danger: "safe" as const, personalNote: null };
}

/** Analyze all mods on a map */
export function analyzeMap(
  mapName: string,
  mods: string[],
  game: import("../types/item.js").Game = "poe1",
  tier: number | null = null,
  build?: BuildTags
) {
  const analyzed = mods.map((mod) => analyzeMod(mod, game, build));
  const dangerOrder = { deadly: 0, dangerous: 1, caution: 2, safe: 3 };
  const worstDanger = analyzed.reduce(
    (worst, a) => (dangerOrder[a.danger] < dangerOrder[worst] ? a.danger : worst),
    "safe" as import("../types/map.js").DangerLevel
  );

  return {
    mapName,
    tier,
    mods: analyzed,
    overallDanger: worstDanger,
    dangerCount: analyzed.filter((a) => a.danger === "deadly" || a.danger === "dangerous").length,
  };
}
