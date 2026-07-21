import { describe, it, expect } from "vitest";
import { getSeasonState, type SeasonInfo } from "../seasons.js";
import { formatDaysHours } from "../../utils/format.js";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const base: SeasonInfo = {
  game: "poe1",
  name: "Testleague",
  startAt: "2026-01-01T00:00:00Z",
  endAt: "2026-04-01T00:00:00Z",
  next: { name: "Nextleague", startAt: "2026-04-05T00:00:00Z" },
};

const t = (iso: string) => Date.parse(iso);

describe("getSeasonState", () => {
  it("running: endAt in the future → countdown", () => {
    const state = getSeasonState(base, t("2026-03-30T00:00:00Z"));
    expect(state).toEqual({ kind: "running", msLeft: 2 * DAY });
  });

  it("ended: between endAt and next launch → countdown to next", () => {
    const state = getSeasonState(base, t("2026-04-02T00:00:00Z"));
    expect(state).toEqual({ kind: "ended", msToNext: 3 * DAY, nextName: "Nextleague" });
  });

  it("ended with no next league announced", () => {
    const season: SeasonInfo = { ...base, next: { name: null, startAt: null } };
    const state = getSeasonState(season, t("2026-04-02T00:00:00Z"));
    expect(state).toEqual({ kind: "ended", msToNext: null, nextName: null });
  });

  it("stale: next league already launched → config outdated", () => {
    const state = getSeasonState(base, t("2026-04-06T00:00:00Z"));
    expect(state).toEqual({ kind: "stale" });
  });

  it("running-open: no endAt announced → day number since launch", () => {
    const season: SeasonInfo = { ...base, endAt: null, next: { name: null, startAt: null } };
    // Launch day counts as day 1
    expect(getSeasonState(season, t("2026-01-01T12:00:00Z"))).toEqual({ kind: "running-open", dayNumber: 1 });
    expect(getSeasonState(season, t("2026-01-02T00:00:00Z"))).toEqual({ kind: "running-open", dayNumber: 2 });
    expect(getSeasonState(season, t("2026-02-22T12:00:00Z"))).toEqual({ kind: "running-open", dayNumber: 53 });
  });

  it("exact endAt boundary counts as ended", () => {
    const state = getSeasonState(base, t("2026-04-01T00:00:00Z"));
    expect(state.kind).toBe("ended");
  });
});

describe("formatDaysHours", () => {
  it("formats days + hours", () => {
    expect(formatDaysHours(23 * DAY + 14 * HOUR + 30 * 60_000)).toBe("23d 14h");
  });
  it("drops to hours under a day", () => {
    expect(formatDaysHours(14 * HOUR)).toBe("14h");
  });
  it("shows <1h for sub-hour and non-positive values", () => {
    expect(formatDaysHours(30 * 60_000)).toBe("<1h");
    expect(formatDaysHours(0)).toBe("<1h");
    expect(formatDaysHours(-5000)).toBe("<1h");
  });
});
