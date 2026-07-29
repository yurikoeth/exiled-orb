import { useState, useEffect, useRef } from "react";
import { useLevelingTracker } from "../hooks/useLevelingTracker";
import { useOverlayStore } from "../stores/overlay-store";
import { useBuildStore } from "../stores/build-store";
import { getLevelingGuide } from "@exiled-orb/shared";
import type { LevelingStep } from "@exiled-orb/shared";
import { getStore, persistToStore } from "../utils/store";
import poe1Logo from "../assets/poe1-logo.png";
import poe2Logo from "../assets/poe2-logo.png";

/** Load checked steps for a character from store */
async function loadChecked(charName: string): Promise<Set<string>> {
  try {
    const store = await getStore();
    const data = await store.get<string[]>(`checklist_${charName}`);
    return new Set(data ?? []);
  } catch {
    return new Set();
  }
}

/** Save checked steps for a character to store */
async function saveChecked(charName: string, checked: Set<string>) {
  await persistToStore(`checklist_${charName}`, [...checked]);
}

export default function LevelingGuide() {
  const { currentStep } = useLevelingTracker();
  const [selectedGame, setSelectedGame] = useState<"poe1" | "poe2">("poe1");
  const guide = getLevelingGuide(selectedGame);
  const [selectedAct, setSelectedAct] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const activeChar = useBuildStore((s) => s.activeBuild?.characterName) ?? null;
  const activeRef = useRef<HTMLDivElement>(null);

  // Load checklist when active character changes
  useEffect(() => {
    if (activeChar) {
      loadChecked(activeChar).then(setChecked);
    } else {
      setChecked(new Set());
    }
  }, [activeChar]);

  const toggleCheck = (stepKey: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(stepKey)) next.delete(stepKey);
      else next.add(stepKey);
      if (activeChar) saveChecked(activeChar, next);
      return next;
    });
  };

  // Get unique acts
  const acts = [...new Set(guide.steps.map((s) => s.act))];

  const toRoman = (n: number): string => {
    const numerals: [number, string][] = [
      [10, "X"],
      [9, "IX"],
      [8, "VIII"],
      [7, "VII"],
      [6, "VI"],
      [5, "V"],
      [4, "IV"],
      [3, "III"],
      [2, "II"],
      [1, "I"],
    ];
    for (const [val, sym] of numerals) {
      if (n >= val) return sym + (n > val ? toRoman(n - val) : "");
    }
    return "";
  };

  // Auto-select act based on current zone
  useEffect(() => {
    if (currentStep && selectedAct === null) {
      setSelectedAct(currentStep.act);
    }
  }, [currentStep, selectedAct]);

  // Default to act 1 if nothing selected
  const displayAct = selectedAct ?? acts[0] ?? 1;
  const actSteps = guide.steps.filter((s) => s.act === displayAct);

  // Only show active highlight if selected game matches the detected game
  const detectedGame = useOverlayStore((s) => s.detectedGame);
  const activeStepZone = selectedGame === detectedGame || !detectedGame ? currentStep?.zone : null;

  // Scroll to active step
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentStep, displayAct]);

  return (
    <div className="space-y-2">
      {/* Game toggle */}
      <div className="flex gap-1">
        {(["poe1", "poe2"] as const).map((g) => (
          <button
            key={g}
            onClick={() => {
              setSelectedGame(g);
              setSelectedAct(null);
            }}
            className="flex-1 py-1.5 rounded flex items-center justify-center transition-all"
            style={{
              background: selectedGame === g ? "rgba(255,255,255,0.08)" : "transparent",
              border:
                selectedGame === g
                  ? "1px solid var(--border-gold)"
                  : "1px solid var(--border-color)",
              opacity: selectedGame === g ? 1 : 0.4,
            }}
          >
            <img src={g === "poe1" ? poe1Logo : poe2Logo} alt={g} className="h-4" />
          </button>
        ))}
      </div>

      {/* Act selector */}
      <div className="flex gap-0.5 flex-wrap">
        {acts.map((act) => (
          <button
            key={act}
            onClick={() => setSelectedAct(act)}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: displayAct === act ? "rgba(255,255,255,0.08)" : "transparent",
              border: displayAct === act ? "1px solid var(--border-gold)" : "1px solid transparent",
              color: displayAct === act ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: activeStepZone && currentStep?.act === act ? 700 : 400,
            }}
          >
            {toRoman(act)}
            {activeStepZone && currentStep?.act === act && " •"}
          </button>
        ))}
      </div>

      {/* Active character + progress */}
      {activeChar &&
        (() => {
          const gameStepKeys = guide.steps.map((s) => `${selectedGame}_${s.act}_${s.zone}`);
          const gameChecked = gameStepKeys.filter((k) => checked.has(k)).length;
          return (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                {activeChar}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {gameChecked}/{guide.steps.length} completed
              </span>
            </div>
          );
        })()}

      {/* Steps for selected act */}
      <div className="space-y-1">
        {actSteps.map((step, i) => {
          const stepKey = `${selectedGame}_${step.act}_${step.zone}`;
          return (
            <StepCard
              key={i}
              step={step}
              isActive={activeStepZone === step.zone}
              isChecked={checked.has(stepKey)}
              onToggleCheck={() => toggleCheck(stepKey)}
              hasActiveChar={!!activeChar}
              ref={activeStepZone === step.zone ? activeRef : null}
            />
          );
        })}
      </div>
    </div>
  );
}

import { forwardRef } from "react";

const StepCard = forwardRef<
  HTMLDivElement,
  {
    step: LevelingStep;
    isActive: boolean;
    isChecked: boolean;
    onToggleCheck: () => void;
    hasActiveChar: boolean;
  }
>(({ step, isActive, isChecked, onToggleCheck, hasActiveChar }, ref) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      ref={ref}
      className="rounded border px-3 py-1.5 cursor-pointer hover:opacity-90 transition-opacity"
      style={{
        background: isActive
          ? "linear-gradient(180deg, rgba(40,40,48,0.95) 0%, rgba(20,20,26,0.95) 100%)"
          : "linear-gradient(180deg, rgba(24,24,28,0.9) 0%, rgba(14,14,18,0.9) 100%)",
        borderColor: isActive ? "var(--border-gold)" : "var(--border-color)",
        borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
        opacity: isChecked ? 0.5 : 1,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Zone + checkbox + level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasActiveChar && (
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                onToggleCheck();
              }}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
              style={{ accentColor: "var(--accent)" }}
            />
          )}
          <span
            className="text-xs font-bold"
            style={{
              color: isActive ? "var(--accent)" : "var(--text-primary)",
              textDecoration: isChecked ? "line-through" : "none",
            }}
          >
            {step.zone}
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Lv.{step.recommendedLevel}
        </span>
      </div>

      {/* Objective */}
      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
        {step.objective}
      </div>

      {/* Expanded details */}
      {(expanded || isActive) && (
        <div
          className="mt-1 pt-1 border-t space-y-0.5"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {step.gemPickups.length > 0 && (
            <div className="text-xs">
              <span style={{ color: "#1ba29b" }} className="font-bold">
                Gems:{" "}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>{step.gemPickups.join(", ")}</span>
            </div>
          )}
          {step.skillPoints > 0 && (
            <div className="text-xs" style={{ color: "#ffd700" }}>
              +{step.skillPoints} passive point{step.skillPoints > 1 ? "s" : ""}
            </div>
          )}
          {step.tips.map((tip, i) => (
            <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              • {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
