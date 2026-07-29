import { useMemo } from "react";
import { useOverlayStore } from "../stores/overlay-store";
import { formatPrice, formatPriceRange, evaluateItem } from "@exiled-orb/shared";
import { checkPrice, getDivineRateCached } from "../hooks/usePriceCheck";
import type { ItemEvaluation } from "@exiled-orb/shared";
import { Btn, Panel, RARITY_COLORS } from "./ui";

const confidenceColors: Record<string, string> = {
  exact: "bg-green-600",
  fuzzy: "bg-yellow-600",
  low: "bg-orange-600",
  none: "bg-red-600",
};

const tierColors: Record<number, string> = {
  1: "#ffd700",
  2: "#44cc44",
  3: "#6688ff",
  4: "#888",
  5: "#555",
};

const verdictColors: Record<string, string> = {
  godly: "#ffd700",
  great: "#44cc44",
  good: "#6688ff",
  decent: "#888",
  trash: "#ff4444",
};

const verdictLabels: Record<string, string> = {
  godly: "GODLY",
  great: "GREAT",
  good: "GOOD",
  decent: "DECENT",
  trash: "VENDOR",
};

export default function PriceCheck() {
  const currentItem = useOverlayStore((s) => s.currentItem);
  const priceResult = useOverlayStore((s) => s.priceResult);
  const priceLoading = useOverlayStore((s) => s.priceLoading);

  // Evaluate rare item mods
  const evaluation: ItemEvaluation | null = useMemo(() => {
    if (!currentItem || currentItem.rarity !== "Rare") return null;
    const allMods = [
      ...currentItem.explicits.map((m) => m.text),
      ...currentItem.implicits.map((m) => m.text),
    ];
    const socketCount = currentItem.sockets ? currentItem.sockets.split(/[-\s]/).length : null;
    return evaluateItem(
      allMods,
      currentItem.itemLevel,
      socketCount,
      currentItem.links,
      currentItem.game
    );
  }, [currentItem]);

  const recheck = async () => {
    if (!currentItem) return;
    useOverlayStore.getState().setPriceCheck(currentItem, null, true);
    const result = await checkPrice(currentItem);
    useOverlayStore.getState().setPriceCheck(currentItem, result, false);
  };

  if (!currentItem) return null;

  const rarityColor = RARITY_COLORS[currentItem.rarity] || "#c8c8c8";

  return (
    <Panel className="p-3" style={{ borderLeft: `3px solid ${rarityColor}` }}>
      {/* Item header */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold" style={{ color: rarityColor }}>
            {currentItem.name || currentItem.baseType}
          </div>
          <Btn
            className="shrink-0"
            onClick={recheck}
            disabled={priceLoading}
            title="Re-check price"
          >
            ↻
          </Btn>
        </div>
        {currentItem.name && (
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {currentItem.baseType}
          </div>
        )}
        <div
          className="flex items-center gap-2 mt-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span style={{ color: "var(--accent)", opacity: 0.7 }}>
            1 div = {getDivineRateCached()}c
          </span>
          <span style={{ opacity: 0.3 }}>|</span>
          {currentItem.itemLevel && <span>iLvl {currentItem.itemLevel}</span>}
          {currentItem.sockets && currentItem.sockets.length >= 5 && !currentItem.links && (
            <span>{currentItem.sockets.split(/[-\s]/).length}S</span>
          )}
          {currentItem.links && currentItem.links >= 4 && <span>{currentItem.links}L</span>}
          {currentItem.corrupted && <span style={{ color: "#ff4444" }}>Corrupted</span>}
          {currentItem.gemLevel && <span>Lv.{currentItem.gemLevel}</span>}
          {currentItem.quality && <span>Q{currentItem.quality}%</span>}
        </div>
      </div>

      {/* Mod tier evaluation for rares */}
      {evaluation && (
        <div className="mb-2 pb-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {/* Score + verdict */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded uppercase"
                style={{
                  background: `${verdictColors[evaluation.verdict]}20`,
                  color: verdictColors[evaluation.verdict],
                }}
              >
                {verdictLabels[evaluation.verdict]}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Score: {evaluation.score}/100
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {evaluation.summary}
            </div>
          </div>

          {/* Individual mod tiers */}
          <div className="space-y-1">
            {evaluation.mods.map((mod, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="font-bold shrink-0 w-5 text-center"
                    style={{ color: mod.tier > 0 ? tierColors[mod.tier] || "#555" : "#333" }}
                  >
                    {mod.tier > 0 ? `T${mod.tier}` : "—"}
                  </span>
                  <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                    {mod.modText}
                  </span>
                  <span
                    className="shrink-0"
                    style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}
                  >
                    {mod.tierMin}–{mod.tierMax}
                  </span>
                </div>
                {/* Roll quality bar */}
                {mod.tier > 0 && (
                  <div className="flex items-center gap-1.5 ml-7">
                    <div
                      className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${mod.rollPercent}%`,
                          background:
                            mod.rollPercent >= 80
                              ? "#ffd700"
                              : mod.rollPercent >= 50
                                ? "#44cc44"
                                : "#6688ff",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.55rem",
                        width: 28,
                        textAlign: "right",
                      }}
                    >
                      {mod.rollPercent}%
                    </span>
                  </div>
                )}
              </div>
            ))}
            {/* Show unrecognized mods dimmed */}
            {currentItem.explicits
              .filter((m) => !evaluation.mods.some((em) => em.modText === m.text))
              .map((m, i) => (
                <div key={`u${i}`} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 w-5 text-center" style={{ color: "#333" }}>
                    —
                  </span>
                  <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                    {m.text}
                  </span>
                </div>
              ))}
          </div>

          {/* Combo flags */}
          {(evaluation.hasTripleRes ||
            evaluation.hasLifePlusRes ||
            evaluation.hasSpeedPlusDamage) && (
            <div className="flex gap-1 mt-1">
              {evaluation.hasTripleRes && (
                <span
                  className="text-xs px-1 rounded"
                  style={{ background: "rgba(68,204,68,0.15)", color: "#44cc44" }}
                >
                  Triple Res
                </span>
              )}
              {evaluation.hasLifePlusRes && (
                <span
                  className="text-xs px-1 rounded"
                  style={{ background: "rgba(255,215,0,0.15)", color: "#ffd700" }}
                >
                  Life+Res
                </span>
              )}
              {evaluation.hasSpeedPlusDamage && (
                <span
                  className="text-xs px-1 rounded"
                  style={{ background: "rgba(102,136,255,0.15)", color: "#6688ff" }}
                >
                  Speed+DMG
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Price result */}
      {priceLoading ? (
        <div
          className="flex items-center gap-2 text-sm py-2"
          style={{ color: "var(--text-secondary)" }}
        >
          <div
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--accent)" }}
          />
          Checking poe.ninja...
        </div>
      ) : priceResult ? (
        <div>
          {priceResult.chaosValue !== null ? (
            <>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {formatPrice(priceResult.chaosValue, getDivineRateCached())}
              </div>
              {priceResult.priceRange && (
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Range: {formatPriceRange(priceResult.priceRange, getDivineRateCached())}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${confidenceColors[priceResult.confidence]}`}
                >
                  {priceResult.confidence}
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  via {priceResult.source}
                </span>
                {priceResult.listingCount !== null && (
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    ({priceResult.listingCount} listings)
                  </span>
                )}
              </div>
            </>
          ) : (
            <div>
              {currentItem.rarity === "Rare" && evaluation ? (
                <>
                  <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                    Estimated (based on mod tiers)
                  </div>
                  <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    {evaluation.estimatedChaos.min === evaluation.estimatedChaos.max
                      ? `${evaluation.estimatedChaos.min}c`
                      : `${evaluation.estimatedChaos.min}–${evaluation.estimatedChaos.max}c`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-600">estimate</span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      via mod tier analysis
                    </span>
                  </div>
                </>
              ) : (
                <div
                  className="flex items-center gap-2 py-2 px-2 rounded mt-1"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  <span style={{ color: "#ef4444", fontSize: "1rem" }}>&#x2717;</span>
                  <div>
                    <div className="text-xs font-medium" style={{ color: "#ef4444" }}>
                      No price data found
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {priceResult.source === "unavailable"
                        ? "Item not listed on poe.ninja — try a different item or re-check"
                        : `Lookup failed via ${priceResult.source}`}
                    </div>
                  </div>
                  <Btn
                    size="sm"
                    className="ml-auto shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                    onClick={recheck}
                  >
                    Retry
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
