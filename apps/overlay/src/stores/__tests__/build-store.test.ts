import { describe, it, expect, beforeEach, vi } from "vitest";

const fakeStore = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  return {
    data,
    set: vi.fn(async (k: string, v: unknown) => void data.set(k, v)),
    get: vi.fn(async (k: string) => data.get(k)),
    save: vi.fn(async () => {}),
  };
});
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: { load: vi.fn(async () => fakeStore) },
}));

import { useBuildStore, inferBuildTags } from "../build-store";

function build(characterName: string) {
  return {
    characterName,
    characterClass: "Witch",
    level: 90,
    game: "poe1" as const,
    league: "Allflame",
    damageTypes: [],
    defenseTypes: [],
    recoveryTypes: [],
    mainSkill: null,
    keyItems: [],
    gearSummary: "",
    goal: null,
    updatedAt: 1,
  };
}

describe("build-store", () => {
  beforeEach(() => {
    fakeStore.data.clear();
    fakeStore.set.mockClear();
    fakeStore.save.mockClear();
    useBuildStore.setState({ activeBuild: null, savedBuilds: [] });
  });

  it("setActiveBuild persists and keeps one entry per character, newest first", async () => {
    await useBuildStore.getState().setActiveBuild(build("A"));
    await useBuildStore.getState().setActiveBuild(build("B"));
    await useBuildStore.getState().setActiveBuild({ ...build("A"), level: 95 });
    const saved = useBuildStore.getState().savedBuilds;
    expect(saved.map((b) => b.characterName)).toEqual(["A", "B"]);
    expect(saved[0].level).toBe(95);
    expect(fakeStore.data.get("active_build")).toMatchObject({ characterName: "A", level: 95 });
    expect(fakeStore.data.get("saved_builds")).toHaveLength(2);
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("setGoal updates the active build and its saved copy only", async () => {
    await useBuildStore.getState().setActiveBuild(build("A"));
    await useBuildStore.getState().setActiveBuild(build("B"));
    const goal = { buildName: "LA Deadeye", focus: ["DPS"], budget: "10 div", notes: "" };
    await useBuildStore.getState().setGoal("B", goal);
    expect(useBuildStore.getState().activeBuild?.goal).toEqual(goal);
    const saved = useBuildStore.getState().savedBuilds;
    expect(saved.find((b) => b.characterName === "B")?.goal).toEqual(goal);
    expect(saved.find((b) => b.characterName === "A")?.goal).toBeNull();
    // A goal for a character that is not active is ignored.
    await useBuildStore.getState().setGoal("A", goal);
    expect(
      useBuildStore.getState().savedBuilds.find((b) => b.characterName === "A")?.goal
    ).toBeNull();
  });

  it("loadBuilds restores persisted state and tolerates an empty store", async () => {
    await useBuildStore.getState().loadBuilds();
    expect(useBuildStore.getState()).toMatchObject({ activeBuild: null, savedBuilds: [] });
    fakeStore.data.set("active_build", build("Z"));
    fakeStore.data.set("saved_builds", [build("Z")]);
    await useBuildStore.getState().loadBuilds();
    expect(useBuildStore.getState().activeBuild?.characterName).toBe("Z");
    expect(useBuildStore.getState().savedBuilds).toHaveLength(1);
  });

  it("deleteBuild removes the saved copy and clears the active build if it matches", async () => {
    await useBuildStore.getState().setActiveBuild(build("A"));
    await useBuildStore.getState().setActiveBuild(build("B"));
    await useBuildStore.getState().deleteBuild("B");
    expect(useBuildStore.getState().activeBuild).toBeNull();
    expect(useBuildStore.getState().savedBuilds.map((b) => b.characterName)).toEqual(["A"]);
    await useBuildStore.getState().deleteBuild("A");
    expect(fakeStore.data.get("saved_builds")).toEqual([]);
  });
});

describe("inferBuildTags", () => {
  it("derives damage, defence and recovery tags without duplicates", () => {
    const tags = inferBuildTags([
      "Adds 10 to 20 Fire Damage",
      "20% chance to Ignite",
      "Adds 10 to 20 Physical Damage",
      "15% increased Attack Speed",
      "+500 to Armour",
      "50% increased Evasion Rating",
      "1% of Physical Attack Damage Leeched as Life",
      "Regenerate 20 Life per second",
      "Minions deal 30% increased Damage",
    ]);
    expect(tags.damageTypes).toEqual(["elemental", "fire", "physical", "attack", "minion"]);
    expect(tags.defenseTypes).toEqual(["armour", "evasion"]);
    expect(tags.recoveryTypes).toEqual(["leech", "regen"]);
    expect(tags.mainSkill).toBeNull();
  });

  it("reads a spell-suppression mod as both suppression and (by wording) spell damage", () => {
    // Documents the current heuristic: "Suppress Spell Damage" contains "spell damage".
    const tags = inferBuildTags(["+10% chance to Suppress Spell Damage"]);
    expect(tags.defenseTypes).toEqual(["suppression"]);
    expect(tags.damageTypes).toEqual(["spell"]);
  });

  it("returns empty tags for unrecognised mods", () => {
    expect(inferBuildTags(["+30 to Strength"])).toEqual({
      damageTypes: [],
      defenseTypes: [],
      recoveryTypes: [],
      mainSkill: null,
    });
  });
});
