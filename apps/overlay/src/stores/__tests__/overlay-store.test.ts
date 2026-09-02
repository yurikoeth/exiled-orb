import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useOverlayStore } from "../overlay-store";
import type { ParsedItem, PriceResult, MapAnalysis } from "@exiled-orb/shared";

const ITEM = { name: "Doom Shell", baseType: "Astral Plate" } as ParsedItem;
const RESULT = { source: "poe.ninja", chaosValue: 10 } as PriceResult;
const ANALYSIS = { mapName: "Strand", overallDanger: "safe", mods: [] } as unknown as MapAnalysis;

const initial = useOverlayStore.getState();

describe("overlay-store", () => {
  beforeEach(() => {
    useOverlayStore.setState(initial, true);
  });
  afterEach(() => vi.useRealTimers());

  it("opens the price panel with a loading result and dismisses it", () => {
    useOverlayStore.getState().setPriceCheck(ITEM, null, true);
    expect(useOverlayStore.getState()).toMatchObject({
      activePanel: "price",
      currentItem: ITEM,
      priceResult: null,
      priceLoading: true,
    });
    useOverlayStore.getState().setPriceCheck(ITEM, RESULT, false);
    expect(useOverlayStore.getState().priceResult).toBe(RESULT);
    useOverlayStore.getState().dismissPanel();
    expect(useOverlayStore.getState().activePanel).toBeNull();
    expect(useOverlayStore.getState().priceLoading).toBe(false);
  });

  it("switches to the map panel for a map analysis", () => {
    useOverlayStore.getState().setPriceCheck(ITEM, RESULT, false);
    useOverlayStore.getState().setMapAnalysis(ANALYSIS);
    expect(useOverlayStore.getState().activePanel).toBe("map");
    expect(useOverlayStore.getState().mapAnalysis).toBe(ANALYSIS);
  });

  it("starts the session clock on the first zone only", () => {
    vi.useFakeTimers({ now: 1_000 });
    useOverlayStore.getState().setZone("The Coast");
    expect(useOverlayStore.getState().sessionStart).toBe(1_000);
    vi.setSystemTime(5_000);
    useOverlayStore.getState().setZone("The Mud Flats");
    expect(useOverlayStore.getState().sessionStart).toBe(1_000);
    expect(useOverlayStore.getState().currentZone).toBe("The Mud Flats");
  });

  it("counts deaths and adopts the slain name only when no name is known", () => {
    useOverlayStore.getState().addDeath("Exile");
    expect(useOverlayStore.getState().sessionDeaths).toBe(1);
    expect(useOverlayStore.getState().characterName).toBe("Exile");
    useOverlayStore.getState().addDeath();
    expect(useOverlayStore.getState().sessionDeaths).toBe(2);
    expect(useOverlayStore.getState().characterName).toBe("Exile");
    useOverlayStore.getState().addDeath("Other");
    expect(useOverlayStore.getState().characterName).toBe("Other");
  });

  it("tracks character, game and area state", () => {
    const s = useOverlayStore.getState();
    s.setCharacterName("Zana");
    s.setCharacterClass("Witch");
    s.setCharacterLevel(90);
    s.setDetectedGame("poe2");
    s.setAreaLevel(79);
    expect(useOverlayStore.getState()).toMatchObject({
      characterName: "Zana",
      characterClass: "Witch",
      characterLevel: 90,
      detectedGame: "poe2",
      areaLevel: 79,
    });
  });

  it("models the Client.txt watcher lifecycle", () => {
    expect(useOverlayStore.getState().logStatus).toBe("pending");
    useOverlayStore.getState().setLogMissing();
    expect(useOverlayStore.getState()).toMatchObject({ logStatus: "missing", logWatchPath: null });
    useOverlayStore.getState().setLogError("boom");
    expect(useOverlayStore.getState().logError).toBe("boom");
    useOverlayStore.getState().setLogWatching("C:\\logs\\Client.txt");
    // A started watcher clears the error.
    expect(useOverlayStore.getState()).toMatchObject({
      logStatus: "watching",
      logWatchPath: "C:\\logs\\Client.txt",
      logError: null,
    });
  });

  it("resets session counters but keeps the character", () => {
    vi.useFakeTimers({ now: 42 });
    const s = useOverlayStore.getState();
    s.setCharacterName("Zana");
    s.setZone("Strand Map");
    s.addDeath();
    s.resetSession();
    expect(useOverlayStore.getState()).toMatchObject({
      sessionDeaths: 0,
      sessionStart: 42,
      currentZone: null,
      characterName: "Zana",
    });
  });
});
