import type { DetectedCharacter } from "@exiled-orb/shared";
import { useBuildStore } from "../../stores/build-store";
import { Btn, Panel } from "../ui";
import { saveActiveBuild } from "./build-actions";

/**
 * Read-only tile for a character mined from local Client.txt history.
 * Shows name + class + max-level. Lets the user mark it as the active build
 * (with empty gear — Capture or Live Session is needed for gear data).
 */
export default function DetectedCharacterTile({
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
    await saveActiveBuild({
      characterName: char.name,
      characterClass: char.class,
      level: char.level,
      game: char.game as "poe1" | "poe2",
      gearSummary: "(no gear data — log-mined character)",
    });
  };

  return (
    <Panel bg={isActive ? "raised" : "dim"} gold={isActive} className="px-3 py-2">
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
            <Btn variant="gold" active={isActive} onClick={setAsActive}
              style={{ fontSize: "0.6rem", ...(isActive ? {} : { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }) }}>
              {isActive ? "active" : "set active"}
            </Btn>
          )}
          {onRemove && (
            <Btn variant="text" onClick={onRemove} style={{ fontSize: "0.7rem" }}
              title="Hide this character from the list (can be restored from the hidden manager below)">
              ✕
            </Btn>
          )}
          {onDelete && (
            <Btn variant="text" onClick={onDelete} style={{ fontSize: "0.7rem", color: "#ff6666" }}
              title="Permanently delete (filtered out of all future scans — not reversible from UI)">
              🗑
            </Btn>
          )}
        </div>
      </div>
      <div className="text-xs pt-0.5" style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}>
        {isActiveWithGear
          ? `Active build · ${activeBuildGearCount} gear items captured (see Live Session above)`
          : "From local log history — no gear data. Use Capture (live session) for gear."}
      </div>
    </Panel>
  );
}

/**
 * Expandable manager for hidden (but not dismissed) log-mined characters:
 * restore/delete individually or in bulk.
 */
export function HiddenCharsManager({
  hidden,
  open,
  onToggleOpen,
  onRestoreOne,
  onDismissOne,
  onRestoreAll,
  onDismissAll,
}: {
  hidden: DetectedCharacter[];
  open: boolean;
  onToggleOpen: () => void;
  onRestoreOne: (char: DetectedCharacter) => void;
  onDismissOne: (char: DetectedCharacter) => void;
  onRestoreAll: () => void;
  onDismissAll: () => void;
}) {
  return (
    <div className="space-y-1">
      <Btn variant="text" size="sm" className="py-0.5" style={{ fontSize: "0.6rem" }} onClick={onToggleOpen}
        title={open ? "Collapse hidden list" : "Expand to manage individual hidden characters"}>
        {open ? "▾" : "▸"} {hidden.length} hidden
      </Btn>
      {open && (
        <Panel bg="faint" dashed className="space-y-0.5 px-2 py-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
          {hidden.map((d) => (
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
                <Btn variant="outline" style={{ background: "rgba(255,255,255,0.04)", fontSize: "0.6rem" }}
                  onClick={() => onRestoreOne(d)} title="Restore this character to the list">
                  ↺ restore
                </Btn>
                <Btn variant="danger" style={{ fontSize: "0.6rem" }} onClick={() => onDismissOne(d)}
                  title="Permanently delete (filtered out of all future scans — not reversible from UI)">
                  🗑 delete
                </Btn>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            <Btn className="flex-1 py-0.5" style={{ background: "rgba(255,255,255,0.04)", fontSize: "0.6rem" }}
              onClick={onRestoreAll} title="Restore every hidden character at once">
              ↺ Restore all
            </Btn>
            <Btn variant="danger" className="flex-1 py-0.5" style={{ border: "none", fontSize: "0.6rem" }}
              onClick={onDismissAll} title="Permanently delete all currently-hidden characters (not reversible from UI)">
              🗑 Delete all
            </Btn>
          </div>
        </Panel>
      )}
    </div>
  );
}
