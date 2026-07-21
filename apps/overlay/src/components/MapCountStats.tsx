import { useState, useEffect } from "react";
import { getOutcomeCounts, type GroupedOutcomeCounts, type OutcomeCounts } from "../stores/speedrun-db";
import { useSpeedrunStore } from "../stores/speedrun-store";
import { useSettingsStore } from "../stores/settings-store";
import { SectionTitle } from "./ui";

type ViewMode = "session" | "today" | "total" | "character" | "league";

/** Map outcome breakdown: completed vs bricked vs abandoned across different groupings */
export default function MapCountStats() {
  const session = useSpeedrunStore((s) => s.session);
  const dbLoaded = useSpeedrunStore((s) => s.dbLoaded);
  const game = useSettingsStore((s) => s.settings.game);
  const [view, setView] = useState<ViewMode>("session");
  const [dbCounts, setDbCounts] = useState<GroupedOutcomeCounts | null>(null);

  // Load DB counts when switching away from session view
  useEffect(() => {
    if (view !== "session" && dbLoaded) {
      getOutcomeCounts(game).then(setDbCounts);
    }
  }, [view, dbLoaded, game]);

  // Also refresh DB counts when session maps change (new run saved)
  const mapCount = session?.maps.length ?? 0;
  useEffect(() => {
    if (view !== "session" && dbLoaded && mapCount > 0) {
      getOutcomeCounts(game).then(setDbCounts);
    }
  }, [mapCount]);

  // Session counts from in-memory store
  const sessionCounts: OutcomeCounts | null = session ? {
    completed: session.completedMaps,
    bricked: session.brickedMaps,
    abandoned: session.abandonedMaps,
    total: session.totalMaps,
    deaths: session.totalDeaths,
  } : null;

  if (!sessionCounts && !dbCounts) return null;

  const views: { id: ViewMode; label: string }[] = [
    { id: "session", label: "Session" },
    { id: "today", label: "Today" },
    { id: "total", label: "Total" },
    { id: "character", label: "Character" },
    { id: "league", label: "League" },
  ];

  return (
    <div
      className="rounded-lg border backdrop-blur-sm"
      style={{ backgroundColor: "var(--bg-panel)", borderColor: "var(--border-color)" }}
    >
      {/* Header + view tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: "var(--border-color)" }}>
        <SectionTitle>Map Outcomes</SectionTitle>
        <div className="flex items-center gap-0.5">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="text-xs px-1 py-0.5 rounded"
              style={{
                background: view === v.id ? "var(--accent)" : "rgba(255,255,255,0.08)",
                color: view === v.id ? "#fff" : "var(--text-secondary)",
                fontSize: "10px",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2">
        {view === "session" && sessionCounts && (
          <OutcomeBar counts={sessionCounts} />
        )}

        {view === "today" && dbCounts && (
          <OutcomeBar counts={dbCounts.today} />
        )}

        {view === "total" && dbCounts && (
          <OutcomeBar counts={dbCounts.total} />
        )}

        {view === "character" && dbCounts && (
          <GroupedView groups={dbCounts.byCharacter} emptyMsg="No character data yet" />
        )}

        {view === "league" && dbCounts && (
          <GroupedView groups={dbCounts.byLeague} emptyMsg="No league data yet" />
        )}

        {(view !== "session" && !dbCounts) && (
          <div className="text-xs text-center py-1" style={{ color: "var(--text-secondary)" }}>Loading...</div>
        )}
      </div>
    </div>
  );
}

function OutcomeBar({ counts }: { counts: OutcomeCounts }) {
  if (counts.total === 0) {
    return <div className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>No maps yet</div>;
  }

  const pctComplete = (counts.completed / counts.total) * 100;
  const pctBricked = (counts.bricked / counts.total) * 100;

  return (
    <div>
      {/* Visual bar */}
      <div className="flex rounded overflow-hidden h-3 mb-1.5" style={{ background: "rgba(255,255,255,0.1)" }}>
        {counts.completed > 0 && (
          <div style={{ width: `${pctComplete}%`, background: "#22c55e" }} title={`${counts.completed} completed`} />
        )}
        {counts.bricked > 0 && (
          <div style={{ width: `${pctBricked}%`, background: "#ef4444" }} title={`${counts.bricked} bricked`} />
        )}
        {/* Abandoned fills the rest via background */}
      </div>

      {/* Numbers */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span style={{ color: "#22c55e" }}>{counts.completed} <span style={{ color: "var(--text-secondary)" }}>clear</span></span>
          <span style={{ color: "#ef4444" }}>{counts.bricked} <span style={{ color: "var(--text-secondary)" }}>brick</span></span>
          {counts.abandoned > 0 && (
            <span style={{ color: "var(--text-secondary)" }}>{counts.abandoned} left</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-secondary)" }}>{counts.total} total</span>
          {counts.deaths > 0 && (
            <span className="text-red-400">{counts.deaths}d</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupedView({ groups, emptyMsg }: { groups: Record<string, OutcomeCounts>; emptyMsg: string }) {
  const entries = Object.entries(groups).sort((a, b) => b[1].total - a[1].total);

  if (entries.length === 0) {
    return <div className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>{emptyMsg}</div>;
  }

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {entries.map(([name, counts]) => (
        <div key={name}>
          <div className="text-xs font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>{name}</div>
          <OutcomeBar counts={counts} />
        </div>
      ))}
    </div>
  );
}
