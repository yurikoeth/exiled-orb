import { describe, it, expect } from "vitest";
import { SEASONS, getSeason, getCurrentLeague, getSeasonState } from "../seasons.js";

describe("SEASONS config", () => {
  it("has a valid entry per game", () => {
    for (const game of ["poe1", "poe2"] as const) {
      const season = getSeason(game);
      expect(season.game).toBe(game);
      expect(season.name.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(season.startAt))).toBe(false);
      if (season.endAt)
        expect(Date.parse(season.endAt)).toBeGreaterThan(Date.parse(season.startAt));
      if (season.next?.startAt) {
        expect(Number.isNaN(Date.parse(season.next.startAt))).toBe(false);
      }
    }
  });

  it("is not stale for today's date", () => {
    // If this fails, a new league has launched: update seasons.ts.
    for (const game of ["poe1", "poe2"] as const) {
      expect(getSeasonState(SEASONS[game], Date.now()).kind).not.toBe("stale");
    }
  });

  it("resolves the API league id per game", () => {
    expect(getCurrentLeague("poe1")).toBe(SEASONS.poe1.leagueId ?? SEASONS.poe1.name);
    expect(getCurrentLeague("poe2")).toBe(SEASONS.poe2.leagueId ?? SEASONS.poe2.name);
  });
});
