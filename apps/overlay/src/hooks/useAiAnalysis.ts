import { invoke } from "@tauri-apps/api/core";
import { useAiStore } from "../stores/ai-store";
import { useSettingsStore } from "../stores/settings-store";
import { getApiKey } from "../utils/store";
import { evaluateItem, resolveLeague } from "@exiled-orb/shared";
import type { ParsedItem, PriceResult, AiPriceAnalysis } from "@exiled-orb/shared";

/** Cache of recent AI analyses keyed by item hash */
const analysisCache = new Map<string, AiPriceAnalysis>();

/** Simple hash for an item (name + base type + mods) */
function itemHash(item: ParsedItem): string {
  const mods = item.explicits.map((m) => m.text).join("|");
  return `${item.name}:${item.baseType}:${mods}`;
}

/** Generate a local analysis from mod tier data (no API key needed) */
function generateLocalAnalysis(item: ParsedItem, priceResult: PriceResult | null): AiPriceAnalysis {
  const allMods = [...item.explicits.map((m) => m.text), ...item.implicits.map((m) => m.text)];
  const socketCount = item.sockets ? item.sockets.split(/[-\s]/).length : null;
  const evaluation = evaluateItem(allMods, item.itemLevel, socketCount, item.links, item.game);

  const modTiers = evaluation.mods
    .filter((m) => m.tier >= 1 && m.tier <= 5)
    .map((m) => ({
      modText: m.modText,
      tier: m.tier as 1 | 2 | 3 | 4 | 5,
      tierName: `T${m.tier}`,
      explanation: `Roll: ${m.rollPercent}% (${m.tierMin}–${m.tierMax})`,
    }));

  // Build a summary based on verdict
  const verdictText: Record<string, string> = {
    godly: "Exceptional rolls — worth serious currency",
    great: "Strong rolls on key mods — good value",
    good: "Solid item with decent mods",
    decent: "Average rolls — usable but not valuable",
    trash: "Low-tier rolls — vendor or recraft",
  };

  const combos: string[] = [];
  if (evaluation.hasTripleRes) combos.push("triple res");
  if (evaluation.hasLifePlusRes) combos.push("life + res");
  if (evaluation.hasSpeedPlusDamage) combos.push("speed + damage");

  const summary = verdictText[evaluation.verdict] || "Mod analysis complete";
  const comboNote = combos.length > 0 ? ` Notable combos: ${combos.join(", ")}.` : "";

  return {
    itemSummary: `${summary}.${comboNote} Score: ${evaluation.score}/100.`,
    modTiers,
    priceRecommendation: {
      minChaos: evaluation.estimatedChaos.min,
      maxChaos: evaluation.estimatedChaos.max,
      confidence: evaluation.score >= 70 ? "medium" : "low",
      reasoning: priceResult?.chaosValue
        ? `Based on mod tiers + poe.ninja (${Math.round(priceResult.chaosValue)}c listed)`
        : "Based on mod tier analysis only — add Claude API key for deeper insight",
    },
    craftAdvice: null,
    buyOrCraft: "either",
    buyOrCraftReason: "",
  };
}

/**
 * Analyze an item's price with Claude AI, or fall back to local mod tier analysis.
 * Called after the basic price check completes.
 */
export async function analyzeItemWithAi(
  item: ParsedItem,
  priceResult: PriceResult | null
): Promise<void> {
  const settings = useSettingsStore.getState().settings;
  if (!settings.ai.enabled) return;

  // Only analyze rares and uniques
  if (item.rarity !== "Rare" && item.rarity !== "Unique") return;

  const hash = itemHash(item);

  // Check cache
  const cached = analysisCache.get(hash);
  if (cached) {
    useAiStore.getState().setAnalysis(cached, false);
    return;
  }

  const apiKey = await getApiKey();

  // No API key — use local mod tier analysis as fallback
  if (!apiKey) {
    if (item.rarity === "Rare" && item.explicits.length > 0) {
      const local = generateLocalAnalysis(item, priceResult);
      analysisCache.set(hash, local);
      useAiStore.getState().setAnalysis(local, false);
    }
    return;
  }

  useAiStore.getState().setAnalysis(null, true);

  try {
    const itemJson = JSON.stringify({
      name: item.name,
      baseType: item.baseType,
      rarity: item.rarity,
      itemLevel: item.itemLevel,
      explicits: item.explicits.map((m) => m.text),
      implicits: item.implicits.map((m) => m.text),
      corrupted: item.corrupted,
      links: item.links,
      game: item.game,
    });

    const marketContext = JSON.stringify({
      currentPrice: priceResult?.chaosValue ?? null,
      source: priceResult?.source ?? null,
      confidence: priceResult?.confidence ?? null,
      listingCount: priceResult?.listingCount ?? null,
      league: resolveLeague(item.game, settings.leagues),
    });

    const result: string = await invoke("analyze_item_price", {
      apiKey,
      itemJson,
      marketContext,
    });

    const analysis: AiPriceAnalysis = JSON.parse(result);
    analysisCache.set(hash, analysis);
    useAiStore.getState().setAnalysis(analysis, false);
  } catch (err) {
    console.error("[ExiledOrb] AI analysis failed:", err);
    // Fall back to local analysis on API failure
    if (item.rarity === "Rare" && item.explicits.length > 0) {
      const local = generateLocalAnalysis(item, priceResult);
      useAiStore.getState().setAnalysis(local, false);
    } else {
      useAiStore.getState().setAnalysis(null, false);
    }
  }
}
