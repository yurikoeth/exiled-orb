import { describe, it, expect, beforeEach, vi } from "vitest";

const db = vi.hoisted(() => ({
  saveMapRun: vi.fn(async () => {}),
  deleteMapRun: vi.fn(async () => {}),
  loadPersonalBests: vi.fn(async () => new Map<string, number>()),
  loadGoals: vi.fn(async () => ({ targetMapsPerHour: 10, targetClearTimeMs: 60_000 })),
  saveGoals: vi.fn(async () => {}),
}));
vi.mock("../speedrun-db", () => db);

import { useSpeedrunStore } from "../speedrun-store";
import { useOverlayStore } from "../overlay-store";
import { useSettingsStore } from "../settings-store";
import type { MapRunOutcome } from "@exiled-orb/shared";

const T0 = 1_700_000_000_000;

function reset() {
  useSpeedrunStore.setState({
    currentRun: null,
    pendingRun: null,
    session: null,
    tracking: true,
    personalBests: new Map(),
    lastCompletedRun: null,
    dbLoaded: false,
    goals: { targetMapsPerHour: null, targetClearTimeMs: null },
    newPb: false,
  });
  useOverlayStore.setState({ detectedGame: null });
  for (const fn of Object.values(db)) fn.mockClear();
}

/** Start + finish + resolve one run. */
function completeRun(
  name: string,
  start: number,
  durationMs: number,
  outcome: MapRunOutcome = "completed"
) {
  const s = useSpeedrunStore.getState();
  s.startMapRun(name, 5, start);
  useSpeedrunStore.getState().finishMapRun(start + durationMs);
  useSpeedrunStore.getState().resolveRun(outcome);
  return useSpeedrunStore.getState().lastCompletedRun!;
}

