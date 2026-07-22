import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DetectedCharacter } from "@exiled-orb/shared";
import { useOverlayStore } from "../../stores/overlay-store";
import { useBuildStore, inferBuildTags, type BuildItem } from "../../stores/build-store";
import { getApiKey, getStore, persistToStore } from "../../utils/store";
import { sortBySlot } from "../../utils/slots";
import poe1Logo from "../../assets/poe1-logo.png";
import poe2Logo from "../../assets/poe2-logo.png";
import { Btn, Panel, SectionTitle } from "../ui";
import {
  detectedKey,
  DISMISSED_DETECTED_KEY,
  HIDDEN_DETECTED_KEY,
  type GggCharacter,
} from "./constants";
import { loadCharacterHistory } from "./character-history";
import { runBuildAnalysis, saveActiveBuild, type BuildAnalysis } from "./build-actions";
import ApiKeyInline from "./ApiKeyInline";
import BuildCapturePanel from "./BuildCapturePanel";
import DetectedCharacterTile, { HiddenCharsManager } from "./DetectedCharacterTile";
import GggCharacterRow from "./GggCharacterRow";
import LiveSessionTile from "./LiveSessionTile";

export default function GggAccount() {
  // null = haven't checked yet, true = connected, false = not connected
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [characters, setCharacters] = useState<GggCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const [charItems, setCharItems] = useState<Record<string, BuildItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);
  const [buildAnalysis, setBuildAnalysis] = useState<Record<string, BuildAnalysis>>({});
  const [analyzingBuild, setAnalyzingBuild] = useState<string | null>(null);
  const [detectedChars, setDetectedChars] = useState<DetectedCharacter[]>([]);
  const [scanningHistory, setScanningHistory] = useState(false);
  const [hiddenChars, setHiddenChars] = useState<string[]>([]);
  const [dismissedChars, setDismissedChars] = useState<string[]>([]);
  const [showHiddenList, setShowHiddenList] = useState(false);

  const refreshHistory = async (force = false) => {
    setScanningHistory(true);
    try {
      setDetectedChars(await loadCharacterHistory(force));
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
    refreshHistory();
    getStore()
      .then(async (s) => {
        const hidden = await s.get<string[]>(HIDDEN_DETECTED_KEY);
        if (Array.isArray(hidden)) setHiddenChars(hidden);
        const dismissed = await s.get<string[]>(DISMISSED_DETECTED_KEY);
        if (Array.isArray(dismissed)) setDismissedChars(dismissed);
      })
      .catch(() => {});
  }, []);

  const hideDetectedChar = (char: DetectedCharacter) => {
    const key = detectedKey(char.game, char.name);
    const next = hiddenChars.includes(key) ? hiddenChars : [...hiddenChars, key];
    setHiddenChars(next);
    void persistToStore(HIDDEN_DETECTED_KEY, next);
  };

  const restoreHidden = () => {
    setHiddenChars([]);
    void persistToStore(HIDDEN_DETECTED_KEY, []);
  };

  const restoreOneHidden = (char: DetectedCharacter) => {
    const key = detectedKey(char.game, char.name);
    const next = hiddenChars.filter((k) => k !== key);
    setHiddenChars(next);
    void persistToStore(HIDDEN_DETECTED_KEY, next);
  };

  /**
   * Permanently dismiss a character — removes from hidden if present and
   * adds to the dismissed list. Dismissed entries are filtered OUT of scan
   * results entirely. Not reversible from the UI.
   */
  const dismissDetectedChar = (char: DetectedCharacter) => {
    const key = detectedKey(char.game, char.name);
    const nextHidden = hiddenChars.filter((k) => k !== key);
    const nextDismissed = dismissedChars.includes(key)
      ? dismissedChars
      : [...dismissedChars, key];
    setHiddenChars(nextHidden);
    setDismissedChars(nextDismissed);
    void persistToStore(HIDDEN_DETECTED_KEY, nextHidden);
    void persistToStore(DISMISSED_DETECTED_KEY, nextDismissed);
  };

  /** Bulk dismiss every currently-hidden character. */
  const dismissAllHidden = () => {
    if (hiddenChars.length === 0) return;
    const merged = Array.from(new Set([...dismissedChars, ...hiddenChars]));
    setHiddenChars([]);
    setDismissedChars(merged);
    void persistToStore(HIDDEN_DETECTED_KEY, []);
    void persistToStore(DISMISSED_DETECTED_KEY, merged);
  };

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

  const loadItems = async (charName: string, force = false): Promise<BuildItem[]> => {
    if (charItems[charName] && !force) return charItems[charName];
    const char = characters.find((c) => c.name === charName);
    const game = char?.game ?? "poe1";
    setItemsLoading(charName);
    let items: BuildItem[] = [];
    try {
      items = await invoke<BuildItem[]>("fetch_character_items", { character: charName, game });
      setCharItems((prev) => ({ ...prev, [charName]: items }));
    } catch (err) {
      console.error("[ExiledOrb] loadItems failed:", err);
      setError(`Failed to load gear: ${err}`);
    }
    setItemsLoading(null);
    return items;
  };

  const toggleChar = (name: string) => {
    if (expandedChar === name) {
      setExpandedChar(null);
    } else {
      setExpandedChar(name);
      loadItems(name);
    }
  };

  const setAsActiveBuild = async (char: GggCharacter) => {
    const items = charItems[char.name] ?? await loadItems(char.name);

    // Infer build tags from all gear mods
    const tags = inferBuildTags(items.flatMap((i) => i.mods));
    const gearSummary = items
      .map((i) => `[${i.inventory_id}] ${i.name || i.base_type} (${i.rarity})`)
      .join("\n");

    await saveActiveBuild({
      characterName: char.name,
      characterClass: char.class,
      level: char.level,
      game: char.game as "poe1" | "poe2",
      league: char.league || "Standard",
      tags,
      keyItems: items.filter((i) => i.rarity === "Unique").map((i) => i.name || i.base_type),
      gearSummary,
      gear: items,
    });

    // Also update overlay store
    useOverlayStore.getState().setCharacterClass(char.class);
    useOverlayStore.getState().setCharacterName(char.name);
  };

  const analyzeBuild = async (char: GggCharacter) => {
    setError(null);

    const items = charItems[char.name] ?? await loadItems(char.name);
    if (items.length === 0) {
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
      const goal = useBuildStore.getState().savedBuilds.find((b) => b.characterName === char.name)?.goal;
      const analysis = await runBuildAnalysis({
        apiKey,
        name: char.name,
        characterClass: char.class,
        level: char.level,
        league: char.league,
        game: char.game,
        goal,
        items,
      });
      setBuildAnalysis((prev) => ({ ...prev, [char.name]: analysis }));
    } catch (err) {
      setError(`AI call failed: ${err}`);
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

  // Match active character from Client.txt to a GGG character for its class.
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
    const result: Record<string, BuildItem[]> = {};
    for (const [name, items] of Object.entries(charItems)) {
      result[name] = sortBySlot(items);
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
        hiddenSection: detectedAll.filter((d) => hiddenChars.includes(detectedKey(d.game, d.name))),
        totalCount: sectionChars.length + detectedSection.length,
      };
    });
  }, [detectedGame, characters, detectedChars, hiddenChars, dismissedChars]);

  if (isAuthed === false) {
    return (
      <div className="space-y-2">
        <BuildCapturePanel />
        <LiveSessionTile gggCharacters={[]} />
        <Panel className="px-3 py-3 space-y-2">
          <SectionTitle>GGG Account</SectionTitle>
          <div className="text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
            Connect to GGG via OAuth to load your PoE1 and PoE2 characters with
            gear. A browser window will open for you to sign in. Tokens are
            stored locally on your machine; no data is sent anywhere else.
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <Btn variant="gold" size="action" className="w-full" onClick={connect} disabled={loading}>
            {loading ? "Waiting for browser sign-in…" : "Connect with GGG"}
          </Btn>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Account header */}
      <Panel gold className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>Connected to GGG</div>
          <div className="flex gap-1">
            <Btn onClick={() => loadCharacters()} title="Refresh characters">↻</Btn>
            <Btn onClick={disconnect} title="Disconnect (deletes local tokens)">✕</Btn>
          </div>
        </div>
      </Panel>

      <ApiKeyInline />

      {loading && <div className="text-xs text-center py-2" style={{ color: "var(--text-secondary)" }}>Loading...</div>}
      {error && <div className="text-xs text-red-400 px-2">{error}</div>}

      <BuildCapturePanel />
      <LiveSessionTile gggCharacters={characters} />

      {/* Character list — grouped by game, active game first. Log-mined
          (detected) characters are only surfaced under the PoE2 section;
          the live-session character intentionally also shows here so the
          section view is the canonical character list. */}
      {sections.map(({ sectionGame, sectionChars, detectedSection, hiddenSection, totalCount }) => {
        if (totalCount === 0 && hiddenSection.length === 0 && sectionGame === "poe1") return null;
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
                <Btn className="ml-auto" style={{ background: "rgba(255,255,255,0.04)", fontSize: "0.6rem" }}
                  onClick={() => refreshHistory(true)} disabled={scanningHistory}
                  title="Re-scan PoE2 Client.txt for character history">
                  {scanningHistory ? "…" : "↻ history"}
                </Btn>
              )}
            </div>

            {sectionChars.length === 0 && detectedSection.length === 0 && sectionGame === "poe2" && (
              <Panel bg="faint" dashed className="text-xs px-2 py-1.5"
                style={{ color: "var(--text-secondary)", fontSize: "0.65rem", lineHeight: 1.3 }}>
                No PoE2 characters found — connect with GGG OAuth above, or play
                a PoE2 character and re-scan the local Client.txt history. See
                also the Live Session tile above.
              </Panel>
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

            {hiddenSection.length > 0 && sectionGame === "poe2" && (
              <HiddenCharsManager
                hidden={hiddenSection}
                open={showHiddenList}
                onToggleOpen={() => setShowHiddenList((v) => !v)}
                onRestoreOne={restoreOneHidden}
                onDismissOne={dismissDetectedChar}
                onRestoreAll={restoreHidden}
                onDismissAll={dismissAllHidden}
              />
            )}

            {sectionChars.map((char, idx) => (
              <GggCharacterRow
                key={`${char.name}-${char.game}-${idx}`}
                char={char}
                expanded={expandedChar === char.name}
                onToggle={() => toggleChar(char.name)}
                items={sortedCharItems[char.name]}
                itemsLoading={itemsLoading === char.name}
                analyzing={analyzingBuild === char.name}
                analysis={buildAnalysis[char.name]}
                onSetActive={() => setAsActiveBuild(char)}
                onRefresh={() => loadItems(char.name, true)}
                onAnalyze={() => analyzeBuild(char)}
                onCloseAnalysis={() => setBuildAnalysis((prev) => {
                  const copy = { ...prev };
                  delete copy[char.name];
                  return copy;
                })}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
