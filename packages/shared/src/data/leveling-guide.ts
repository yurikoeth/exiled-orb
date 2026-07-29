import type { Game } from "../types/item.js";

export interface LevelingStep {
  zone: string;
  act: number;
  recommendedLevel: number;
  objective: string;
  /** Key gems available from quest rewards at this point */
  gemPickups: string[];
  /** Passive skill points from quests in this zone */
  skillPoints: number;
  /** Tips for the zone */
  tips: string[];
}

export interface LevelingGuide {
  game: Game;
  steps: LevelingStep[];
}

/**
 * PoE1 leveling guide — Act 1 through 10.
 * Covers key zones, quest rewards, and gem pickups.
 */
export const POE1_LEVELING: LevelingGuide = {
  game: "poe1",
  steps: [
    // Act 1
    {
      zone: "The Twilight Strand",
      act: 1,
      recommendedLevel: 1,
      objective: "Kill Hillock, enter Lioneye's Watch",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Pick up and equip any weapon"],
    },
    {
      zone: "The Coast",
      act: 1,
      recommendedLevel: 2,
      objective: "Go to The Mud Flats",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Don't full-clear, keep moving"],
    },
    {
      zone: "The Mud Flats",
      act: 1,
      recommendedLevel: 4,
      objective: "Find 3 glyphs, enter Submerged Passage",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Glyphs are in nests on the ground"],
    },
    {
      zone: "The Submerged Passage",
      act: 1,
      recommendedLevel: 5,
      objective: "Find Flooded Depths (optional Dweller kill) → The Ledge",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Ledge",
      act: 1,
      recommendedLevel: 7,
      objective: "Go to The Climb",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Linear zone, good for leveling if behind"],
    },
    {
      zone: "The Climb",
      act: 1,
      recommendedLevel: 8,
      objective: "Go to The Lower Prison",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Lower Prison",
      act: 1,
      recommendedLevel: 9,
      objective: "Find Trial of Ascendancy → The Upper Prison",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Upper Prison",
      act: 1,
      recommendedLevel: 10,
      objective: "Kill Brutus",
      gemPickups: ["Support gems from Nessa after Brutus"],
      skillPoints: 0,
      tips: ["Dodge Brutus's chain attack"],
    },
    {
      zone: "Prisoner's Gate",
      act: 1,
      recommendedLevel: 11,
      objective: "Go to The Ship Graveyard",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Cavern of Wrath",
      act: 1,
      recommendedLevel: 12,
      objective: "Kill Merveil",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Bring cold resistance flasks"],
    },

    // Act 2
    {
      zone: "The Southern Forest",
      act: 2,
      recommendedLevel: 13,
      objective: "Enter The Forest Encampment",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Old Fields",
      act: 2,
      recommendedLevel: 14,
      objective: "Find The Den → Kill Great White Beast",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Chamber of Sins Level 1",
      act: 2,
      recommendedLevel: 15,
      objective: "Find Trial → Level 2 → Kill Fidelitas",
      gemPickups: ["Gem reward from Greust"],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Riverways",
      act: 2,
      recommendedLevel: 16,
      objective: "Find The Wetlands",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Wetlands",
      act: 2,
      recommendedLevel: 17,
      objective: "Kill Oak (or help) → Find the waypoint",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Bandit quest: Kill all for 2 passive points (recommended)"],
    },
    {
      zone: "The Vaal Ruins",
      act: 2,
      recommendedLevel: 18,
      objective: "Kill Vaal Oversoul",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },

    // Act 3
    {
      zone: "The City of Sarn",
      act: 3,
      recommendedLevel: 23,
      objective: "Enter The Sarn Encampment",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Slums",
      act: 3,
      recommendedLevel: 23,
      objective: "Find Crematorium",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Crematorium",
      act: 3,
      recommendedLevel: 24,
      objective: "Kill Piety, get Tolman's Bracelet",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Sewer",
      act: 3,
      recommendedLevel: 25,
      objective: "Find 3 busts → Ebony Barracks",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Ebony Barracks",
      act: 3,
      recommendedLevel: 27,
      objective: "Kill General Gravicius → The Lunaris Temple",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Lunaris Temple Level 2",
      act: 3,
      recommendedLevel: 28,
      objective: "Kill Piety",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Imperial Gardens",
      act: 3,
      recommendedLevel: 29,
      objective: "Find Trial → The Sceptre of God",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Sceptre of God",
      act: 3,
      recommendedLevel: 30,
      objective: "Kill Dominus",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Three phases — rain phase needs movement"],
    },

    // Act 4
    {
      zone: "The Aqueduct",
      act: 4,
      recommendedLevel: 32,
      objective: "Enter Highgate",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Good zone for Humility div card farming"],
    },
    {
      zone: "The Dried Lake",
      act: 4,
      recommendedLevel: 33,
      objective: "Kill Voll",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Mines Level 2",
      act: 4,
      recommendedLevel: 34,
      objective: "Kill Daresso or Kaom (order doesn't matter)",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Belly of the Beast",
      act: 4,
      recommendedLevel: 36,
      objective: "Kill Piety → The Harvest",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Harvest",
      act: 4,
      recommendedLevel: 37,
      objective: "Kill Malachai",
      gemPickups: ["Gem vendor unlocks after Malachai"],
      skillPoints: 0,
      tips: ["Three heart phases, then Malachai"],
    },

    // Act 5
    {
      zone: "The Slave Pens",
      act: 5,
      recommendedLevel: 38,
      objective: "Enter Overseer's Tower",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Control Blocks",
      act: 5,
      recommendedLevel: 39,
      objective: "Kill Overseer Krow",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Templar Courts",
      act: 5,
      recommendedLevel: 41,
      objective: "Find Innocence",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Chamber of Innocence",
      act: 5,
      recommendedLevel: 42,
      objective: "Kill High Templar Avarius / Innocence",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Heavy fire damage — bring fire resist"],
    },
    {
      zone: "The Cathedral Rooftop",
      act: 5,
      recommendedLevel: 43,
      objective: "Kill Kitava (Act 5)",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Permanent -30% all resistances after this fight!"],
    },

    // Acts 6-10 abbreviated — key milestones only
    {
      zone: "The Twilight Strand (Act 6)",
      act: 6,
      recommendedLevel: 44,
      objective: "Kill Twilight Brutus",
      gemPickups: ["Lilly Roth sells all gems after freeing her"],
      skillPoints: 0,
      tips: ["Cap resistances! You lost 30% from Act 5 Kitava"],
    },
    {
      zone: "The Brine King's Reef",
      act: 6,
      recommendedLevel: 47,
      objective: "Kill The Brine King",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Pantheon unlocked"],
    },

    {
      zone: "The Northern Forest",
      act: 7,
      recommendedLevel: 48,
      objective: "Progress through Dread Thicket",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Causeway",
      act: 7,
      recommendedLevel: 50,
      objective: "Kill Arakaali",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },

    {
      zone: "The Sarn Ramparts",
      act: 8,
      recommendedLevel: 52,
      objective: "Find Doedre, Maligaro, Shavronne",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Lunaris Concourse",
      act: 8,
      recommendedLevel: 55,
      objective: "Kill Lunaris & Solaris",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },

    {
      zone: "The Blood Aqueduct",
      act: 9,
      recommendedLevel: 57,
      objective: "Farm to ~61+ if needed",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Best leveling zone in the game — Humility card drops here"],
    },
    {
      zone: "The Quarry",
      act: 9,
      recommendedLevel: 60,
      objective: "Kill Garukhan → The Belly (Act 9)",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },

    {
      zone: "The Cathedral Rooftop (Act 10)",
      act: 10,
      recommendedLevel: 62,
      objective: "Kill Kitava (final)",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Another -30% all resistances! Cap resists before maps."],
    },
  ],
};

