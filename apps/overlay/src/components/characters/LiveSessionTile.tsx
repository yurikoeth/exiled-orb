import { useState, useEffect, useMemo } from "react";
import { useOverlayStore } from "../../stores/overlay-store";
import { useBuildStore } from "../../stores/build-store";
import { useGearCaptureStore } from "../../stores/gear-capture-store";
import { getStore, getApiKey, persistToStore } from "../../utils/store";
import { sortBySlot } from "../../utils/slots";
import poe1Logo from "../../assets/poe1-logo.png";
import poe2Logo from "../../assets/poe2-logo.png";
import { Btn, Panel, SectionTitle } from "../ui";
import { LIVE_CLASS_STORE_KEY, POE1_CLASSES, POE2_CLASSES, type GggCharacter } from "./constants";
import { resolveCharacterLevel } from "./character-history";
import { runBuildAnalysis, saveActiveBuild, type BuildAnalysis } from "./build-actions";
import BuildAnalysisCard from "./BuildAnalysisCard";
import BuildGoalEditor from "./BuildGoalEditor";
import ItemCard from "./ItemCard";

/**
 * Surfaces the Client.txt-detected character as a tile when GGG's API can't
 * provide it (notably PoE2 before OAuth is connected). Lets the user pick a
 * class manually; persists the choice keyed by name+game.
 */
export default function LiveSessionTile({ gggCharacters }: { gggCharacters: GggCharacter[] }) {
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
    () => (activeBuildGear ? sortBySlot(activeBuildGear) : null),
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
  // existing tile covers it — skip to avoid duplication. PoE2 shows here
  // until the OAuth-fetched list includes it.
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
    await persistToStore(LIVE_CLASS_STORE_KEY, next);
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
      const parsed = await runBuildAnalysis({
        apiKey,
        name: ab.characterName,
        characterClass: ab.characterClass,
        level: ab.level,
        league: ab.league,
        game: ab.game,
        goal: ab.goal,
        items: activeBuildGear,
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
    await saveActiveBuild({
      characterName,
      characterClass,
      level: resolvedLevel,
      game: detectedGame,
      gearSummary: "(no gear data — GGG OAuth required)",
    });
  };

  const showOauthNote = detectedGame === "poe2";
  const hasGearSummary = activeBuildGearSummary && !activeBuildGearSummary.startsWith("(no gear data");

  return (
    <Panel bg="purple" gold className="px-3 py-2 space-y-1.5">
      <SectionTitle>Live Session</SectionTitle>

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
        <Btn variant="outline" size="sm" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setPicking(true)}>
          Set class…
        </Btn>
      )}

      {picking && (
        <div className="flex flex-wrap gap-1">
          {classOptions.map((cls) => (
            <Btn key={cls} variant="outline" onClick={() => pickClass(cls)}>
              {cls}
            </Btn>
          ))}
          <Btn variant="text" onClick={() => setPicking(false)}>✕</Btn>
        </div>
      )}

      {characterClass && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Btn variant="gold" active={isActiveBuild} size="sm" onClick={setAsActiveBuild}
            style={isActiveBuild ? {} : { background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
            {isActiveBuild ? "Active build ✓" : "Set as active build"}
          </Btn>
          {detectedGame === "poe2" && (
            <Btn variant="outline" size="sm" style={{ background: "rgba(255,255,255,0.08)" }}
              onClick={() => useGearCaptureStore.getState().start(detectedGame)}
              title="Open inventory in PoE and Ctrl+C each equipped piece">
              Capture gear
            </Btn>
          )}
          {isActiveBuild && activeBuildGear && activeBuildGear.length > 0 && (
            <Btn variant="gold" size="sm" style={{ background: "rgba(255,255,255,0.06)" }}
              onClick={analyzeCapturedBuild} disabled={analyzing}
              title="Send build + gear to Claude (Witch persona) for analysis">
              {analyzing ? "Analyzing…" : "Analyze build"}
            </Btn>
          )}
          <Btn variant="text" onClick={() => setPicking(true)} title="Change class">↻</Btn>
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
        <BuildAnalysisCard analysis={analysis} onClose={() => setAnalysis(null)} />
      )}

      {/* Captured-build gear viewer: shown when this character is the
          active build AND that build has structured gear data. Falls
          back to the gearSummary text for legacy builds saved before
          structured gear existed. */}
      {isActiveBuild && ((activeBuildGear && activeBuildGear.length > 0) || hasGearSummary) && (
        <div className="pt-1">
          <Btn variant="outline" className="py-0.5"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", fontSize: "0.65rem" }}
            onClick={() => setGearOpen((v) => !v)}>
            {gearOpen ? "▾" : "▸"} Gear ({activeBuildGear?.length ?? activeBuildGearSummary?.split("\n").filter((l) => l.startsWith("[")).length ?? 0} items
            {activeBuildKeyItems.length > 0 ? `, ${activeBuildKeyItems.length} unique${activeBuildKeyItems.length === 1 ? "" : "s"}` : ""})
          </Btn>
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
          PoE2 character data requires GGG OAuth.
          {!hasGearSummary ? (
            <> Live-detected from Client.txt — no gear data captured yet. Use Capture gear above to record your kit.</>
          ) : (
            <> Live-detected from Client.txt — gear captured via clipboard (expand above to view).</>
          )}
        </div>
      )}
    </Panel>
  );
}
