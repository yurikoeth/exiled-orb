import WitchSays from "../WitchSays";
import { COLORS, PRIORITY_COLORS } from "../ui";
import type { BuildAnalysis } from "./build-actions";

/** Renders a Witch build analysis inside the WitchSays frame. */
export default function BuildAnalysisCard({
  analysis,
  onClose,
}: {
  analysis: BuildAnalysis;
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-20 text-xs px-1.5 py-0.5 rounded hover:opacity-80"
        style={{ background: "rgba(0,0,0,0.5)", color: "var(--text-secondary)" }}
      >
        ✕
      </button>
      <WitchSays title={`Build Analysis — ${analysis.overallRating}/10`}>
        <div className="space-y-2">
          <div className="text-xs" style={{ color: "var(--text-primary)" }}>
            {analysis.buildSummary}
          </div>

          {analysis.strengths.length > 0 && (
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.green }}>
                Strengths
              </div>
              {analysis.strengths.map((s, i) => (
                <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  + {s}
                </div>
              ))}
            </div>
          )}

          {analysis.weaknesses.length > 0 && (
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.red }}>
                Weaknesses
              </div>
              {analysis.weaknesses.map((w, i) => (
                <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  - {w}
                </div>
              ))}
            </div>
          )}

          {analysis.upgrades.length > 0 && (
            <div>
              <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                Suggested Upgrades
              </div>
              {analysis.upgrades.map((u, i) => (
                <div
                  key={i}
                  className="text-xs mt-1 pl-2 border-l-2"
                  style={{ borderColor: PRIORITY_COLORS[u.priority] || "#888" }}
                >
                  <div style={{ color: "var(--text-primary)" }}>
                    <span className="font-bold">{u.slot}</span>
                    {u.currentItem && (
                      <span style={{ color: "var(--text-secondary)" }}> ({u.currentItem})</span>
                    )}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>{u.suggestion}</div>
                  {u.estimatedCost && (
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>
                      ~{u.estimatedCost}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>
              Next Steps
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {analysis.nextSteps}
            </div>
          </div>
        </div>
      </WitchSays>
    </div>
  );
}
