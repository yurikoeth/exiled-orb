import { create } from "zustand";
import type { AppSettings, Game } from "@exiled-orb/shared";
import { DEFAULT_SETTINGS } from "@exiled-orb/shared";
import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:exiled-orb.db";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  /** True when no settings row existed at load time (first launch). */
  firstRun: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setGame: (game: Game) => Promise<void>;
  /** Set a per-game league override; null returns the game to auto (season league). */
  setLeagueOverride: (game: Game, league: string | null) => Promise<void>;
  setAi: (partial: Partial<AppSettings["ai"]>) => Promise<void>;
}

async function getDb() {
  return await Database.load(DB_URL);
}

async function readSettings(): Promise<{ settings: AppSettings; existed: boolean }> {
  try {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings WHERE key = 'app_settings'"
    );
    if (rows.length > 0) {
      const stored = JSON.parse(rows[0].value);
      return {
        settings: {
          ...DEFAULT_SETTINGS,
          ...stored,
          // Nested objects need their own defaults-merge so new fields appear.
          leagues: { ...DEFAULT_SETTINGS.leagues, ...stored.leagues },
          ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
        },
        existed: true,
      };
    }
  } catch (err) {
    console.error("[ExiledOrb] Failed to read settings:", err);
  }
  return { settings: { ...DEFAULT_SETTINGS }, existed: false };
}

async function writeSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await getDb();
    const json = JSON.stringify(settings);
    await db.execute(
      "INSERT INTO settings (key, value, updated_at) VALUES ('app_settings', $1, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = unixepoch()",
      [json]
    );
  } catch (err) {
    console.error("[ExiledOrb] Failed to write settings:", err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  firstRun: false,

  loadSettings: async () => {
    const { settings, existed } = await readSettings();
    set({ settings, loaded: true, firstRun: !existed });
    // Persist defaults on first launch so onboarding only happens once.
    if (!existed) await writeSettings(settings);
  },

  updateSettings: async (partial) => {
    const merged = { ...get().settings, ...partial };
    set({ settings: merged });
    await writeSettings(merged);
  },

  setGame: async (game) => {
    await get().updateSettings({ game });
  },

  setLeagueOverride: async (game, league) => {
    const leagues = { ...get().settings.leagues, [game]: league };
    await get().updateSettings({ leagues });
  },

  setAi: async (partial) => {
    const ai = { ...get().settings.ai, ...partial };
    await get().updateSettings({ ai });
  },
}));
