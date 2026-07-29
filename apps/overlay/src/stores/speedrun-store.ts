import { create } from "zustand";
import type { MapRun, MapRunOutcome, SpeedrunSession, SpeedrunGoals } from "@exiled-orb/shared";
import { computeSessionStats } from "@exiled-orb/shared";
import {
  saveMapRun,
  deleteMapRun,
  loadPersonalBests,
  loadGoals,
  saveGoals as saveGoalsDb,
} from "./speedrun-db";

interface SpeedrunState {
  /** Current active map run (null when in hideout/town) */
  currentRun: MapRun | null;
  /** Run that finished timing but awaits user Clear/Brick decision */
  pendingRun: MapRun | null;
  /** Current grinding session */
  session: SpeedrunSession | null;
  /** Whether the tracker is active */
  tracking: boolean;
  /** Personal best times per map name */
  personalBests: Map<string, number>;
  /** Last resolved run (for split display after decision) */
  lastCompletedRun: MapRun | null;
  /** Whether PBs have been loaded from DB */
  dbLoaded: boolean;
  /** Speedrun goals */
  goals: SpeedrunGoals;
  /** Whether the last completed run was a new PB */
  newPb: boolean;

  // Actions
  startSession: (game: string, league: string) => void;
  endSession: () => void;
  startMapRun: (
    mapName: string,
    mapTier: number | null,
    timestamp: number,
    characterName?: string | null
  ) => void;
  enterBossArena: (timestamp: number) => void;
  /** Stop the timer and move run to pending — waits for user to resolve */
  finishMapRun: (timestamp: number) => void;
  /** User resolves the pending run as completed or bricked */
  resolveRun: (outcome: MapRunOutcome) => void;
  /** Dismiss the pending run popup without changing outcome (keeps current state) */
  dismissPending: () => void;
  addMapDeath: () => void;
  abandonMapRun: () => void;
  setTracking: (tracking: boolean) => void;
  /** Reclassify a run's outcome (e.g. mark as bricked). Updates session stats, PBs, and DB. */
  markOutcome: (runId: string, outcome: MapRunOutcome) => void;
  /** Delete a run from session and DB */
  deleteRun: (runId: string) => void;
  loadPBsFromDB: (game?: string) => Promise<void>;
  setGoals: (goals: Partial<SpeedrunGoals>) => Promise<void>;
  loadGoals: () => Promise<void>;
  exportSession: (format: "csv" | "json") => string;
}

let nextId = 1;
function genId(): string {
  return `${Date.now()}-${nextId++}`;
}

