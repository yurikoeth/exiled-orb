import { invoke } from "@tauri-apps/api/core";
import type { DetectedCharacter } from "@exiled-orb/shared";
import { useOverlayStore } from "../../stores/overlay-store";

/**
 * Module-level cache for the Client.txt scan result. The scan reads entire
 * log files (potentially hundreds of MB), so we only run it once per app
 * session by default. Pass force=true ("↻ history" button) to bypass.
 * Survives unmount/remount of GggAccount when navigating tabs.
 */
let detectedCharsCache: DetectedCharacter[] | null = null;

/** Scan Client.txt history for characters (cached; throws on IPC failure). */
export async function loadCharacterHistory(force = false): Promise<DetectedCharacter[]> {
  if (!force && detectedCharsCache) return detectedCharsCache;
  detectedCharsCache = await invoke<DetectedCharacter[]>("scan_character_history");
  return detectedCharsCache;
}

/**
 * Resolve a character's level by checking the live overlay store first
 * (which only has it when a recent level_up landed in the watched log
 * tail), then falling back to the full-log detected-history cache. The
 * tail-scan often misses old characters who haven't leveled in a while,
 * so this fallback prevents accidentally saving builds at level 1.
 */
export function resolveCharacterLevel(name: string | null, game: "poe1" | "poe2" | null): number | null {
  if (!name) return null;
  const fromStore = useOverlayStore.getState().characterLevel;
  if (fromStore != null && fromStore > 0) return fromStore;
  if (!game || !detectedCharsCache) return null;
  const match = detectedCharsCache.find(
    (d) => d.name.toLowerCase() === name.toLowerCase() && d.game === game,
  );
  return match && match.level > 0 ? match.level : null;
}
