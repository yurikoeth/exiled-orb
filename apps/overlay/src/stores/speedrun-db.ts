import Database from "@tauri-apps/plugin-sql";
import type { MapRun, MapRunOutcome, SpeedrunGoals } from "@exiled-orb/shared";

const DB_URL = "sqlite:exiled-orb.db";

async function getDb() {
  return await Database.load(DB_URL);
}

/** Save a completed, bricked, or abandoned map run to SQLite */
export async function saveMapRun(run: MapRun): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      `INSERT OR REPLACE INTO map_runs (id, session_id, map_name, map_tier, game, league, started_at, completed_at, total_ms, deaths, completed, outcome, character_name, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        run.id,
        run.sessionId,
        run.mapName,
        run.mapTier,
        run.game,
        run.league,
        run.startedAt,
        run.completedAt,
        run.totalMs,
        run.deaths,
        run.completed ? 1 : 0,
        run.outcome,
        run.characterName,
        run.data,
      ]
    );
  } catch (err) {
    console.error("[ExiledOrb] Failed to save map run:", err);
  }
}

/** Delete a map run from SQLite */
export async function deleteMapRun(runId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.execute("DELETE FROM map_runs WHERE id = $1", [runId]);
  } catch (err) {
    console.error("[ExiledOrb] Failed to delete map run:", err);
  }
}

/** Load personal best times per map from all-time history */
export async function loadPersonalBests(game?: string): Promise<Map<string, number>> {
  const pbs = new Map<string, number>();
  try {
    const db = await getDb();
    const where = game
      ? "WHERE completed = 1 AND total_ms IS NOT NULL AND game = $1"
      : "WHERE completed = 1 AND total_ms IS NOT NULL";
    const params = game ? [game] : [];
    const rows = await db.select<{ map_name: string; best_ms: number }[]>(
      `SELECT map_name, MIN(total_ms) as best_ms FROM map_runs ${where} GROUP BY map_name`,
      params
    );
    for (const row of rows) {
      pbs.set(row.map_name, row.best_ms);
    }
  } catch (err) {
    console.error("[ExiledOrb] Failed to load personal bests:", err);
  }
  return pbs;
}

export interface RunHistoryOpts {
  game?: string;
  league?: string;
  mapName?: string;
  limit?: number;
  offset?: number;
}

/** Load run history from DB with optional filters */
export async function loadRunHistory(opts: RunHistoryOpts = {}): Promise<MapRun[]> {
  try {
    const db = await getDb();
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (opts.game) {
      conditions.push(`game = $${paramIdx++}`);
      params.push(opts.game);
    }
    if (opts.league) {
      conditions.push(`league = $${paramIdx++}`);
      params.push(opts.league);
    }
    if (opts.mapName) {
      conditions.push(`map_name = $${paramIdx++}`);
      params.push(opts.mapName);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;

    const rows = await db.select<DbMapRun[]>(
      `SELECT * FROM map_runs ${where} ORDER BY started_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );
    return rows.map(dbRowToMapRun);
  } catch (err) {
    console.error("[ExiledOrb] Failed to load run history:", err);
    return [];
  }
}

/** Get top N fastest times for a specific map */
export async function getMapLeaderboard(
  mapName: string,
  game: string,
  limit = 10
): Promise<MapRun[]> {
  try {
    const db = await getDb();
    const rows = await db.select<DbMapRun[]>(
      `SELECT * FROM map_runs WHERE map_name = $1 AND game = $2 AND completed = 1 AND total_ms IS NOT NULL ORDER BY total_ms ASC LIMIT $3`,
      [mapName, game, limit]
    );
    return rows.map(dbRowToMapRun);
  } catch (err) {
    console.error("[ExiledOrb] Failed to load map leaderboard:", err);
    return [];
  }
}

/** Load speedrun goals from settings table */
export async function loadGoals(): Promise<SpeedrunGoals> {
  const defaults: SpeedrunGoals = { targetMapsPerHour: null, targetClearTimeMs: null };
  try {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = 'speedrun_goals'"
    );
    if (rows.length > 0) {
      return { ...defaults, ...JSON.parse(rows[0].value) };
    }
  } catch (err) {
    console.error("[ExiledOrb] Failed to load speedrun goals:", err);
  }
  return defaults;
}

/** Save speedrun goals to settings table */
export async function saveGoals(goals: SpeedrunGoals): Promise<void> {
  try {
    const db = await getDb();
    const json = JSON.stringify(goals);
    await db.execute(
      "INSERT INTO settings (key, value, updated_at) VALUES ('speedrun_goals', $1, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = unixepoch()",
      [json]
    );
  } catch (err) {
    console.error("[ExiledOrb] Failed to save speedrun goals:", err);
  }
}

