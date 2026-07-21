import type { BuildItem } from "../../stores/build-store";
import { useBuildStore } from "../../stores/build-store";
import { useOverlayStore } from "../../stores/overlay-store";
import poe1Logo from "../../assets/poe1-logo.png";
import poe2Logo from "../../assets/poe2-logo.png";
import { Btn, Panel } from "../ui";
import type { GggCharacter } from "./constants";
import type { BuildAnalysis } from "./build-actions";
import BuildAnalysisCard from "./BuildAnalysisCard";
import BuildGoalEditor from "./BuildGoalEditor";
import ItemCard from "./ItemCard";

/**
 * One GGG-fetched character: clickable header row + expanded gear view with
 * Set Active / Refresh / Analyze actions.
 */
export default function GggCharacterRow({
  char,
  expanded,
  onToggle,
  items,
  itemsLoading,
  analyzing,
  analysis,
  onSetActive,
  onRefresh,
  onAnalyze,
  onCloseAnalysis,
}: {
  char: GggCharacter;
  expanded: boolean;
  onToggle: () => void;
  items: BuildItem[] | undefined;
  itemsLoading: boolean;
  analyzing: boolean;
  analysis: BuildAnalysis | undefined;
  onSetActive: () => void;
  onRefresh: () => void;
  onAnalyze: () => void;
  onCloseAnalysis: () => void;
}) {
  const activeCharName = useOverlayStore((s) => s.characterName);
  const activeBuildName = useBuildStore((s) => s.activeBuild?.characterName);
  const isActiveBuild = activeBuildName === char.name;
  const isLiveChar = activeCharName?.toLowerCase() === char.name.toLowerCase();

  return (
    <div>
      {/* Character header — clickable */}
      <Panel bg={expanded ? "raised" : "dim"} gold={expanded}
        className="px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={char.game === "poe2" ? poe2Logo : poe1Logo} alt={char.game} className="h-3.5 shrink-0" style={{ opacity: 0.7 }} />
            <div>
              <span className="text-xs font-bold" style={{ color: isLiveChar ? "var(--accent)" : "var(--text-primary)" }}>
                {char.name}
              </span>
              <span className="text-xs ml-1.5" style={{ color: "var(--text-secondary)" }}>
                Lv.{char.level} {char.class}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {char.league && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: "0.6rem" }}>
                {char.league}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </div>
      </Panel>

      {/* Expanded gear view */}
      {expanded && (
        <div className="mt-1 space-y-1">
          {/* Action buttons */}
          <div className="flex gap-1.5">
            <Btn variant="green" active={isActiveBuild} size="action" className="flex-1"
              onClick={(e) => { e.stopPropagation(); onSetActive(); }}>
              {isActiveBuild ? "Active" : "Set Active"}
            </Btn>
            <Btn size="action" style={{ border: "1px solid var(--border-color)" }}
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}>
              ↻
            </Btn>
            <Btn variant="gold" size="action" className="flex-1" style={{ background: "rgba(255,255,255,0.06)" }}
              disabled={analyzing}
              onClick={(e) => { e.stopPropagation(); onAnalyze(); }}>
              {analyzing ? "Analyzing..." : "Analyze"}
            </Btn>
          </div>

          <BuildGoalEditor characterName={char.name} />

          {analysis && (
            <BuildAnalysisCard analysis={analysis} onClose={onCloseAnalysis} />
          )}

          {/* Gear list */}
          {itemsLoading ? (
            <div className="text-xs text-center py-2" style={{ color: "var(--text-secondary)" }}>Loading gear...</div>
          ) : (
            <div className="space-y-0.5">
              {items?.map((item, i) => (
                <ItemCard key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
