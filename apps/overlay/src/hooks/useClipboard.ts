import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { parseItem, isPoEItem, analyzeMap } from "@exiled-orb/shared";
import type { ParsedItem } from "@exiled-orb/shared";
import { useOverlayStore } from "../stores/overlay-store";
import { useSettingsStore } from "../stores/settings-store";
import { useGearCaptureStore } from "../stores/gear-capture-store";
import { checkPrice } from "./usePriceCheck";
import { analyzeItemWithAi } from "./useAiAnalysis";

/**
 * Listen for clipboard-item events from the Rust backend.
 * When a PoE item is detected, parse it and route to the appropriate handler.
 */
export function useClipboard() {
  useEffect(() => {
    console.log("[ExiledOrb] Clipboard hook mounted, listening for items...");
    const unlisten = listen<string>("clipboard-item", async (event) => {
      const raw = event.payload;
      console.log(
        "[ExiledOrb] Clipboard event received, length:",
        raw.length,
        "preview:",
        raw.substring(0, 80)
      );
      if (!isPoEItem(raw)) {
        console.log("[ExiledOrb] Not a PoE item, ignoring");
        return;
      }

      try {
        const item = parseItem(raw);

        // Gear-capture mode is exclusive: every clipboard item is consumed
        // by the capture session. Items that don't match any slot rule are
        // logged and dropped — we don't fall through to price-check or map
        // analysis, since those popups during a kit tour are confusing and
        // hide the slot-checklist UI. The capture store overrides item.game
        // to the session's game (parser falls back to poe1 for shared item
        // classes like body armours / rings — the user's already declared
        // the active game by starting capture).
        const captureStore = useGearCaptureStore.getState();
        if (captureStore.active) {
          const slot = captureStore.ingest(item);
          const sessionGame = captureStore.game;
          if (slot) {
            console.log(
              `[ExiledOrb] Captured ${sessionGame} ${slot}: ${item.name || item.baseType} (${item.rarity})`
            );
          } else {
            console.log(
              `[ExiledOrb] Capture: no slot for item class ${JSON.stringify(item.itemClass)} (${item.rarity}, ${item.name || item.baseType})`
            );
          }
          return;
        }

        console.log(
          "[ExiledOrb] Parsed item:",
          item.rarity,
          item.name || item.baseType,
          "class:",
          item.itemClass,
          "game:",
          item.game
        );

        // Route based on item class
        if (
          item.itemClass.toLowerCase().includes("map") ||
          item.itemClass.toLowerCase().includes("waystone")
        ) {
          // Map — show mod warnings
          const modTexts = item.explicits.map((m) => m.text);
          const buildProfile = useSettingsStore.getState().settings.build;
          const analysis = analyzeMap(
            item.name || item.baseType,
            modTexts,
            item.game,
            item.mapTier,
            buildProfile
          );
          useOverlayStore.getState().setMapAnalysis(analysis);
        } else {
          // Item — show price check
          useOverlayStore.getState().setPriceCheck(item, null, true);

          // Fetch price asynchronously
          const result = await checkPrice(item);
          console.log(
            "[ExiledOrb] Price result:",
            result.source,
            result.chaosValue,
            result.confidence
          );
          useOverlayStore.getState().setPriceCheck(item, result, false);

          // Trigger AI analysis in the background (non-blocking).
          // analyzeItemWithAi handles its own errors internally and never rejects.
          void analyzeItemWithAi(item, result);
        }
      } catch (err) {
        console.error("[ExiledOrb] Failed to parse clipboard item:", err);
        const errorItem: ParsedItem = {
          raw,
          game: "poe1",
          itemClass: "",
          rarity: "Normal",
          name: null,
          baseType: "Parse Error",
          itemLevel: null,
          quality: null,
          sockets: null,
          links: null,
          implicits: [],
          explicits: [],
          enchants: [],
          corrupted: false,
          mirrored: false,
          unidentified: false,
          influences: [],
          stackSize: null,
          mapTier: null,
          gemLevel: null,
          requirements: {},
          properties: {},
        };
        useOverlayStore
          .getState()
          .setPriceCheck(
            errorItem,
            {
              item: errorItem,
              source: "unavailable",
              chaosValue: null,
              divineValue: null,
              confidence: "none",
              listingCount: null,
              priceRange: null,
              tradeUrl: null,
              timestamp: Date.now(),
            },
            false
          );
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
