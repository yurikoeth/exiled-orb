import { useEffect, useState } from "react";
import type { Game } from "@exiled-orb/shared";
import { getSeason, getSeasonState, formatDaysHours } from "@exiled-orb/shared";
import type { SeasonState } from "@exiled-orb/shared";
import poe1Logo from "../assets/poe1-logo.png";
import poe2Logo from "../assets/poe2-logo.png";
import { COLORS, Panel, SectionTitle } from "./ui";

/**
 * One-line description of a game's season status. Shared by the home tile
 * and the compact ZoneTracker line.
 */
export function seasonLabel(game: Game, now: number): { name: string; detail: string; urgent: boolean } {
  const season = getSeason(game);
  const state: SeasonState = getSeasonState(season, now);
  switch (state.kind) {
    case "running":
      return {
        name: season.name,
        detail: `${formatDaysHours(state.msLeft)} left`,
        // Under a week left — worth noticing.
        urgent: state.msLeft < 7 * 86_400_000,
      };
    case "running-open":
      return { name: season.name, detail: `day ${state.dayNumber} · end TBA`, urgent: false };
    case "ended":
      return {
        name: season.name,
        detail: state.msToNext != null
          ? `ended · ${state.nextName ?? "next league"} in ${formatDaysHours(state.msToNext)}`
          : "ended · next league TBA",
        urgent: true,
      };
    case "stale":
      return { name: season.name, detail: "season data outdated — update seasons.ts", urgent: true };
  }
}

/** Re-render every minute — days+hours precision needs nothing faster. */
export function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

const GAME_LOGOS: Record<Game, string> = { poe1: poe1Logo, poe2: poe2Logo };

/** Home tile: season countdown for both games. */
export default function SeasonTimers() {
  const now = useMinuteNow();

  return (
    <Panel className="px-3 py-2 space-y-1">
      <SectionTitle>Season</SectionTitle>
      {(["poe1", "poe2"] as const).map((game) => {
        const { name, detail, urgent } = seasonLabel(game, now);
        return (
          <div key={game} className="flex items-center gap-2">
            <img src={GAME_LOGOS[game]} alt={game} className="h-3 shrink-0" style={{ opacity: 0.7 }} />
            <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-primary)" }}>
              {name}
            </span>
            <span className="text-xs truncate" style={{ color: urgent ? COLORS.orange : "var(--text-secondary)" }}>
              {detail}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
