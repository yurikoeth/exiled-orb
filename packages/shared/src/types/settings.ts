import type { Game } from "./item.js";

export interface BuildProfile {
  /** e.g. ["physical", "elemental", "spell", "chaos", "dot"] */
  damageTypes: string[];
  /** e.g. ["armour", "evasion", "energy-shield", "block", "dodge"] */
  defenseTypes: string[];
  /** e.g. ["leech", "regen", "life-flask", "es-recharge"] */
  recoveryTypes: string[];
}

export interface OverlayPrefs {
  fadeMs: number;
  hotkey: string;
  position: { x: number; y: number };
  opacity: number;
  fontSize: "small" | "medium" | "large";
}

export interface AiConfig {
  enabled: boolean;
  enableTradeAssistant: boolean;
  enableMarketTrends: boolean;
}

export interface AppSettings {
  game: Game;
  league: string;
  clientLogPath: string | null;
  autoDetectLog: boolean;
  overlay: OverlayPrefs;
  build: BuildProfile;
  ai: AiConfig;
}

export const DEFAULT_SETTINGS: AppSettings = {
  game: "poe2",
  league: "Allflame",
  clientLogPath: null,
  autoDetectLog: true,
  overlay: {
    fadeMs: 10000,
    hotkey: "F5",
    position: { x: 20, y: 20 },
    opacity: 0.92,
    fontSize: "medium",
  },
  build: {
    damageTypes: [],
    defenseTypes: [],
    recoveryTypes: [],
  },
  ai: {
    enabled: false,
    enableTradeAssistant: false,
    enableMarketTrends: false,
  },
};
