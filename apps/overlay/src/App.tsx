import { useEffect, useState } from "react";
import PriceCheck from "./components/PriceCheck";
import MapModWarnings from "./components/MapModWarnings";
import ZoneTracker from "./components/ZoneTracker";
import MapTimer from "./components/MapTimer";
import SpeedrunStats from "./components/SpeedrunStats";
import MapSplitDisplay from "./components/MapSplitDisplay";
import AiPriceInsight from "./components/AiPriceInsight";
import TradeAssistant from "./components/TradeAssistant";
import LevelingGuide from "./components/LevelingGuide";
import RunHistory from "./components/RunHistory";
import RunTimeChart from "./components/RunTimeChart";
import MapLeaderboard from "./components/MapLeaderboard";
import MapCountStats from "./components/MapCountStats";
import GggAccount from "./components/characters/GggAccount";
import SeasonTimers from "./components/SeasonTimers";
import AskAi from "./components/AskAi";
import MarketTab from "./components/MarketTab";
import SettingsTab from "./components/SettingsTab";
import { invoke } from "@tauri-apps/api/core";
import { useClipboard } from "./hooks/useClipboard";
import { useClientLog, syncInitialGameState } from "./hooks/useClientLog";
import { useMapSpeedrun } from "./hooks/useMapSpeedrun";
import { useTradeWhispers } from "./hooks/useTradeWhispers";
import { useOverlayStore } from "./stores/overlay-store";
import { useSettingsStore } from "./stores/settings-store";
import { useSpeedrunStore } from "./stores/speedrun-store";
import { useBuildStore } from "./stores/build-store";
import { Btn, Panel, SectionTitle } from "./components/ui";

import menuMarket from "./assets/menu/market.png";
import menuLeveling from "./assets/menu/leveling.png";
import menuMaps from "./assets/menu/maps.png";
import menuAsk from "./assets/menu/ask.png";
import menuChar from "./assets/menu/char.png";

type Page = "home" | "market" | "leveling" | "maps" | "ask" | "char" | "settings";

const MENU_ITEMS: { id: Page; label: string; desc: string; bg?: string }[] = [
  { id: "market", label: "Market", desc: "Live prices from poe.ninja", bg: menuMarket },
  { id: "leveling", label: "Leveling", desc: "Act-by-act progression", bg: menuLeveling },
  { id: "maps", label: "Maps", desc: "Speedrun timer & stats", bg: menuMaps },
  { id: "ask", label: "Ask AI", desc: "Ask anything about PoE", bg: menuAsk },
  { id: "char", label: "Characters", desc: "Gear & build analysis", bg: menuChar },
  { id: "settings", label: "Settings", desc: "Game, league, log & AI" },
];

export default function App() {
  const activePanel = useOverlayStore((s) => s.activePanel);
  const currentRun = useSpeedrunStore((s) => s.currentRun);
  const [page, setPage] = useState<Page>("home");
  const [leaderboardMap, setLeaderboardMap] = useState<{ name: string; game: string } | null>(null);

  // Load settings, builds, and speedrun data on startup
  useEffect(() => {
    useSettingsStore
      .getState()
      .loadSettings()
      .then(async () => {
        const { settings, firstRun } = useSettingsStore.getState();
        useSpeedrunStore.getState().loadPBsFromDB(settings.game);
        useSpeedrunStore.getState().loadGoals();

        // First launch → open onboarding (Settings page).
        if (firstRun) setPage("settings");

        // Custom log path configured → replace the auto-detected watcher.
        if (!settings.autoDetectLog && settings.clientLogPath) {
          try {
            await invoke("set_log_path", { path: settings.clientLogPath });
            await syncInitialGameState();
          } catch (err) {
            console.error("[ExiledOrb] Custom log path failed, keeping auto-detected:", err);
          }
        }
      });
    useBuildStore.getState().loadBuilds();
  }, []);

  // Start listening for clipboard and log events
  useClipboard();
  useClientLog();
  useMapSpeedrun();
  useTradeWhispers();

  // Listen for toggle hotkey
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        useOverlayStore.getState().toggleVisibility();
      }
      if (e.key === "Escape") {
        if (page !== "home") {
          setPage("home");
        } else {
          useOverlayStore.getState().dismissPanel();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [page]);

  const visible = useOverlayStore((s) => s.visible);
  if (!visible) return null;

  return (
    <div className="w-full min-h-0 h-screen flex flex-col gap-2 p-2 overflow-y-auto">
      {/* Zone tracker — always visible, click to go home */}
      <div onClick={() => setPage("home")} className={page !== "home" ? "cursor-pointer" : ""}>
        {currentRun ? <MapTimer /> : <ZoneTracker />}
      </div>

      {/* Price check overlay — floats on top of any page */}
      {activePanel === "price" && (
        <div
          className="rounded border p-0 relative"
          style={{
            background: "rgba(10,10,14,0.98)",
            borderColor: "var(--border-color)",
            zIndex: 50,
          }}
        >
          <Btn
            className="absolute top-1 right-1"
            style={{ zIndex: 51 }}
            onClick={() => useOverlayStore.getState().dismissPanel()}
            title="Dismiss (Esc)"
          >
            ✕
          </Btn>
          <PriceCheck />
          <AiPriceInsight />
        </div>
      )}

      {/* HOME — menu grid + live panels */}
      {page === "home" && (
        <>
          {activePanel === "map" && <MapModWarnings />}
          <MapSplitDisplay />
          <SpeedrunStats />
          <TradeAssistant />
          <SeasonTimers />

          {/* Menu grid */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className="rounded border px-3 py-4 text-left hover:brightness-125 transition-all relative overflow-hidden group"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(24,24,28,0.95) 0%, rgba(14,14,18,0.95) 100%)",
                  borderColor: "var(--border-color)",
                }}
              >
                {item.bg && (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{
                      backgroundImage: `url(${item.bg})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right center",
                    }}
                  />
                )}
                <div className="relative z-10">
                  <div className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                    {item.label}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* PAGES */}
      {page === "market" && <MarketTab />}
      {page === "leveling" && <LevelingGuide />}
      {page === "maps" && (
        <>
          <MapSplitDisplay />
          <SpeedrunStats />
          <MapCountStats />
          <RunTimeChart />
          {leaderboardMap && (
            <MapLeaderboard
              mapName={leaderboardMap.name}
              game={leaderboardMap.game}
              onClose={() => setLeaderboardMap(null)}
            />
          )}
          <RunHistory onSelectMap={(name, game) => setLeaderboardMap({ name, game })} />
          {!currentRun && !useSpeedrunStore.getState().session && (
            <HintPanel
              title="Map Grinding Tracker"
              lines={[
                "Enter a map to start tracking automatically.",
                "• Live timer + maps/hour + avg clear time",
                "• Personal bests + split comparisons",
                "• Run history + per-map leaderboards",
                "• Set goals + track improvement over time",
                "• Export session data as CSV/JSON",
              ]}
            />
          )}
        </>
      )}
      {page === "ask" && <AskAi />}
      {page === "char" && <GggAccount />}
      {page === "settings" && <SettingsTab />}
    </div>
  );
}

function HintPanel({ title, lines }: { title?: string; lines: string[] }) {
  return (
    <Panel bg="dim" className="px-3 py-2">
      {title && <SectionTitle className="mb-1">{title}</SectionTitle>}
      <div className="text-xs space-y-0.5" style={{ color: "var(--text-secondary)" }}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </Panel>
  );
}
