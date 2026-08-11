import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useOverlayStore } from "../stores/overlay-store";
import type { LogEventPayload, InitialGameState } from "@exiled-orb/shared";

/**
 * Listen for log-event events from the Rust backend (Client.txt watcher).
 * Updates the overlay store with zone changes, deaths, etc.
 */

/**
 * Pull the watcher's current state from Rust into the overlay store.
 * Used on mount and after the watched log path changes (settings).
 * Returns the state (has `log_path`) or null on failure.
 */
export async function syncInitialGameState(): Promise<InitialGameState | null> {
  try {
    const state = await invoke<InitialGameState>("get_initial_game_state");
    const store = useOverlayStore.getState();
    if (state.character_name) store.setCharacterName(state.character_name);
    if (state.character_level) store.setCharacterLevel(state.character_level);
    if (state.character_class) store.setCharacterClass(state.character_class);
    if (state.zone) store.setZone(state.zone);
    if (state.area_level) store.setAreaLevel(state.area_level);
    if (state.game === "poe1" || state.game === "poe2") store.setDetectedGame(state.game);
    console.log("[ExiledOrb] Initial state loaded:", state);
    return state;
  } catch (err) {
    console.error("[ExiledOrb] Failed to load initial state:", err);
    return null;
  }
}

export function useClientLog() {
  // Fetch initial state from Rust on mount (no race condition)
  useEffect(() => {
    syncInitialGameState();
  }, []);

  // The backend's deep log scan found the character after startup
  // (no recent level-up in the tail — e.g. a max-level char). Re-sync.
  useEffect(() => {
    const unlisten = listen("initial-state-updated", () => {
      syncInitialGameState();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for live events
  useEffect(() => {
    const unlisten = listen<LogEventPayload>("log-event", (event) => {
      const data = event.payload;
      console.log("[ExiledOrb] log-event received:", JSON.stringify(data));
      const store = useOverlayStore.getState();

      if (data.game === "poe1" || data.game === "poe2") {
        store.setDetectedGame(data.game);
      }

      switch (data.type) {
        case "zone":
          if (data.zone_name) {
            store.setZone(data.zone_name);
          }
          break;
        case "death":
          store.addDeath(data.character_name);
          break;
        case "level_up":
          if (data.character_name) {
            store.setCharacterName(data.character_name);
          }
          if (data.class) {
            store.setCharacterClass(data.class);
          }
          if (data.level && data.level > 0) {
            store.setCharacterLevel(data.level);
            console.log(`[ExiledOrb] Level up: ${data.character_name} → ${data.level}`);
          }
          break;
        case "connected":
          console.log(`[ExiledOrb] Connected to: ${data.server}`);
          break;
        case "area_level":
          if (data.level) {
            store.setAreaLevel(data.level);
          }
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
