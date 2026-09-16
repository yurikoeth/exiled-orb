import { invoke } from "@tauri-apps/api/core";
import { useAiStore } from "../stores/ai-store";
import { useSettingsStore } from "../stores/settings-store";
import { getApiKey } from "../utils/store";
import { parseAiJson } from "../utils/parseAiJson";
import { evaluateItem, resolveLeague, formatGamePrice, basicToChaos } from "@exiled-orb/shared";
import { getPriceUnits } from "./usePriceCheck";
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
      // estimatedChaos is in the game's basic currency (PoE2: exalted);
      // the recommendation is always chaos so the card can print units.
      minChaos: basicToChaos(evaluation.estimatedChaos.min, getPriceUnits(item.game)),
      maxChaos: basicToChaos(evaluation.estimatedChaos.max, getPriceUnits(item.game)),
      confidence: evaluation.score >= 70 ? "medium" : "low",
      reasoning: priceResult?.chaosValue
        ? `Based on mod tiers + poe.ninja (${formatGamePrice(priceResult.chaosValue, getPriceUnits(item.game))} listed)`
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

  // No API key — use local mod tier analysis as fallback. NOT cached:
  // it's instant local math, and caching it would keep serving the keyless
  // result (with its "add an API key" hint) after the user adds a key.
  if (!apiKey) {
    if (item.rarity === "Rare" && item.explicits.length > 0) {
      const local = generateLocalAnalysis(item, priceResult);
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

    const units = getPriceUnits(item.game);
    const marketContext = JSON.stringify({
      currentPriceChaos: priceResult?.chaosValue ?? null,
      currentPriceDisplay: priceResult?.chaosValue
        ? formatGamePrice(priceResult.chaosValue, units)
        : null,
      source: priceResult?.source ?? null,
      confidence: priceResult?.confidence ?? null,
      listingCount: priceResult?.listingCount ?? null,
      league: resolveLeague(item.game, settings.leagues),
      // PoE2 trades in exalted / divine; the JSON numbers stay in chaos so the
      // UI can convert, but the prose should use the game's units.
      economy:
        item.game === "poe2"
          ? `Path of Exile 2: prices are quoted in exalted orbs and divine orbs (1 div = ${units.chaosPerDivine.toFixed(2)} chaos${units.chaosPerExalted ? ` = ${Math.round(units.chaosPerDivine / units.chaosPerExalted)} ex` : ""}). Return minChaos/maxChaos in chaos, but write exalted/divine amounts in your prose. Items below item level 65 are leveling gear: worth vendor money to a few exalted at most, whatever their tiers.`
          : `Path of Exile 1: prices are quoted in chaos orbs and divine orbs (1 div = ${Math.round(units.chaosPerDivine)} chaos). Items below item level 68 are leveling gear: worth vendor money to a few chaos at most, whatever their tiers.`,
    });

    const result: string = await invoke("analyze_item_price", {
      apiKey,
      itemJson,
      marketContext,
    });

    // Claude sometimes wraps the JSON in ```json fences despite instructions —
    // parseAiJson strips fences and repairs trailing commas/truncation.
    const analysis = parseAiJson<AiPriceAnalysis | null>(result, null);
    if (!analysis) throw new Error("Unparseable AI response");
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