/**
 * PoE2 leveling guide — Acts 1 through 3 (Early Access content).
 * PoE2 has fewer acts but deeper content per act.
 */
export const POE2_LEVELING: LevelingGuide = {
  game: "poe2",
  steps: [
    // Act 1
    {
      zone: "The Twilight Strand",
      act: 1,
      recommendedLevel: 1,
      objective: "Kill Ruined Templar, enter Clearfell",
      gemPickups: ["Starting skill gem"],
      skillPoints: 0,
      tips: ["Explore for gold and gear"],
    },
    {
      zone: "Clearfell",
      act: 1,
      recommendedLevel: 3,
      objective: "Find Clearfell Encampment",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Open layout, find the road"],
    },
    {
      zone: "The Muddled Meadow",
      act: 1,
      recommendedLevel: 5,
      objective: "Progress to Grelwood",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "Grelwood",
      act: 1,
      recommendedLevel: 8,
      objective: "Kill the Grelwood boss",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "Freythorn",
      act: 1,
      recommendedLevel: 10,
      objective: "Find the Cemetery of the Eternals",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "Ogham Village",
      act: 1,
      recommendedLevel: 12,
      objective: "Kill The Crowbell",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Watch for the bell attack"],
    },
    {
      zone: "The Sanctum of the Huntress",
      act: 1,
      recommendedLevel: 14,
      objective: "Complete the trial",
      gemPickups: [],
      skillPoints: 1,
      tips: [],
    },

    // Act 2
    {
      zone: "Vastiri Outskirts",
      act: 2,
      recommendedLevel: 16,
      objective: "Enter the desert region",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Bring fire resistance for the desert"],
    },
    {
      zone: "The Bone Pits",
      act: 2,
      recommendedLevel: 18,
      objective: "Clear the undead area",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Traitor's Passage",
      act: 2,
      recommendedLevel: 20,
      objective: "Navigate to Keth",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "Mastodon Badlands",
      act: 2,
      recommendedLevel: 22,
      objective: "Find the Sand Wurm",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "Keth",
      act: 2,
      recommendedLevel: 24,
      objective: "Town hub — access vendors",
      gemPickups: ["New gem vendor unlocks"],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Dreadnought",
      act: 2,
      recommendedLevel: 26,
      objective: "Kill Jamanra",
      gemPickups: [],
      skillPoints: 1,
      tips: ["Multi-phase boss fight"],
    },

    // Act 3
    {
      zone: "Utzaal",
      act: 3,
      recommendedLevel: 28,
      objective: "Enter the jungle region",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Jungle Ruins",
      act: 3,
      recommendedLevel: 30,
      objective: "Find ancient temples",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "Aggorat",
      act: 3,
      recommendedLevel: 33,
      objective: "Navigate the Vaal city",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Ziggurat",
      act: 3,
      recommendedLevel: 35,
      objective: "Kill the Act 3 boss",
      gemPickups: [],
      skillPoints: 1,
      tips: [],
    },
    {
      zone: "The Trial of the Sekhemas",
      act: 3,
      recommendedLevel: 36,
      objective: "Complete the ascendancy trial",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Unlocks ascendancy class"],
    },

    // Act 4
    {
      zone: "The Lowlands",
      act: 4,
      recommendedLevel: 38,
      objective: "Travel through the swamps",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Ormath",
      act: 4,
      recommendedLevel: 40,
      objective: "Enter the fortress city",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Drowned City",
      act: 4,
      recommendedLevel: 42,
      objective: "Navigate flooded ruins",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Watch for water-based hazards"],
    },
    {
      zone: "The Harbour",
      act: 4,
      recommendedLevel: 44,
      objective: "Town hub — restock and prepare",
      gemPickups: ["New vendor gems available"],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Spires",
      act: 4,
      recommendedLevel: 45,
      objective: "Ascend the spire towers",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Apex",
      act: 4,
      recommendedLevel: 47,
      objective: "Kill the Act 4 boss",
      gemPickups: [],
      skillPoints: 1,
      tips: ["Multi-phase fight, bring fire resistance"],
    },

    // Act 5
    {
      zone: "The Burning Coast",
      act: 5,
      recommendedLevel: 48,
      objective: "Enter the volcanic region",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Fire damage zones — cap fire resist"],
    },
    {
      zone: "The Volcanic Island",
      act: 5,
      recommendedLevel: 50,
      objective: "Cross the lava fields",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Ashen Fields",
      act: 5,
      recommendedLevel: 52,
      objective: "Progress through burned wastelands",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Forge",
      act: 5,
      recommendedLevel: 54,
      objective: "Find the ancient forge",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Crucible",
      act: 5,
      recommendedLevel: 55,
      objective: "Kill the Act 5 boss",
      gemPickups: [],
      skillPoints: 1,
      tips: ["Resistance penalty after this fight!"],
    },

    // Act 6
    {
      zone: "The Twilight Ruins",
      act: 6,
      recommendedLevel: 56,
      objective: "Enter the endgame zones",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Cap resistances — you lost some from Act 5 boss"],
    },
    {
      zone: "The Forsaken Lands",
      act: 6,
      recommendedLevel: 58,
      objective: "Navigate the corrupted areas",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Dark Citadel",
      act: 6,
      recommendedLevel: 60,
      objective: "Infiltrate the final stronghold",
      gemPickups: [],
      skillPoints: 0,
      tips: [],
    },
    {
      zone: "The Throne Room",
      act: 6,
      recommendedLevel: 62,
      objective: "Kill the final boss",
      gemPickups: [],
      skillPoints: 1,
      tips: ["Prepare your endgame build before this fight"],
    },
    {
      zone: "The Epilogue",
      act: 6,
      recommendedLevel: 63,
      objective: "Complete the story — endgame unlocked",
      gemPickups: [],
      skillPoints: 0,
      tips: ["Waystones and endgame atlas now available"],
    },
  ],
};

/** Get the leveling guide for a game */
export function getLevelingGuide(game: Game): LevelingGuide {
  return game === "poe1" ? POE1_LEVELING : POE2_LEVELING;
}

/** Find the current step based on zone name */
export function findCurrentStep(guide: LevelingGuide, zoneName: string): LevelingStep | null {
  return guide.steps.find((s) => zoneName.toLowerCase().includes(s.zone.toLowerCase())) ?? null;
}

/** Get the next step after a given zone */
export function getNextStep(guide: LevelingGuide, zoneName: string): LevelingStep | null {
  const idx = guide.steps.findIndex((s) => zoneName.toLowerCase().includes(s.zone.toLowerCase()));
  if (idx >= 0 && idx < guide.steps.length - 1) {
    return guide.steps[idx + 1];
  }
  return null;
}
