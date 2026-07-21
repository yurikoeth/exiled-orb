import { useState, useEffect } from "react";
import { useSpeedrunStore } from "../stores/speedrun-store";
import { formatDuration } from "@exiled-orb/shared";
import { Btn, SectionTitle } from "./ui";

/** Session stats HUD: maps/hour, avg time, deaths, goals, export, pause */
export default function SpeedrunStats() {
  const session = useSpeedrunStore((s) => s.session);
  const tracking = useSpeedrunStore((s) => s.tracking);
  const goals = useSpeedrunStore((s) => s.goals);
  const [, forceUpdate] = useState(0);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [goalMph, setGoalMph] = useState("");
  const [goalTime, setGoalTime] = useState("");

  // Re-render every 5 seconds to update maps/hour
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => forceUpdate((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, [session]);

  // Sync goal editor inputs
  useEffect(() => {
    setGoalMph(goals.targetMapsPerHour?.toString() ?? "");
    setGoalTime(goals.targetClearTimeMs ? (goals.targetClearTimeMs / 1000).toString() : "");
  }, [goals]);

  if (!session || session.completedMaps === 0) return null;

  const handlePauseToggle = () => {
    const store = useSpeedrunStore.getState();
    if (tracking && store.currentRun) {
      store.abandonMapRun();
    }
    store.setTracking(!tracking);
  };

  const handleExport = (format: "csv" | "json") => {
    const data = useSpeedrunStore.getState().exportSession(format);
    if (data) {
      navigator.clipboard.writeText(data).then(() => {
        setExportMsg(`${format.toUpperCase()} copied!`);
        setTimeout(() => setExportMsg(null), 2000);
      });
    }
  };

  const handleSaveGoals = () => {
    const mph = goalMph ? parseFloat(goalMph) : null;
    const timeMs = goalTime ? parseFloat(goalTime) * 1000 : null;
    useSpeedrunStore.getState().setGoals({
      targetMapsPerHour: mph && mph > 0 ? mph : null,
      targetClearTimeMs: timeMs && timeMs > 0 ? timeMs : null,
    });
    setShowGoalEditor(false);
  };

  const mphOnTarget = goals.targetMapsPerHour != null && session.mapsPerHour != null
    ? session.mapsPerHour >= goals.targetMapsPerHour : null;
  const avgOnTarget = goals.targetClearTimeMs != null && session.avgMapTimeMs != null
    ? session.avgMapTimeMs <= goals.targetClearTimeMs : null;

  return (
    <div
      className="rounded-lg border px-3 py-2 backdrop-blur-sm"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: !tracking ? "rgba(255,255,255,0.15)" : "var(--border-color)",
        opacity: tracking ? 1 : 0.7,
      }}
    >
      {/* Header: controls */}
      <div className="flex items-center justify-between mb-1">
        <SectionTitle>Session{!tracking && " (Paused)"}</SectionTitle>
        <div className="flex items-center gap-1.5">
          {exportMsg && (
            <span className="text-xs text-green-400">{exportMsg}</span>
          )}
          <Btn className="px-1" onClick={() => handleExport("csv")} title="Export CSV">CSV</Btn>
          <Btn className="px-1" onClick={() => handleExport("json")} title="Export JSON">JSON</Btn>
          <Btn className="px-1" onClick={() => setShowGoalEditor(!showGoalEditor)} title="Set goals">&#9881;</Btn>
          <Btn
            onClick={handlePauseToggle}
            style={tracking ? {} : { background: "rgba(34,197,94,0.2)", color: "#22c55e" }}
            title={tracking ? "Pause tracking" : "Resume tracking"}
          >
            {tracking ? "⏸" : "▶"}
          </Btn>
        </div>
      </div>

      {/* Goal editor */}
      {showGoalEditor && (
        <div className="mb-2 p-2 rounded border" style={{ borderColor: "var(--border-color)", background: "rgba(0,0,0,0.3)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Goals</div>
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs block mb-0.5" style={{ color: "var(--text-secondary)" }}>Maps/hr</label>
              <input
                type="number"
                value={goalMph}
                onChange={(e) => setGoalMph(e.target.value)}
                className="w-16 text-xs px-1 py-0.5 rounded border bg-transparent"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="—"
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-xs block mb-0.5" style={{ color: "var(--text-secondary)" }}>Target (sec)</label>
              <input
                type="number"
                value={goalTime}
                onChange={(e) => setGoalTime(e.target.value)}
                className="w-16 text-xs px-1 py-0.5 rounded border bg-transparent"
                style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="—"
                min="0"
                step="5"
              />
            </div>
            <button
              onClick={handleSaveGoals}
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Maps / Hour */}
        <div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Maps/hr</div>
          <div className="text-sm font-bold" style={{ color: mphOnTarget === true ? "#22c55e" : mphOnTarget === false ? "#ef4444" : "var(--text-primary)" }}>
            {session.mapsPerHour != null ? session.mapsPerHour.toFixed(1) : "—"}
            {goals.targetMapsPerHour != null && (
              <span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>
                /{goals.targetMapsPerHour}
              </span>
            )}
          </div>
        </div>

        {/* Avg Time */}
        <div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Avg Time</div>
          <div className="text-sm font-bold" style={{ color: avgOnTarget === true ? "#22c55e" : avgOnTarget === false ? "#ef4444" : "var(--text-primary)" }}>
            {session.avgMapTimeMs != null ? formatDuration(session.avgMapTimeMs) : "—"}
            {goals.targetClearTimeMs != null && (
              <span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>
                /{formatDuration(goals.targetClearTimeMs)}
              </span>
            )}
          </div>
        </div>

        {/* Total Maps */}
        <div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Maps</div>
          <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {session.completedMaps}
          </div>
        </div>
      </div>

      {/* Second row: Deaths + Bricked + Fastest */}
      <div className="grid grid-cols-3 gap-2 text-center mt-1 pt-1 border-t" style={{ borderColor: "var(--border-color)" }}>
        <div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Deaths</div>
          <div className={`text-sm font-bold ${session.totalDeaths > 0 ? "text-red-400" : ""}`} style={session.totalDeaths === 0 ? { color: "var(--text-primary)" } : {}}>
            {session.totalDeaths}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Bricked</div>
          <div className={`text-sm font-bold ${session.brickedMaps > 0 ? "text-red-400" : ""}`} style={session.brickedMaps === 0 ? { color: "var(--text-primary)" } : {}}>
            {session.brickedMaps}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Fastest</div>
          <div className="text-sm font-bold" style={{ color: "var(--accent)" }}>
            {session.fastestMapMs != null ? formatDuration(session.fastestMapMs) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
