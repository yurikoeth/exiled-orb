import { describe, it, expect, beforeEach, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const getApiKey = vi.hoisted(() => vi.fn<() => Promise<string | null>>());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("../../utils/store", () => ({ getApiKey }));

import { analyzeItemWithAi } from "../useAiAnalysis";
import { useAiStore } from "../../stores/ai-store";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "@exiled-orb/shared";
import type { ParsedItem, PriceResult } from "@exiled-orb/shared";

let counter = 0;
/** Each rare gets a unique name so the module-level analysis cache never collides. */
function rare(
  mods: string[] = ["+120 to maximum Life", "+46% to Fire Resistance", "+45% to Cold Resistance"]
): ParsedItem {
  return {
    raw: "",
    game: "poe1",
    itemClass: "Body Armours",
    rarity: "Rare",
    name: `Item ${counter++}`,
    baseType: "Astral Plate",
    itemLevel: 86,
    quality: null,
    sockets: null,
    links: null,
    implicits: [],
    explicits: mods.map((text) => ({ text, type: "explicit" as const })),
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
}

const AI_JSON = JSON.stringify({
  itemSummary: "Almost worthy of me.",
  modTiers: [],
  priceRecommendation: { minChaos: 50, maxChaos: 100, confidence: "high", reasoning: "x" },
  craftAdvice: null,
  buyOrCraft: "buy",
  buyOrCraftReason: "",
});

function enableAi(enabled: boolean) {
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { enabled, enableTradeAssistant: false } },
  });
}

describe("analyzeItemWithAi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getApiKey.mockReset().mockResolvedValue(null);
    useAiStore.getState().clearAnalysis();
    enableAi(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does nothing when AI is disabled or the item is not rare/unique", async () => {
    enableAi(false);
    await analyzeItemWithAi(rare(), null);
    expect(getApiKey).not.toHaveBeenCalled();
    enableAi(true);
    await analyzeItemWithAi({ ...rare(), rarity: "Currency" }, null);
    expect(getApiKey).not.toHaveBeenCalled();
    expect(useAiStore.getState().currentAnalysis).toBeNull();
  });

  it("without a key, produces a local mod-tier analysis for rares", async () => {
    const price = { chaosValue: 42 } as PriceResult;
    await analyzeItemWithAi(rare(), price);
    const analysis = useAiStore.getState().currentAnalysis;
    expect(invokeMock).not.toHaveBeenCalled();
    expect(analysis?.modTiers.map((m) => m.tier)).toEqual([1, 1, 2]);
    expect(analysis?.priceRecommendation.reasoning).toContain("42c listed");
    expect(analysis?.itemSummary).toContain("Score:");
    expect(analysis?.itemSummary).toContain("life + res");
  });

  it("without a key, uniques and modless rares get no analysis", async () => {
    await analyzeItemWithAi({ ...rare(), rarity: "Unique" }, null);
    expect(useAiStore.getState().currentAnalysis).toBeNull();
    await analyzeItemWithAi(rare([]), null);
    expect(useAiStore.getState().currentAnalysis).toBeNull();
  });

  it("with a key, calls Rust and caches the parsed analysis per item", async () => {
    getApiKey.mockResolvedValue("sk-ant");
    invokeMock.mockResolvedValue("```json\n" + AI_JSON + "\n```");
    const item = rare();
    await analyzeItemWithAi(item, { chaosValue: 10, source: "poe.ninja" } as PriceResult);
    expect(invokeMock).toHaveBeenCalledWith(
      "analyze_item_price",
      expect.objectContaining({ apiKey: "sk-ant" })
    );
    const args = invokeMock.mock.calls[0][1] as { itemJson: string; marketContext: string };
    expect(JSON.parse(args.itemJson).explicits).toHaveLength(3);
    expect(JSON.parse(args.marketContext)).toMatchObject({ currentPrice: 10, league: "Allflame" });
    expect(useAiStore.getState().currentAnalysis?.itemSummary).toBe("Almost worthy of me.");
    expect(useAiStore.getState().analysisLoading).toBe(false);

    await analyzeItemWithAi(item, null);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the local analysis when the API call fails", async () => {
    getApiKey.mockResolvedValue("sk-ant");
    invokeMock.mockRejectedValue(new Error("Claude API error 401"));
    await analyzeItemWithAi(rare(), null);
    const analysis = useAiStore.getState().currentAnalysis;
    expect(analysis?.priceRecommendation.reasoning).toContain("mod tier analysis only");
    expect(useAiStore.getState().analysisLoading).toBe(false);
  });

  it("treats unparseable AI output as a failure", async () => {
    getApiKey.mockResolvedValue("sk-ant");
    invokeMock.mockResolvedValue("The Witch says nothing useful.");
    await analyzeItemWithAi({ ...rare(), rarity: "Unique" }, null);
    expect(useAiStore.getState().currentAnalysis).toBeNull();
    expect(useAiStore.getState().analysisLoading).toBe(false);
  });
});
