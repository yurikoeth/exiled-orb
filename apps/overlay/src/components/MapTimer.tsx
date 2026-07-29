import { useState, useEffect } from "react";
import { useSpeedrunStore } from "../stores/speedrun-store";
import { formatDuration } from "@exiled-orb/shared";

/** Live map timer showing current map name, elapsed time, and deaths */
export default function MapTimer() {
  const currentRun = useSpeedrunStore((s) => s.currentRun);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!currentRun) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Date.now() - currentRun.startedAt);
    }, 250);
    return () => clearInterval(interval);
  }, [currentRun]);

  if (!currentRun) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 backdrop-blur-sm"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-color)",
      }}
    >
      <div className="flex items-center justify-between">
        {/* Map name + tier */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
            {currentRun.mapName}
          </div>
          {currentRun.mapTier != null && (
            <span
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              T{currentRun.mapTier}
            </span>
          )}
        </div>

        {/* Timer */}
        <div
          className="text-sm font-mono font-bold tabular-nums shrink-0"
          style={{ color: "var(--accent)" }}
        >
          {formatDuration(elapsed)}
        </div>
      </div>

      {/* Phase indicator + deaths */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {currentRun.bossEnteredAt ? "Boss" : "Clearing"}
        </span>
        {currentRun.deaths > 0 && (
          <span className="text-xs text-red-400">
            {currentRun.deaths} death{currentRun.deaths !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
