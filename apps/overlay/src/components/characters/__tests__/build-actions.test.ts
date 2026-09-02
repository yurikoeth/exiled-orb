import { describe, it, expect, beforeEach, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
const fakeStore = vi.hoisted(() => ({
  set: vi.fn(async () => {}),
  get: vi.fn(async () => undefined),
  save: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/plugin-store", () => ({ Store: { load: vi.fn(async () => fakeStore) } }));

import { runBuildAnalysis, saveActiveBuild } from "../build-actions";
import { useBuildStore, type BuildItem } from "../../../stores/build-store";

const GEAR: BuildItem[] = [
  {
    name: "",
    base_type: "Astral Plate",
    inventory_id: "BodyArmour",
    icon: "",
    rarity: "Rare",
    socket_count: 6,
    max_links: 6,
    socket_details: [],
    ilvl: 86,
    corrupted: false,
    mods: ["+120 to maximum Life"],
  },
];

describe("runBuildAnalysis", () => {
  beforeEach(() => invokeMock.mockReset());

  it("marshals the character and gear into the Rust command and parses the reply", async () => {
    invokeMock.mockResolvedValue(
      JSON.stringify({
        buildSummary: "Fine.",
        strengths: ["life"],
        weaknesses: [],
        upgrades: [],
        overallRating: "B",
        nextSteps: "cap res",
      })
    );
    const result = await runBuildAnalysis({
      apiKey: "sk",
      name: "Zana",
      characterClass: "Witch",
      level: 90,
      league: "Allflame",
      game: "poe1",
      goal: { buildName: "RF", focus: ["survivability"], budget: "5 div", notes: "" },
      items: GEAR,
    });
    expect(result.overallRating).toBe("B");
    const args = invokeMock.mock.calls[0][1] as { characterJson: string; itemsJson: string };
    expect(JSON.parse(args.characterJson)).toMatchObject({
      name: "Zana",
      class: "Witch",
      buildGoal: { buildName: "RF" },
    });
    // Nameless rares fall back to the base type, and links come from max_links.
    expect(JSON.parse(args.itemsJson)).toEqual([
      {
        slot: "BodyArmour",
        name: "Astral Plate",
        baseType: "Astral Plate",
        rarity: "Rare",
        ilvl: 86,
        links: 6,
        corrupted: false,
        mods: ["+120 to maximum Life"],
      },
    ]);
  });

  it("returns the Witch fallback when the reply is not JSON", async () => {
    invokeMock.mockResolvedValue("I refuse.");
    const result = await runBuildAnalysis({
      apiKey: "sk",
      name: "Zana",
      characterClass: "Witch",
      level: 1,
      league: null,
      game: "poe2",
      goal: null,
      items: [],
    });
    expect(result.overallRating).toBe("?");
    expect(result.upgrades).toEqual([]);
  });
});

describe("saveActiveBuild", () => {
  beforeEach(() => useBuildStore.setState({ activeBuild: null, savedBuilds: [] }));

  it("fills defaults and stores structured gear when given", async () => {
    await saveActiveBuild({
      characterName: "Zana",
      characterClass: "Witch",
      level: 90,
      game: "poe1",
      gearSummary: "summary",
      gear: GEAR,
    });
    expect(useBuildStore.getState().activeBuild).toMatchObject({
      characterName: "Zana",
      league: "Standard",
      damageTypes: [],
      keyItems: [],
      goal: null,
      gear: GEAR,
    });
  });

  it("keeps the goal when re-saving the same character and drops it for another", async () => {
    const goal = { buildName: "RF", focus: [], budget: "", notes: "" };
    await saveActiveBuild({
      characterName: "Zana",
      characterClass: "Witch",
      level: 90,
      game: "poe1",
      gearSummary: "",
    });
    await useBuildStore.getState().setGoal("Zana", goal);
    await saveActiveBuild({
      characterName: "Zana",
      characterClass: "Witch",
      level: 91,
      game: "poe1",
      gearSummary: "new",
      tags: { damageTypes: ["fire"], defenseTypes: [], recoveryTypes: [], mainSkill: "RF" },
    });
    expect(useBuildStore.getState().activeBuild).toMatchObject({
      level: 91,
      goal,
      mainSkill: "RF",
    });

    await saveActiveBuild({
      characterName: "Other",
      characterClass: "Ranger",
      level: 50,
      game: "poe2",
      gearSummary: "",
    });
    expect(useBuildStore.getState().activeBuild?.goal).toBeNull();
    expect(useBuildStore.getState().activeBuild).not.toHaveProperty("gear");
  });
});
