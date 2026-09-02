import type { DangerousMod } from "../types/map.js";

/**
 * Curated database of dangerous map / waystone mods.
 *
 * Every pattern is written against the text the game actually prints:
 * PoE1 wording from poeaffix.net (map affixes) + maxroll's T17 list, PoE2
 * wording from poe2db's waystone modifier table — both checked 2026-09-02.
 * PoE1 and PoE2 phrase the same idea differently ("25% increased Monster
 * Attack Speed" vs "Monsters have 12% increased Attack, Cast and Movement
 * Speed"), so a mod that exists in both games often needs two alternatives in
 * one regex. Mods that exist in only one game are tagged accordingly — PoE2
 * has no reflect, no "cannot regenerate", and no spell suppression.
 */
export const DANGEROUS_MODS: DangerousMod[] = [
  // ===== DEADLY (will likely kill you) =====
  {
    pattern: /Monsters reflect (\d+)% of Elemental Damage/i,
    shortName: "Ele Reflect",
    danger: "deadly",
    description:
      "Monsters reflect elemental damage back to you. Instant death for elemental hit builds.",
    dangerousFor: ["elemental", "spell", "attack"],
    safeFor: ["physical", "chaos DoT", "ignite", "minion", "totem", "trap", "mine"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters reflect (\d+)% of Physical Damage/i,
    shortName: "Phys Reflect",
    danger: "deadly",
    description:
      "Monsters reflect physical damage back to you. Instant death for physical hit builds.",
    dangerousFor: ["physical", "attack", "impale"],
    safeFor: ["elemental", "chaos DoT", "minion", "totem", "trap", "mine"],
    games: ["poe1"],
  },
  {
    pattern: /Players cannot Regenerate Life, Mana or Energy Shield/i,
    shortName: "No Regen",
    danger: "deadly",
    description:
      "Disables all regeneration. Deadly for builds relying on life/mana regen or ES recharge.",
    dangerousFor: ["regen", "RF", "ES recharge", "mana regen"],
    safeFor: ["leech", "life on hit", "life flask", "blood magic"],
    games: ["poe1"],
  },
  {
    pattern: /cannot Leech (?:Life|Mana) from Monsters/i,
    shortName: "No Leech",
    danger: "deadly",
    description: "Disables leech. Fatal for leech-dependent builds.",
    dangerousFor: ["leech", "life leech", "mana leech"],
    safeFor: ["regen", "life flask", "ES recharge"],
    games: ["poe1"],
  },
  {
    pattern: /Players and their Minions deal no Damage for 3 out of every 10 seconds/i,
    shortName: "No Damage Phases",
    danger: "deadly",
    description: "T17: you deal no damage 30% of the time. Plan boss phases around it.",
    dangerousFor: ["all builds"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Area has patches of Awakener's Desolation/i,
    shortName: "Awakener's Desolation",
    danger: "deadly",
    description: "T17: ground that deals heavy damage over time. Instant death if you stand in it.",
    dangerousFor: ["all builds"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Area contains Drowning Orbs/i,
    shortName: "Drowning Orbs",
    danger: "deadly",
    description: "T17: orbs that kill outright if you stop paying attention.",
    dangerousFor: ["all builds"],
    safeFor: [],
    games: ["poe1"],
  },

  // ===== DANGEROUS (significant risk) =====
  {
    pattern: /-(\d+)% maximum Player Resistances/i,
    shortName: "-Max Res",
    danger: "dangerous",
    description: "Lowers your maximum resistances. Elemental damage taken jumps sharply.",
    dangerousFor: ["low EHP", "CI"],
    safeFor: ["high max res", "physical mitigation"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have a (\d+)% chance to avoid Poison, (?:Impale|Blind), and Bleed/i,
    shortName: "Avoid Ailments",
    danger: "dangerous",
    description: "Monsters shrug off poison, impale and bleed. Cripples builds built on them.",
    dangerousFor: ["poison", "bleed", "impale"],
    safeFor: ["hit-based", "elemental", "minion"],
    games: ["poe1"],
  },
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
    pattern: /Monsters fire (\d+) additional Projectiles/i,
    shortName: "Extra Proj",
    danger: "dangerous",
    description: "Ranged monsters shotgun. Much more incoming damage up close.",
    dangerousFor: ["melee", "low evasion", "low block"],
    safeFor: ["high evasion", "max block", "ranged"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Area contains two Unique Bosses/i,
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
      "Monster projectiles chain between targets. Very dangerous with minions, totems or a party.",
    dangerousFor: ["minion", "totem", "party play"],
    safeFor: ["solo", "no secondary targets"],
    games: ["poe1"],
  },
  {
    pattern: /Players are (?:periodically )?Cursed with Temporal Chains/i,
    shortName: "Temp Chains",
    danger: "dangerous",
    description: "You are slowed. Affects movement, attack and cast speed significantly.",
    dangerousFor: ["all builds"],
    safeFor: ["curse immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players are (?:periodically )?Cursed with Elemental Weakness/i,
    shortName: "Ele Weakness",
    danger: "dangerous",
    description: "Your elemental resistances are lowered. You may drop below the resist cap.",
    dangerousFor: ["low overcapped res"],
    safeFor: ["highly overcapped res", "curse immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players are (?:periodically )?Cursed with Vulnerability/i,
    shortName: "Vulnerability",
    danger: "dangerous",
    description: "You take increased physical damage and are easier to stun.",
    dangerousFor: ["low phys mitigation", "stun vulnerable"],
    safeFor: ["high armour", "stun immune"],
    games: ["poe1"],
  },
  {
    // PoE1: "Monsters deal 90% extra Physical Damage as Fire"
    // PoE2: "Monsters deal 20% of Damage as Extra Fire"
    pattern:
      /Monsters deal (\d+)% (?:extra (?:Physical )?Damage as|of Damage as Extra) (?:Fire|Cold|Lightning|Chaos)/i,
    shortName: "Extra Ele Dmg",
    danger: "dangerous",
    description:
      "Monsters convert part of their damage to an element. Hurts if that resistance is not capped.",
    dangerousFor: ["low res", "low EHP"],
    safeFor: ["overcapped res", "high max res"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monster Damage Penetrates (\d+)% Elemental Resistances/i,
    shortName: "Ele Pen",
    danger: "dangerous",
    description:
      "Monsters bypass part of your resistances. Very deadly for res-capped-but-squishy builds.",
    dangerousFor: ["elemental", "low res", "low EHP"],
    safeFor: ["armour stacking", "block", "high max res"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /(\d+)% (?:reduced|less) effect of Non-Curse Auras/i,
    shortName: "Less Auras",
    danger: "dangerous",
    description: "Your auras are weakened. Aura stackers and Determination/Grace defences suffer.",
    dangerousFor: ["aura stacking", "armour", "evasion"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Monsters have a (\d+)% chance to cause (?:Elemental|Status) Ailments/i,
    shortName: "Monster Ailments",
    danger: "dangerous",
    description: "Monsters ignite, freeze and shock you on hit. Freeze in particular kills.",
    dangerousFor: ["low ailment mitigation"],
    safeFor: ["ailment immune", "freeze immune"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters Break Armour equal to (\d+)% of Physical Damage dealt/i,
    shortName: "Armour Break",
    danger: "dangerous",
    description: "Monsters break your armour. Physical hits get much worse as the map goes on.",
    dangerousFor: ["armour"],
    safeFor: ["evasion", "energy shield"],
    games: ["poe2"],
  },
  {
    pattern: /Monsters have (\d+)% increased Stun Buildup/i,
    shortName: "Stun Buildup",
    danger: "dangerous",
    description:
      "You get heavy-stunned far more often. Deadly for slow builds without stun threshold.",
    dangerousFor: ["low stun threshold", "melee"],
    safeFor: ["high stun threshold", "ranged"],
    games: ["poe2"],
  },
  {
    pattern: /Monsters? have (\d+)% increased Elemental Ailment Application/i,
    shortName: "Ailment Application",
    danger: "dangerous",
    description: "Monsters freeze, shock and ignite you much more easily.",
    dangerousFor: ["low ailment threshold"],
    safeFor: ["ailment immune"],
    games: ["poe2"],
  },
  {
    pattern: /Rare Monsters have Volatile Cores/i,
    shortName: "Volatile Cores",
    danger: "dangerous",
    description: "T17: rares spawn exploding cores. One-shot potential if you stand on them.",
    dangerousFor: ["melee", "low fire res"],
    safeFor: ["ranged"],
    games: ["poe1"],
  },
  {
    pattern: /Players are assaulted by Bloodstained Sawblades/i,
    shortName: "Sawblades",
    danger: "dangerous",
    description: "T17: sawblades chase you, dealing physical damage and Corrupted Blood.",
    dangerousFor: ["low phys mitigation"],
    safeFor: ["corrupted blood immune"],
    games: ["poe1"],
  },
  {
    pattern: /Players have (\d+)% less Defences/i,
    shortName: "Less Defences",
    danger: "dangerous",
    description: "T17: armour, evasion and energy shield all reduced.",
    dangerousFor: ["all builds"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Rare and Unique Monsters remove (\d+)% of Life, Mana and Energy Shield from Players/i,
    shortName: "% Life Removal",
    danger: "dangerous",
    description: "T17: every rare/unique hit strips a flat percentage of your pool. Stacks fast.",
    dangerousFor: ["low recovery"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Area contains Petrification Statues/i,
    shortName: "Petrification",
    danger: "dangerous",
    description: "T17: statues petrify you. Hard to spot in dense packs.",
    dangerousFor: ["all builds"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Runes of the Searing Exarch/i,
    shortName: "Exarch Runes",
    danger: "dangerous",
    description: "T17: fire DoT runes that stop recovery while you stand in them.",
    dangerousFor: ["low fire res", "regen"],
    safeFor: [],
    games: ["poe1"],
  },

  // ===== CAUTION (be aware) =====
  {
    pattern: /Players are (?:periodically )?Cursed with Enfeeble/i,
    shortName: "Enfeeble",
    danger: "caution",
    description: "Your damage and accuracy are reduced. Slows the map down more than it kills.",
    dangerousFor: ["low DPS"],
    safeFor: ["curse immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have \+?(\d+)% chance to Suppress Spell Damage/i,
    shortName: "Spell Suppress",
    danger: "caution",
    description: "Monsters suppress half of your spell hits. Spell builds lose real DPS.",
    dangerousFor: ["spell"],
    safeFor: ["attack", "minion"],
    games: ["poe1"],
  },
  {
    // PoE1 prints three lines: "#% increased Monster Movement/Attack/Cast Speed".
    pattern: /(\d+)% increased Monster (?:Movement|Attack|Cast) Speed/i,
    shortName: "Fast Monsters",
    danger: "caution",
    description: "Monsters act faster. Harder to kite, more incoming damage per second.",
    dangerousFor: ["slow builds", "totems", "low defenses"],
    safeFor: ["high mobility", "high block", "high evasion"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters have (\d+)% increased Attack, Cast and Movement Speed/i,
    shortName: "Fast Monsters",
    danger: "caution",
    description: "Monsters act faster. Harder to kite, more incoming damage per second.",
    dangerousFor: ["slow builds", "low defenses"],
    safeFor: ["high mobility", "high evasion"],
    games: ["poe2"],
  },
  {
    pattern: /(\d+)% more Monster Life/i,
    shortName: "Monster Life",
    danger: "caution",
    description: "Monsters are tankier. Slows clear speed and boss fights.",
    dangerousFor: ["low DPS"],
    safeFor: [],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /(\d+)% increased Monster Damage/i,
    shortName: "Monster Damage",
    danger: "caution",
    description: "Everything hits harder.",
    dangerousFor: ["low EHP"],
    safeFor: [],
    games: ["poe1", "poe2"],
  },
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
    pattern: /Monsters have (\d+)% increased (?:Critical Strike|Critical Hit) Chance/i,
    shortName: "Monster Crit",
    danger: "caution",
    description: "Monsters crit more often. Spiky incoming damage.",
    dangerousFor: ["low EHP"],
    safeFor: ["crit damage reduction"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have (\d+)% increased Accuracy Rating/i,
    shortName: "Monster Accuracy",
    danger: "caution",
    description: "Monsters hit you more often. Evasion builds get hit through their defence.",
    dangerousFor: ["evasion"],
    safeFor: ["armour", "block"],
    games: ["poe1", "poe2"],
  },
  {
    // PoE1: "Monsters Poison on Hit" — PoE2: "Monsters have 20% chance to Poison on Hit"
    pattern: /Monsters (?:have (\d+)% chance to )?Poison on Hit/i,
    shortName: "Poison",
    danger: "caution",
    description: "Monsters poison you on hit. Stacked poison can be lethal over time.",
    dangerousFor: ["low chaos res"],
    safeFor: ["high chaos res", "poison immune"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Monsters have (\d+)% chance to inflict Bleeding on Hit/i,
    shortName: "Bleed",
    danger: "caution",
    description: "Monsters bleed you on hit. Moving while bleeding hurts.",
    dangerousFor: ["low phys mitigation"],
    safeFor: ["bleed immune"],
    games: ["poe2"],
  },
  {
    pattern: /Area has patches of Burning Ground/i,
    shortName: "Burning Ground",
    danger: "caution",
    description: "Fire damage over time from ground patches.",
    dangerousFor: ["low fire res", "stationary builds"],
    safeFor: ["high fire res", "mobile builds"],
    games: ["poe1"],
  },
  {
    pattern: /Area has patches of Chilled Ground/i,
    shortName: "Chilled Ground",
    danger: "caution",
    description: "Slowing ground patches. Reduces action speed.",
    dangerousFor: ["slow builds"],
    safeFor: ["chill immune", "freeze immune"],
    games: ["poe1"],
  },
  {
    pattern: /Area has patches of Shock(?:ed|ing) Ground/i,
    shortName: "Shocked Ground",
    danger: "caution",
    description: "Ground patches that make you take increased damage.",
    dangerousFor: ["all builds"],
    safeFor: ["shock immune"],
    games: ["poe1"],
  },
  {
    pattern: /Area has patches of desecrated ground/i,
    shortName: "Desecrated Ground",
    danger: "caution",
    description: "Chaos damage over time from ground patches.",
    dangerousFor: ["low chaos res"],
    safeFor: ["high chaos res", "CI"],
    games: ["poe1"],
  },
  {
    pattern: /Players gain (\d+)% reduced Flask Charges/i,
    shortName: "Less Flask Charges",
    danger: "caution",
    description: "Fewer flask charges. Flask-dependent sustain runs dry.",
    dangerousFor: ["life flask", "flask sustain"],
    safeFor: ["regen", "leech"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Players have (\d+)% less Area of Effect/i,
    shortName: "Less AoE",
    danger: "caution",
    description: "Your skills cover less area. Clear speed drops.",
    dangerousFor: ["AoE builds"],
    safeFor: ["single target", "projectile"],
    games: ["poe1"],
  },
  {
    pattern: /Players have (\d+)% less Cooldown Recovery Rate/i,
    shortName: "Less CDR",
    danger: "caution",
    description: "Your cooldowns recover slower — fewer dodge rolls, guard skills and blinks.",
    dangerousFor: ["cooldown-dependent"],
    safeFor: [],
    games: ["poe2"],
  },
  {
    pattern: /Players have (\d+)% less Armour/i,
    shortName: "Less Armour",
    danger: "caution",
    description: "Reduced armour makes physical hits hurt more.",
    dangerousFor: ["armour"],
    safeFor: ["evasion", "energy shield"],
    games: ["poe1"],
  },
  {
    pattern: /Players have (\d+)% reduced (?:Chance to Block|Block Chance)/i,
    shortName: "Less Block",
    danger: "caution",
    description: "Your block chance is reduced.",
    dangerousFor: ["block"],
    safeFor: ["evasion", "armour"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters have (\d+)% chance to Avoid Elemental (?:Status )?Ailments/i,
    shortName: "Avoid Ele Ailments",
    danger: "caution",
    description:
      "Monsters resist ignite, freeze and shock. Ailment builds lose damage and control.",
    dangerousFor: ["ignite", "freeze", "shock"],
    safeFor: ["hit-based", "physical"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters have (\d+)% increased Ailment Threshold/i,
    shortName: "Ailment Threshold",
    danger: "caution",
    description: "Harder to freeze, shock or ignite monsters.",
    dangerousFor: ["freeze", "shock", "ignite"],
    safeFor: ["hit-based"],
    games: ["poe2"],
  },
  {
    pattern: /Monsters cannot be Stunned/i,
    shortName: "Stun Immune",
    danger: "caution",
    description: "Monsters cannot be stunned. Stun-lock builds lose their safety.",
    dangerousFor: ["stun"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Monsters are Hexproof/i,
    shortName: "Hexproof",
    danger: "caution",
    description: "Curses do not apply. Curse-dependent builds lose damage and defence.",
    dangerousFor: ["curse"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /(\d+)% less effect of Curses on Monsters/i,
    shortName: "Less Curse Effect",
    danger: "caution",
    description: "Your curses are weaker.",
    dangerousFor: ["curse"],
    safeFor: [],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /Buffs on Players expire (\d+)% faster/i,
    shortName: "Buffs Expire Faster",
    danger: "caution",
    description: "Flasks, guard skills and temporary buffs run out sooner.",
    dangerousFor: ["flask sustain", "guard skill"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Monsters take (\d+)% reduced Extra Damage from Critical (?:Strikes|Hits)/i,
    shortName: "Less Crit Dmg",
    danger: "caution",
    description: "Your crits deal less bonus damage.",
    dangerousFor: ["crit"],
    safeFor: ["non-crit"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /\+(\d+)% Monster Elemental Resistances?/i,
    shortName: "Monster Ele Res",
    danger: "caution",
    description: "Monsters resist elemental damage. Elemental builds need penetration.",
    dangerousFor: ["elemental"],
    safeFor: ["physical", "chaos"],
    games: ["poe1", "poe2"],
  },
  {
    pattern: /\+(\d+)% Monster Chaos Resistance/i,
    shortName: "Monster Chaos Res",
    danger: "caution",
    description: "Monsters resist chaos damage.",
    dangerousFor: ["chaos", "poison"],
    safeFor: ["physical", "elemental"],
    games: ["poe1"],
  },
  {
    pattern: /\+(\d+)% Monster Physical Damage Reduction/i,
    shortName: "Monster Phys Reduction",
    danger: "caution",
    description: "Monsters take less physical damage.",
    dangerousFor: ["physical"],
    safeFor: ["elemental", "chaos"],
    games: ["poe1"],
  },
  {
    pattern: /Monsters are (?:Armoured|Evasive)/i,
    shortName: "Monster Defences",
    danger: "caution",
    description: "Monsters have extra armour or evasion.",
    dangerousFor: ["physical", "attack"],
    safeFor: ["spell", "chaos"],
    games: ["poe2"],
  },
  {
    pattern: /Monsters gain (\d+)% of maximum Life as Extra maximum Energy Shield/i,
    shortName: "Monster ES",
    danger: "caution",
    description: "Monsters have an extra energy shield layer. Tankier packs.",
    dangerousFor: ["low DPS"],
    safeFor: [],
    games: ["poe2"],
  },
  {
    pattern: /Unique Boss deals (\d+)% increased Damage/i,
    shortName: "Boss Damage",
    danger: "caution",
    description: "The map boss hits harder (and usually attacks faster).",
    dangerousFor: ["low EHP"],
    safeFor: ["tanky builds"],
    games: ["poe1"],
  },
  {
    pattern: /Area contains Unstable Tentacle Fiends/i,
    shortName: "Tentacle Fiends",
    danger: "caution",
    description: "T17: exploding fiends slow the map and hit hard.",
    dangerousFor: ["low EHP"],
    safeFor: [],
    games: ["poe1"],
  },
  {
    pattern: /Players have (\d+)% reduced Action Speed for each skill/i,
    shortName: "Action Speed Stacking",
    danger: "caution",
    description: "T17: every skill used slows you further. Can double map time.",
    dangerousFor: ["multi-skill builds"],
    safeFor: ["one-button builds"],
    games: ["poe1"],
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
