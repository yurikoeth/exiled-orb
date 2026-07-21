import { create } from "zustand";
import type { ParsedItem, PriceResult, MapAnalysis } from "@exiled-orb/shared";

type ActivePanel = "price" | "map" | null;

interface OverlayState {
  visible: boolean;
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

  // Actions
  toggleVisibility: () => void;
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
  resetSession: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  visible: true,
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

  toggleVisibility: () => set((s) => ({ visible: !s.visible })),

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

  resetSession: () =>
    set({
      sessionDeaths: 0,
      sessionStart: Date.now(),
      currentZone: null,
    }),
}));