export const useSpeedrunStore = create<SpeedrunState>((set, get) => ({
  currentRun: null,
  pendingRun: null,
  session: null,
  tracking: true,
  personalBests: new Map(),
  lastCompletedRun: null,
  dbLoaded: false,
  goals: { targetMapsPerHour: null, targetClearTimeMs: null },
  newPb: false,

  startSession: (game, league) => {
    const session: SpeedrunSession = {
      id: genId(),
      game: game as "poe1" | "poe2",
      league,
      startedAt: Date.now(),
      endedAt: null,
      maps: [],
      totalMaps: 0,
      completedMaps: 0,
      brickedMaps: 0,
      abandonedMaps: 0,
      totalDeaths: 0,
      totalTimeMs: 0,
      effectiveTimeMs: 0,
      mapsPerHour: null,
      avgMapTimeMs: null,
      chaosPerHour: null,
      fastestMapMs: null,
      slowestMapMs: null,
      fastestMapName: null,
    };
    set({ session });
  },

  endSession: () => {
    set((s) => {
      if (!s.session) return s;
      return {
        session: { ...s.session, endedAt: Date.now() },
        currentRun: null,
      };
    });
  },

  startMapRun: (mapName, mapTier, timestamp, characterName?) => {
    const state = get();

    // If there's an unresolved pending run, auto-resolve it as "completed"
    if (state.pendingRun) {
      state.resolveRun("completed");
    }

    // Auto-start session if not running
    if (!state.session) {
      state.startSession("poe2", "Standard");
    }

    const run: MapRun = {
      id: genId(),
      sessionId: state.session?.id ?? "",
      mapName,
      mapTier,
      game: (state.session?.game ?? "poe2") as "poe1" | "poe2",
      league: state.session?.league ?? "Standard",
      characterName: characterName ?? null,
      startedAt: timestamp,
      bossEnteredAt: null,
      completedAt: null,
      totalMs: null,
      deaths: 0,
      completed: false,
      outcome: "abandoned",
      data: null,
    };
    set({ currentRun: run });
  },

  enterBossArena: (timestamp) => {
    set((s) => {
      if (!s.currentRun) return s;
      return { currentRun: { ...s.currentRun, bossEnteredAt: timestamp } };
    });
  },

  finishMapRun: (timestamp) => {
    const state = get();
    if (!state.currentRun) return;

    // Stop the timer, move to pending — NOT saved yet
    const pending: MapRun = {
      ...state.currentRun,
      completedAt: timestamp,
      totalMs: timestamp - state.currentRun.startedAt,
    };

    set({ currentRun: null, pendingRun: pending });
  },

  resolveRun: (outcome) => {
    const state = get();
    if (!state.pendingRun || !state.session) return;

    const isCleared = outcome === "completed";
    const run: MapRun = {
      ...state.pendingRun,
      completed: isCleared,
      outcome,
    };

    const maps = [...state.session.maps, run];
    const stats = computeSessionStats(maps, state.session.startedAt);

    // Only update PB for completed runs
    const pbs = new Map(state.personalBests);
    let isPb = false;
    if (isCleared && run.totalMs != null) {
      const currentPb = pbs.get(run.mapName);
      isPb = currentPb == null || run.totalMs < currentPb;
      if (isPb) pbs.set(run.mapName, run.totalMs);
    }

    set({
      pendingRun: null,
      lastCompletedRun: run,
      personalBests: pbs,
      newPb: isPb,
      session: { ...state.session, maps, ...stats },
    });

    void saveMapRun(run);
  },

  dismissPending: () => {
    set({ pendingRun: null });
  },

  addMapDeath: () => {
    set((s) => {
      if (!s.currentRun) return s;
      return { currentRun: { ...s.currentRun, deaths: s.currentRun.deaths + 1 } };
    });
  },

  abandonMapRun: () => {
    const state = get();
    if (!state.currentRun || !state.session) return;

    const abandoned: MapRun = { ...state.currentRun, completed: false, outcome: "abandoned" };
    const maps = [...state.session.maps, abandoned];
    const stats = computeSessionStats(maps, state.session.startedAt);

    set({
      currentRun: null,
      session: { ...state.session, maps, ...stats },
    });

    void saveMapRun(abandoned);
  },

  markOutcome: (runId, outcome) => {
    const state = get();
    if (!state.session) return;

    const mapIdx = state.session.maps.findIndex((m) => m.id === runId);
    if (mapIdx === -1) return;

    const oldRun = state.session.maps[mapIdx];
    const updatedRun: MapRun = {
      ...oldRun,
      outcome,
      completed: outcome === "completed",
    };

    const maps = [...state.session.maps];
    maps[mapIdx] = updatedRun;
    const stats = computeSessionStats(maps, state.session.startedAt);

    // Recalculate PBs
    const pbs = new Map(state.personalBests);
    if (outcome === "bricked" || outcome === "abandoned") {
      const currentPb = pbs.get(updatedRun.mapName);
      if (currentPb != null && updatedRun.totalMs != null && updatedRun.totalMs <= currentPb) {
        const remainingCompleted = maps.filter(
          (m) => m.mapName === updatedRun.mapName && m.outcome === "completed" && m.totalMs != null
        );
        if (remainingCompleted.length > 0) {
          pbs.set(updatedRun.mapName, Math.min(...remainingCompleted.map((m) => m.totalMs!)));
        } else {
          pbs.delete(updatedRun.mapName);
        }
      }
    } else if (outcome === "completed" && updatedRun.totalMs != null) {
      const currentPb = pbs.get(updatedRun.mapName);
      if (currentPb == null || updatedRun.totalMs < currentPb) {
        pbs.set(updatedRun.mapName, updatedRun.totalMs);
      }
    }

    const lastRun = state.lastCompletedRun?.id === runId ? updatedRun : state.lastCompletedRun;

    set({
      session: { ...state.session, maps, ...stats },
      personalBests: pbs,
      lastCompletedRun: lastRun,
    });

    void saveMapRun(updatedRun);
  },

  deleteRun: (runId) => {
    const state = get();
    if (!state.session) return;

    const maps = state.session.maps.filter((m) => m.id !== runId);
    const stats = computeSessionStats(maps, state.session.startedAt);

    const pbs = new Map<string, number>();
    for (const m of maps) {
      if (m.outcome === "completed" && m.totalMs != null) {
        const current = pbs.get(m.mapName);
        if (current == null || m.totalMs < current) {
          pbs.set(m.mapName, m.totalMs);
        }
      }
    }

    const lastRun = state.lastCompletedRun?.id === runId ? null : state.lastCompletedRun;

    set({
      session: { ...state.session, maps, ...stats },
      personalBests: pbs,
      lastCompletedRun: lastRun,
    });

    void deleteMapRun(runId);
  },

  setTracking: (tracking) => set({ tracking }),

  loadPBsFromDB: async (game?) => {
    const pbs = await loadPersonalBests(game);
    set({ personalBests: pbs, dbLoaded: true });
  },

  setGoals: async (partial) => {
    const merged = { ...get().goals, ...partial };
    set({ goals: merged });
    await saveGoalsDb(merged);
  },

  loadGoals: async () => {
    const goals = await loadGoals();
    set({ goals });
  },

  exportSession: (format) => {
    const session = get().session;
    if (!session || session.maps.length === 0) return "";

    if (format === "json") {
      return JSON.stringify(session.maps, null, 2);
    }

    const header = "map_name,map_tier,character,outcome,started_at,completed_at,total_ms,deaths";
    const rows = session.maps.map((m) =>
      [
        `"${m.mapName}"`,
        m.mapTier ?? "",
        `"${m.characterName ?? ""}"`,
        m.outcome,
        new Date(m.startedAt).toISOString(),
        m.completedAt ? new Date(m.completedAt).toISOString() : "",
        m.totalMs ?? "",
        m.deaths,
      ].join(",")
    );
    return [header, ...rows].join("\n");
  },
}));
