import { describe, it, expect, beforeEach, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({
  execute: vi.fn(async () => ({})),
  select: vi.fn(async (): Promise<unknown[]> => []),
}));
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => fakeDb) },
}));

import { useSettingsStore } from "../settings-store";
import { DEFAULT_SETTINGS } from "@exiled-orb/shared";

function lastWrittenSettings() {
  const calls = fakeDb.execute.mock.calls as unknown as [string, string[]][];
  return JSON.parse(calls[calls.length - 1][1][0]);
}

describe("settings-store", () => {
  beforeEach(() => {
    fakeDb.execute.mockReset().mockResolvedValue({});
    fakeDb.select.mockReset().mockResolvedValue([]);
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, loaded: false, firstRun: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("first launch: no row → defaults, firstRun, and the defaults are persisted", async () => {
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState()).toMatchObject({ loaded: true, firstRun: true });
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(fakeDb.execute).toHaveBeenCalledTimes(1);
    expect(lastWrittenSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges a stored row over the defaults, including nested objects", async () => {
    fakeDb.select.mockResolvedValueOnce([
      {
        key: "app_settings",
        value: JSON.stringify({
          game: "poe1",
          leagues: { poe1: "Standard" },
          ai: { enabled: true },
        }),
      },
    ]);
    await useSettingsStore.getState().loadSettings();
    const s = useSettingsStore.getState();
    expect(s.firstRun).toBe(false);
    expect(s.settings.game).toBe("poe1");
    // Missing nested keys come from the defaults instead of disappearing.
    expect(s.settings.leagues).toEqual({ poe1: "Standard", poe2: null });
    expect(s.settings.ai).toEqual({ enabled: true, enableTradeAssistant: false });
    expect(s.settings.overlay).toEqual(DEFAULT_SETTINGS.overlay);
    expect(fakeDb.execute).not.toHaveBeenCalled();
  });

  it("falls back to defaults when the DB read throws", async () => {
    fakeDb.select.mockRejectedValueOnce(new Error("no table"));
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().firstRun).toBe(true);
  });

  it("updateSettings applies the change immediately and writes the merged JSON", async () => {
    await useSettingsStore.getState().updateSettings({ clientLogPath: "D:\\Client.txt" });
    expect(useSettingsStore.getState().settings.clientLogPath).toBe("D:\\Client.txt");
    const [sql] = fakeDb.execute.mock.calls[0] as unknown as [string];
    expect(sql).toContain("'app_settings'");
    expect(lastWrittenSettings().clientLogPath).toBe("D:\\Client.txt");
  });

  it("setGame, setLeagueOverride and setAi are partial updates", async () => {
    await useSettingsStore.getState().setGame("poe1");
    await useSettingsStore.getState().setLeagueOverride("poe2", "Standard");
    await useSettingsStore.getState().setAi({ enabled: true });
    const s = useSettingsStore.getState().settings;
    expect(s.game).toBe("poe1");
    expect(s.leagues).toEqual({ poe1: null, poe2: "Standard" });
    expect(s.ai).toEqual({ enabled: true, enableTradeAssistant: false });
    await useSettingsStore.getState().setLeagueOverride("poe2", null);
    expect(useSettingsStore.getState().settings.leagues.poe2).toBeNull();
    expect(fakeDb.execute).toHaveBeenCalledTimes(4);
  });

  it("keeps in-memory state when the write fails", async () => {
    fakeDb.execute.mockRejectedValueOnce(new Error("disk"));
    await useSettingsStore.getState().setGame("poe1");
    expect(useSettingsStore.getState().settings.game).toBe("poe1");
  });
});
