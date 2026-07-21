import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useOverlayStore } from "../stores/overlay-store";
import { getStore, getApiKey } from "../utils/store";
import { parseAiJson } from "../utils/parseAiJson";
import { useBuildStore, inferBuildTags, type BuildGoal, type BuildItem, type BuildSocket } from "../stores/build-store";
import { useGearCaptureStore, CAPTURE_SLOTS, SLOT_LABELS, type CaptureSlot } from "../stores/gear-capture-store";
import type { DetectedCharacter } from "@exiled-orb/shared";
import poe1Logo from "../assets/poe1-logo.png";
import poe2Logo from "../assets/poe2-logo.png";
import WitchSays from "./WitchSays";

interface GggCharacter {
  name: string;
  class: string;
  level: number;
  league: string | null;
  experience: number | null;
  game: string;
}

// Renamed/aliased to share with build-store so a single ItemCard renders
// both GGG-fetched and clipboard-captured items.
type SocketInfo = BuildSocket;
type GggItem = BuildItem;

interface BuildAnalysis {
  buildSummary: string;
  strengths: string[];
  weaknesses: string[];
  upgrades: Array<{
    slot: string;
    currentItem: string;
    suggestion: string;
    priority: string;
    estimatedCost: string;
  }>;
  overallRating: string;
  nextSteps: string;
}

const rarityColors: Record<string, string> = {
  Normal: "#c8c8c8",
  Magic: "#8888ff",
  Rare: "#ffff77",
  Unique: "#af6025",
  Gem: "#1ba29b",
  Currency: "#aa9e82",
};

const slotOrder = [
  "Helm", "Amulet", "Weapon", "Weapon2",
  "BodyArmour", "Offhand", "Offhand2",
  "Gloves", "Ring", "Ring2", "Belt", "Boots",
  "Flask",
];

const slotLabels: Record<string, string> = {
  Helm: "Helmet", Amulet: "Amulet", Weapon: "Weapon", Weapon2: "Swap Weapon",
  BodyArmour: "Body", Offhand: "Off-hand", Offhand2: "Swap Off-hand",
  Gloves: "Gloves", Ring: "Ring 1", Ring2: "Ring 2", Belt: "Belt", Boots: "Boots",
  Flask: "Flask",
};

const POE1_CLASSES = ["Marauder", "Ranger", "Witch", "Duelist", "Templar", "Shadow", "Scion"];
const POE2_CLASSES = ["Warrior", "Sorceress", "Witch", "Monk", "Mercenary", "Ranger", "Druid", "Huntress"];

const LIVE_CLASS_STORE_KEY = "live_char_classes";
const HIDDEN_DETECTED_KEY = "hidden_detected_chars";
/**
 * Permanently dismissed characters — filtered out of scan results entirely,
 * never counted in the "hidden" UI, never restorable except by editing the
 * persisted store file. Keyed by `<game>::<name-lowercase>` like hidden.
 */
const DISMISSED_DETECTED_KEY = "dismissed_detected_chars";

const detectedKey = (game: string, name: string) => `${game}::${name.toLowerCase()}`;

/**
 * Module-level cache for the Client.txt scan result. The scan reads entire
 * log files (potentially hundreds of MB), so we only run it once per app
 * session by default. The "↻ history" button passes force=true to bypass.
 * Survives unmount/remount of GggAccount when navigating tabs.
 */
let detectedCharsCache: DetectedCharacter[] | null = null;

/**
 * Resolve a character's level by checking the live overlay store first
 * (which only has it when a recent level_up landed in the watched log
 * tail), then falling back to the full-log detected-history cache. The
 * tail-scan often misses old characters who haven't leveled in a while,
 * so this fallback prevents accidentally saving builds at level 1.
 */
function resolveCharacterLevel(name: string | null, game: "poe1" | "poe2" | null): number | null {
  if (!name) return null;
  const fromStore = useOverlayStore.getState().characterLevel;
  if (fromStore != null && fromStore > 0) return fromStore;
  if (!game || !detectedCharsCache) return null;
  const match = detectedCharsCache.find(
    (d) => d.name.toLowerCase() === name.toLowerCase() && d.game === game,
  );
  return match && match.level > 0 ? match.level : null;
}

