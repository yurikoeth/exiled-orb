import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Game } from "@exiled-orb/shared";
import { getCurrentLeague } from "@exiled-orb/shared";
import { useSettingsStore } from "../stores/settings-store";
import { syncInitialGameState } from "../hooks/useClientLog";
import ApiKeyInline from "./characters/ApiKeyInline";
import { Btn, COLORS, Panel, SectionTitle } from "./ui";
import poe1Logo from "../assets/poe1-logo.png";
import poe2Logo from "../assets/poe2-logo.png";

const GAMES: Game[] = ["poe1", "poe2"];
const GAME_LABELS: Record<Game, string> = { poe1: "Path of Exile 1", poe2: "Path of Exile 2" };

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
} as const;

/** Per-game league override row: Auto (season league) or a custom league name. */
function LeagueRow({ game }: { game: Game }) {
  const override = useSettingsStore((s) => s.settings.leagues[game]);
  const setLeagueOverride = useSettingsStore((s) => s.setLeagueOverride);
  const [draft, setDraft] = useState(override ?? "");

  // Keep the draft in sync when the override changes elsewhere (e.g. Auto).
  useEffect(() => setDraft(override ?? ""), [override]);

  const commit = () => {
    const value = draft.trim();
    setLeagueOverride(game, value || null);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs w-10 shrink-0" style={{ color: "var(--text-secondary)" }}>
        {game === "poe1" ? "PoE 1" : "PoE 2"}
      </span>
      <Btn
        variant="gold"
        active={override == null}
        onClick={() => setLeagueOverride(game, null)}
        title="Use the current season's league automatically"
      >
        Auto — {getCurrentLeague(game)}
      </Btn>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        placeholder="Custom (e.g. Standard)"
        className="flex-1 min-w-0 px-2 py-1 rounded text-xs"
        style={inputStyle}
      />
    </div>
  );
}

/** Client.txt source: auto-detect (most recently active game) or a custom path. */
function LogSection() {
  const autoDetectLog = useSettingsStore((s) => s.settings.autoDetectLog);
  const clientLogPath = useSettingsStore((s) => s.settings.clientLogPath);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [watching, setWatching] = useState<string | null>(null);
  const [draft, setDraft] = useState(clientLogPath ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncInitialGameState().then((s) => setWatching(s?.log_path ?? null));
  }, []);

  const applyCustom = async () => {
    const path = draft.trim();
    if (!path) return;
    setError(null);
    try {
      await invoke("set_log_path", { path });
      await updateSettings({ clientLogPath: path, autoDetectLog: false });
      const s = await syncInitialGameState();
      setWatching(s?.log_path ?? path);
    } catch (err) {
      setError(String(err));
    }
  };

  const useAutoDetect = async () => {
    setError(null);
    await updateSettings({ autoDetectLog: true, clientLogPath: null });
    try {
      const path = await invoke<string | null>("autodetect_log_path");
      if (path == null) {
        setError("No Client.txt found in the default install locations.");
        return;
      }
      const s = await syncInitialGameState();
      setWatching(s?.log_path ?? path);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Btn variant="gold" active={autoDetectLog} onClick={useAutoDetect}>
          Auto-detect
        </Btn>
        <Btn
          variant="gold"
          active={!autoDetectLog}
          onClick={() => updateSettings({ autoDetectLog: false })}
        >
          Custom path
        </Btn>
      </div>

      {watching && (
        <div className="text-xs break-all" style={{ color: "var(--text-secondary)" }}>
          Watching: <span style={{ color: "var(--text-primary)" }}>{watching}</span>
        </div>
      )}

      {!autoDetectLog && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            placeholder="C:\...\Path of Exile 2\logs\Client.txt"
            className="flex-1 min-w-0 px-2 py-1 rounded text-xs"
            style={inputStyle}
          />
          <Btn variant="outline" size="sm" onClick={applyCustom}>
            Apply
          </Btn>
        </div>
      )}

      {error && (
        <div className="text-xs" style={{ color: COLORS.redSoft }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** Labeled on/off toggle row for AI feature flags. */
function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs" style={{ color: "var(--text-primary)" }}>
          {label}
        </div>
        {hint && (
          <div className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>
            {hint}
          </div>
        )}
      </div>
      <Btn variant="green" active={value} disabled={disabled} onClick={() => onChange(!value)}>
        {value ? "On" : "Off"}
      </Btn>
    </div>
  );
}

export default function SettingsTab() {
  const game = useSettingsStore((s) => s.settings.game);
  const ai = useSettingsStore((s) => s.settings.ai);
  const firstRun = useSettingsStore((s) => s.firstRun);
  const setGame = useSettingsStore((s) => s.setGame);
  const setAi = useSettingsStore((s) => s.setAi);

  return (
    <div className="space-y-2">
      {firstRun && (
        <Panel gold className="px-3 py-2">
          <SectionTitle className="mb-1">Welcome, exile</SectionTitle>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            One-time setup: pick your game and league, check the Client.txt path, and optionally add
            a Claude API key for AI features. Everything can be changed here later.
          </div>
        </Panel>
      )}

      <Panel className="px-3 py-2 space-y-1.5">
        <SectionTitle>Default game</SectionTitle>
        <div className="flex gap-1">
          {GAMES.map((g) => (
            <button
              key={g}
              onClick={() => setGame(g)}
              className="flex-1 py-1.5 rounded flex items-center justify-center transition-all"
              title={GAME_LABELS[g]}
              style={{
                background: game === g ? "rgba(255,255,255,0.08)" : "transparent",
                border:
                  game === g ? "1px solid var(--border-gold)" : "1px solid var(--border-color)",
                opacity: game === g ? 1 : 0.4,
              }}
            >
              <img src={g === "poe1" ? poe1Logo : poe2Logo} alt={g} className="h-4" />
            </button>
          ))}
        </div>
        <div className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>
          Used when no game is detected from the log (leveling guide, map stats).
        </div>
      </Panel>

      <Panel className="px-3 py-2 space-y-1.5">
        <SectionTitle>League</SectionTitle>
        <LeagueRow game="poe1" />
        <LeagueRow game="poe2" />
        <div className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>
          Auto follows the current season. Set a custom league for Standard/Hardcore or when a new
          league launches before the app updates.
        </div>
      </Panel>

      <Panel className="px-3 py-2 space-y-1.5">
        <SectionTitle>Client.txt</SectionTitle>
        <LogSection />
      </Panel>

      <Panel className="px-3 py-2 space-y-1.5">
        <SectionTitle>AI (Claude)</SectionTitle>
        <ApiKeyInline />
        <ToggleRow
          label="AI price insight"
          hint="Ask Claude for a second opinion on rare/unique price checks (uses your API key per check)."
          value={ai.enabled}
          onChange={(v) => setAi({ enabled: v })}
        />
        <ToggleRow
          label="Trade whisper analysis"
          hint="Analyze incoming trade whispers for suspicious pricing. Requires AI enabled."
          value={ai.enabled && ai.enableTradeAssistant}
          disabled={!ai.enabled}
          onChange={(v) => setAi({ enableTradeAssistant: v })}
        />
      </Panel>
    </div>
  );
}
