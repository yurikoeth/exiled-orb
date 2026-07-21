import { useState } from "react";
import type { BuildItem, BuildSocket } from "../../stores/build-store";
import { SLOT_LABELS } from "../../utils/slots";
import { RARITY_COLORS } from "../ui";

const socketColors: Record<string, string> = {
  R: "#e44", G: "#4b4", B: "#66f", W: "#ddd", A: "#888",
};

const socketNames: Record<string, string> = {
  R: "Red", G: "Green", B: "Blue", W: "White",
};

function SocketDisplay({ sockets }: { sockets: BuildSocket[] }) {
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
              title={`${socketNames[s.color] ?? "White"} socket`}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders one equipped item — GGG-fetched or clipboard-captured (both are
 * BuildItem). Click to expand the mod list.
 */
export default function ItemCard({ item }: { item: BuildItem }) {
  const [showMods, setShowMods] = useState(false);
  const displayName = item.name || item.base_type;
  const subtitle = item.name ? item.base_type : null;
  const color = RARITY_COLORS[item.rarity] || "#c8c8c8";
  const slotLabel = SLOT_LABELS[item.inventory_id] || item.inventory_id;

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
