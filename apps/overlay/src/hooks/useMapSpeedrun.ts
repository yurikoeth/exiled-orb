import { useEffect, useRef } from "react";
import { useOverlayStore } from "../stores/overlay-store";
import { useSettingsStore } from "../stores/settings-store";
import { useSpeedrunStore } from "../stores/speedrun-store";
import { isMapZone, isHideout, isBossArena, findMap, tierFromAreaLevel } from "@exiled-orb/shared";

/**
 * Hook that monitors zone changes and death events to automatically
 * track map runs (start → boss → complete cycle).
 *
 * When the player returns to hideout, the timer stops and a pending run
 * is shown with Clear/Brick buttons. Nothing is saved until the user decides.
 */
export function useMapSpeedrun() {
  const currentZone = useOverlayStore((s) => s.currentZone);
  const sessionDeaths = useOverlayStore((s) => s.sessionDeaths);
  const areaLevel = useOverlayStore((s) => s.areaLevel);
  const characterName = useOverlayStore((s) => s.characterName);
  const detectedGame = useOverlayStore((s) => s.detectedGame);
  const settingsGame = useSettingsStore((s) => s.settings.game);
  const lastDeathCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentZone) return;

    const store = useSpeedrunStore.getState();
    if (!store.tracking) return;

    const now = Date.now();
    // Every lookup below is game-scoped: several PoE2 waystone names contain
    // a PoE1 map name, so an unscoped search can resolve to the wrong game's
    // map (and tier).
    const game = detectedGame ?? settingsGame;

    if (store.currentRun && isBossArena(currentZone, game)) {
      // Entered a boss arena during the run. Checked before isMapZone: a
      // boss arena isn't necessarily a map zone itself (PoE1 pinnacle
      // arenas), and nesting this under isMapZone missed those entirely.
      // Only the first entry counts — this effect re-runs on any dependency
      // change while the zone is unchanged, which would otherwise keep
      // pushing bossEnteredAt forward and shrink the recorded boss phase.
      if (!store.currentRun.bossEnteredAt) store.enterBossArena(now);
    } else if (isMapZone(currentZone, game)) {
      if (!store.currentRun) {
        // New map run. Maps missing from the curated database fall back to a
        // tier estimated from the area level — the two are NOT the same
        // number (a T16 PoE1 map is area level 83), so the raw area level
        // must never be displayed as a tier.
        const mapInfo = findMap(currentZone, game);
        const tier =
          mapInfo?.tier ?? (areaLevel != null ? tierFromAreaLevel(areaLevel, game) : null);
        store.startMapRun(mapInfo?.name ?? currentZone, tier, now, characterName);
      }
    } else if (isHideout(currentZone)) {
      // Returned to hideout — stop timer, await user decision (Clear/Brick)
      if (store.currentRun) {
        store.finishMapRun(now);
      }
    }
    // Town/campaign zones don't end the run — player may portal back
  }, [currentZone, areaLevel, detectedGame, settingsGame, characterName]);

  // Track deaths during map runs — use ref to avoid re-counting on re-renders
  useEffect(() => {
    if (lastDeathCountRef.current === null) {
      // Initial mount — set baseline without adding deaths
      lastDeathCountRef.current = sessionDeaths;
      return;
    }

    const delta = sessionDeaths - lastDeathCountRef.current;
    lastDeathCountRef.current = sessionDeaths;

    if (delta > 0) {
      const store = useSpeedrunStore.getState();
      if (store.currentRun) {
        for (let i = 0; i < delta; i++) {
          store.addMapDeath();
        }
      }
    }
  }, [sessionDeaths]);
}
