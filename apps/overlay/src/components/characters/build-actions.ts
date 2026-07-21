import { invoke } from "@tauri-apps/api/core";
import { parseAiJson } from "../../utils/parseAiJson";
import { useBuildStore, type BuildGoal, type BuildItem } from "../../stores/build-store";

/** Shape of the Witch's build-analysis JSON response. */
export interface BuildAnalysis {
  buildSummary: string;
  strengths: string[];
  weaknesses: string[];
  upgrades: Array<{
    slot: string;
    currentItem: string;
    suggestion: string;
    priority: string;
    estimatedCost: string;
  }>;
  overallRating: string;
  nextSteps: string;
}

const ANALYSIS_FALLBACK: BuildAnalysis = {
  buildSummary: "The Witch could not read this exile's fate. Try again.",
  strengths: [], weaknesses: [], upgrades: [],
  overallRating: "?", nextSteps: "Click Analyze Build to retry.",
};

/**
 * Marshal a character + gear and run the Claude (Witch persona) build
 * analysis. Shared by the GGG character rows and the Live Session tile —
 * both previously had a near-identical copy of this.
 */
export async function runBuildAnalysis(opts: {
  apiKey: string;
  name: string;
  characterClass: string;
  level: number;
  league: string | null;
  game: string;
  goal: BuildGoal | null | undefined;
  items: BuildItem[];
}): Promise<BuildAnalysis> {
  const characterJson = JSON.stringify({
    name: opts.name,
    class: opts.characterClass,
    level: opts.level,
    league: opts.league,
    game: opts.game,
    buildGoal: opts.goal
      ? {
          buildName: opts.goal.buildName,
          focus: opts.goal.focus,
          budget: opts.goal.budget,
          notes: opts.goal.notes,
        }
      : null,
  });
  const itemsJson = JSON.stringify(
    opts.items.map((i) => ({
      slot: i.inventory_id,
      name: i.name || i.base_type,
      baseType: i.base_type,
      rarity: i.rarity,
      ilvl: i.ilvl,
      links: i.max_links,
      corrupted: i.corrupted,
      mods: i.mods,
    })),
  );
  const result = await invoke<string>("analyze_build", { apiKey: opts.apiKey, characterJson, itemsJson });
  return parseAiJson<BuildAnalysis>(result, ANALYSIS_FALLBACK);
}

export interface SaveBuildParts {
  characterName: string;
  characterClass: string;
  level: number;
  game: "poe1" | "poe2";
  league?: string;
  tags?: {
    damageTypes: string[];
    defenseTypes: string[];
    recoveryTypes: string[];
    mainSkill: string | null;
  };
  keyItems?: string[];
  gearSummary: string;
  gear?: BuildItem[];
}

/**
 * Save a build as the active build, preserving the existing goal when the
 * character is unchanged. Centralizes the object construction previously
 * copy-pasted at four call sites.
 */
export async function saveActiveBuild(parts: SaveBuildParts): Promise<void> {
  const prev = useBuildStore.getState().activeBuild;
  const goal = prev?.characterName === parts.characterName ? prev?.goal ?? null : null;
  await useBuildStore.getState().setActiveBuild({
    characterName: parts.characterName,
    characterClass: parts.characterClass,
    level: parts.level,
    game: parts.game,
    league: parts.league ?? "Standard",
    damageTypes: parts.tags?.damageTypes ?? [],
    defenseTypes: parts.tags?.defenseTypes ?? [],
    recoveryTypes: parts.tags?.recoveryTypes ?? [],
    mainSkill: parts.tags?.mainSkill ?? null,
    keyItems: parts.keyItems ?? [],
    gearSummary: parts.gearSummary,
    ...(parts.gear ? { gear: parts.gear } : {}),
    goal,
    updatedAt: Date.now(),
  });
}
