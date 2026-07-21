import { useState, useEffect } from "react";
import { getMapLeaderboard } from "../stores/speedrun-db";
import { formatDuration } from "@exiled-orb/shared";
import type { MapRun } from "@exiled-orb/shared";
import { Btn, SectionTitle } from "./ui";

interface MapLeaderboardProps {
  mapName: string;
  game: string;
  onClose: () => void;
}

/** Top N best times for a specific map from DB history */
export default function MapLeaderboard({ mapName, game, onClose }: MapLeaderboardProps) {
  const [runs, setRuns] = useState<MapRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMapLeaderboard(mapName, game, 10).then((r) => {
      setRuns(r);
      setLoading(false);
    });
  }, [mapName, game]);

  return (
    <div
      className="rounded-lg border backdrop-blur-sm"
      style={{ backgroundColor: "var(--bg-panel)", borderColor: "var(--border-color)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-1.5">
          <SectionTitle>Best Times</SectionTitle>
          <span className="text-xs" style={{ color: "var(--text-primary)" }}>{mapName}</span>
        </div>
        <Btn onClick={onClose}>✕</Btn>
      </div>

      {loading ? (
        <div className="px-3 py-3 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
          Loading...
        </div>
      ) : runs.length === 0 ? (
        <div className="px-3 py-3 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
          No completed runs for this map
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {runs.map((run, i) => (
            <div
              key={run.id}
              className="flex items-center justify-between px-3 py-1 border-b last:border-b-0"
              style={{
                borderColor: "rgba(255,255,255,0.05)",
                borderLeft: i === 0 ? "2px solid #22c55e" : "2px solid transparent",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold w-4 text-center"
                  style={{ color: i === 0 ? "#22c55e" : i < 3 ? "var(--accent)" : "var(--text-secondary)" }}
                >
                  #{i + 1}
                </span>
                <span className="text-xs font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                  {run.totalMs != null ? formatDuration(run.totalMs) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {run.deaths > 0 && (
                  <span className="text-xs text-red-400">{run.deaths}d</span>
                )}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {new Date(run.startedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
