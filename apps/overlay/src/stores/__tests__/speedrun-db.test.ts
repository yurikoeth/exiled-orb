import { describe, it, expect, beforeEach, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({
  execute: vi.fn(async () => ({})),
  select: vi.fn(async (): Promise<unknown[]> => []),
}));
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => fakeDb) },
}));

import {
  saveMapRun,
  deleteMapRun,
  loadPersonalBests,
  loadRunHistory,
  getMapLeaderboard,
  loadGoals,
  saveGoals,
  getOutcomeCounts,
} from "../speedrun-db";
import type { MapRun } from "@exiled-orb/shared";

const RUN: MapRun = {
  id: "r1",
  sessionId: "s1",
  mapName: "Strand",
  mapTier: 5,
  game: "poe1",
  league: "Allflame",
  characterName: "Zana",
  startedAt: 1000,
  bossEnteredAt: 1500,
  completedAt: 61_000,
  totalMs: 60_000,
  deaths: 2,
  completed: true,
  outcome: "completed",
  data: null,
};

const ROW = {
  id: "r1",
  session_id: "s1",
  map_name: "Strand",
  map_tier: 5,
  game: "poe1",
  league: "Allflame",
  started_at: 1000,
  completed_at: 61_000,
  total_ms: 60_000,
  deaths: 2,
  completed: 1,
  outcome: "completed",
  character_name: "Zana",
  data: null,
  created_at: 1,
};

describe("speedrun-db", () => {
  beforeEach(() => {
    fakeDb.execute.mockReset().mockResolvedValue({});
    fakeDb.select.mockReset().mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saveMapRun binds every column in order with completed as 0/1", async () => {
    await saveMapRun(RUN);
    const [sql, params] = fakeDb.execute.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/INSERT OR REPLACE INTO map_runs/);
    expect(params).toEqual([
      "r1",
      "s1",
      "Strand",
      5,
      "poe1",
      "Allflame",
      1000,
      61_000,
      60_000,
      2,
      1,
      "completed",
      "Zana",
      null,
    ]);
  });

  it("swallows DB errors instead of breaking the UI", async () => {
    fakeDb.execute.mockRejectedValueOnce(new Error("locked"));
    await expect(saveMapRun(RUN)).resolves.toBeUndefined();
    await deleteMapRun("r1");
    expect(fakeDb.execute).toHaveBeenLastCalledWith("DELETE FROM map_runs WHERE id = $1", ["r1"]);
  });

  it("loadPersonalBests maps best times, optionally per game", async () => {
    fakeDb.select.mockResolvedValueOnce([{ map_name: "Strand", best_ms: 50_000 }]);
    const pbs = await loadPersonalBests("poe1");
    expect(pbs.get("Strand")).toBe(50_000);
    const [sql, params] = fakeDb.select.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("game = $1");
    expect(params).toEqual(["poe1"]);

    await loadPersonalBests();
    const [sql2, params2] = fakeDb.select.mock.calls[1] as unknown as [string, unknown[]];
    expect(sql2).not.toContain("game =");
    expect(params2).toEqual([]);
  });

  it("loadRunHistory builds the WHERE clause from the given filters and paginates", async () => {
    fakeDb.select.mockResolvedValueOnce([ROW]);
    const runs = await loadRunHistory({ game: "poe1", mapName: "Strand", limit: 5, offset: 10 });
    const [sql, params] = fakeDb.select.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("WHERE game = $1 AND map_name = $2");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
    expect(params).toEqual(["poe1", "Strand", 5, 10]);
    expect(runs[0]).toMatchObject({
      id: "r1",
      sessionId: "s1",
      mapName: "Strand",
      characterName: "Zana",
      completed: true,
      outcome: "completed",
      bossEnteredAt: null,
    });
  });

  it("loadRunHistory defaults to 20 rows and no filter", async () => {
    await loadRunHistory();
    const [sql, params] = fakeDb.select.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toContain("WHERE");
    expect(params).toEqual([20, 0]);
  });

  it("derives a legacy row's outcome from the completed flag", async () => {
    fakeDb.select.mockResolvedValueOnce([
      { ...ROW, outcome: null, completed: 0 },
      { ...ROW, id: "r2", outcome: null, completed: 1 },
    ]);
    const runs = await loadRunHistory();
    expect(runs.map((r) => r.outcome)).toEqual(["abandoned", "completed"]);
  });

  it("getMapLeaderboard queries completed runs for the map ascending by time", async () => {
    fakeDb.select.mockResolvedValueOnce([ROW]);
    const rows = await getMapLeaderboard("Strand", "poe1", 3);
    const [sql, params] = fakeDb.select.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("completed = 1");
    expect(sql).toContain("ORDER BY total_ms ASC");
    expect(params).toEqual(["Strand", "poe1", 3]);
    expect(rows).toHaveLength(1);
  });

  it("loadGoals returns defaults when unset and merges stored JSON", async () => {
    expect(await loadGoals()).toEqual({ targetMapsPerHour: null, targetClearTimeMs: null });
    fakeDb.select.mockResolvedValueOnce([{ value: JSON.stringify({ targetMapsPerHour: 12 }) }]);
    expect(await loadGoals()).toEqual({ targetMapsPerHour: 12, targetClearTimeMs: null });
  });

  it("saveGoals upserts the JSON blob", async () => {
    await saveGoals({ targetMapsPerHour: 12, targetClearTimeMs: null });
    const [sql, params] = fakeDb.execute.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT(key) DO UPDATE");
    expect(params).toEqual(['{"targetMapsPerHour":12,"targetClearTimeMs":null}']);
  });

  it("getOutcomeCounts aggregates totals, today, character and league groups", async () => {
    fakeDb.select
      .mockResolvedValueOnce([
        { outcome: "completed", cnt: 3, death_sum: 2 },
        { outcome: "bricked", cnt: 1, death_sum: 6 },
        { outcome: "abandoned", cnt: 1, death_sum: null },
      ])
      .mockResolvedValueOnce([{ outcome: "completed", cnt: 1, death_sum: 0 }])
      .mockResolvedValueOnce([
        { character_name: "Zana", outcome: "completed", cnt: 3, death_sum: 2 },
        { character_name: "Unknown", outcome: "bricked", cnt: 1, death_sum: 6 },
      ])
      .mockResolvedValueOnce([{ league: "Allflame", outcome: "completed", cnt: 3, death_sum: 2 }]);

    const counts = await getOutcomeCounts("poe1");
    expect(counts.total).toEqual({ completed: 3, bricked: 1, abandoned: 1, total: 5, deaths: 8 });
    expect(counts.today.completed).toBe(1);
    expect(counts.byCharacter.Zana.completed).toBe(3);
    expect(counts.byCharacter.Unknown.bricked).toBe(1);
    expect(counts.byLeague.Allflame.total).toBe(3);
    // Every query is game-scoped.
    for (const call of fakeDb.select.mock.calls) {
      expect((call as unknown as [string])[0]).toContain("game = $1");
    }
  });

  it("getOutcomeCounts returns empty groups when the DB fails", async () => {
    fakeDb.select.mockRejectedValueOnce(new Error("nope"));
    const counts = await getOutcomeCounts();
    expect(counts.total.total).toBe(0);
    expect(counts.byCharacter).toEqual({});
  });
});
