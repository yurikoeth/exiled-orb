import { describe, it, expect, beforeEach, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { detectedKey, POE1_CLASSES, POE2_CLASSES } from "../constants";

const DETECTED = [
  { name: "Zana", class: "Witch", level: 72, game: "poe2", last_seen: null, deaths: 3 },
  { name: "OldGuy", class: null, level: 0, game: "poe1", last_seen: null, deaths: 0 },
];

/**
 * The module keeps a private scan cache, so each test gets a fresh module
 * graph — including the overlay store instance the module reads from.
 */
async function fresh() {
  vi.resetModules();
  const history = await import("../character-history");
  const { useOverlayStore } = await import("../../../stores/overlay-store");
  return { ...history, useOverlayStore };
}

describe("loadCharacterHistory", () => {
  beforeEach(() => {
    invokeMock.mockReset().mockResolvedValue(DETECTED);
  });

  it("scans once and serves the cache until forced", async () => {
    const { loadCharacterHistory } = await fresh();
    expect(await loadCharacterHistory()).toEqual(DETECTED);
    await loadCharacterHistory();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("scan_character_history");
    await loadCharacterHistory(true);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("propagates IPC failures so the UI can show them", async () => {
    invokeMock.mockRejectedValueOnce(new Error("scan failed"));
    const { loadCharacterHistory } = await fresh();
    await expect(loadCharacterHistory()).rejects.toThrow("scan failed");
  });
});

describe("resolveCharacterLevel", () => {
  beforeEach(() => {
    invokeMock.mockReset().mockResolvedValue(DETECTED);
  });

  it("prefers a positive live level from the overlay store", async () => {
    const { resolveCharacterLevel, useOverlayStore } = await fresh();
    useOverlayStore.setState({ characterLevel: 88 });
    expect(resolveCharacterLevel("Zana", "poe2")).toBe(88);
    // A zero/unknown live level does not count.
    useOverlayStore.setState({ characterLevel: 0 });
    expect(resolveCharacterLevel("Zana", "poe2")).toBeNull();
  });

  it("falls back to the scanned history, matching name case-insensitively per game", async () => {
    const { loadCharacterHistory, resolveCharacterLevel } = await fresh();
    expect(resolveCharacterLevel("Zana", "poe2")).toBeNull(); // nothing scanned yet
    await loadCharacterHistory();
    expect(resolveCharacterLevel("zana", "poe2")).toBe(72);
    expect(resolveCharacterLevel("Zana", "poe1")).toBeNull();
    expect(resolveCharacterLevel("OldGuy", "poe1")).toBeNull(); // level 0 is unknown
    expect(resolveCharacterLevel(null, "poe2")).toBeNull();
    expect(resolveCharacterLevel("Zana", null)).toBeNull();
  });
});

describe("constants", () => {
  it("builds a stable lower-cased key per game", () => {
    expect(detectedKey("poe2", "ZaNa")).toBe("poe2::zana");
  });

  it("lists the seven PoE1 and eight PoE2 base classes", () => {
    expect(POE1_CLASSES).toHaveLength(7);
    expect(POE2_CLASSES).toHaveLength(8);
    expect(POE2_CLASSES).toContain("Huntress");
  });
});
