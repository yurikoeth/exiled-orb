import { describe, it, expect, vi, afterEach } from "vitest";
import { computeSessionStats, type MapRun, type MapRunOutcome } from "../speedrun.js";

const T0 = 1_700_000_000_000;

function run(
  overrides: Partial<MapRun> & { startedAt: number; totalMs?: number | null; outcome?: MapRunOutcome }
): MapRun {
  const outcome = overrides.outcome ?? "completed";
  const totalMs = overrides.totalMs === undefined ? 60_000 : overrides.totalMs;
  return {
    id: `${overrides.startedAt}`,
    sessionId: "s",
    mapName: "Strand",
    mapTier: 5,
    game: "poe1",
    league: "Allflame",
    characterName: null,
    bossEnteredAt: null,
    completedAt: totalMs != null ? overrides.startedAt + totalMs : null,
    deaths: 0,
    completed: outcome === "completed",
    data: null,
    ...overrides,
    outcome,
    totalMs,
  };
}

describe("computeSessionStats", () => {
  afterEach(() => vi.useRealTimers());

  it("returns zeros/nulls for an empty session", () => {
    vi.useFakeTimers({ now: T0 + 10_000 });
    const stats = computeSessionStats([], T0);
    expect(stats).toEqual({
      totalMaps: 0,
      completedMaps: 0,
      brickedMaps: 0,
      abandonedMaps: 0,
      totalDeaths: 0,
      totalTimeMs: 10_000,
      effectiveTimeMs: 0,
      mapsPerHour: null,
      avgMapTimeMs: null,
      fastestMapMs: null,
      slowestMapMs: null,
      fastestMapName: null,
    });
  });

  it("counts outcomes and deaths across every run", () => {
    const maps = [
      run({ startedAt: T0, deaths: 1 }),
      run({ startedAt: T0 + 100_000, outcome: "bricked", deaths: 6, totalMs: 90_000 }),
      run({ startedAt: T0 + 300_000, outcome: "abandoned", totalMs: null, deaths: 0 }),
    ];
    const stats = computeSessionStats(maps, T0);
    expect(stats.totalMaps).toBe(3);
    expect(stats.completedMaps).toBe(1);
    expect(stats.brickedMaps).toBe(1);
    expect(stats.abandonedMaps).toBe(1);
    expect(stats.totalDeaths).toBe(7);
  });

  it("only uses completed runs for timing stats", () => {
    const maps = [
      run({ startedAt: T0, totalMs: 120_000, mapName: "Strand" }),
      run({ startedAt: T0 + 200_000, totalMs: 60_000, mapName: "Beach" }),
      run({ startedAt: T0 + 400_000, totalMs: 10_000, outcome: "bricked", mapName: "Pit" }),
    ];
    const stats = computeSessionStats(maps, T0);
    expect(stats.fastestMapMs).toBe(60_000);
    expect(stats.fastestMapName).toBe("Beach");
    expect(stats.slowestMapMs).toBe(120_000);
    expect(stats.avgMapTimeMs).toBe(90_000);
  });

  it("caps inter-run gaps at 2 minutes when computing effective time", () => {
    const maps = [
      run({ startedAt: T0, totalMs: 60_000 }),
      // 30 minute AFK gap after the first run completes
      run({ startedAt: T0 + 60_000 + 30 * 60_000, totalMs: 60_000 }),
      // 30 second gap
      run({ startedAt: T0 + 60_000 + 30 * 60_000 + 60_000 + 30_000, totalMs: 60_000 }),
    ];
    const stats = computeSessionStats(maps, T0);
    expect(stats.effectiveTimeMs).toBe(3 * 60_000 + 120_000 + 30_000);
    // 3 maps in 5.5 effective minutes
    expect(stats.mapsPerHour).toBeCloseTo(3 / (5.5 / 60), 5);
  });

  it("ignores negative gaps from out-of-order timestamps", () => {
    const maps = [
      run({ startedAt: T0 + 50_000, totalMs: 60_000 }),
      run({ startedAt: T0, totalMs: 60_000 }),
    ];
    const stats = computeSessionStats(maps, T0);
    // Sorted by startedAt; second run starts before the first ends → gap clamped to 0.
    expect(stats.effectiveTimeMs).toBe(120_000);
  });
});