describe("speedrun-store", () => {
  beforeEach(reset);

  it("auto-starts a session from the detected game and resolved league", () => {
    useOverlayStore.setState({ detectedGame: "poe2" });
    useSpeedrunStore.getState().startMapRun("Sinking Spire", 12, T0, "Zana");
    const { session, currentRun } = useSpeedrunStore.getState();
    expect(session?.game).toBe("poe2");
    expect(session?.league).toBe("Runes of Aldur");
    // The very first run of an auto-started session must belong to that
    // session (this used to read a stale snapshot: sessionId "", league
    // "Standard").
    expect(currentRun).toMatchObject({
      sessionId: session?.id,
      mapName: "Sinking Spire",
      mapTier: 12,
      game: "poe2",
      league: "Runes of Aldur",
      characterName: "Zana",
      startedAt: T0,
      deaths: 0,
      outcome: "abandoned",
    });
  });

  it("falls back to the settings game and honours a league override", () => {
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        game: "poe1",
        leagues: { poe1: "Standard", poe2: null },
      },
    });
    useSpeedrunStore.getState().startMapRun("Strand", 1, T0);
    expect(useSpeedrunStore.getState().session).toMatchObject({ game: "poe1", league: "Standard" });
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, leagues: { poe1: null, poe2: null } },
    });
  });

  it("stops the timer into a pending run and saves only on resolve", () => {
    const s = useSpeedrunStore.getState();
    s.startMapRun("Strand", 1, T0);
    useSpeedrunStore.getState().enterBossArena(T0 + 30_000);
    useSpeedrunStore.getState().addMapDeath();
    useSpeedrunStore.getState().finishMapRun(T0 + 90_000);
    const { currentRun, pendingRun } = useSpeedrunStore.getState();
    expect(currentRun).toBeNull();
    expect(pendingRun).toMatchObject({
      bossEnteredAt: T0 + 30_000,
      deaths: 1,
      completedAt: T0 + 90_000,
      totalMs: 90_000,
    });
    expect(db.saveMapRun).not.toHaveBeenCalled();

    useSpeedrunStore.getState().resolveRun("completed");
    expect(db.saveMapRun).toHaveBeenCalledTimes(1);
    const state = useSpeedrunStore.getState();
    expect(state.pendingRun).toBeNull();
    expect(state.lastCompletedRun?.outcome).toBe("completed");
    expect(state.session?.completedMaps).toBe(1);
    expect(state.personalBests.get("Strand")).toBe(90_000);
    expect(state.newPb).toBe(true);
  });

  it("only records personal bests for completed runs and flags improvements", () => {
    completeRun("Strand", T0, 90_000);
    completeRun("Strand", T0 + 200_000, 120_000);
    expect(useSpeedrunStore.getState().newPb).toBe(false);
    expect(useSpeedrunStore.getState().personalBests.get("Strand")).toBe(90_000);
    completeRun("Strand", T0 + 400_000, 60_000);
    expect(useSpeedrunStore.getState().newPb).toBe(true);
    expect(useSpeedrunStore.getState().personalBests.get("Strand")).toBe(60_000);
    completeRun("Beach", T0 + 600_000, 10_000, "bricked");
    expect(useSpeedrunStore.getState().personalBests.has("Beach")).toBe(false);
    expect(useSpeedrunStore.getState().session?.brickedMaps).toBe(1);
  });

  it("auto-resolves an unanswered pending run as completed when the next map starts", () => {
    const s = useSpeedrunStore.getState();
    s.startMapRun("Strand", 1, T0);
    useSpeedrunStore.getState().finishMapRun(T0 + 60_000);
    useSpeedrunStore.getState().startMapRun("Beach", 1, T0 + 120_000);
    const state = useSpeedrunStore.getState();
    expect(state.pendingRun).toBeNull();
    expect(state.session?.maps.map((m) => m.outcome)).toEqual(["completed"]);
    expect(state.currentRun?.mapName).toBe("Beach");
  });

  it("dismissPending drops the run without saving", () => {
    useSpeedrunStore.getState().startMapRun("Strand", 1, T0);
    useSpeedrunStore.getState().finishMapRun(T0 + 60_000);
    useSpeedrunStore.getState().dismissPending();
    expect(useSpeedrunStore.getState().pendingRun).toBeNull();
    expect(db.saveMapRun).not.toHaveBeenCalled();
  });

  it("abandonMapRun records the run as abandoned", () => {
    useSpeedrunStore.getState().startMapRun("Strand", 1, T0);
    useSpeedrunStore.getState().abandonMapRun();
    const state = useSpeedrunStore.getState();
    expect(state.currentRun).toBeNull();
    expect(state.session?.abandonedMaps).toBe(1);
    expect(db.saveMapRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "abandoned" }));
  });

  it("markOutcome reclassifies a run and recomputes the PB", () => {
    const best = completeRun("Strand", T0, 60_000);
    completeRun("Strand", T0 + 200_000, 90_000);
    useSpeedrunStore.getState().markOutcome(best.id, "bricked");
    let state = useSpeedrunStore.getState();
    expect(state.personalBests.get("Strand")).toBe(90_000);
    expect(state.session?.brickedMaps).toBe(1);
    expect(state.lastCompletedRun?.id).not.toBe(best.id);

    useSpeedrunStore.getState().markOutcome(best.id, "completed");
    state = useSpeedrunStore.getState();
    expect(state.personalBests.get("Strand")).toBe(60_000);
    expect(db.saveMapRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: best.id, outcome: "completed", completed: true })
    );
  });

  it("markOutcome drops the PB entirely when no completed run remains", () => {
    const only = completeRun("Strand", T0, 60_000);
    useSpeedrunStore.getState().markOutcome(only.id, "abandoned");
    expect(useSpeedrunStore.getState().personalBests.has("Strand")).toBe(false);
  });

  it("deleteRun removes the run, rebuilds PBs and deletes from the DB", () => {
    const a = completeRun("Strand", T0, 60_000);
    completeRun("Strand", T0 + 200_000, 90_000);
    useSpeedrunStore.getState().deleteRun(a.id);
    const state = useSpeedrunStore.getState();
    expect(state.session?.maps).toHaveLength(1);
    expect(state.personalBests.get("Strand")).toBe(90_000);
    expect(db.deleteMapRun).toHaveBeenCalledWith(a.id);
  });

  it("endSession stamps the end time and drops the active run", () => {
    useSpeedrunStore.getState().startMapRun("Strand", 1, T0);
    useSpeedrunStore.getState().endSession();
    expect(useSpeedrunStore.getState().session?.endedAt).not.toBeNull();
    expect(useSpeedrunStore.getState().currentRun).toBeNull();
  });

  it("exports CSV and JSON", () => {
    expect(useSpeedrunStore.getState().exportSession("csv")).toBe("");
    completeRun("Strand", T0, 60_000);
    const csv = useSpeedrunStore.getState().exportSession("csv");
    const [header, row] = csv.split("\n");
    expect(header).toBe(
      "map_name,map_tier,character,outcome,started_at,completed_at,total_ms,deaths"
    );
    expect(row).toBe(
      `"Strand",5,"",completed,${new Date(T0).toISOString()},${new Date(T0 + 60_000).toISOString()},60000,0`
    );
    const json = JSON.parse(useSpeedrunStore.getState().exportSession("json"));
    expect(json).toHaveLength(1);
    expect(json[0].mapName).toBe("Strand");
  });

  it("loads PBs and goals from the DB and persists goal changes", async () => {
    db.loadPersonalBests.mockResolvedValueOnce(new Map([["Strand", 1234]]));
    await useSpeedrunStore.getState().loadPBsFromDB("poe1");
    expect(useSpeedrunStore.getState().personalBests.get("Strand")).toBe(1234);
    expect(useSpeedrunStore.getState().dbLoaded).toBe(true);
    expect(db.loadPersonalBests).toHaveBeenCalledWith("poe1");

    await useSpeedrunStore.getState().loadGoals();
    expect(useSpeedrunStore.getState().goals.targetMapsPerHour).toBe(10);

    await useSpeedrunStore.getState().setGoals({ targetClearTimeMs: 90_000 });
    expect(db.saveGoals).toHaveBeenCalledWith({ targetMapsPerHour: 10, targetClearTimeMs: 90_000 });
  });
});
