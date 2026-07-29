import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useOverlayStore } from "../stores/overlay-store";
import type { LogEventPayload, InitialGameState } from "@exiled-orb/shared";

/**
 * Listen for log-event events from the Rust backend (Client.txt watcher).
 * Updates the overlay store with zone changes, deaths, etc.
 */

export function useClientLog() {
  // Fetch initial state from Rust on mount (no race condition)
  useEffect(() => {
    invoke<InitialGameState>("get_initial_game_state")
      .then((state) => {
        const store = useOverlayStore.getState();
        if (state.character_name) store.setCharacterName(state.character_name);
        if (state.character_level) store.setCharacterLevel(state.character_level);
        if (state.zone) store.setZone(state.zone);
        if (state.area_level) store.setAreaLevel(state.area_level);
        if (state.game === "poe1" || state.game === "poe2") store.setDetectedGame(state.game);
        console.log("[ExiledOrb] Initial state loaded:", state);
      })
      .catch((err) => {
        console.error("[ExiledOrb] Failed to load initial state:", err);
      });
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
