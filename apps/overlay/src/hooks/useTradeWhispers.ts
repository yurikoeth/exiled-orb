import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getApiKey } from "../utils/store";
import { parseAiJson } from "../utils/parseAiJson";
import { useSettingsStore } from "../stores/settings-store";
import { useAiStore } from "../stores/ai-store";
import type { TradeWhisperAnalysis } from "@exiled-orb/shared";

interface LogEventPayload {
  event_type: string;
  player_name?: string;
  message?: string;
  direction?: string;
}

/**
 * Hook that monitors incoming trade whispers and provides AI-powered analysis.
 * Filters whisper events from the log watcher, detects trade-related messages,
 * and sends them to Claude for analysis.
 */
export function useTradeWhispers() {
  useEffect(() => {
    const unlisten = listen<LogEventPayload>("log-event", async (event) => {
      const payload = event.payload;
      if (payload.event_type !== "whisper" || payload.direction !== "incoming") return;

      const settings = useSettingsStore.getState().settings;
      if (!settings.ai.enabled || !settings.ai.enableTradeAssistant) return;

      const whisperText = `@From ${payload.player_name}: ${payload.message}`;

      // Only analyze if it looks like a trade whisper (contains price-related keywords)
      const tradeKeywords = ["buy", "listed", "chaos", "divine", "exalted", "offer", "price"];
      const lower = (payload.message ?? "").toLowerCase();
      if (!tradeKeywords.some((kw) => lower.includes(kw))) return;

      try {
        const apiKey = await getApiKey();
        if (!apiKey) return;

        const result: string = await invoke("analyze_trade_whisper", {
          apiKey,
          whisperText,
          itemContext: "No additional context available.",
        });

        const analysis = parseAiJson<TradeWhisperAnalysis | null>(result, null);
        if (!analysis) throw new Error("Unparseable AI response");
        useAiStore.getState().addWhisperAnalysis(whisperText, analysis);
      } catch (err) {
        console.error("[ExiledOrb] Trade whisper analysis failed:", err);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
