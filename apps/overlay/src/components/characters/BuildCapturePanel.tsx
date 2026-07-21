import { useState } from "react";
import type { ParsedItem } from "@exiled-orb/shared";
import { inferBuildTags, useBuildStore, type BuildItem } from "../../stores/build-store";
import { useGearCaptureStore } from "../../stores/gear-capture-store";
import { useOverlayStore } from "../../stores/overlay-store";
import { CAPTURE_SLOTS, SLOT_LABELS, type CaptureSlot } from "../../utils/slots";
import { Btn, Panel, SectionTitle } from "../ui";
import { resolveCharacterLevel } from "./character-history";
import { saveActiveBuild } from "./build-actions";

/**
 * Active gear-capture session UI. Drives via the gear-capture store: shows
 * a slot checklist that fills as the user Ctrl+Cs items in PoE, with Done
 * flushing to the active build (gear summary + inferred build tags + uniques
 * as keyItems — same shape as a GGG-fetched character).
 */
export default function BuildCapturePanel() {
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
      `[ExiledOrb] Saving captured build: ${characterName} (${characterClass}, ${game}, lv${resolvedLevel}) — ${entries.length} items`,
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

    try {
      await saveActiveBuild({
        characterName,
        characterClass,
        level: resolvedLevel,
        game,
        tags,
        keyItems,
        gearSummary,
        gear,
      });
      console.log(
        `[ExiledOrb] Build saved OK: ${characterName} (${characterClass}, ${game}, lv${resolvedLevel}) — ${entries.length} gear items, ${keyItems.length} unique(s)`,
      );
    } catch (err) {
      console.error("[ExiledOrb] Build save FAILED:", err);
    }
  };

  const onCancel = () => useGearCaptureStore.getState().cancel();

  const canSave = filledCount > 0 && !!characterName && !!characterClass;

  return (
    <Panel bg="amber" gold className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>
          Capturing Gear {sessionGame ? `(${sessionGame.toUpperCase()})` : ""}
        </SectionTitle>
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
        <Btn variant="gold" active size="sm" onClick={onSave} disabled={!canSave}
          className="disabled:opacity-40 disabled:cursor-not-allowed">
          Save Build ({filledCount})
        </Btn>
        <Btn size="sm" onClick={onCancel}>Cancel</Btn>
        {!characterClass && (
          <span className="text-xs" style={{ color: "var(--danger-deadly)", fontSize: "0.65rem" }}>
            Set class on the Live Session tile to enable Save.
          </span>
        )}
      </div>
    </Panel>
  );
}
