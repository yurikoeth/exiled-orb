import { useState, useEffect, useCallback } from "react";
import { useSpeedrunStore } from "../stores/speedrun-store";
import { loadRunHistory, type RunHistoryOpts } from "../stores/speedrun-db";
import { formatDuration } from "@exiled-orb/shared";
import type { MapRun } from "@exiled-orb/shared";
import { Btn, SectionTitle } from "./ui";

interface RunHistoryProps {
  onSelectMap?: (mapName: string, game: string) => void;
}

type FilterMode = "session" | "all";

/** Scrollable list of past map runs */
export default function RunHistory({ onSelectMap }: RunHistoryProps) {
  const session = useSpeedrunStore((s) => s.session);
  const personalBests = useSpeedrunStore((s) => s.personalBests);
  const [filter, setFilter] = useState<FilterMode>("session");
  const [dbRuns, setDbRuns] = useState<MapRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [mapFilter, setMapFilter] = useState("");

  const PAGE_SIZE = 20;

  const loadMore = useCallback(async () => {
    setLoading(true);
    const opts: RunHistoryOpts = { limit: PAGE_SIZE, offset: dbRuns.length };
    if (mapFilter) opts.mapName = mapFilter;
    const runs = await loadRunHistory(opts);
    setDbRuns((prev) => [...prev, ...runs]);
    setHasMore(runs.length === PAGE_SIZE);
    setLoading(false);
  }, [dbRuns.length, mapFilter]);

  // Reset and load when switching to "all" or changing map filter
  useEffect(() => {
    if (filter === "all") {
      setDbRuns([]);
      setHasMore(false);
      const load = async () => {
        setLoading(true);
        const opts: RunHistoryOpts = { limit: PAGE_SIZE, offset: 0 };
        if (mapFilter) opts.mapName = mapFilter;
        const runs = await loadRunHistory(opts);
        setDbRuns(runs);
        setHasMore(runs.length === PAGE_SIZE);
        setLoading(false);
      };
      load();
    }
  }, [filter, mapFilter]);

  const runs: MapRun[] = filter === "session" ? [...(session?.maps ?? [])].reverse() : dbRuns;

  if (runs.length === 0 && !loading) return null;

  return (
    <div
      className="rounded-lg border backdrop-blur-sm"
      style={{ backgroundColor: "var(--bg-panel)", borderColor: "var(--border-color)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <SectionTitle>Run History</SectionTitle>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("session")}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: filter === "session" ? "var(--accent)" : "rgba(255,255,255,0.08)",
              color: filter === "session" ? "#fff" : "var(--text-secondary)",
            }}
          >
            Session
          </button>
          <button
            onClick={() => setFilter("all")}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: filter === "all" ? "var(--accent)" : "rgba(255,255,255,0.08)",
              color: filter === "all" ? "#fff" : "var(--text-secondary)",
            }}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Map name filter for "all" mode */}
      {filter === "all" && (
        <div className="px-3 py-1 border-b" style={{ borderColor: "var(--border-color)" }}>
          <input
            type="text"
            value={mapFilter}
            onChange={(e) => setMapFilter(e.target.value)}
            placeholder="Filter by map name..."
            className="w-full text-xs px-2 py-0.5 rounded border bg-transparent"
            style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
        </div>
      )}

      {/* Run list */}
      <div className="max-h-60 overflow-y-auto">
        {runs.map((run) => {
          const pb = personalBests.get(run.mapName);
          const isPb = run.completed && run.totalMs != null && pb != null && run.totalMs <= pb;
          const diff = run.completed && run.totalMs != null && pb != null ? run.totalMs - pb : null;

          return (
            <div
              key={run.id}
              className="flex items-center justify-between px-3 py-1 border-b last:border-b-0 hover:brightness-125 cursor-pointer"
              style={{
                borderColor: "rgba(255,255,255,0.05)",
                borderLeft:
                  run.outcome === "bricked"
                    ? "2px solid #ef4444"
                    : isPb
                      ? "2px solid #22c55e"
                      : run.deaths > 0
                        ? "2px solid #f59e0b"
                        : "2px solid transparent",
              }}
              onClick={() => onSelectMap?.(run.mapName, run.game)}
            >
              {/* Left: map info */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                  {run.mapName}
                </span>
                {run.mapTier != null && (
                  <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
                    T{run.mapTier}
                  </span>
                )}
                {/* Outcome toggle — click to cycle between completed/bricked */}
                {run.outcome === "bricked" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useSpeedrunStore.getState().markOutcome(run.id, "completed");
                    }}
                    className="text-xs shrink-0 text-red-400 font-bold hover:opacity-70"
                    title="Click to mark as cleared"
                  >
                    BRICK
                  </button>
                ) : run.outcome === "completed" && run.deaths > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useSpeedrunStore.getState().markOutcome(run.id, "bricked");
                    }}
                    className="text-xs shrink-0 hover:opacity-70"
                    style={{ color: "var(--text-secondary)" }}
                    title="Click to mark as bricked"
                  >
                    [B]
                  </button>
                ) : (
                  run.outcome === "abandoned" && (
                    <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
                      (left)
                    </span>
                  )
                )}
              </div>

              {/* Right: time + delta + deaths + delete */}
              <div className="flex items-center gap-2 shrink-0">
                {run.deaths > 0 && <span className="text-xs text-red-400">{run.deaths}d</span>}
                {diff != null && diff !== 0 && (
                  <span
                    className={`text-xs font-mono ${diff < 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {diff > 0 ? "+" : ""}
                    {formatDuration(Math.abs(diff))}
                  </span>
                )}
                {isPb && <span className="text-xs text-green-400">PB</span>}
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: run.completed ? "var(--text-primary)" : "var(--text-secondary)" }}
                >
                  {run.totalMs != null ? formatDuration(run.totalMs) : "—"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useSpeedrunStore.getState().deleteRun(run.id);
                  }}
                  className="text-xs px-0.5 hover:opacity-80 opacity-30 hover:opacity-70"
                  style={{ color: "var(--text-secondary)" }}
                  title="Delete run"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more for DB mode */}
      {filter === "all" && hasMore && (
        <div
          className="px-3 py-1.5 text-center border-t"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Btn className="px-3" onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </Btn>
        </div>
      )}
    </div>
  );
}
