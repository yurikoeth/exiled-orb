import { create } from "zustand";
import { getStore } from "../utils/store";

/** A single socket on an equipped item — color + link group. */
export interface BuildSocket {
  color: string;
  group: number;
}

/**
 * One equipped item on a build, in the same shape as GGG's get-items API
 * returns. Used both by GGG-fetched characters and by clipboard-captured
 * builds so a single `<ItemCard />` renders both.
 */
export interface BuildItem {
  name: string;
  base_type: string;
  inventory_id: string;
  icon: string;
  rarity: string;
  socket_count: number | null;
  max_links: number | null;
  socket_details: BuildSocket[];
  ilvl: number | null;
  corrupted: boolean;
  mods: string[];
}

export interface BuildGoal {
  /** Main skill / build archetype, e.g. "Lightning Arrow Deadeye" */
  buildName: string;
  /** What to optimize for, e.g. "DPS", "survivability", "magic find", "boss killing" */
  focus: string[];
  /** Budget in divine/chaos */
  budget: string;
  /** Any specific notes, e.g. "need more chaos res", "want to do ubers" */
  notes: string;
}

interface ActiveBuild {
  /** Character this build is from */
  characterName: string;
  characterClass: string;
  level: number;
  game: "poe1" | "poe2";
  league: string;

  /** Build archetype tags — used by map warnings, AI, etc. */
  damageTypes: string[];
  defenseTypes: string[];
  recoveryTypes: string[];

  /** Key stats inferred from gear */
  mainSkill: string | null;
  keyItems: string[];

  /** Raw gear summary for AI context */
  gearSummary: string;

  /**
   * Equipped items in structured form. Optional for backwards compatibility
   * with builds saved before this field existed (those just have gearSummary
   * text). Captured + GGG-fetched builds populate this.
   */
  gear?: BuildItem[];

  /** Build goal — user-defined optimization target */
  goal: BuildGoal | null;

  /** Timestamp */
  updatedAt: number;
}

interface BuildState {
  activeBuild: ActiveBuild | null;
  savedBuilds: ActiveBuild[];

  setActiveBuild: (build: ActiveBuild) => Promise<void>;
  setGoal: (characterName: string, goal: BuildGoal) => Promise<void>;
  loadBuilds: () => Promise<void>;
  deleteBuild: (characterName: string) => Promise<void>;
}

const STORE_KEY = "saved_builds";
const ACTIVE_KEY = "active_build";

export const useBuildStore = create<BuildState>((set, get) => ({
  activeBuild: null,
  savedBuilds: [],

  setGoal: async (characterName, goal) => {
    const state = get();
    if (state.activeBuild?.characterName === characterName) {
      const updated = { ...state.activeBuild, goal };
      set({ activeBuild: updated });
      // Update in saved builds too
      const saved = state.savedBuilds.map((b) =>
        b.characterName === characterName ? { ...b, goal } : b
      );
      set({ savedBuilds: saved });
      try {
        const store = await getStore();
        await store.set(ACTIVE_KEY, updated);
        await store.set(STORE_KEY, saved);
        await store.save();
      } catch (err) { console.error("[ExiledOrb] Store error:", err); }
    }
  },

  setActiveBuild: async (build) => {
    set({ activeBuild: build });

    // Save to persistent store
    try {
      const store = await getStore();
      await store.set(ACTIVE_KEY, build);

      // Also update saved builds list
      const saved = get().savedBuilds.filter((b) => b.characterName !== build.characterName);
      saved.unshift(build);
      set({ savedBuilds: saved });
      await store.set(STORE_KEY, saved);
      await store.save();
    } catch (err) { console.error("[ExiledOrb] Store error:", err); }
  },

  loadBuilds: async () => {
    try {
      const store = await getStore();
      const active = await store.get<ActiveBuild>(ACTIVE_KEY);
      const saved = await store.get<ActiveBuild[]>(STORE_KEY);
      set({
        activeBuild: active ?? null,
        savedBuilds: saved ?? [],
      });
    } catch (err) { console.error("[ExiledOrb] Store error:", err); }
  },

  deleteBuild: async (characterName) => {
    const saved = get().savedBuilds.filter((b) => b.characterName !== characterName);
    set({ savedBuilds: saved });
    if (get().activeBuild?.characterName === characterName) {
      set({ activeBuild: null });
    }
    try {
      const store = await getStore();
      await store.set(STORE_KEY, saved);
      await store.save();
    } catch (err) { console.error("[ExiledOrb] Store error:", err); }
  },
}));

/**
 * Infer build archetype tags from gear mods.
 * Used when generating a build profile from GGG character data.
 */
export function inferBuildTags(mods: string[]): {
  damageTypes: string[];
  defenseTypes: string[];
  recoveryTypes: string[];
  mainSkill: string | null;
} {
  const allMods = mods.join(" ").toLowerCase();

  const damageTypes: string[] = [];
  const defenseTypes: string[] = [];
  const recoveryTypes: string[] = [];

  // Damage
  if (/fire damage|burning|ignite/.test(allMods)) damageTypes.push("elemental", "fire");
  if (/cold damage|freeze|chill/.test(allMods)) damageTypes.push("elemental", "cold");
  if (/lightning damage|shock/.test(allMods)) damageTypes.push("elemental", "lightning");
  if (/chaos damage|poison/.test(allMods)) damageTypes.push("chaos");
  if (/physical damage|impale|bleed/.test(allMods)) damageTypes.push("physical");
  if (/spell damage|cast speed/.test(allMods)) damageTypes.push("spell");
  if (/attack speed|accuracy/.test(allMods)) damageTypes.push("attack");
  if (/minion|summon|skeleton|zombie|spectre/.test(allMods)) damageTypes.push("minion");
  if (/damage over time|dot/.test(allMods)) damageTypes.push("dot");
  if (/totem/.test(allMods)) damageTypes.push("totem");
  if (/trap|mine/.test(allMods)) damageTypes.push("trap");

  // Defense
  if (/armour|\barmor\b/.test(allMods)) defenseTypes.push("armour");
  if (/evasion/.test(allMods)) defenseTypes.push("evasion");
  if (/energy shield/.test(allMods)) defenseTypes.push("energy-shield");
  if (/block/.test(allMods)) defenseTypes.push("block");
  if (/dodge|suppress/.test(allMods)) defenseTypes.push("suppression");

  // Recovery
  if (/leech/.test(allMods)) recoveryTypes.push("leech");
  if (/life regen|regenerat/.test(allMods)) recoveryTypes.push("regen");
  if (/life on hit|life gained/.test(allMods)) recoveryTypes.push("life-on-hit");
  if (/es recharge|energy shield recharge/.test(allMods)) recoveryTypes.push("es-recharge");

  // Deduplicate
  const unique = (arr: string[]) => [...new Set(arr)];

  return {
    damageTypes: unique(damageTypes),
    defenseTypes: unique(defenseTypes),
    recoveryTypes: unique(recoveryTypes),
    mainSkill: null,
  };
}
