import type { Game } from "./item.js";

/** How a map run ended */
export type MapRunOutcome = "completed" | "bricked" | "abandoned";

export interface MapRun {
  id: string;
  sessionId: string;
  mapName: string;
  mapTier: number | null;
  game: Game;
  league: string;
  characterName: string | null;

  startedAt: number;
  bossEnteredAt: number | null;
  completedAt: number | null;
  totalMs: number | null;

  deaths: number;
  completed: boolean;
  /** How the run ended: completed (hideout return), bricked (6+ deaths or manual), abandoned (paused/left) */
  outcome: MapRunOutcome;

  /** JSON-serialized extra data (splits, loot estimates, etc.) */
  data: string | null;
}

export interface SpeedrunSession {
  id: string;
  game: Game;
  league: string;
  startedAt: number;
  endedAt: number | null;

  maps: MapRun[];
  totalMaps: number;
  completedMaps: number;
  /** Maps where all portals were used (6+ deaths) or manually marked bricked */
  brickedMaps: number;
  /** Maps abandoned before completion */
  abandonedMaps: number;
  totalDeaths: number;
  totalTimeMs: number;
  /** Active grinding time (excludes AFK gaps > 2min) */
  effectiveTimeMs: number;

  mapsPerHour: number | null;
  avgMapTimeMs: number | null;
  chaosPerHour: number | null;

  fastestMapMs: number | null;
  slowestMapMs: number | null;
  fastestMapName: string | null;
}

export interface SpeedrunGoals {
  targetMapsPerHour: number | null;
  targetClearTimeMs: number | null;
}

export interface MapNote {
  mapName: string;
  game: Game;
  layoutRating: 1 | 2 | 3 | 4 | 5;
  bossRating: 1 | 2 | 3 | 4 | 5;
  notes: string;
  layoutHints: string[];
  updatedAt: number;
}

/** Max gap between runs before it's considered AFK (2 minutes) */
const MAX_GAP_MS = 120_000;

/** Compute aggregate stats from a list of completed map runs */
export function computeSessionStats(
  maps: MapRun[],
  sessionStartedAt: number
): Pick<
  SpeedrunSession,
  | "totalMaps"
  | "completedMaps"
  | "brickedMaps"
  | "abandonedMaps"
  | "totalDeaths"
  | "totalTimeMs"
  | "effectiveTimeMs"
  | "mapsPerHour"
  | "avgMapTimeMs"
  | "fastestMapMs"
  | "slowestMapMs"
  | "fastestMapName"
> {
  const completed = maps.filter((m) => m.outcome === "completed" && m.totalMs != null);
  const bricked = maps.filter((m) => m.outcome === "bricked");
  const abandoned = maps.filter((m) => m.outcome === "abandoned");
  const totalTimeMs = Date.now() - sessionStartedAt;

  const times = completed.map((m) => m.totalMs!);
  const fastest = times.length > 0 ? Math.min(...times) : null;
  const slowest = times.length > 0 ? Math.max(...times) : null;
  const fastestRun = fastest != null ? completed.find((m) => m.totalMs === fastest) : null;

  // Effective time: sum of run durations + inter-run gaps (capped at MAX_GAP_MS)
  const sorted = [...completed].sort((a, b) => a.startedAt - b.startedAt);
  let effectiveTimeMs = sorted.reduce((sum, m) => sum + m.totalMs!, 0);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startedAt - (sorted[i - 1].completedAt ?? sorted[i - 1].startedAt);
    effectiveTimeMs += Math.min(Math.max(gap, 0), MAX_GAP_MS);
  }
  const effectiveHours = effectiveTimeMs / 3_600_000;

  return {
    totalMaps: maps.length,
    completedMaps: completed.length,
    brickedMaps: bricked.length,
    abandonedMaps: abandoned.length,
    totalDeaths: maps.reduce((sum, m) => sum + m.deaths, 0),
    totalTimeMs,
    effectiveTimeMs,
    mapsPerHour: effectiveHours > 0 ? completed.length / effectiveHours : null,
    avgMapTimeMs: completed.length > 0 ? times.reduce((a, b) => a + b, 0) / completed.length : null,
    fastestMapMs: fastest,
    slowestMapMs: slowest,
    fastestMapName: fastestRun?.mapName ?? null,
  };
}
