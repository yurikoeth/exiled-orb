import { describe, it, expect, beforeEach, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import { syncInitialGameState } from "../useClientLog";
import { useOverlayStore } from "../../stores/overlay-store";

const initial = useOverlayStore.getState();

describe("syncInitialGameState", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useOverlayStore.setState(initial, true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("copies the Rust state into the overlay store and marks the log as watched", async () => {
    invokeMock.mockResolvedValue({
      character_name: "Zana",
      character_level: 90,
      character_class: "Witch",
      zone: "Clearfell",
      area_level: 3,
      game: "poe2",
      log_path: "D:\\PoE2\\logs\\Client.txt",
    });
    const state = await syncInitialGameState();
    expect(state?.log_path).toContain("Client.txt");
    expect(useOverlayStore.getState()).toMatchObject({
      characterName: "Zana",
      characterLevel: 90,
      characterClass: "Witch",
      currentZone: "Clearfell",
      areaLevel: 3,
      detectedGame: "poe2",
      logStatus: "watching",
      logWatchPath: "D:\\PoE2\\logs\\Client.txt",
    });
    expect(invokeMock).toHaveBeenCalledWith("get_initial_game_state");
  });

  it("flags a missing Client.txt and leaves unknown fields untouched", async () => {
    invokeMock.mockResolvedValue({
      character_name: null,
      character_level: null,
      character_class: null,
      zone: null,
      area_level: null,
      game: null,
      log_path: null,
    });
    await syncInitialGameState();
    expect(useOverlayStore.getState()).toMatchObject({
      characterName: null,
      currentZone: null,
      detectedGame: null,
      logStatus: "missing",
    });
  });

  it("returns null and keeps the store untouched when the IPC fails", async () => {
    invokeMock.mockRejectedValue(new Error("no window"));
    expect(await syncInitialGameState()).toBeNull();
    expect(useOverlayStore.getState().logStatus).toBe("pending");
  });
});
