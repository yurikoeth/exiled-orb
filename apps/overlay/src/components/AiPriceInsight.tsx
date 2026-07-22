import { useAiStore } from "../stores/ai-store";
import WitchSays from "./WitchSays";

const tierColors: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-green-400",
  3: "text-blue-400",
  4: "text-gray-400",
  5: "text-gray-500",
};

/** AI-powered or local mod-tier price insight panel */
export default function AiPriceInsight() {
  // Individual selectors — destructuring the whole store re-renders on every
  // unrelated store write (see CLAUDE.md Zustand convention).
  const currentAnalysis = useAiStore((s) => s.currentAnalysis);
  const analysisLoading = useAiStore((s) => s.analysisLoading);

  if (analysisLoading) {
    return (
      <WitchSays title="Analyzing...">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Examining this item...</span>
        </div>
      </WitchSays>
    );
  }

  if (!currentAnalysis) return null;

  const { modTiers, priceRecommendation, craftAdvice, itemSummary, buyOrCraftReason } = currentAnalysis;

  // Detect if this is a local (no API key) analysis
  const isLocal = !buyOrCraftReason && priceRecommendation.reasoning?.includes("mod tier analysis");

  const confColors = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-red-400",
  };

  return (
    <WitchSays title={isLocal ? "Mod Analysis" : "Price Insight"}>
      <div className="space-y-2">
        <p style={{ color: "var(--text-secondary)" }}>{itemSummary}</p>

        {modTiers.length > 0 && (
          <div className="space-y-0.5">
            {modTiers.map((mod, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`font-bold shrink-0 ${tierColors[mod.tier] || "text-gray-400"}`}>
                  {mod.tierName}
                </span>
                <span className="truncate" style={{ color: "var(--text-primary)" }}>
                  {mod.modText}
                </span>
                {mod.explanation && (
                  <span className="shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {mod.explanation}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-secondary)" }}>Recommended</span>
            <span className="font-bold" style={{ color: "var(--text-primary)", fontSize: "0.8rem" }}>
              {priceRecommendation.minChaos}–{priceRecommendation.maxChaos}c
            </span>
          </div>
          <div className={confColors[priceRecommendation.confidence]}>
            {priceRecommendation.confidence} confidence — {priceRecommendation.reasoning}
          </div>
        </div>

        {craftAdvice && (
          <div style={{ color: "var(--text-secondary)" }}>
            <span className="font-bold" style={{ color: "var(--accent)" }}>Craft: </span>
            {craftAdvice}
          </div>
        )}

        {isLocal && (
          <div
            className="text-xs px-2 py-1.5 rounded mt-1"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)" }}
          >
            Add a Claude API key in Settings for deeper Witch-powered analysis
          </div>
        )}
      </div>
    </WitchSays>
  );
}
