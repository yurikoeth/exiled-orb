import { describe, it, expect } from "vitest";
import { CLIENT_LOG_PATHS, GGG_API, OVERLAY_DEFAULTS } from "../constants.js";
import { DEFAULT_SETTINGS } from "../../types/settings.js";

describe("constants", () => {
  it("lists a Client.txt path per launcher for each game", () => {
    for (const game of ["poe1", "poe2"] as const) {
      expect(CLIENT_LOG_PATHS[game].length).toBeGreaterThanOrEqual(3);
      for (const p of CLIENT_LOG_PATHS[game]) {
        expect(p.endsWith("\\logs\\Client.txt")).toBe(true);
        expect(p.includes("Path of Exile 2")).toBe(game === "poe2");
      }
    }
  });

  it("points at the official OAuth and trade endpoints", () => {
    expect(GGG_API.oauth.authorize).toBe("https://www.pathofexile.com/oauth/authorize");
    expect(GGG_API.trade.poe2).toContain("/api/trade2");
  });

  it("keeps the overlay defaults and settings defaults in agreement", () => {
    expect(DEFAULT_SETTINGS.overlay.hotkey).toBe(OVERLAY_DEFAULTS.toggleHotkey);
    expect(DEFAULT_SETTINGS.overlay.fadeMs).toBe(OVERLAY_DEFAULTS.priceCheckFadeMs);
    expect(DEFAULT_SETTINGS.leagues).toEqual({ poe1: null, poe2: null });
    expect(DEFAULT_SETTINGS.ai.enabled).toBe(false);
  });
});
