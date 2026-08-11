import { useState, useEffect } from "react";
import { useOverlayStore } from "../stores/overlay-store";
import { syncInitialGameState } from "../hooks/useClientLog";
import { formatDuration } from "@exiled-orb/shared";
import poe1Logo from "../assets/poe1-logo.png";
import poe2Logo from "../assets/poe2-logo.png";
import { useSettingsStore } from "../stores/settings-store";
import { Btn, COLORS, Panel } from "./ui";
import { seasonLabel, useMinuteNow } from "./SeasonTimers";

const gameLogos = { poe1: poe1Logo, poe2: poe2Logo } as const;

/**
 * Try to load a class wallpaper image. Images should be in assets/classes/
 * named by lowercase class or ascendancy (e.g. elementalist.png, witch.png).
 */
const classImageCache: Record<string, string | null> = {};

function useClassImage(className: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!className) {
      setSrc(null);
      return;
    }

    const key = className.toLowerCase().replace(/\s+/g, "-");

    if (key in classImageCache) {
      setSrc(classImageCache[key]);
      return;
    }

    // Try to dynamically import the image
    import(`../assets/classes/${key}.png`)
      .then((mod) => {
        classImageCache[key] = mod.default;
        setSrc(mod.default);
      })
      .catch(() => {
        // Try base class name (e.g. "witch" for "Elementalist")
        const baseMap: Record<string, string> = {
          elementalist: "elementalist",
          necromancer: "witch",
          occultist: "witch",
          deadeye: "ranger",
          raider: "ranger",
          pathfinder: "ranger",
          juggernaut: "marauder",
          berserker: "marauder",
          chieftain: "marauder",
          assassin: "shadow",
          trickster: "shadow",
          saboteur: "shadow",
          inquisitor: "templar",
          hierophant: "templar",
          guardian: "templar",
          champion: "duelist",
          gladiator: "duelist",
          slayer: "duelist",
          ascendant: "scion",
          // PoE2
          stormweaver: "sorceress",
          chronomancer: "sorceress",
          titan: "warrior",
          warbringer: "warrior",
          witchhunter: "mercenary",
          gemling: "mercenary",
          deadeye2: "ranger",
          bloodmage: "witch",
          infernalist: "witch",
          acolyte: "monk",
          invoker: "monk",
        };
        const fallback = baseMap[key];
        if (fallback && fallback !== key) {
          import(`../assets/classes/${fallback}.png`)
            .then((mod) => {
              classImageCache[key] = mod.default;
              setSrc(mod.default);
            })
            .catch(() => {
              classImageCache[key] = null;
              setSrc(null);
            });
        } else {
          classImageCache[key] = null;
          setSrc(null);
        }
      });
  }, [className]);

  return src;
}

export default function ZoneTracker() {
  // Use individual selectors instead of destructuring the entire store —
  // otherwise the tile re-renders on every clipboard/price-check/map event,
  // since those write unrelated fields to the same store.
  const currentZone = useOverlayStore((s) => s.currentZone);
  const sessionDeaths = useOverlayStore((s) => s.sessionDeaths);
  const sessionStart = useOverlayStore((s) => s.sessionStart);
  const detectedGame = useOverlayStore((s) => s.detectedGame);
  const characterName = useOverlayStore((s) => s.characterName);
  const characterClass = useOverlayStore((s) => s.characterClass);
  const characterLevel = useOverlayStore((s) => s.characterLevel);
  const areaLevel = useOverlayStore((s) => s.areaLevel);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionStart) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - sessionStart);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const classImage = useClassImage(characterClass);

  // Season line for the active game (falls back to the configured game when
  // no Client.txt has been detected yet).
  const settingsGame = useSettingsStore((s) => s.settings.game);
  const now = useMinuteNow();
  const season = seasonLabel(detectedGame ?? settingsGame, now);

  const refresh = () => {
    syncInitialGameState();
  };

  return (
    <Panel gold className="px-3 py-3 relative overflow-hidden" style={{ minHeight: 56 }}>
      {/* Class art background */}
      {classImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${classImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.12,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Top row: character + class + game badge */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {characterName && (
              <span className="text-sm font-bold truncate" style={{ color: "var(--accent)" }}>
                {characterName}
              </span>
            )}
            {characterLevel != null && (
              <span
                className="text-xs shrink-0"
                style={{ color: "var(--text-primary)" }}
                title="Character level"
              >
                Lv.{characterLevel}
              </span>
            )}
            {characterClass && (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {characterClass}
              </span>
            )}
            {detectedGame && (
              <img
                src={gameLogos[detectedGame]}
                alt={detectedGame}
                className="h-4 shrink-0"
                style={{ opacity: 0.8 }}
              />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {sessionStart && (
              <span
                className="text-xs font-mono"
                style={{ color: "var(--text-secondary)" }}
                title="Session time"
              >
                {formatDuration(elapsed)}
              </span>
            )}
            <Btn className="px-1" onClick={refresh} title="Refresh game state">
              ↻
            </Btn>
          </div>
        </div>

        {/* Bottom row: zone + area level + deaths */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
              {currentZone || "Waiting for zone..."}
            </span>
            {areaLevel != null && (
              <span
                className="text-xs shrink-0"
                style={{ color: "var(--text-secondary)" }}
                title="Area (monster) level"
              >
                Area {areaLevel}
              </span>
            )}
          </div>

          <span
            className="text-xs shrink-0"
            style={{ color: sessionDeaths > 0 ? "var(--danger-deadly)" : "var(--text-secondary)" }}
            title="Deaths this session"
          >
            {sessionDeaths > 0
              ? `${sessionDeaths} death${sessionDeaths !== 1 ? "s" : ""}`
              : "Deathless"}
          </span>
        </div>

        {/* Season line for the active game */}
        <div
          className="pt-0.5 truncate"
          style={{
            color: season.urgent ? COLORS.orange : "var(--text-secondary)",
            fontSize: "0.6rem",
          }}
          title="Season status (see Season tile on home for both games)"
        >
          {season.name} · {season.detail}
        </div>
      </div>
    </Panel>
  );
}
