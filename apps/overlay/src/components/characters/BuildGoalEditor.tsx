import { useState } from "react";
import { useBuildStore } from "../../stores/build-store";
import { Btn, Panel } from "../ui";

const FOCUS_OPTIONS = [
  "DPS",
  "Survivability",
  "Boss Killing",
  "Clear Speed",
  "Magic Find",
  "League Start",
  "Budget",
  "Min-Max",
];

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
} as const;

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 rounded text-xs"
        style={inputStyle}
      />
    </div>
  );
}

/** Collapsible editor for a character's build goal (name/focus/budget/notes). */
export default function BuildGoalEditor({ characterName }: { characterName: string }) {
  const savedBuild = useBuildStore((s) =>
    s.savedBuilds.find((b) => b.characterName === characterName)
  );
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
    setFocus((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <Panel bg="flat" gold={!!goal} className="px-2 py-1.5">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="text-xs"
          style={{ color: goal ? "var(--accent)" : "var(--text-secondary)" }}
        >
          {goal ? `Build: ${goal.buildName}` : "Set Build Goal"}
          {goal && goal.focus.length > 0 && (
            <span style={{ color: "var(--text-secondary)" }}> — {goal.focus.join(", ")}</span>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <Field
            label="Build Name"
            value={buildName}
            onChange={setBuildName}
            placeholder="e.g. RF Juggernaut, Lightning Arrow Deadeye"
          />

          <div>
            <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
              Focus
            </div>
            <div className="flex flex-wrap gap-1">
              {FOCUS_OPTIONS.map((f) => (
                <Btn
                  key={f}
                  variant="gold"
                  active={focus.includes(f)}
                  onClick={() => toggleFocus(f)}
                  style={
                    focus.includes(f)
                      ? { background: "rgba(255,255,255,0.12)" }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {f}
                </Btn>
              ))}
            </div>
          </div>

          <Field
            label="Budget"
            value={budget}
            onChange={setBudget}
            placeholder="e.g. 50 divine, 2000 chaos, unlimited"
          />
          <Field
            label="Notes"
            value={notes}
            onChange={setNotes}
            placeholder="e.g. need more chaos res, want to do ubers"
          />

          <Btn
            variant="gold"
            size="action"
            className="w-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
            onClick={save}
          >
            Save Goal
          </Btn>
        </div>
      )}
    </Panel>
  );
}
