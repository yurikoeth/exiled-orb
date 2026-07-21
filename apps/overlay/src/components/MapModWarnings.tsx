import { useOverlayStore } from "../stores/overlay-store";

const dangerStyles = {
  deadly: { bg: "bg-red-900/60", border: "border-red-500/50", text: "text-red-300", label: "DEADLY" },
  dangerous: { bg: "bg-orange-900/60", border: "border-orange-500/50", text: "text-orange-300", label: "DANGER" },
  caution: { bg: "bg-yellow-900/40", border: "border-yellow-500/40", text: "text-yellow-300", label: "CAUTION" },
  safe: { bg: "bg-green-900/30", border: "border-green-500/30", text: "text-green-300", label: "SAFE" },
};

export default function MapModWarnings() {
  const mapAnalysis = useOverlayStore((s) => s.mapAnalysis);
  if (!mapAnalysis) return null;

  const overallStyle = dangerStyles[mapAnalysis.overallDanger];

  return (
    <div
      className="rounded-lg border p-3 backdrop-blur-sm"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-color)",
      }}
    >
      {/* Map header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {mapAnalysis.mapName}
          </div>
          {mapAnalysis.tier && (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Tier {mapAnalysis.tier}
            </div>
          )}
        </div>
        <div className={`text-xs font-bold px-2 py-1 rounded ${overallStyle.bg} ${overallStyle.text}`}>
          {overallStyle.label}
        </div>
      </div>

      {/* Mod list */}
      <div className="flex flex-col gap-1.5">
        {mapAnalysis.mods.map((mod, i) => {
          const style = dangerStyles[mod.danger];
          return (
            <div
              key={i}
              className={`rounded px-2 py-1.5 border ${style.bg} ${style.border}`}
            >
              <div className="flex items-start gap-2">
                {mod.danger !== "safe" && (
                  <span className={`text-xs font-bold shrink-0 mt-0.5 ${style.text}`}>
                    {style.label}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs" style={{ color: "var(--text-primary)" }}>
                    {mod.match ? mod.match.shortName : mod.modText}
                  </div>
                  {mod.match && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {mod.match.description}
                    </div>
                  )}
                  {mod.match && mod.match.dangerousFor.length > 0 && (
                    <div className="text-xs mt-0.5 text-red-400/80">
                      Dangerous for: {mod.match.dangerousFor.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {mapAnalysis.dangerCount > 0 && (
        <div className="mt-2 text-xs text-center" style={{ color: "var(--text-secondary)" }}>
          {mapAnalysis.dangerCount} dangerous mod{mapAnalysis.dangerCount > 1 ? "s" : ""} detected
        </div>
      )}
    </div>
  );
}
