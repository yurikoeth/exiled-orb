import { useEffect, useState } from "react";
import { useOverlayStore } from "../stores/overlay-store";
import { useSettingsStore } from "../stores/settings-store";
import { getLevelingGuide, findCurrentStep, getNextStep, isMapZone } from "@exiled-orb/shared";
import type { LevelingStep } from "@exiled-orb/shared";

interface LevelingState {
  currentStep: LevelingStep | null;
  nextStep: LevelingStep | null;
  isLeveling: boolean;
}

/**
 * Track leveling progression based on zone changes.
 * Detects when the player is in campaign zones (not mapping)
 * and shows the appropriate leveling guide step.
 */
export function useLevelingTracker(): LevelingState {
  const currentZone = useOverlayStore((s) => s.currentZone);
  const characterLevel = useOverlayStore((s) => s.characterLevel);
  // Zones come from whichever game's Client.txt is being watched; the
  // configured game is only a fallback until a log has been detected.
  const detectedGame = useOverlayStore((s) => s.detectedGame);
  const settingsGame = useSettingsStore((s) => s.settings.game);
  const game = detectedGame ?? settingsGame;
  const [state, setState] = useState<LevelingState>({
    currentStep: null,
    nextStep: null,
    isLeveling: false,
  });

  useEffect(() => {
    if (!currentZone) return;

    // Don't show leveling guide in maps
    if (isMapZone(currentZone, game)) {
      setState({ currentStep: null, nextStep: null, isLeveling: false });
      return;
    }

    // The character level disambiguates zone names the campaign reuses
    // (The Twilight Strand in Act 1 and Act 6).
    const guide = getLevelingGuide(game);
    const current = findCurrentStep(guide, currentZone, characterLevel);
    const next = current ? getNextStep(guide, currentZone, characterLevel) : null;

    if (current) {
      setState({ currentStep: current, nextStep: next, isLeveling: true });
    }
  }, [currentZone, characterLevel, game]);

  return state;
}
