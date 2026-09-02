import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useAiStore } from "../ai-store";
import type { AiPriceAnalysis, TradeWhisperAnalysis } from "@exiled-orb/shared";

const initial = useAiStore.getState();
const WHISPER: TradeWhisperAnalysis = {
  intent: "buy",
  itemMentioned: null,
  suggestedResponse: "",
  isSuspiciousPrice: false,
  suspiciousReason: null,
};

describe("ai-store", () => {
  beforeEach(() => useAiStore.setState(initial, true));
  afterEach(() => vi.useRealTimers());

  it("sets and clears the current analysis", () => {
    const analysis = { itemSummary: "x" } as AiPriceAnalysis;
    useAiStore.getState().setAnalysis(null, true);
    expect(useAiStore.getState().analysisLoading).toBe(true);
    useAiStore.getState().setAnalysis(analysis, false);
    expect(useAiStore.getState().currentAnalysis).toBe(analysis);
    useAiStore.getState().clearAnalysis();
    expect(useAiStore.getState()).toMatchObject({ currentAnalysis: null, analysisLoading: false });
  });

  it("keeps the 20 most recent whisper analyses, newest first", () => {
    for (let i = 0; i < 25; i++) {
      useAiStore.getState().addWhisperAnalysis(`w${i}`, WHISPER);
    }
    const list = useAiStore.getState().whisperAnalyses;
    expect(list).toHaveLength(20);
    expect(list[0].whisperText).toBe("w24");
    expect(list[19].whisperText).toBe("w5");
  });

  it("accumulates token usage and resets after midnight", () => {
    vi.useFakeTimers({ now: new Date("2026-09-02T10:00:00") });
    useAiStore.setState({ dailyTokensUsed: 0, dailyResetAt: new Date("2026-09-03T00:00:00").getTime() });
    useAiStore.getState().addTokenUsage(100);
    useAiStore.getState().addTokenUsage(50);
    expect(useAiStore.getState().dailyTokensUsed).toBe(150);

    vi.setSystemTime(new Date("2026-09-03T00:00:01"));
    useAiStore.getState().addTokenUsage(10);
    expect(useAiStore.getState().dailyTokensUsed).toBe(10);
    expect(useAiStore.getState().dailyResetAt).toBe(new Date("2026-09-04T00:00:00").getTime());
  });
});
