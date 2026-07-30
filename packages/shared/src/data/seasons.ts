import type { Game } from "../types/item.js";

/**
 * Season (challenge league) dates — MANUAL CONFIG, update once per league.
 *
 * GGG's APIs cannot provide this (verified 2026-07-21): the legacy
 * `pathofexile.com/api/leagues` endpoint ignores `realm=poe2`, omits challenge
 * leagues, and returns `endAt: null`; the documented OAuth `/league` endpoint
 * needs the `service:leagues` scope with a confidential client, which our
 * public PKCE app can't use. So the dates live here, sourced from GGG
 * announcements.
 */
export interface SeasonInfo {
  game: Game;
  /** Challenge league name, e.g. "Mirage". */
  name: string;
  /**
   * League id used by APIs (poe.ninja, trade) when it differs from the
   * display name — e.g. PoE2 0.5 displays as "Return of the Ancients" but
   * the economy league is "Runes of Aldur".
   */
  leagueId?: string;
  /** League launch, ISO UTC. */
  startAt: string;
  /** League end, ISO UTC — null while GGG hasn't announced it. */
  endAt: string | null;
  /** The already-announced next league, if any. */
  next?: {
    name: string | null;
    startAt: string | null;
  };
}

export const SEASONS: Record<Game, SeasonInfo> = {
  poe1: {
    game: "poe1",
    // 3.29 "Curse of the Allflame" (league id: Allflame) launched July 24, 2026 1:00 PM PDT.
    name: "Allflame",
    startAt: "2026-07-24T20:00:00Z",
    // End not announced yet.
    endAt: null,
    next: { name: null, startAt: null },
  },
  poe2: {
    game: "poe2",
    name: "Return of the Ancients",
    // poe.ninja economy league id for 0.5 (verified 2026-07-30 via
    // /poe2/api/data/index-state).
    leagueId: "Runes of Aldur",
    // 0.5.0 launched May 29, 2026 1:00 PM PDT.
    startAt: "2026-05-29T20:00:00Z",
    // End not announced (community estimates range Sept–Dec 2026).
    endAt: null,
    next: { name: null, startAt: null },
  },
};

export function getSeason(game: Game): SeasonInfo {
  return SEASONS[game];
}

/** The league id to use for API calls (price lookups, market data). */
export function getCurrentLeague(game: Game): string {
  const season = SEASONS[game];
  return season.leagueId ?? season.name;
}

/** What the countdown should display for a season at time `now`. */
export type SeasonState =
  | { kind: "running"; msLeft: number }
  | { kind: "running-open"; dayNumber: number }
  | { kind: "ended"; msToNext: number | null; nextName: string | null }
  | { kind: "stale" };

const DAY_MS = 86_400_000;

/**
 * Classify a season relative to `now` (epoch ms):
 * - running:      endAt announced and in the future → countdown
 * - running-open: no endAt announced → show "day N" since launch
 * - ended:        endAt passed → countdown to the next league launch (if known)
 * - stale:        the next league has already launched → this config is outdated
 */
export function getSeasonState(season: SeasonInfo, now: number): SeasonState {
  const nextStart = season.next?.startAt ? Date.parse(season.next.startAt) : null;
  if (nextStart != null && now >= nextStart) return { kind: "stale" };

  const end = season.endAt ? Date.parse(season.endAt) : null;
  if (end == null) {
    const start = Date.parse(season.startAt);
    return { kind: "running-open", dayNumber: Math.max(1, Math.floor((now - start) / DAY_MS) + 1) };
  }
  if (now < end) return { kind: "running", msLeft: end - now };
  return {
    kind: "ended",
    msToNext: nextStart != null ? nextStart - now : null,
    nextName: season.next?.name ?? null,
  };
}