/** Outcome counts for a given grouping */
export interface OutcomeCounts {
  completed: number;
  bricked: number;
  abandoned: number;
  total: number;
  deaths: number;
}

export interface GroupedOutcomeCounts {
  total: OutcomeCounts;
  today: OutcomeCounts;
  byCharacter: Record<string, OutcomeCounts>;
  byLeague: Record<string, OutcomeCounts>;
}

/** Get outcome counts grouped by total, today, character, and league */
export async function getOutcomeCounts(game?: string): Promise<GroupedOutcomeCounts> {
  const empty = (): OutcomeCounts => ({
    completed: 0,
    bricked: 0,
    abandoned: 0,
    total: 0,
    deaths: 0,
  });
  const result: GroupedOutcomeCounts = {
    total: empty(),
    today: empty(),
    byCharacter: {},
    byLeague: {},
  };

  try {
    const db = await getDb();
    const gameFilter = game ? " AND game = $1" : "";
    const params = game ? [game] : [];

    // Total counts by outcome
    const totalRows = await db.select<{ outcome: string; cnt: number; death_sum: number }[]>(
      `SELECT outcome, COUNT(*) as cnt, SUM(deaths) as death_sum FROM map_runs WHERE 1=1${gameFilter} GROUP BY outcome`,
      params
    );
    for (const row of totalRows) {
      addToOutcome(result.total, row.outcome, row.cnt, row.death_sum);
    }

    // Today's counts (using local date via started_at epoch)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    const todayParams = game ? [game, todayMs] : [todayMs];
    const todayFilter = game ? " AND game = $1 AND started_at >= $2" : " AND started_at >= $1";
    const todayRows = await db.select<{ outcome: string; cnt: number; death_sum: number }[]>(
      `SELECT outcome, COUNT(*) as cnt, SUM(deaths) as death_sum FROM map_runs WHERE 1=1${todayFilter} GROUP BY outcome`,
      todayParams
    );
    for (const row of todayRows) {
      addToOutcome(result.today, row.outcome, row.cnt, row.death_sum);
    }

    // By character
    const charRows = await db.select<
      { character_name: string; outcome: string; cnt: number; death_sum: number }[]
    >(
      `SELECT COALESCE(character_name, 'Unknown') as character_name, outcome, COUNT(*) as cnt, SUM(deaths) as death_sum FROM map_runs WHERE 1=1${gameFilter} GROUP BY character_name, outcome`,
      params
    );
    for (const row of charRows) {
      if (!result.byCharacter[row.character_name]) result.byCharacter[row.character_name] = empty();
      addToOutcome(result.byCharacter[row.character_name], row.outcome, row.cnt, row.death_sum);
    }

    // By league
    const leagueRows = await db.select<
      { league: string; outcome: string; cnt: number; death_sum: number }[]
    >(
      `SELECT league, outcome, COUNT(*) as cnt, SUM(deaths) as death_sum FROM map_runs WHERE 1=1${gameFilter} GROUP BY league, outcome`,
      params
    );
    for (const row of leagueRows) {
      if (!result.byLeague[row.league]) result.byLeague[row.league] = empty();
      addToOutcome(result.byLeague[row.league], row.outcome, row.cnt, row.death_sum);
    }
  } catch (err) {
    console.error("[ExiledOrb] Failed to get outcome counts:", err);
  }

  return result;
}

function addToOutcome(counts: OutcomeCounts, outcome: string, cnt: number, deaths: number) {
  counts.total += cnt;
  counts.deaths += deaths ?? 0;
  if (outcome === "completed") counts.completed += cnt;
  else if (outcome === "bricked") counts.bricked += cnt;
  else counts.abandoned += cnt;
}

// --- Internal helpers ---

interface DbMapRun {
  id: string;
  session_id: string;
  map_name: string;
  map_tier: number | null;
  game: string;
  league: string;
  started_at: number;
  completed_at: number | null;
  total_ms: number | null;
  deaths: number;
  completed: number; // SQLite stores as 0/1
  outcome: string | null;
  character_name: string | null;
  data: string | null;
  created_at: number;
}

function dbRowToMapRun(row: DbMapRun): MapRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    mapName: row.map_name,
    mapTier: row.map_tier,
    game: row.game as MapRun["game"],
    league: row.league,
    characterName: row.character_name,
    startedAt: row.started_at,
    bossEnteredAt: null, // Not stored in DB — could be in data JSON
    completedAt: row.completed_at,
    totalMs: row.total_ms,
    deaths: row.deaths,
    completed: row.completed === 1,
    outcome: (row.outcome ?? (row.completed === 1 ? "completed" : "abandoned")) as MapRunOutcome,
    data: row.data,
  };
}