export default function GggAccount() {
  // null = haven't checked yet, true = connected, false = not connected
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [characters, setCharacters] = useState<GggCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const [charItems, setCharItems] = useState<Record<string, GggItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);
  const [buildAnalysis, setBuildAnalysis] = useState<Record<string, BuildAnalysis>>({});
  const [analyzingBuild, setAnalyzingBuild] = useState<string | null>(null);
  const [detectedChars, setDetectedChars] = useState<DetectedCharacter[]>([]);
  const [scanningHistory, setScanningHistory] = useState(false);
  const [hiddenChars, setHiddenChars] = useState<string[]>([]);
  const [dismissedChars, setDismissedChars] = useState<string[]>([]);

  const loadCharacterHistory = async (force = false) => {
    if (!force && detectedCharsCache) {
      setDetectedChars(detectedCharsCache);
      return;
    }
    setScanningHistory(true);
    try {
      const chars = await invoke<DetectedCharacter[]>("scan_character_history");
      detectedCharsCache = chars;
      setDetectedChars(chars);
    } catch (err) {
      console.error("[ExiledOrb] scan_character_history failed:", err);
    }
    setScanningHistory(false);
  };

  // When the detected-history scan finishes, if the overlay store's
  // characterLevel is still null (because the live tail-scan didn't find
  // a recent level_up), backfill it from the full-log scan result.
  useEffect(() => {
    if (detectedChars.length === 0) return;
    const ov = useOverlayStore.getState();
    if (ov.characterLevel != null || !ov.characterName || !ov.detectedGame) return;
    const match = detectedChars.find(
      (d) => d.name.toLowerCase() === ov.characterName!.toLowerCase() && d.game === ov.detectedGame,
    );
    if (match && match.level > 0) {
      ov.setCharacterLevel(match.level);
    }
  }, [detectedChars]);

  useEffect(() => {
    loadCharacterHistory();
    getStore()
      .then(async (s) => {
        const hidden = await s.get<string[]>(HIDDEN_DETECTED_KEY);
        if (Array.isArray(hidden)) setHiddenChars(hidden);
        const dismissed = await s.get<string[]>(DISMISSED_DETECTED_KEY);
        if (Array.isArray(dismissed)) setDismissedChars(dismissed);
      })
      .catch(() => {});
  }, []);

  const hideDetectedChar = async (char: DetectedCharacter) => {
    const key = detectedKey(char.game, char.name);
    const next = hiddenChars.includes(key) ? hiddenChars : [...hiddenChars, key];
    setHiddenChars(next);
    try {
      const s = await getStore();
      await s.set(HIDDEN_DETECTED_KEY, next);
      await s.save();
    } catch (err) {
      console.error("[ExiledOrb] Failed to persist hidden chars:", err);
    }
  };

  const restoreHidden = async () => {
    setHiddenChars([]);
    try {
      const s = await getStore();
      await s.set(HIDDEN_DETECTED_KEY, []);
      await s.save();
    } catch (err) {
      console.error("[ExiledOrb] Failed to clear hidden chars:", err);
    }
  };

  const restoreOneHidden = async (char: DetectedCharacter) => {
    const key = detectedKey(char.game, char.name);
    const next = hiddenChars.filter((k) => k !== key);
    setHiddenChars(next);
    try {
      const s = await getStore();
      await s.set(HIDDEN_DETECTED_KEY, next);
      await s.save();
    } catch (err) {
      console.error("[ExiledOrb] Failed to remove from hidden chars:", err);
    }
  };

  /**
   * Permanently dismiss a character — removes from hidden if present and
   * adds to the dismissed list. Dismissed entries are filtered OUT of scan
   * results entirely, so they never appear in either the visible list or
   * the hidden manager. Survives restarts (persisted to tauri-plugin-store).
   * Not reversible from the UI — edit the store file to undo.
   */
  const dismissDetectedChar = async (char: DetectedCharacter) => {
    const key = detectedKey(char.game, char.name);
    const nextHidden = hiddenChars.filter((k) => k !== key);
    const nextDismissed = dismissedChars.includes(key)
      ? dismissedChars
      : [...dismissedChars, key];
    setHiddenChars(nextHidden);
    setDismissedChars(nextDismissed);
    try {
      const s = await getStore();
      await s.set(HIDDEN_DETECTED_KEY, nextHidden);
      await s.set(DISMISSED_DETECTED_KEY, nextDismissed);
      await s.save();
    } catch (err) {
      console.error("[ExiledOrb] Failed to persist dismissed chars:", err);
    }
  };

  /**
   * Bulk dismiss every currently-hidden character. After this the hidden
   * list is empty and the dismissed list grows by the same count — none of
   * those names will appear in the section again.
   */
  const dismissAllHidden = async () => {
    if (hiddenChars.length === 0) return;
    const merged = Array.from(new Set([...dismissedChars, ...hiddenChars]));
    setHiddenChars([]);
    setDismissedChars(merged);
    try {
      const s = await getStore();
      await s.set(HIDDEN_DETECTED_KEY, []);
      await s.set(DISMISSED_DETECTED_KEY, merged);
      await s.save();
    } catch (err) {
      console.error("[ExiledOrb] Failed to persist bulk dismiss:", err);
    }
  };

  const [showHiddenList, setShowHiddenList] = useState(false);

  // On mount, check if we already have valid GGG OAuth tokens.
  // If yes, load characters immediately. If no, show the Connect button.
  useEffect(() => {
    invoke<boolean>("is_authenticated")
      .then((authed) => {
        setIsAuthed(authed);
        if (authed) loadCharacters();
      })
      .catch((err) => {
        console.error("[ExiledOrb] is_authenticated failed:", err);
        setIsAuthed(false);
      });
  }, []);

  const loadCharacters = async () => {
    setLoading(true);
    setError(null);
    try {
      const chars = await invoke<GggCharacter[]>("fetch_characters");
      setCharacters(chars);
    } catch (err) {
      setError(String(err));
      setCharacters([]);
    }
    setLoading(false);
  };

  const loadItems = async (charName: string, force = false) => {
    if (charItems[charName] && !force) return; // already loaded
    const char = characters.find((c) => c.name === charName);
    const game = char?.game ?? "poe1";
    setItemsLoading(charName);
    try {
      const items = await invoke<GggItem[]>("fetch_character_items", {
        character: charName,
        game,
      });
      setCharItems((prev) => ({ ...prev, [charName]: items }));
    } catch (err) {
      console.error("[ExiledOrb] loadItems failed:", err);
      setError(`Failed to load gear: ${err}`);
    }
    setItemsLoading(null);
  };

  const toggleChar = (name: string) => {
    if (expandedChar === name) {
      setExpandedChar(null);
    } else {
      setExpandedChar(name);
      loadItems(name);
    }
  };

  const activeBuildName = useBuildStore((s) => s.activeBuild?.characterName);

  const setAsActiveBuild = async (char: GggCharacter) => {
    // Load items if not loaded
    if (!charItems[char.name]) await loadItems(char.name);
    const items = charItems[char.name] || [];

    // Infer build tags from all gear mods
    const allMods = items.flatMap((i) => i.mods);
    const tags = inferBuildTags(allMods);

    const gearSummary = items
      .map((i) => `[${i.inventory_id}] ${i.name || i.base_type} (${i.rarity})`)
      .join("\n");

    await useBuildStore.getState().setActiveBuild({
      characterName: char.name,
      characterClass: char.class,
      level: char.level,
      game: char.game as "poe1" | "poe2",
      league: char.league || "Standard",
      damageTypes: tags.damageTypes,
      defenseTypes: tags.defenseTypes,
      recoveryTypes: tags.recoveryTypes,
      mainSkill: tags.mainSkill,
      keyItems: items.filter((i) => i.rarity === "Unique").map((i) => i.name || i.base_type),
      gearSummary,
      goal: useBuildStore.getState().activeBuild?.characterName === char.name
        ? useBuildStore.getState().activeBuild?.goal ?? null
        : null,
      updatedAt: Date.now(),
    });

    // Also update overlay store
    useOverlayStore.getState().setCharacterClass(char.class);
    useOverlayStore.getState().setCharacterName(char.name);
  };

  const analyzeBuild = async (char: GggCharacter) => {
    setError(null);

    // Need items loaded first
    if (!charItems[char.name]) await loadItems(char.name);
    const items = charItems[char.name];
    if (!items || items.length === 0) {
      setError("No gear loaded for this character. Try Refresh Gear first.");
      return;
    }

    const apiKey = await getApiKey();

    if (!apiKey) {
      setError("Add your Claude API key in Settings > AI to use build analysis. Get one at console.anthropic.com — gear viewing and price checks work without it.");
      return;
    }

    setAnalyzingBuild(char.name);
    try {
      const buildGoal = useBuildStore.getState().savedBuilds.find((b) => b.characterName === char.name)?.goal;
      const charJson = JSON.stringify({
        name: char.name, class: char.class, level: char.level, league: char.league, game: char.game,
        buildGoal: buildGoal ? {
          buildName: buildGoal.buildName,
          focus: buildGoal.focus,
          budget: buildGoal.budget,
          notes: buildGoal.notes,
        } : null,
      });
      const itemsJson = JSON.stringify(items.map((i) => ({
        slot: i.inventory_id,
        name: i.name || i.base_type,
        baseType: i.base_type,
        rarity: i.rarity,
        ilvl: i.ilvl,
        links: i.max_links,
        corrupted: i.corrupted,
        mods: i.mods,
      })));

      let result: string;
      try {
        result = await invoke("analyze_build", { apiKey, characterJson: charJson, itemsJson });
      } catch (invokeErr) {
        console.error("[ExiledOrb] invoke failed:", invokeErr);
        setError(`AI call failed: ${invokeErr}`);
        setAnalyzingBuild(null);
        return;
      }
      const analysis = parseAiJson<BuildAnalysis>(result, {
        buildSummary: "The Witch could not read this exile's fate. Try again.",
        strengths: [], weaknesses: [], upgrades: [],
        overallRating: "?", nextSteps: "Click Analyze Build to retry.",
      });
      setBuildAnalysis((prev) => ({ ...prev, [char.name]: analysis }));
    } catch (err) {
      setError(String(err));
    }
    setAnalyzingBuild(null);
  };

  // OAuth2 PKCE flow — opens system browser to GGG, awaits callback on
  // localhost:11343, exchanges code for tokens, persists, then loads chars.
  const connect = async () => {
    setError(null);
    setLoading(true);
    try {
      await invoke("start_oauth_flow");
      setIsAuthed(true);
      await loadCharacters();
    } catch (err) {
      console.error("[ExiledOrb] OAuth flow failed:", err);
      setError(String(err));
    }
    setLoading(false);
  };

  const disconnect = async () => {
    try {
      await invoke("disconnect_oauth");
    } catch (err) {
      console.error("[ExiledOrb] disconnect_oauth failed:", err);
    }
    setIsAuthed(false);
    setCharacters([]);
    setCharItems({});
    setError(null);
  };

  // Match active character from Client.txt
  const activeCharName = useOverlayStore((s) => s.characterName);
  const detectedGame = useOverlayStore((s) => s.detectedGame);
  useEffect(() => {
    if (characters.length > 0 && activeCharName) {
      const match = characters.find((c) => c.name.toLowerCase() === activeCharName.toLowerCase());
      if (match) {
        useOverlayStore.getState().setCharacterClass(match.class);
      }
    }
  }, [characters, activeCharName]);

  // Pre-sort GGG character items once per charItems update so the inner
  // .map render doesn't sort on every parent render.
  const sortedCharItems = useMemo(() => {
    const result: Record<string, GggItem[]> = {};
    for (const [name, items] of Object.entries(charItems)) {
      result[name] = [...items].sort((a, b) => {
        const ai = slotOrder.indexOf(a.inventory_id);
        const bi = slotOrder.indexOf(b.inventory_id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    return result;
  }, [charItems]);

  // Pre-compute section grouping once per relevant input change so the
  // grouping (filter + Set + filter) doesn't re-run on every render.
  const sections = useMemo(() => {
    const dismissedSet = new Set(dismissedChars);
    const order: ("poe1" | "poe2")[] = detectedGame === "poe1" ? ["poe1", "poe2"] : ["poe2", "poe1"];
    return order.map((sectionGame) => {
      const sectionChars = characters.filter((c) => c.game === sectionGame);
      const gggNamesLower = new Set(sectionChars.map((c) => c.name.toLowerCase()));
      // Dismissed chars are filtered out completely — never visible, never
      // in the hidden manager. Hidden-but-not-dismissed are split next.
      const detectedAll = sectionGame === "poe2"
        ? detectedChars.filter(
            (d) =>
              d.game === "poe2"
              && !gggNamesLower.has(d.name.toLowerCase())
              && !dismissedSet.has(detectedKey(d.game, d.name)),
          )
        : [];
      const detectedSection = detectedAll.filter(
        (d) => !hiddenChars.includes(detectedKey(d.game, d.name)),
      );
      return {
        sectionGame,
        sectionChars,
        detectedSection,
        hiddenInSection: detectedAll.length - detectedSection.length,
        totalCount: sectionChars.length + detectedSection.length,
      };
    });
  }, [detectedGame, characters, detectedChars, hiddenChars, dismissedChars]);

  if (isAuthed === false) {
    return (
      <div className="space-y-2">
      <BuildCapturePanel />
      <LiveSessionTile gggCharacters={[]} />
      <div
        className="rounded border px-3 py-3 space-y-2"
        style={{
          background: "linear-gradient(180deg, rgba(24,24,28,0.95) 0%, rgba(14,14,18,0.95) 100%)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
          GGG Account
        </div>
        <div className="text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
          Connect to GGG via OAuth to load your PoE1 and PoE2 characters with
          gear. A browser window will open for you to sign in. Tokens are
          stored locally on your machine; no data is sent anywhere else.
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <button
          onClick={connect}
          disabled={loading}
          className="w-full py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-gold)", color: "var(--accent)" }}
        >
          {loading ? "Waiting for browser sign-in…" : "Connect with GGG"}
        </button>
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Account header */}
      <div
        className="rounded border px-3 py-2"
        style={{
          background: "linear-gradient(180deg, rgba(24,24,28,0.95) 0%, rgba(14,14,18,0.95) 100%)",
          borderColor: "var(--border-gold)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>Connected to GGG</div>
          <div className="flex gap-1">
            <button onClick={() => loadCharacters()} className="text-xs px-1.5 py-0.5 rounded hover:opacity-80" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }} title="Refresh characters">↻</button>
            <button onClick={disconnect} className="text-xs px-1.5 py-0.5 rounded hover:opacity-80" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }} title="Disconnect (deletes local tokens)">✕</button>
          </div>
        </div>
      </div>

      {/* API Key inline setup */}
      <ApiKeyInline />

      {loading && <div className="text-xs text-center py-2" style={{ color: "var(--text-secondary)" }}>Loading...</div>}
      {error && <div className="text-xs text-red-400 px-2">{error}</div>}

      <BuildCapturePanel />
      <LiveSessionTile gggCharacters={characters} />

      {/* Character list — grouped by game, active game first.
          PoE1 uses GGG's character API (which works); PoE2 uses log-mined
          history because GGG's public API doesn't return PoE2 characters
          without OAuth. So detected (log-mined) characters are only
          surfaced under the PoE2 section. The live-session character is
          intentionally NOT filtered — it shows in its section alongside
          other detected chars (with the existing "active" badge) so the
          section view is the canonical character list. */}
      {sections.map(({ sectionGame, sectionChars, detectedSection, hiddenInSection, totalCount }) => {
        if (totalCount === 0 && hiddenInSection === 0 && sectionGame === "poe1") return null;
        return (
          <div key={sectionGame} className="space-y-1.5">
            <div
              className="flex items-center gap-2 px-1 pt-1 text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              <img src={sectionGame === "poe2" ? poe2Logo : poe1Logo} alt={sectionGame} className="h-3 shrink-0" style={{ opacity: 0.7 }} />
              <span>{sectionGame === "poe2" ? "Path of Exile 2" : "Path of Exile 1"}</span>
              <span style={{ opacity: 0.7 }}>· {totalCount}</span>
              {sectionGame === "poe2" && (
                <button
                  onClick={() => loadCharacterHistory(true)}
                  disabled={scanningHistory}
                  className="ml-auto text-xs px-1.5 py-0.5 rounded hover:opacity-80 disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", fontSize: "0.6rem" }}
                  title="Re-scan PoE2 Client.txt for character history"
                >
                  {scanningHistory ? "…" : "↻ history"}
                </button>
              )}
            </div>
            {sectionChars.length === 0 && detectedSection.length === 0 && sectionGame === "poe2" && (
              <div
                className="text-xs px-2 py-1.5 rounded"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px dashed var(--border-color)",
                  color: "var(--text-secondary)",
                  fontSize: "0.65rem",
                  lineHeight: 1.3,
                }}
              >
                GGG's public character API doesn't expose PoE2 characters yet —
                requires OAuth (developer application pending). No characters
                found in local Client.txt history either. Play a PoE2 character
                and re-scan, or see the Live Session tile above.
              </div>
            )}
            {detectedSection.length > 0 && (
              <div className="space-y-1">
                {detectedSection.map((char) => (
                  <DetectedCharacterTile
                    key={`${char.game}-${char.name}`}
                    char={char}
                    onRemove={() => hideDetectedChar(char)}
                    onDelete={() => dismissDetectedChar(char)}
                  />
                ))}
              </div>
            )}
            {hiddenInSection > 0 && sectionGame === "poe2" && (
              <div className="space-y-1">
                <button
                  onClick={() => setShowHiddenList((v) => !v)}
                  className="text-xs px-2 py-0.5 rounded hover:opacity-80"
                  style={{ background: "transparent", color: "var(--text-secondary)", fontSize: "0.6rem" }}
                  title={showHiddenList ? "Collapse hidden list" : "Expand to manage individual hidden characters"}
                >
                  {showHiddenList ? "▾" : "▸"} {hiddenInSection} hidden
                </button>
                {showHiddenList && (
                  <div
                    className="rounded space-y-0.5 px-2 py-1.5"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px dashed var(--border-color)",
                    }}
                  >
                    {detectedChars
                      .filter(
                        (d) =>
                          d.game === sectionGame
                          && hiddenChars.includes(detectedKey(d.game, d.name)),
                      )
                      .map((d) => (
                        <div
                          key={`hidden-${d.game}-${d.name}`}
                          className="flex items-center justify-between gap-2 text-xs"
                          style={{ fontSize: "0.65rem" }}
                        >
                          <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                            {d.name}
                            {d.class ? ` · ${d.class}` : ""}
                            {d.level > 0 ? ` · Lv.${d.level}` : ""}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => restoreOneHidden(d)}
                              className="px-1.5 py-0.5 rounded hover:opacity-80"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                                fontSize: "0.6rem",
                              }}
                              title="Restore this character to the list"
                            >
                              ↺ restore
                            </button>
                            <button
                              onClick={() => dismissDetectedChar(d)}
                              className="px-1.5 py-0.5 rounded hover:opacity-80"
                              style={{
                                background: "rgba(255,68,68,0.08)",
                                border: "1px solid rgba(255,68,68,0.3)",
                                color: "#ff6666",
                                fontSize: "0.6rem",
                              }}
                              title="Permanently delete (filtered out of all future scans — not reversible from UI)"
                            >
                              🗑 delete
                            </button>
                          </div>
                        </div>
                      ))}
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={restoreHidden}
                        className="flex-1 text-xs py-0.5 rounded hover:opacity-80"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--text-secondary)",
                          fontSize: "0.6rem",
                        }}
                        title="Restore every hidden character at once"
                      >
                        ↺ Restore all
                      </button>
                      <button
                        onClick={dismissAllHidden}
                        className="flex-1 text-xs py-0.5 rounded hover:opacity-80"
                        style={{
                          background: "rgba(255,68,68,0.08)",
                          color: "#ff6666",
                          fontSize: "0.6rem",
                        }}
                        title="Permanently delete all currently-hidden characters (not reversible from UI)"
                      >
                        🗑 Delete all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {sectionChars.map((char, idx) => (
        <div key={`${char.name}-${char.game}-${idx}`}>
          {/* Character header — clickable */}
          <div
            className="rounded border px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              background: expandedChar === char.name
                ? "linear-gradient(180deg, rgba(30,30,36,0.95) 0%, rgba(18,18,22,0.95) 100%)"
                : "linear-gradient(180deg, rgba(24,24,28,0.9) 0%, rgba(14,14,18,0.9) 100%)",
              borderColor: expandedChar === char.name ? "var(--border-gold)" : "var(--border-color)",
            }}
            onClick={() => toggleChar(char.name)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={char.game === "poe2" ? poe2Logo : poe1Logo} alt={char.game} className="h-3.5 shrink-0" style={{ opacity: 0.7 }} />
                <div>
                  <span className="text-xs font-bold" style={{ color: activeCharName?.toLowerCase() === char.name.toLowerCase() ? "var(--accent)" : "var(--text-primary)" }}>
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
                  {expandedChar === char.name ? "▲" : "▼"}
                </span>
              </div>
            </div>
          </div>

          {/* Expanded gear view */}
          {expandedChar === char.name && (
            <div className="mt-1 space-y-1">
              {/* Action buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setAsActiveBuild(char); }}
                  className="flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
                  style={{
                    background: activeBuildName === char.name ? "rgba(68,204,68,0.15)" : "rgba(255,255,255,0.06)",
                    border: activeBuildName === char.name ? "1px solid #44cc44" : "1px solid var(--border-color)",
                    color: activeBuildName === char.name ? "#44cc44" : "var(--text-secondary)",
                  }}
                >
                  {activeBuildName === char.name ? "Active" : "Set Active"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); loadItems(char.name, true); }}
                  className="py-1.5 px-2 rounded text-xs transition-opacity hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                >
                  ↻
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); analyzeBuild(char); }}
                  disabled={analyzingBuild === char.name}
                  className="flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-gold)", color: "var(--accent)" }}
                >
                  {analyzingBuild === char.name ? "Analyzing..." : "Analyze"}
                </button>
              </div>

              {/* Build Goal editor */}
              <BuildGoalEditor characterName={char.name} />

              {/* Build Analysis results */}
              {buildAnalysis[char.name] && (
                <BuildAnalysisCard
                  analysis={buildAnalysis[char.name]}
                  onClose={() => setBuildAnalysis((prev) => { const copy = { ...prev }; delete copy[char.name]; return copy; })}
                />
              )}

              {/* Gear list */}
              {itemsLoading === char.name ? (
                <div className="text-xs text-center py-2" style={{ color: "var(--text-secondary)" }}>Loading gear...</div>
              ) : (
                <div className="space-y-0.5">
                  {sortedCharItems[char.name]?.map((item, i) => (
                    <ItemCard key={i} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
          </div>
        );
      })}
    </div>
  );
}

function ApiKeyInline() {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStore().then((store) => {
      store.get<string>("claude_api_key").then((k) => {
        if (k) { setKey(k); setSaved(true); }
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    const store = await getStore();
    await store.set("claude_api_key", key.trim());
    await store.save();
    setSaved(true);
  };

  return (
    <div
      className="rounded border px-3 py-1.5"
      style={{ background: "rgba(18,18,22,0.9)", borderColor: "var(--border-color)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: saved ? "#44cc44" : "var(--text-secondary)" }}>
            {saved ? "API Key Set" : "Claude API Key"}
          </span>
        </div>
        <button
          onClick={() => setShow(!show)}
          className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
        >
          {show ? "Hide" : "Edit"}
        </button>
      </div>
      {show && (
        <div className="flex gap-1.5 mt-1.5">
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setSaved(false); }}
            placeholder="sk-ant-..."
            className="flex-1 px-2 py-1 rounded text-xs"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          />
          <button
            onClick={save}
            className="px-2 py-1 rounded text-xs hover:opacity-80"
            style={{ background: saved ? "rgba(68,204,68,0.15)" : "rgba(255,255,255,0.08)", border: "1px solid var(--border-color)", color: saved ? "#44cc44" : "var(--text-primary)" }}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

const FOCUS_OPTIONS = ["DPS", "Survivability", "Boss Killing", "Clear Speed", "Magic Find", "League Start", "Budget", "Min-Max"];

function BuildGoalEditor({ characterName }: { characterName: string }) {
  const savedBuild = useBuildStore((s) => s.savedBuilds.find((b) => b.characterName === characterName));
  const goal = savedBuild?.goal;
  const [expanded, setExpanded] = useState(false);
  const [buildName, setBuildName] = useState(goal?.buildName ?? "");
  const [focus, setFocus] = useState<string[]>(goal?.focus ?? []);
  const [budget, setBudget] = useState(goal?.budget ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");

  const save = () => {
    useBuildStore.getState().setGoal(characterName, { buildName, focus, budget, notes });
    setExpanded(false);
  };

  const toggleFocus = (f: string) =>
    setFocus((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  return (
    <div
      className="rounded border px-2 py-1.5"
      style={{
        background: "rgba(18,18,22,0.9)",
        borderColor: goal ? "var(--border-gold)" : "var(--border-color)",
      }}
    >
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="text-xs" style={{ color: goal ? "var(--accent)" : "var(--text-secondary)" }}>
          {goal ? `Build: ${goal.buildName}` : "Set Build Goal"}
          {goal && goal.focus.length > 0 && (
            <span style={{ color: "var(--text-secondary)" }}> — {goal.focus.join(", ")}</span>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Build Name</div>
            <input
              type="text"
              value={buildName}
              onChange={(e) => setBuildName(e.target.value)}
              placeholder="e.g. RF Juggernaut, Lightning Arrow Deadeye"
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>

          <div>
            <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Focus</div>
            <div className="flex flex-wrap gap-1">
              {FOCUS_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFocus(f)}
                  className="px-1.5 py-0.5 rounded text-xs transition-colors"
                  style={{
                    background: focus.includes(f) ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                    border: focus.includes(f) ? "1px solid var(--border-gold)" : "1px solid var(--border-color)",
                    color: focus.includes(f) ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Budget</div>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 50 divine, 2000 chaos, unlimited"
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>

          <div>
            <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>Notes</div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. need more chaos res, want to do ubers"
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
          </div>

          <button
            onClick={save}
            className="w-full py-1.5 rounded text-xs font-bold uppercase tracking-wide hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-gold)", color: "var(--accent)" }}
          >
            Save Goal
          </button>
        </div>
      )}
    </div>
  );
}

const priorityColors: Record<string, string> = {
  high: "#ff4444",
  medium: "#ffaa00",
  low: "#44cc44",
};

function BuildAnalysisCard({ analysis, onClose }: { analysis: BuildAnalysis; onClose: () => void }) {
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

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div>
          <div className="text-xs font-bold" style={{ color: "#44cc44" }}>Strengths</div>
          {analysis.strengths.map((s, i) => (
            <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>+ {s}</div>
          ))}
        </div>
      )}

      {/* Weaknesses */}
      {analysis.weaknesses.length > 0 && (
        <div>
          <div className="text-xs font-bold" style={{ color: "#ff4444" }}>Weaknesses</div>
          {analysis.weaknesses.map((w, i) => (
            <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>- {w}</div>
          ))}
        </div>
      )}

      {/* Upgrade suggestions */}
      {analysis.upgrades.length > 0 && (
        <div>
          <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>Suggested Upgrades</div>
          {analysis.upgrades.map((u, i) => (
            <div key={i} className="text-xs mt-1 pl-2 border-l-2" style={{ borderColor: priorityColors[u.priority] || "#888" }}>
              <div style={{ color: "var(--text-primary)" }}>
                <span className="font-bold">{u.slot}</span>
                {u.currentItem && <span style={{ color: "var(--text-secondary)" }}> ({u.currentItem})</span>}
              </div>
              <div style={{ color: "var(--text-secondary)" }}>{u.suggestion}</div>
              {u.estimatedCost && (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>~{u.estimatedCost}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Next steps */}
      <div className="pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>Next Steps</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{analysis.nextSteps}</div>
      </div>

        </div>
      </WitchSays>
    </div>
  );
}

const socketColors: Record<string, string> = {
  R: "#e44", G: "#4b4", B: "#66f", W: "#ddd", A: "#888",
};

function SocketDisplay({ sockets }: { sockets: SocketInfo[] }) {
  if (sockets.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {sockets.map((s, i) => {
        const linked = i > 0 && sockets[i - 1].group === s.group;
        return (
          <div key={i} className="flex items-center">
            {linked && (
              <div className="w-1.5 h-0.5" style={{ background: "rgba(255,255,255,0.3)" }} />
            )}
            <div
              className="w-3 h-3 rounded-sm border"
              style={{
                background: socketColors[s.color] || "#888",
                borderColor: "rgba(0,0,0,0.4)",
                opacity: 0.85,
              }}
              title={`${s.color === "R" ? "Red" : s.color === "G" ? "Green" : s.color === "B" ? "Blue" : "White"} socket`}
            />
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({ item }: { item: GggItem }) {
  const [showMods, setShowMods] = useState(false);
  const displayName = item.name || item.base_type;
  const subtitle = item.name ? item.base_type : null;
  const color = rarityColors[item.rarity] || "#c8c8c8";
  const slotLabel = slotLabels[item.inventory_id] || item.inventory_id;

  return (
    <div
      className="rounded border px-2 py-1.5 cursor-pointer hover:opacity-90"
      style={{
        background: "rgba(18,18,22,0.9)",
        borderColor: "rgba(255,255,255,0.05)",
        borderLeft: `2px solid ${color}`,
      }}
      onClick={() => item.mods.length > 0 && setShowMods(!showMods)}
    >
      <div className="flex items-center gap-2">
        {/* Item icon */}
        {item.icon && (
          <img src={item.icon} alt="" className="w-6 h-6 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-xs font-bold truncate block" style={{ color }}>
                {displayName}
              </span>
              {subtitle && (
                <span className="text-xs truncate block" style={{ color: "var(--text-secondary)" }}>
                  {subtitle}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {item.corrupted && (
                <span className="text-xs px-1 rounded" style={{ background: "rgba(255,68,68,0.15)", color: "#ff4444", fontSize: "0.55rem" }}>Corrupted</span>
              )}
              <span className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}>
                {slotLabel}
              </span>
            </div>
          </div>

          {/* Socket display */}
          {item.socket_details.length > 0 && (
            <SocketDisplay sockets={item.socket_details} />
          )}
        </div>
      </div>

      {/* Expanded mods */}
      {showMods && item.mods.length > 0 && (
        <div className="mt-1 pt-1 border-t space-y-0.5" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {item.mods.map((mod, i) => (
            <div key={i} className="text-xs" style={{ color: "#8888cc" }}>
              {mod}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Surfaces the Client.txt-detected character as a tile when GGG's API can't
 * provide it (notably PoE2, which requires OAuth not yet implemented).
 * Lets the user pick a class manually; persists the choice keyed by name+game.
 */
function LiveSessionTile({ gggCharacters }: { gggCharacters: GggCharacter[] }) {
  const characterName = useOverlayStore((s) => s.characterName);
  const characterLevel = useOverlayStore((s) => s.characterLevel);
  const characterClass = useOverlayStore((s) => s.characterClass);
  const detectedGame = useOverlayStore((s) => s.detectedGame);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [gearOpen, setGearOpen] = useState(true);
  const activeBuildName = useBuildStore((s) => s.activeBuild?.characterName);
  const activeBuildGearSummary = useBuildStore((s) => s.activeBuild?.gearSummary ?? null);
  const activeBuildKeyItems = useBuildStore((s) => s.activeBuild?.keyItems ?? []);
  const activeBuildGear = useBuildStore((s) => s.activeBuild?.gear ?? null);
  const [analysis, setAnalysis] = useState<BuildAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Stable sorted-gear reference so the gear viewer doesn't re-sort on
  // every render of the parent (gear is small but parent re-renders often).
  const sortedActiveGear = useMemo(
    () =>
      activeBuildGear
        ? [...activeBuildGear].sort((a, b) => {
            const ai = slotOrder.indexOf(a.inventory_id);
            const bi = slotOrder.indexOf(b.inventory_id);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          })
        : null,
    [activeBuildGear],
  );

  const storeKey = characterName && detectedGame ? `${detectedGame}::${characterName}` : null;

  // Hydrate persisted class map; apply to overlay store if the saved class
  // matches the current live character and overlay-store has no class yet
  // (e.g. on cold start before the GGG-list match runs).
  useEffect(() => {
    getStore()
      .then((s) => s.get<Record<string, string>>(LIVE_CLASS_STORE_KEY))
      .then((map) => {
        if (map) setClassMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!storeKey || characterClass) return;
    const saved = classMap[storeKey];
    if (saved) useOverlayStore.getState().setCharacterClass(saved);
  }, [storeKey, classMap, characterClass]);

  if (!characterName || !detectedGame) return null;

  // If the live char is already in the GGG list for the same game, the
  // existing tile covers it — skip to avoid duplication. PoE2 will never
  // appear in the GGG list (until OAuth lands), so it always shows.
  const inGggList = gggCharacters.some(
    (c) => c.name.toLowerCase() === characterName.toLowerCase() && c.game === detectedGame,
  );
  if (inGggList) return null;

  const classOptions = detectedGame === "poe2" ? POE2_CLASSES : POE1_CLASSES;
  const isActiveBuild = activeBuildName === characterName;

  const pickClass = async (cls: string) => {
    if (!storeKey) return;
    const next = { ...classMap, [storeKey]: cls };
    setClassMap(next);
    setPicking(false);
    useOverlayStore.getState().setCharacterClass(cls);
    try {
      const s = await getStore();
      await s.set(LIVE_CLASS_STORE_KEY, next);
      await s.save();
    } catch (err) {
      console.error("[ExiledOrb] Failed to persist class:", err);
    }
  };

  const analyzeCapturedBuild = async () => {
    setAnalyzeError(null);
    if (!activeBuildGear || activeBuildGear.length === 0) {
      setAnalyzeError("No captured gear to analyze. Click Capture gear first.");
      return;
    }
    const ab = useBuildStore.getState().activeBuild;
    if (!ab) {
      setAnalyzeError("No active build set.");
      return;
    }
    const apiKey = await getApiKey();
    if (!apiKey) {
      setAnalyzeError("Add your Claude API key in Settings > AI to use build analysis. Get one at console.anthropic.com.");
      return;
    }
    setAnalyzing(true);
    try {
      const charJson = JSON.stringify({
        name: ab.characterName,
        class: ab.characterClass,
        level: ab.level,
        league: ab.league,
        game: ab.game,
        buildGoal: ab.goal ? {
          buildName: ab.goal.buildName,
          focus: ab.goal.focus,
          budget: ab.goal.budget,
          notes: ab.goal.notes,
        } : null,
      });
      const itemsJson = JSON.stringify(activeBuildGear.map((i) => ({
        slot: i.inventory_id,
        name: i.name || i.base_type,
        baseType: i.base_type,
        rarity: i.rarity,
        ilvl: i.ilvl,
        links: i.max_links,
        corrupted: i.corrupted,
        mods: i.mods,
      })));
      const result = await invoke<string>("analyze_build", { apiKey, characterJson: charJson, itemsJson });
      const parsed = parseAiJson<BuildAnalysis>(result, {
        buildSummary: "The Witch could not read this exile's fate. Try again.",
        strengths: [], weaknesses: [], upgrades: [],
        overallRating: "?", nextSteps: "Click Analyze Build to retry.",
      });
      setAnalysis(parsed);
    } catch (err) {
      setAnalyzeError(`AI call failed: ${err}`);
    }
    setAnalyzing(false);
  };

  const setAsActiveBuild = async () => {
    if (!characterName || !detectedGame || !characterClass) return;
    const resolvedLevel =
      resolveCharacterLevel(characterName, detectedGame)
      ?? useBuildStore.getState().activeBuild?.level
      ?? 1;
    await useBuildStore.getState().setActiveBuild({
      characterName,
      characterClass,
      level: resolvedLevel,
      game: detectedGame,
      league: "Standard",
      damageTypes: [],
      defenseTypes: [],
      recoveryTypes: [],
      mainSkill: null,
      keyItems: [],
      gearSummary: "(no gear data — GGG OAuth required)",
      goal: useBuildStore.getState().activeBuild?.characterName === characterName
        ? useBuildStore.getState().activeBuild?.goal ?? null
        : null,
      updatedAt: Date.now(),
    });
  };

  const showOauthNote = detectedGame === "poe2";

  return (
    <div
      className="rounded border px-3 py-2 space-y-1.5"
      style={{
        background: "linear-gradient(180deg, rgba(28,24,40,0.95) 0%, rgba(16,14,22,0.95) 100%)",
        borderColor: "var(--border-gold)",
      }}
    >
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Live Session
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={detectedGame === "poe2" ? poe2Logo : poe1Logo}
            alt={detectedGame}
            className="h-3.5 shrink-0"
            style={{ opacity: 0.7 }}
          />
          <span className="text-xs font-bold truncate" style={{ color: "var(--accent)" }}>
            {characterName}
          </span>
          {characterLevel != null && (
            <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
              Lv.{characterLevel}
            </span>
          )}
          {characterClass && (
            <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
              {characterClass}
            </span>
          )}
        </div>
      </div>

      {!characterClass && !picking && (
        <button
          onClick={() => setPicking(true)}
          className="text-xs px-2 py-1 rounded hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
        >
          Set class…
        </button>
      )}

      {picking && (
        <div className="flex flex-wrap gap-1">
          {classOptions.map((cls) => (
            <button
              key={cls}
              onClick={() => pickClass(cls)}
              className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            >
              {cls}
            </button>
          ))}
          <button
            onClick={() => setPicking(false)}
            className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            ✕
          </button>
        </div>
      )}

      {characterClass && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={setAsActiveBuild}
            className="text-xs px-2 py-1 rounded hover:opacity-80"
            style={{
              background: isActiveBuild ? "rgba(180,140,60,0.2)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${isActiveBuild ? "var(--border-gold)" : "var(--border-color)"}`,
              color: isActiveBuild ? "var(--accent)" : "var(--text-primary)",
            }}
          >
            {isActiveBuild ? "Active build ✓" : "Set as active build"}
          </button>
          {detectedGame === "poe2" && (
            <button
              onClick={() => useGearCaptureStore.getState().start(detectedGame)}
              className="text-xs px-2 py-1 rounded hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              title="Open inventory in PoE and Ctrl+C each equipped piece"
            >
              Capture gear
            </button>
          )}
          {isActiveBuild && activeBuildGear && activeBuildGear.length > 0 && (
            <button
              onClick={analyzeCapturedBuild}
              disabled={analyzing}
              className="text-xs px-2 py-1 rounded hover:opacity-80 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-gold)", color: "var(--accent)" }}
              title="Send build + gear to Claude (Witch persona) for analysis"
            >
              {analyzing ? "Analyzing…" : "Analyze build"}
            </button>
          )}
          <button
            onClick={() => setPicking(true)}
            className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
            title="Change class"
          >
            ↻
          </button>
        </div>
      )}

      {/* Build goal editor — same component the GGG flow uses, keyed on
          the active build's character name so the goal persists alongside
          the saved build. */}
      {isActiveBuild && characterName && (
        <BuildGoalEditor characterName={characterName} />
      )}

      {analyzeError && (
        <div className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,68,68,0.08)", color: "#ff6666", fontSize: "0.65rem" }}>
          {analyzeError}
        </div>
      )}

      {analysis && (
        <BuildAnalysisCard
          analysis={analysis}
          onClose={() => setAnalysis(null)}
        />
      )}

      {/* Captured-build gear viewer: shown when this character is the
          active build AND that build has structured gear data. Falls
          back to the gearSummary text for legacy builds saved before
          structured gear existed. */}
      {isActiveBuild && (
        (activeBuildGear && activeBuildGear.length > 0) ||
        (activeBuildGearSummary && !activeBuildGearSummary.startsWith("(no gear data"))
      ) && (
        <div className="pt-1">
          <button
            onClick={() => setGearOpen((v) => !v)}
            className="text-xs px-2 py-0.5 rounded hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              fontSize: "0.65rem",
            }}
          >
            {gearOpen ? "▾" : "▸"} Gear ({activeBuildGear?.length ?? activeBuildGearSummary?.split("\n").filter((l) => l.startsWith("[")).length ?? 0} items
            {activeBuildKeyItems.length > 0 ? `, ${activeBuildKeyItems.length} unique${activeBuildKeyItems.length === 1 ? "" : "s"}` : ""})
          </button>
          {gearOpen && (
            <div className="mt-1 space-y-0.5">
              {sortedActiveGear && sortedActiveGear.length > 0 ? (
                sortedActiveGear.map((item, i) => (
                  <ItemCard key={`${item.inventory_id}-${i}`} item={item} />
                ))
              ) : (
                <pre
                  className="text-xs rounded p-2 whitespace-pre-wrap"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-secondary)",
                    fontSize: "0.65rem",
                    lineHeight: 1.35,
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {activeBuildGearSummary}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {showOauthNote && (
        <div className="text-xs pt-1" style={{ color: "var(--text-secondary)", fontSize: "0.65rem", lineHeight: 1.3 }}>
          PoE2 character data requires GGG OAuth (developer application pending).
          {!activeBuildGearSummary || activeBuildGearSummary.startsWith("(no gear data") ? (
            <> Live-detected from Client.txt — no gear data captured yet. Use Capture gear above to record your kit.</>
          ) : (
            <> Live-detected from Client.txt — gear captured via clipboard (expand above to view).</>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Active gear-capture session UI. Drives via the gear-capture store: shows
 * a slot checklist that fills as the user Ctrl+Cs items in PoE, with Done
 * flushing to the active build (gear summary + inferred build tags + uniques
 * as keyItems — same shape as a GGG-fetched character).
 */
function BuildCapturePanel() {
  const active = useGearCaptureStore((s) => s.active);
  const items = useGearCaptureStore((s) => s.items);
  const lastSlot = useGearCaptureStore((s) => s.lastSlot);
  const sessionGame = useGearCaptureStore((s) => s.game);
  const characterName = useOverlayStore((s) => s.characterName);
  const characterClass = useOverlayStore((s) => s.characterClass);
  const [expandedSlot, setExpandedSlot] = useState<CaptureSlot | null>(null);

  if (!active) return null;

  const filledCount = (Object.keys(items) as CaptureSlot[]).filter((k) => items[k]).length;
  const total = CAPTURE_SLOTS.length;

  const onSave = async () => {
    // Validate BEFORE finish() — finish() resets the capture store, so if we
    // bail out after that the captured items are lost. Class is required
    // because ActiveBuild has it as a non-optional field.
    if (!characterName || !characterClass) {
      console.warn(
        "[ExiledOrb] Capture cannot save — characterName/class missing.",
        "Name:", characterName, "Class:", characterClass,
        "Set class on the Live Session tile first; capture state preserved.",
      );
      return;
    }

    const result = useGearCaptureStore.getState().finish();
    const captured = result.items;
    const game = result.game ?? "poe1";

    const entries = (Object.entries(captured) as [CaptureSlot, ParsedItem | undefined][])
      .filter((entry): entry is [CaptureSlot, ParsedItem] => Boolean(entry[1]));

    const resolvedLevel =
      resolveCharacterLevel(characterName, game)
      ?? useBuildStore.getState().activeBuild?.level
      ?? 1;

    console.log(
      `[ExiledOrb] Saving captured build: ${characterName} (${characterClass}, ${game}, lv${resolvedLevel}) — ${entries.length} items, all tagged as ${game}:`,
      entries.map(([slot, item]) => ({ slot, name: item.name || item.baseType, game: item.game })),
    );

    const allMods = entries.flatMap(([, item]) =>
      [...item.implicits, ...item.explicits].map((m) => m.text),
    );
    const tags = inferBuildTags(allMods);

    const gearSummary = entries
      .map(([slot, item]) => {
        const head = `[${slot}] ${item.name || item.baseType} (${item.rarity}${item.corrupted ? ", corrupted" : ""})`;
        const modLines = [
          ...item.implicits.map((m) => `  (implicit) ${m.text}`),
          ...item.explicits.map((m) => `  ${m.text}`),
        ];
        return modLines.length > 0 ? `${head}\n${modLines.join("\n")}` : head;
      })
      .join("\n");

    const keyItems = entries
      .filter(([, item]) => item.rarity === "Unique")
      .map(([, item]) => item.name || item.baseType);

    // Convert each captured ParsedItem to BuildItem so the GGG-side
    // ItemCard renders it identically. Captured items have no icon URL
    // (we only have clipboard text) and no parsed socket structure for
    // V1 — those degrade gracefully in ItemCard.
    const gear: BuildItem[] = entries.map(([slot, item]) => ({
      name: item.name ?? "",
      base_type: item.baseType,
      inventory_id: slot,
      icon: "",
      rarity: item.rarity,
      socket_count: null,
      max_links: item.links,
      socket_details: [],
      ilvl: item.itemLevel,
      corrupted: item.corrupted,
      mods: [
        ...item.implicits.map((m) => `(implicit) ${m.text}`),
        ...item.explicits.map((m) => m.text),
      ],
    }));

    const existingGoal = useBuildStore.getState().activeBuild?.characterName === characterName
      ? useBuildStore.getState().activeBuild?.goal ?? null
      : null;

    try {
      await useBuildStore.getState().setActiveBuild({
        characterName,
        characterClass,
        level: resolvedLevel,
        game,
        league: "Standard",
        damageTypes: tags.damageTypes,
        defenseTypes: tags.defenseTypes,
        recoveryTypes: tags.recoveryTypes,
        mainSkill: tags.mainSkill,
        keyItems,
        gearSummary,
        gear,
        goal: existingGoal,
        updatedAt: Date.now(),
      });
      console.log(
        `[ExiledOrb] Build saved OK: ${characterName} (${characterClass}, ${game}, lv${resolvedLevel}) — ${entries.length} gear items, ${keyItems.length} unique(s), tags: dmg=${tags.damageTypes.join("/")} def=${tags.defenseTypes.join("/")} rec=${tags.recoveryTypes.join("/")}`,
      );
    } catch (err) {
      console.error("[ExiledOrb] Build save FAILED:", err);
    }
  };

  const onCancel = () => useGearCaptureStore.getState().cancel();

  const canSave = filledCount > 0 && !!characterName && !!characterClass;

  return (
    <div
      className="rounded border px-3 py-2 space-y-2"
      style={{
        background: "linear-gradient(180deg, rgba(40,30,20,0.95) 0%, rgba(20,16,12,0.95) 100%)",
        borderColor: "var(--border-gold)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
          Capturing Gear {sessionGame ? `(${sessionGame.toUpperCase()})` : ""}
        </div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {filledCount} / {total}
        </div>
      </div>

      <div className="text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.3 }}>
        Open your inventory in PoE and press Ctrl+C on each equipped piece.
        Items route to slots automatically. Re-copy any piece to overwrite.
      </div>

      <div className="grid grid-cols-2 gap-1">
        {CAPTURE_SLOTS.map((slot) => {
          const item = items[slot];
          const isLast = lastSlot === slot;
          const isExpanded = expandedSlot === slot;
          const modCount = item ? item.implicits.length + item.explicits.length : 0;
          return (
            <div
              key={slot}
              className="rounded px-2 py-1"
              style={{
                background: item ? "rgba(180,140,60,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isLast ? "var(--border-gold)" : "var(--border-color)"}`,
                cursor: item ? "pointer" : "default",
                gridColumn: isExpanded ? "1 / -1" : undefined,
              }}
              onClick={() => item && setExpandedSlot(isExpanded ? null : slot)}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs shrink-0 w-12" style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>
                  {SLOT_LABELS[slot]}
                </span>
                {item ? (
                  <>
                    <span className="text-xs truncate flex-1" style={{ color: item.rarity === "Unique" ? "#af6025" : item.rarity === "Rare" ? "#ffff77" : "var(--text-primary)", fontSize: "0.7rem" }} title={item.name || item.baseType}>
                      {item.name || item.baseType}
                    </span>
                    {modCount > 0 && (
                      <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}>
                        {isExpanded ? "▾" : "▸"} {modCount} mod{modCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>—</span>
                )}
              </div>
              {item && isExpanded && (
                <div className="mt-1 pl-12 space-y-0.5">
                  {item.implicits.map((m, i) => (
                    <div key={`i-${i}`} className="text-xs" style={{ color: "#8888cc", fontSize: "0.65rem" }}>
                      {m.text}
                    </div>
                  ))}
                  {item.explicits.map((m, i) => (
                    <div key={`e-${i}`} className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>
                      {m.text}
                    </div>
                  ))}
                  {item.implicits.length === 0 && item.explicits.length === 0 && (
                    <div className="text-xs italic" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}>(no mods parsed)</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="text-xs px-2 py-1 rounded hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "rgba(180,140,60,0.2)", border: "1px solid var(--border-gold)", color: "var(--accent)" }}
        >
          Save Build ({filledCount})
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-2 py-1 rounded hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        {!characterClass && (
          <span className="text-xs" style={{ color: "var(--danger-deadly)", fontSize: "0.65rem" }}>
            Set class on the Live Session tile to enable Save.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only tile for a character mined from local Client.txt history.
 * Shows name + class + max-level. Lets the user mark it as the active build
 * (with empty gear — Capture or Live Session is needed for gear data).
 */
function DetectedCharacterTile({
  char,
  onRemove,
  onDelete,
}: {
  char: DetectedCharacter;
  onRemove?: () => void;
  onDelete?: () => void;
}) {
  const activeBuildName = useBuildStore((s) => s.activeBuild?.characterName);
  const activeBuildGearCount = useBuildStore((s) => s.activeBuild?.gear?.length ?? 0);
  const isActive = activeBuildName === char.name;
  const isActiveWithGear = isActive && activeBuildGearCount > 0;

  const setAsActive = async () => {
    if (!char.class) return;
    const existingGoal = useBuildStore.getState().activeBuild?.characterName === char.name
      ? useBuildStore.getState().activeBuild?.goal ?? null
      : null;
    await useBuildStore.getState().setActiveBuild({
      characterName: char.name,
      characterClass: char.class,
      level: char.level,
      game: (char.game as "poe1" | "poe2"),
      league: "Standard",
      damageTypes: [],
      defenseTypes: [],
      recoveryTypes: [],
      mainSkill: null,
      keyItems: [],
      gearSummary: "(no gear data — log-mined character)",
      goal: existingGoal,
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      className="rounded border px-3 py-2"
      style={{
        background: isActive
          ? "linear-gradient(180deg, rgba(30,30,36,0.95) 0%, rgba(18,18,22,0.95) 100%)"
          : "linear-gradient(180deg, rgba(20,20,24,0.85) 0%, rgba(12,12,16,0.85) 100%)",
        borderColor: isActive ? "var(--border-gold)" : "var(--border-color)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold truncate" style={{ color: isActive ? "var(--accent)" : "var(--text-primary)" }}>
            {char.name}
          </span>
          <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
            Lv.{char.level}
          </span>
          {char.class && (
            <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
              {char.class}
            </span>
          )}
          {char.deaths > 0 && (
            <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }} title={`${char.deaths} death${char.deaths === 1 ? "" : "s"} in log`}>
              ☠ {char.deaths}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {char.last_seen && (
            <span className="text-xs" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }} title="Most recent log line">
              {char.last_seen.slice(0, 10)}
            </span>
          )}
          {char.class && (
            <button
              onClick={setAsActive}
              className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
              style={{
                background: isActive ? "rgba(180,140,60,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${isActive ? "var(--border-gold)" : "var(--border-color)"}`,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "0.6rem",
              }}
            >
              {isActive ? "active" : "set active"}
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
              style={{ background: "transparent", color: "var(--text-secondary)", fontSize: "0.7rem" }}
              title="Hide this character from the list (can be restored from the hidden manager below)"
            >
              ✕
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
              style={{ background: "transparent", color: "#ff6666", fontSize: "0.7rem" }}
              title="Permanently delete (filtered out of all future scans — not reversible from UI)"
            >
              🗑
            </button>
          )}
        </div>
      </div>
      <div className="text-xs pt-0.5" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}>
        {isActiveWithGear
          ? `Active build · ${activeBuildGearCount} gear items captured (see Live Session above)`
          : "From local log history — no gear data. Use Capture (live session) for gear."}
      </div>
    </div>
  );
}
