import { create } from "zustand";
import type { ParsedItem, PriceResult, MapAnalysis } from "@exiled-orb/shared";

type ActivePanel = "price" | "map" | null;

interface OverlayState {
  activePanel: ActivePanel;

  // Price check state
  currentItem: ParsedItem | null;
  priceResult: PriceResult | null;
  priceLoading: boolean;

  // Map analysis state
  mapAnalysis: MapAnalysis | null;

  // Zone tracker state
  currentZone: string | null;
  sessionDeaths: number;
  sessionStart: number | null;

  // Game/character state
  detectedGame: "poe1" | "poe2" | null;
  characterName: string | null;
  characterClass: string | null;
  characterLevel: number | null;
  areaLevel: number | null;

  // Client.txt watcher status — "pending" until the initial state loads,
  // then "watching" (logWatchPath set) or "missing" (no Client.txt found,
  // log-driven features are inert). logError carries watcher failures
  // (e.g. the file disappeared) emitted by Rust as "log-error".
  logStatus: "pending" | "watching" | "missing";
  logWatchPath: string | null;
  logError: string | null;

  // Actions
  dismissPanel: () => void;
  setPriceCheck: (item: ParsedItem, result: PriceResult | null, loading: boolean) => void;
  setMapAnalysis: (analysis: MapAnalysis) => void;
  setZone: (zone: string) => void;
  addDeath: (characterName?: string) => void;
  setCharacterName: (name: string) => void;
  setCharacterClass: (cls: string) => void;
  setCharacterLevel: (level: number) => void;
  setDetectedGame: (game: "poe1" | "poe2") => void;
  setAreaLevel: (level: number) => void;
  setLogWatching: (path: string) => void;
  setLogMissing: () => void;
  setLogError: (error: string) => void;
  resetSession: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  activePanel: null,

  currentItem: null,
  priceResult: null,
  priceLoading: false,

  mapAnalysis: null,

  currentZone: null,
  sessionDeaths: 0,
  sessionStart: null,

  detectedGame: null,
  characterName: null,
  characterClass: null,
  characterLevel: null,
  areaLevel: null,

  logStatus: "pending",
  logWatchPath: null,
  logError: null,

  dismissPanel: () => set({ activePanel: null, priceLoading: false }),

  setPriceCheck: (item, result, loading) =>
    set({
      activePanel: "price",
      currentItem: item,
      priceResult: result,
      priceLoading: loading,
    }),

  setMapAnalysis: (analysis) =>
    set({
      activePanel: "map",
      mapAnalysis: analysis,
    }),

  setZone: (zone) =>
    set((s) => ({
      currentZone: zone,
      sessionStart: s.sessionStart ?? Date.now(),
    })),

  addDeath: (characterName?: string) =>
    set((s) => ({
      sessionDeaths: s.sessionDeaths + 1,
      characterName: characterName || s.characterName,
    })),

  setCharacterName: (name) => set({ characterName: name }),

  setCharacterClass: (cls) => set({ characterClass: cls }),

  setCharacterLevel: (level) => set({ characterLevel: level }),

  setDetectedGame: (game) => set({ detectedGame: game }),

  setAreaLevel: (level) => set({ areaLevel: level }),

  setLogWatching: (path) => set({ logStatus: "watching", logWatchPath: path, logError: null }),

  setLogMissing: () => set({ logStatus: "missing", logWatchPath: null }),

  setLogError: (error) => set({ logError: error }),

  resetSession: () =>
    set({
      sessionDeaths: 0,
      sessionStart: Date.now(),
      currentZone: null,
    }),
}));
